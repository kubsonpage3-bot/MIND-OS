// @ts-nocheck
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import { NUTRI_GOAL_KEY } from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import { Calculator, Settings, Bell } from 'lucide-react';

const PRESETS = [
  { key: 'preset_cut',      defaultLabel: '🏃 Weight Loss',   calories: 1600, protein: 140, fat: 50,  carbs: 150, water_ml: 2200 },
  { key: 'preset_maintain', defaultLabel: '⚖️ Maintenance',   calories: 2000, protein: 150, fat: 65,  carbs: 250, water_ml: 2000 },
  { key: 'preset_bulk',     defaultLabel: '💪 Muscle Gain',   calories: 2600, protein: 200, fat: 80,  carbs: 310, water_ml: 2500 },
];

const ACTIVITY_LEVELS = [
  { key: 'sedentary',   mult: 1.2,   label: '🪑 Сидячий (офис / нет тренировок)' },
  { key: 'light',       mult: 1.375, label: '🚶 Лёгкий (1–3 тренировки/нед)' },
  { key: 'moderate',    mult: 1.55,  label: '🏋️ Умеренный (3–5 тренировок/нед)' },
  { key: 'active',      mult: 1.725, label: '🔥 Активный (6–7 тренировок/нед)' },
  { key: 'very_active', mult: 1.9,   label: '⚡ Очень активный (спорт + физ. труд)' },
];

function calcTDEE({ weight, height, age, sex, activity }) {
  const w = parseFloat(weight);
  const h = parseFloat(height);
  const a = parseFloat(age);
  if (!w || !h || !a) return null;
  const mult = ACTIVITY_LEVELS.find(x => x.key === activity)?.mult || 1.55;
  const bmr = sex === 'male'
    ? 10 * w + 6.25 * h - 5 * a + 5
    : 10 * w + 6.25 * h - 5 * a - 161;
  const tdee = Math.round(bmr * mult);
  // Авто-распределение макросов
  const protein = Math.round(w * 2.0);           // 2г/кг
  const fat     = Math.round((tdee * 0.28) / 9); // 28% от TDEE
  const carbs   = Math.round((tdee - protein * 4 - fat * 9) / 4);
  return { calories: tdee, protein, fat, carbs };
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
    carbs:    currentGoal.carbs    ?? 250,
    water_ml: currentGoal.water_ml ?? 2000,
    target_weight_kg: currentGoal.target_weight_kg ?? '',
  });

  const [reminders, setReminders] = useState({
    breakfast: currentGoal.reminder_breakfast ?? '',
    lunch:     currentGoal.reminder_lunch     ?? '',
    dinner:    currentGoal.reminder_dinner    ?? '',
  });

  // TDEE calculator state
  const [calc, setCalc] = useState({
    weight: '', height: '', age: '', sex: 'male', activity: 'moderate',
  });
  const tdeeResult = calcTDEE(calc);

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
    setForm(prev => ({ ...prev, calories: preset.calories, protein: preset.protein, fat: preset.fat, carbs: preset.carbs, water_ml: preset.water_ml }));
  }

  function applyTDEE() {
    if (!tdeeResult) return;
    setForm(prev => ({ ...prev, ...tdeeResult }));
    setActiveTab('goals');
    toast({ title: '🧮 TDEE applied to goals!' });
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
    { key: 'calories', label: t('nutrition.goal_modal.calories', 'Calories'), unit: 'kcal', color: 'var(--habit-gold, #f59e0b)' },
    { key: 'protein',  label: t('nutrition.goal_modal.protein', 'Protein'),   unit: 'g',    color: 'var(--habit-blue, #3b82f6)' },
    { key: 'fat',      label: t('nutrition.goal_modal.fat', 'Fat'),           unit: 'g',    color: 'var(--habit-orange, #f97316)' },
    { key: 'carbs',    label: t('nutrition.goal_modal.carbs', 'Carbs'),       unit: 'g',    color: 'var(--habit-green, #10b981)' },
    { key: 'water_ml', label: t('nutrition.goal_modal.water', 'Water'),       unit: 'ml',   color: '#38bdf8' },
    { key: 'target_weight_kg', label: t('weight.target', 'Goal Weight'),      unit: 'kg',   color: 'var(--habit-green, #10b981)' },
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
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full md:max-w-md max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--habit-panel)',
          border: '1px solid var(--habit-border)',
          borderRadius: '20px 20px 0 0',
          padding: 20,
          fontFamily: "'Nunito', sans-serif",
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--habit-text)' }}>
            🎯 {t('nutrition.goal_modal.title', 'Nutrition Goals')}
          </span>
          <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100 transition-opacity">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-0.5 rounded-xl mb-4" style={{ background: 'var(--habit-border)' }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-1.5 px-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
              style={{
                background: activeTab === tab ? 'var(--habit-panel)' : 'transparent',
                color: activeTab === tab ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-dim, #888)',
                cursor: 'pointer',
              }}
            >
              {tabIcons[tab]}
              <span className="capitalize">{tab === 'goals' ? t('nutrition.goal_modal.tab_goals', 'Goals') : tab === 'calculator' ? t('nutrition.goal_modal.tab_calc', 'TDEE') : t('nutrition.goal_modal.tab_remind', 'Alerts')}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Tab: Goals ── */}
          {activeTab === 'goals' && (
            <motion.div key="goals" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Presets */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => applyPreset(p)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all"
                    style={{ background: 'var(--habit-border)', color: 'var(--habit-text)', cursor: 'pointer' }}
                  >
                    {t(`nutrition.goal_modal.${p.key}`, p.defaultLabel)}
                  </button>
                ))}
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-3 mb-5">
                {FIELDS.map(({ key, label, unit, color }) => (
                  <div key={key} className="flex items-center justify-between">
                    <label style={{ fontWeight: 700, fontSize: 14, color }}>
                      {label} <span style={{ opacity: 0.5, fontWeight: 400 }}>({unit})</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={key === 'target_weight_kg' ? 0.5 : 1}
                      value={form[key]}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={key === 'target_weight_kg' ? '70' : undefined}
                      className="w-24 px-3 py-1.5 rounded-xl text-center text-sm font-bold outline-none"
                      style={{ background: 'var(--habit-border)', color, border: `1px solid ${color}40` }}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Tab: TDEE Calculator ── */}
          {activeTab === 'calculator' && (
            <motion.div key="calc" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div
                className="p-3 rounded-xl mb-3 text-xs"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--habit-dim)' }}
              >
                {t('weight.tdee_hint', 'Enter your stats → get daily calorie + macro targets based on Mifflin-St Jeor formula')}
              </div>

              <div className="space-y-3 mb-4">
                {/* Sex */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: 'var(--habit-text)' }}>Sex</span>
                  <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: 'var(--habit-border)' }}>
                    {['male', 'female'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setCalc(p => ({ ...p, sex: s }))}
                        className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: calc.sex === s ? 'var(--habit-panel)' : 'transparent',
                          color: calc.sex === s ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-dim)',
                          cursor: 'pointer',
                        }}
                      >
                        {s === 'male' ? '♂ Male' : '♀ Female'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Numeric inputs */}
                {[
                  { key: 'weight', label: 'Weight', unit: 'kg', min: 20, max: 300 },
                  { key: 'height', label: 'Height', unit: 'cm', min: 100, max: 250 },
                  { key: 'age',    label: 'Age',    unit: 'yr', min: 10,  max: 100 },
                ].map(({ key, label, unit, min, max }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: 'var(--habit-text)' }}>{label}</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={min}
                        max={max}
                        value={calc[key]}
                        onChange={(e) => setCalc(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={key === 'weight' ? '75' : key === 'height' ? '175' : '25'}
                        className="w-24 px-3 py-1.5 rounded-xl text-center text-sm font-bold outline-none"
                        style={{ background: 'var(--habit-border)', color: 'var(--habit-text)', border: '1px solid var(--habit-border)' }}
                      />
                      <span className="text-xs opacity-50 font-bold w-6">{unit}</span>
                    </div>
                  </div>
                ))}

                {/* Activity */}
                <div>
                  <span className="text-sm font-bold block mb-1.5" style={{ color: 'var(--habit-text)' }}>Activity Level</span>
                  <div className="space-y-1">
                    {ACTIVITY_LEVELS.map((a) => (
                      <button
                        key={a.key}
                        onClick={() => setCalc(p => ({ ...p, activity: a.key }))}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: calc.activity === a.key ? 'rgba(245,158,11,0.15)' : 'var(--habit-border)',
                          color: calc.activity === a.key ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-text)',
                          border: `1px solid ${calc.activity === a.key ? 'rgba(245,158,11,0.4)' : 'transparent'}`,
                          cursor: 'pointer',
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Result */}
              {tdeeResult ? (
                <div
                  className="p-3.5 rounded-2xl mb-3"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
                >
                  <div className="text-xs font-extrabold uppercase tracking-wide mb-2" style={{ color: 'var(--habit-green, #10b981)' }}>
                    📊 Your TDEE Results
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Calories', value: `${tdeeResult.calories} kcal`, color: 'var(--habit-gold, #f59e0b)' },
                      { label: 'Protein',  value: `${tdeeResult.protein}g`,     color: 'var(--habit-blue, #3b82f6)' },
                      { label: 'Fat',      value: `${tdeeResult.fat}g`,         color: 'var(--habit-orange, #f97316)' },
                      { label: 'Carbs',    value: `${tdeeResult.carbs}g`,       color: 'var(--habit-green, #10b981)' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center p-2 rounded-xl" style={{ background: 'var(--habit-border)' }}>
                        <div style={{ fontSize: 10, color: 'var(--habit-dim)', fontWeight: 700 }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 900, color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={applyTDEE}
                    className="w-full mt-3 py-2.5 rounded-xl font-black text-sm"
                    style={{ background: 'linear-gradient(135deg, var(--habit-green, #10b981), #059669)', color: '#fff', cursor: 'pointer' }}
                  >
                    ✅ Apply to My Goals
                  </motion.button>
                </div>
              ) : (
                <div className="text-center py-4 text-xs opacity-40">
                  Fill in all fields to see your TDEE calculation
                </div>
              )}
            </motion.div>
          )}

          {/* ── Tab: Reminders ── */}
          {activeTab === 'reminders' && (
            <motion.div key="reminders" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div
                className="p-3 rounded-xl mb-4 text-xs"
                style={{ background: 'rgba(80,181,233,0.08)', border: '1px solid rgba(80,181,233,0.2)', color: 'var(--habit-dim)' }}
              >
                {t('reminders.hint', 'Set push reminders for each meal. Leave blank to disable.')}
              </div>
              <div className="space-y-3 mb-5">
                {MEAL_REMINDERS.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center justify-between">
                    <label style={{ fontWeight: 700, fontSize: 13, color }}>{label}</label>
                    <input
                      type="time"
                      value={reminders[key]}
                      onChange={(e) => setReminders(p => ({ ...p, [key]: e.target.value }))}
                      className="px-3 py-1.5 rounded-xl text-sm font-bold outline-none"
                      style={{ background: 'var(--habit-border)', color, border: `1px solid ${color}40` }}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save Button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={updateGoalMut.isPending}
          className="w-full py-3 rounded-xl font-black text-sm transition-all mt-2"
          style={{
            background: 'linear-gradient(135deg, var(--habit-gold, #f59e0b), #d97706)',
            color: '#000',
            opacity: updateGoalMut.isPending ? 0.7 : 1,
            cursor: 'pointer',
          }}
        >
          {updateGoalMut.isPending ? t('nutrition.goal_modal.saving', 'Saving...') : t('nutrition.goal_modal.save_btn', '💾 Save All')}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
