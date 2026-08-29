// @ts-nocheck
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import { NUTRI_GOAL_KEY } from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import { Calculator, Settings, Bell, RefreshCw, Zap, Scale, Check } from 'lucide-react';
import { hapticLight } from '@/hooks/useHaptic';

const MACRO_SPLITS = [
  { id: 'balanced', key: 'split_balanced', defaultLabel: '⚖️ 30/30/40 Balanced', p: 0.30, f: 0.30, c: 0.40 },
  { id: 'high_protein', key: 'split_high_protein', defaultLabel: '💪 35/25/40 High Protein', p: 0.35, f: 0.25, c: 0.40 },
  { id: 'low_carb', key: 'split_low_carb', defaultLabel: '🥩 30/45/25 Low Carb', p: 0.30, f: 0.45, c: 0.25 },
  { id: 'keto', key: 'split_keto', defaultLabel: '🥑 20/70/10 Keto', p: 0.20, f: 0.70, c: 0.10 },
];

const PRESETS = [
  { key: 'preset_cut',      defaultLabel: '🏃 Weight Loss',   calories: 1600, protein: 140, fat: 50,  carbs: 145, water_ml: 2200 },
  { key: 'preset_maintain', defaultLabel: '⚖️ Maintenance',   calories: 2000, protein: 150, fat: 65,  carbs: 205, water_ml: 2000 },
  { key: 'preset_bulk',     defaultLabel: '💪 Muscle Gain',   calories: 2600, protein: 195, fat: 80,  carbs: 275, water_ml: 2500 },
];

const ACTIVITY_LEVELS = [
  { key: 'sedentary',   i18nKey: 'act_sedentary',   mult: 1.2,   defaultLabel: '🪑 Sedentary (office / no workouts)' },
  { key: 'light',       i18nKey: 'act_light',       mult: 1.375, defaultLabel: '🚶 Light (1–3 workouts/wk)' },
  { key: 'moderate',    i18nKey: 'act_moderate',    mult: 1.55,  defaultLabel: '🏋️ Moderate (3–5 workouts/wk)' },
  { key: 'active',      i18nKey: 'act_active',      mult: 1.725, defaultLabel: '🔥 Active (6–7 workouts/wk)' },
  { key: 'very_active', i18nKey: 'act_very_active', mult: 1.9,   defaultLabel: '⚡ Very Active (athlete / physical work)' },
];

const STRATEGIES = [
  { key: 'cut',      i18nKey: 'strategy_cut',      defaultLabel: '📉 Cut (-20%)', mult: 0.80, protPerKg: 2.0, fatRatio: 0.25 },
  { key: 'maintain', i18nKey: 'strategy_maintain', defaultLabel: '⚖️ Maintain (100%)', mult: 1.00, protPerKg: 1.6, fatRatio: 0.28 },
  { key: 'bulk',     i18nKey: 'strategy_bulk',     defaultLabel: '📈 Bulk (+12%)', mult: 1.12, protPerKg: 2.2, fatRatio: 0.25 },
];

function calcTDEEResults({ weight, height, age, sex, activity, strategyKey = 'maintain' }) {
  const w = parseFloat(weight);
  const h = parseFloat(height);
  const a = parseFloat(age);
  if (!w || !h || !a) return null;

  const actMult = ACTIVITY_LEVELS.find(x => x.key === activity)?.mult || 1.55;
  const strat = STRATEGIES.find(x => x.key === strategyKey) || STRATEGIES[1];

  const bmr = sex === 'male'
    ? 10 * w + 6.25 * h - 5 * a + 5
    : 10 * w + 6.25 * h - 5 * a - 161;

  const tdeeBase = Math.round(bmr * actMult);
  const targetCalories = Math.round(tdeeBase * strat.mult);

  // 4/9/4 Rule Calculation
  const protein = Math.round(w * strat.protPerKg);
  const proteinKcal = protein * 4;
  const fat = Math.round((targetCalories * strat.fatRatio) / 9);
  const fatKcal = fat * 9;
  const carbs = Math.max(20, Math.round((targetCalories - proteinKcal - fatKcal) / 4));
  const carbsKcal = carbs * 4;
  const exactCalories = proteinKcal + fatKcal + carbsKcal;

  return {
    bmr: Math.round(bmr),
    tdee: tdeeBase,
    calories: exactCalories,
    protein,
    fat,
    carbs,
    water_ml: Math.round(w * 35),
  };
}

const TABS = ['goals', 'calculator', 'reminders'];

export default function NutriGoalModal({ currentGoal = {}, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('goals');

  const [form, setForm] = useState({
    calories: currentGoal.calories ?? 2000,
    protein:  currentGoal.protein  ?? 150,
    fat:      currentGoal.fat      ?? 65,
    carbs:    currentGoal.carbs    ?? 205,
    water_ml: currentGoal.water_ml ?? 2000,
    target_weight_kg: currentGoal.target_weight_kg ?? '',
  });

  const [reminders, setReminders] = useState({
    breakfast: currentGoal.reminder_breakfast ?? '',
    lunch:     currentGoal.reminder_lunch     ?? '',
    dinner:    currentGoal.reminder_dinner    ?? '',
  });

  // TDEE calculator state (Pre-filled with sensible profile defaults)
  const [calc, setCalc] = useState({
    weight: currentGoal.target_weight_kg || 75,
    height: 175,
    age: 25,
    sex: 'male',
    activity: 'moderate',
    strategy: 'maintain',
  });

  const tdeeResult = calcTDEEResults(calc);

  // ── Two-Way Mathematical Synchronization (4/9/4 Rule) ──────────────────────
  const pGrams = Number(form.protein) || 0;
  const fGrams = Number(form.fat) || 0;
  const cGrams = Number(form.carbs) || 0;

  const proteinKcal = pGrams * 4;
  const fatKcal     = fGrams * 9;
  const carbsKcal   = cGrams * 4;
  const macroSumKcal = proteinKcal + fatKcal + carbsKcal;

  const targetKcal = Number(form.calories) || 0;
  const diffKcal = macroSumKcal - targetKcal;

  const pPct = macroSumKcal > 0 ? Math.round((proteinKcal / macroSumKcal) * 100) : 0;
  const fPct = macroSumKcal > 0 ? Math.round((fatKcal / macroSumKcal) * 100) : 0;
  const cPct = macroSumKcal > 0 ? Math.max(0, 100 - pPct - fPct) : 0;

  // Sync actions
  function syncCaloriesToMacros() {
    hapticLight();
    setForm(prev => ({ ...prev, calories: macroSumKcal }));
    toast({ title: t('nutrition.goal_modal.sync_toast', `⚡ Calories synced: {{cal}} kcal`, { cal: macroSumKcal }) });
  }

  function distributeCaloriesToMacros(split) {
    hapticLight();
    const total = Number(form.calories) || 2000;
    const p = Math.round((total * split.p) / 4);
    const f = Math.round((total * split.f) / 9);
    const c = Math.max(10, Math.round((total - (p * 4) - (f * 9)) / 4));
    setForm(prev => ({ ...prev, protein: p, fat: f, carbs: c }));
    const label = t(`nutrition.goal_modal.${split.key}`, split.defaultLabel);
    toast({ title: t('nutrition.goal_modal.split_toast', `⚖️ Macros distributed: {{label}}`, { label }) });
  }

  const updateGoalMut = useMutation({
    mutationFn: (data) => djangoApi.nutrition.updateGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NUTRI_GOAL_KEY });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'meals'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'water'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'trends'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'weight'] });
      toast({ title: t('nutrition.goal_modal.goals_saved', '✅ Goals saved!') });
      onClose();
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  function applyPreset(preset) {
    hapticLight();
    setForm(prev => ({
      ...prev,
      calories: preset.calories,
      protein: preset.protein,
      fat: preset.fat,
      carbs: preset.carbs,
      water_ml: preset.water_ml,
    }));
  }

  function applyTDEE() {
    if (!tdeeResult) return;
    hapticLight();
    setForm(prev => ({
      ...prev,
      calories: tdeeResult.calories,
      protein: tdeeResult.protein,
      fat: tdeeResult.fat,
      carbs: tdeeResult.carbs,
      water_ml: tdeeResult.water_ml,
    }));
    setActiveTab('goals');
    toast({ title: t('nutrition.goal_modal.tdee_applied_toast', '🧮 TDEE & macro targets applied to goals!') });
  }

  function handleSave() {
    updateGoalMut.mutate({
      calories: Number(form.calories),
      protein:  Number(form.protein),
      fat:      Number(form.fat),
      carbs:    Number(form.carbs),
      water_ml: Number(form.water_ml),
      target_weight_kg: form.target_weight_kg ? Number(form.target_weight_kg) : null,
      reminder_breakfast: reminders.breakfast || null,
      reminder_lunch:     reminders.lunch     || null,
      reminder_dinner:    reminders.dinner    || null,
    });
  }

  const FIELDS = [
    { key: 'calories', label: t('nutrition.goal_modal.calories', 'Calories Goal'), unit: 'kcal', color: 'var(--habit-gold, #f59e0b)', step: 50 },
    { key: 'protein',  label: t('nutrition.goal_modal.protein', 'Protein (4 kcal/g)'), unit: 'g', color: 'var(--habit-blue, #3b82f6)', step: 5, kcalVal: proteinKcal },
    { key: 'fat',      label: t('nutrition.goal_modal.fat', 'Fat (9 kcal/g)'), unit: 'g', color: 'var(--habit-orange, #f97316)', step: 2, kcalVal: fatKcal },
    { key: 'carbs',    label: t('nutrition.goal_modal.carbs', 'Carbs (4 kcal/g)'), unit: 'g', color: 'var(--habit-green, #10b981)', step: 5, kcalVal: carbsKcal },
    { key: 'water_ml', label: t('nutrition.goal_modal.water', 'Daily Water Target'), unit: 'ml', color: '#38bdf8', step: 100 },
    { key: 'target_weight_kg', label: t('weight.target', 'Goal Body Weight'), unit: 'kg', color: 'var(--habit-green, #10b981)', step: 0.5 },
  ];

  const MEAL_REMINDERS = [
    { key: 'breakfast', label: '🌅 ' + t('nutrition.meals.breakfast', 'Breakfast'), color: 'var(--habit-gold, #f59e0b)' },
    { key: 'lunch',     label: '☀️ ' + t('nutrition.meals.lunch', 'Lunch'),         color: 'var(--habit-orange, #f97316)' },
    { key: 'dinner',    label: '🌙 ' + t('nutrition.meals.dinner', 'Dinner'),       color: 'var(--habit-purple, #7B61FF)' },
  ];

  const tabIcons = {
    goals:      <Settings size={13} />,
    calculator: <Calculator size={13} />,
    reminders:  <Bell size={13} />,
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      <motion.div
        className="relative w-full md:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl md:rounded-3xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--habit-panel, #120e24)',
          borderColor: 'var(--habit-border, rgba(255,255,255,0.12))',
          fontFamily: "'Nunito', sans-serif",
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      >
        {/* Header (Clean, no duplicate emoji) */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0 border-b border-[var(--habit-border)]">
          <div className="flex items-center gap-2">
            <span style={{ fontWeight: 900, fontSize: 17, color: 'var(--habit-text)', letterSpacing: '-0.3px' }}>
              🎯 {t('nutrition.goal_modal.title', 'Nutrition & Water Goals')}
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--habit-gold,#f59e0b)] text-black">
              4/9/4 RULE
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-lg opacity-60 hover:opacity-100 hover:bg-[var(--habit-border)] transition-all"
            style={{ color: 'var(--habit-text)' }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 md:p-5 overflow-y-auto flex-1 space-y-4 scrollbar-thin">
          {/* Tabs */}
          <div className="flex gap-1 p-0.5 rounded-xl bg-[var(--habit-border)]">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    hapticLight();
                    setActiveTab(tab);
                  }}
                  className="flex-1 py-2 px-1 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5"
                  style={{
                    background: isActive ? 'var(--habit-panel)' : 'transparent',
                    color: isActive ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-dim, #888)',
                    boxShadow: isActive ? '0 1px 6px rgba(0,0,0,0.3)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {tabIcons[tab]}
                  <span>{tab === 'goals' ? t('nutrition.goal_modal.tab_goals', '🎯 Goals & Macros') : tab === 'calculator' ? t('nutrition.goal_modal.tab_calc', '🧮 TDEE Calculator') : t('nutrition.goal_modal.tab_remind', '🔔 Reminders')}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {/* ── Tab: Goals & Live Macro Balancer ── */}
            {activeTab === 'goals' && (
              <motion.div key="goals" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Presets */}
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-[var(--habit-dim)] mb-1.5 px-1">
                    {t('nutrition.goal_modal.quick_presets', 'QUICK PRESETS')}
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {PRESETS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => applyPreset(p)}
                        className="px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all bg-[var(--habit-border)] hover:border-[var(--habit-gold,#f59e0b)] border border-transparent"
                        style={{ color: 'var(--habit-text)', cursor: 'pointer' }}
                      >
                        {t(`nutrition.goal_modal.${p.key}`, p.defaultLabel)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Live Macro Balance & Two-Way Sync HUD ── */}
                <div
                  className="p-3.5 rounded-2xl border space-y-2.5"
                  style={{
                    background: 'rgba(245,158,11,0.06)',
                    borderColor: 'rgba(245,158,11,0.22)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-[var(--habit-gold,#f59e0b)] uppercase tracking-wider">
                        {t('nutrition.goal_modal.macro_hud', '⚡ Macro Balance HUD')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-black">
                      <span>{t('nutrition.goal_modal.sum', 'Sum:')} {macroSumKcal} kcal</span>
                      {Math.abs(diffKcal) <= 10 ? (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">
                          {t('nutrition.goal_modal.match', '✓ 100% MATCH')}
                        </span>
                      ) : (
                        <span className={`px-1.5 py-0.2 rounded text-[10px] ${diffKcal > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {diffKcal > 0 ? `+${diffKcal} kcal` : `${diffKcal} kcal`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi-Segment Macro Ratio Bar */}
                  <div className="h-2.5 rounded-full overflow-hidden flex bg-black/40 p-0.5 gap-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pPct}%`, background: '#3b82f6' }}
                      title={`Protein: ${pPct}% (${proteinKcal} kcal)`}
                    />
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${fPct}%`, background: '#f97316' }}
                      title={`Fat: ${fPct}% (${fatKcal} kcal)`}
                    />
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${cPct}%`, background: '#10b981' }}
                      title={`Carbs: ${cPct}% (${carbsKcal} kcal)`}
                    />
                  </div>

                  {/* Ratio labels */}
                  <div className="flex items-center justify-between text-[10.5px] font-mono font-bold">
                    <span className="text-[#3b82f6]">{t('nutrition.macros.protein', 'Protein')}: {pPct}% ({proteinKcal}k)</span>
                    <span className="text-[#f97316]">{t('nutrition.macros.fat', 'Fat')}: {fPct}% ({fatKcal}k)</span>
                    <span className="text-[#10b981]">{t('nutrition.macros.carbs', 'Carbs')}: {cPct}% ({carbsKcal}k)</span>
                  </div>

                  {/* Two-Way Synchronization Action Buttons */}
                  <div className="pt-2 border-t border-[rgba(245,158,11,0.15)] flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={syncCaloriesToMacros}
                      className="flex-1 py-1.5 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition-all bg-[var(--habit-border)] hover:bg-[var(--habit-panel)] text-[var(--habit-gold,#f59e0b)]"
                    >
                      <RefreshCw size={12} />
                      <span>{t('nutrition.goal_modal.sync_calories', 'Sync Calories = {{cal}} kcal', { cal: macroSumKcal })}</span>
                    </button>
                  </div>

                  {/* Macro Distribution Scheme Selector */}
                  <div className="pt-1">
                    <div className="text-[9.5px] font-black uppercase tracking-wider text-[var(--habit-dim)] mb-1">
                      {t('nutrition.goal_modal.auto_distribute', 'AUTO-DISTRIBUTE CALORIES ({{cal}} kcal) TO MACROS:', { cal: form.calories })}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MACRO_SPLITS.map((split) => (
                        <button
                          key={split.id}
                          type="button"
                          onClick={() => distributeCaloriesToMacros(split)}
                          className="py-1 px-2 rounded-lg text-[10px] font-black text-left bg-[var(--habit-border)] hover:border-[var(--habit-gold,#f59e0b)] border border-transparent text-[var(--habit-text)] transition-all"
                        >
                          {t(`nutrition.goal_modal.${split.key}`, split.defaultLabel)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Input Fields ── */}
                <div className="space-y-2.5">
                  {FIELDS.map(({ key, label, unit, color, step, kcalVal }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--habit-border)] border border-transparent hover:border-[var(--habit-border)] transition-all"
                    >
                      <div className="flex flex-col">
                        <span style={{ fontWeight: 800, fontSize: 13, color }}>
                          {label}
                        </span>
                        {kcalVal != null && (
                          <span className="text-[10px] font-mono text-[var(--habit-dim)] font-bold">
                            = {kcalVal} kcal ({macroSumKcal > 0 ? Math.round((kcalVal / macroSumKcal) * 100) : 0}%)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setForm(p => ({ ...p, [key]: Math.max(0, Number(p[key]) - step) }))}
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm bg-[var(--habit-panel)] text-[var(--habit-text)]"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          step={step}
                          value={form[key]}
                          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                          className="w-20 px-2 py-1 rounded-lg text-center text-sm font-black outline-none bg-[var(--habit-panel)]"
                          style={{ color, border: `1px solid ${color}40` }}
                        />
                        <button
                          type="button"
                          onClick={() => setForm(p => ({ ...p, [key]: Number(p[key]) + step }))}
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm bg-[var(--habit-panel)] text-[var(--habit-text)]"
                        >
                          +
                        </button>
                        <span className="text-xs opacity-60 font-black w-7 text-right">{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Tab: TDEE Calculator & Goal Strategies ── */}
            {activeTab === 'calculator' && (
              <motion.div key="calc" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3.5">
                <div
                  className="p-3 rounded-xl text-xs font-bold leading-relaxed"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--habit-dim)' }}
                >
                  {t('weight.tdee_hint', 'Mifflin-St Jeor Engine: auto-calculates baseline metabolic rate + daily macro targets based on the 4/9/4 rule.')}
                </div>

                {/* Strategy Selector */}
                <div>
                  <span className="text-xs font-black block mb-1.5 text-[var(--habit-gold,#f59e0b)] uppercase tracking-wider">
                    {t('nutrition.goal_modal.strategy_label', '1. Goal Strategy')}
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {STRATEGIES.map((s) => {
                      const isStratActive = calc.strategy === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => {
                            hapticLight();
                            setCalc(p => ({ ...p, strategy: s.key }));
                          }}
                          className="py-2 px-1 rounded-xl text-[11px] font-black transition-all text-center"
                          style={{
                            background: isStratActive ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-border)',
                            color: isStratActive ? '#000000' : 'var(--habit-text)',
                            boxShadow: isStratActive ? '0 2px 8px rgba(245,158,11,0.25)' : 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {t(`nutrition.goal_modal.${s.i18nKey}`, s.defaultLabel)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Body Metrics Inputs */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--habit-border)]">
                    <span className="text-xs font-black text-[var(--habit-text)]">{t('weight.sex', 'Sex')}</span>
                    <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--habit-panel)]">
                      {['male', 'female'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCalc(p => ({ ...p, sex: s }))}
                          className="px-3 py-1 rounded-md text-xs font-black transition-all"
                          style={{
                            background: calc.sex === s ? 'var(--habit-gold, #f59e0b)' : 'transparent',
                            color: calc.sex === s ? '#000' : 'var(--habit-dim)',
                            cursor: 'pointer',
                          }}
                        >
                          {s === 'male' ? t('weight.male', '♂ Male') : t('weight.female', '♀ Female')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {[
                    { key: 'weight', label: t('weight.weight', 'Current Weight'), unit: 'kg', min: 30, max: 250, step: 0.5 },
                    { key: 'height', label: t('weight.height', 'Height'), unit: 'cm', min: 100, max: 230, step: 1 },
                    { key: 'age',    label: t('weight.age', 'Age'), unit: 'yr', min: 12, max: 100, step: 1 },
                  ].map(({ key, label, unit, min, max, step }) => (
                    <div key={key} className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--habit-border)]">
                      <span className="text-xs font-black text-[var(--habit-text)]">{label}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={min}
                          max={max}
                          step={step}
                          value={calc[key]}
                          onChange={(e) => setCalc(p => ({ ...p, [key]: e.target.value }))}
                          className="w-20 px-2 py-1 rounded-lg text-center text-sm font-black outline-none bg-[var(--habit-panel)] text-[var(--habit-text)]"
                        />
                        <span className="text-xs opacity-60 font-black w-6 text-right">{unit}</span>
                      </div>
                    </div>
                  ))}

                  {/* Activity Level */}
                  <div>
                    <span className="text-xs font-black block mb-1.5 text-[var(--habit-text)]">{t('weight.activity_level', 'Activity Level')}</span>
                    <div className="space-y-1">
                      {ACTIVITY_LEVELS.map((a) => {
                        const isActActive = calc.activity === a.key;
                        return (
                          <button
                            key={a.key}
                            type="button"
                            onClick={() => setCalc(p => ({ ...p, activity: a.key }))}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all"
                            style={{
                              background: isActActive ? 'rgba(245,158,11,0.18)' : 'var(--habit-border)',
                              color: isActActive ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-text)',
                              border: `1px solid ${isActActive ? 'var(--habit-gold, #f59e0b)' : 'transparent'}`,
                              cursor: 'pointer',
                            }}
                          >
                            {t(`nutrition.goal_modal.${a.i18nKey}`, a.defaultLabel)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Live TDEE Results Box ── */}
                {tdeeResult && (
                  <div
                    className="p-3.5 rounded-2xl border space-y-3"
                    style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wide text-[var(--habit-green,#10b981)]">
                        {t('weight.tdee_breakdown', '📊 TDEE & Macro Breakdown')}
                      </span>
                      <span className="text-[10px] font-mono font-black opacity-60">
                        BMR: {tdeeResult.bmr} kcal | TDEE: {tdeeResult.tdee} kcal
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="p-2 rounded-xl bg-[var(--habit-panel)] border border-[rgba(245,158,11,0.2)]">
                        <div className="text-[9px] font-black text-[var(--habit-dim)] uppercase">{t('nutrition.macros.calories_short', 'TARGET')}</div>
                        <div className="text-xs font-black text-[var(--habit-gold,#f59e0b)] font-mono">{tdeeResult.calories}k</div>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--habit-panel)] border border-[rgba(59,130,246,0.2)]">
                        <div className="text-[9px] font-black text-[var(--habit-dim)] uppercase">{t('nutrition.macros.protein', 'PROTEIN')}</div>
                        <div className="text-xs font-black text-[#3b82f6] font-mono">{tdeeResult.protein}g</div>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--habit-panel)] border border-[rgba(249,115,22,0.2)]">
                        <div className="text-[9px] font-black text-[var(--habit-dim)] uppercase">{t('nutrition.macros.fat', 'FAT')}</div>
                        <div className="text-xs font-black text-[#f97316] font-mono">{tdeeResult.fat}g</div>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--habit-panel)] border border-[rgba(16,185,129,0.2)]">
                        <div className="text-[9px] font-black text-[var(--habit-dim)] uppercase">{t('nutrition.macros.carbs', 'CARBS')}</div>
                        <div className="text-xs font-black text-[#10b981] font-mono">{tdeeResult.carbs}g</div>
                      </div>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={applyTDEE}
                      className="w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all"
                      style={{
                        background: 'linear-gradient(135deg, var(--habit-green, #10b981), #059669)',
                        color: '#ffffff',
                        boxShadow: '0 2px 10px rgba(16,185,129,0.3)',
                        cursor: 'pointer',
                      }}
                    >
                      <Check size={14} />
                      <span>{t('nutrition.goal_modal.apply_tdee_btn', 'Apply TDEE Targets to My Goals')}</span>
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Tab: Reminders ── */}
            {activeTab === 'reminders' && (
              <motion.div key="reminders" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                <div
                  className="p-3 rounded-xl text-xs font-bold leading-relaxed"
                  style={{ background: 'rgba(80,181,233,0.08)', border: '1px solid rgba(80,181,233,0.2)', color: 'var(--habit-dim)' }}
                >
                  {t('reminders.hint', 'Set push reminders for each meal. Leave blank to disable.')}
                </div>
                <div className="space-y-2.5">
                  {MEAL_REMINDERS.map(({ key, label, color }) => (
                    <div key={key} className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--habit-border)]">
                      <label style={{ fontWeight: 800, fontSize: 13, color }}>{label}</label>
                      <input
                        type="time"
                        value={reminders[key]}
                        onChange={(e) => setReminders(p => ({ ...p, [key]: e.target.value }))}
                        className="px-3 py-1.5 rounded-xl text-sm font-black outline-none bg-[var(--habit-panel)] text-[var(--habit-text)]"
                        style={{ border: `1px solid ${color}40` }}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer with Save Button */}
        <div className="p-4 border-t border-[var(--habit-border)] shrink-0 bg-[var(--habit-panel)]">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={updateGoalMut.isPending}
            className="w-full py-3 rounded-xl font-black text-sm transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--habit-gold, #f59e0b), #d97706)',
              color: '#000000',
              opacity: updateGoalMut.isPending ? 0.7 : 1,
              boxShadow: '0 4px 18px rgba(245,158,11,0.35)',
              cursor: 'pointer',
            }}
          >
            {updateGoalMut.isPending ? t('nutrition.goal_modal.saving', 'Saving...') : t('nutrition.goal_modal.save_btn', '💾 Save Goals')}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
