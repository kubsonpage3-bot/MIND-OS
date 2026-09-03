// @ts-nocheck
import { useState, lazy, Suspense, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import {
  NUTRITION_MEALS_KEY,
  NUTRITION_CALENDAR_KEY,
  NUTRI_GOAL_KEY,
} from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import MacroRings, { MacroBars } from './MacroRings';
import WaterTracker from './WaterTracker';
import {
  Plus, Settings, Trash2, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Calendar as CalendarIcon,
  TrendingUp, Utensils, UtensilsCrossed, Sunrise, Sun,
  Moon, Apple, Flame, Share2, Zap, Edit3,
} from 'lucide-react';

const AddMealModal      = lazy(() => import('./AddMealModal'));
const NutriGoalModal    = lazy(() => import('./NutriGoalModal'));
const NutriCalendarModal= lazy(() => import('./NutriCalendarModal'));
const SavedCombosModal  = lazy(() => import('./SavedCombosModal'));
const NutritionTrends   = lazy(() => import('./NutritionTrends'));
const BodyWeightTracker = lazy(() => import('./BodyWeightTracker'));
const WeeklyReportCard  = lazy(() => import('./WeeklyReportCard'));

// ─── Utils ─────────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function monthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function formatDate(dateStr, lang='en') {
  const [y,m,day] = dateStr.split('-').map(Number);
  return new Date(y, m-1, day).toLocaleDateString(lang==='ru'?'ru-RU':'en-US', { day:'numeric', month:'long' });
}
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// ─── Meal meta ─────────────────────────────────────────────────────────────────
const MEAL_META = {
  breakfast: { key:'breakfast', defaultLabel:'Breakfast', icon:Sunrise, color:'#f59e0b', glow:'rgba(245,158,11,0.25)', bg:'rgba(245,158,11,0.1)' },
  lunch:     { key:'lunch',     defaultLabel:'Lunch',     icon:Sun,     color:'#f97316', glow:'rgba(249,115,22,0.25)', bg:'rgba(249,115,22,0.1)' },
  dinner:    { key:'dinner',    defaultLabel:'Dinner',    icon:Moon,    color:'#7B61FF', glow:'rgba(123,97,255,0.25)', bg:'rgba(123,97,255,0.1)' },
  snack:     { key:'snack',     defaultLabel:'Snacks',    icon:Apple,   color:'#10b981', glow:'rgba(16,185,129,0.25)', bg:'rgba(16,185,129,0.1)' },
};

import NutritionDateNavigator from './NutritionDateNavigator';

function getFoodEmoji(name = '') {
  const lower = (name || '').toLowerCase();
  if (lower.includes('пицц') || lower.includes('pizza')) return '🍕';
  if (lower.includes('овсян') || lower.includes('oat') || lower.includes('каша') || lower.includes('porridge')) return '🥣';
  if (lower.includes('сырник') || lower.includes('блин') || lower.includes('pancake')) return '🥞';
  if (lower.includes('яйц') || lower.includes('яичниц') || lower.includes('egg') || lower.includes('omelet')) return '🍳';
  if (lower.includes('куриц') || lower.includes('курин') || lower.includes('филе') || lower.includes('chicken') || lower.includes('птиц')) return '🍗';
  if (lower.includes('говядин') || lower.includes('стейк') || lower.includes('beef') || lower.includes('steak') || lower.includes('мясо')) return '🥩';
  if (lower.includes('рыб') || lower.includes('лосос') || lower.includes('тунец') || lower.includes('fish') || lower.includes('salmon')) return '🐟';
  if (lower.includes('гречк') || lower.includes('buckwheat')) return '🌾';
  if (lower.includes('рис') || lower.includes('rice') || lower.includes('плов')) return '🍚';
  if (lower.includes('макарон') || lower.includes('паст') || lower.includes('pasta') || lower.includes('spaghetti')) return '🍝';
  if (lower.includes('картоф') || lower.includes('potato')) return '🥔';
  if (lower.includes('творог') || lower.includes('cottage') || lower.includes('сыр') || lower.includes('cheese')) return '🧀';
  if (lower.includes('молок') || lower.includes('milk') || lower.includes('йогурт') || lower.includes('yogurt')) return '🥛';
  if (lower.includes('протеин') || lower.includes('protein') || lower.includes('шейк') || lower.includes('shake')) return '🥤';
  if (lower.includes('бургер') || lower.includes('burger')) return '🍔';
  if (lower.includes('шаурм') || lower.includes('shawarma') || lower.includes('ролл') || lower.includes('wrap')) return '🌯';
  if (lower.includes('кофе') || lower.includes('coffee') || lower.includes('капучино') || lower.includes('латте') || lower.includes('чай')) return '☕';
  if (lower.includes('банан') || lower.includes('banana')) return '🍌';
  if (lower.includes('яблок') || lower.includes('apple')) return '🍎';
  if (lower.includes('авокадо') || lower.includes('avocado')) return '🥑';
  if (lower.includes('салат') || lower.includes('salad') || lower.includes('огур') || lower.includes('помидор')) return '🥗';
  if (lower.includes('борщ') || lower.includes('суп') || lower.includes('soup')) return '🍲';
  return '🍽️';
}

// ─── Single Meal Entry Row (Pixel-Art Card) ──────────────────────────────────
function MealEntryRow({ entry, onDelete, accentColor, index = 0 }) {
  const { t } = useTranslation();
  const emoji = getFoodEmoji(entry.food_name);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={{ duration: 0.28, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="group flex items-center justify-between px-3 py-2.5 rounded-xl border relative overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: 'var(--habit-border, rgba(255,255,255,0.08))',
      }}
      whileHover={{
        borderColor: accentColor,
        boxShadow: `0 0 18px -2px ${accentColor}35`,
        scale: 1.008,
        transition: { duration: 0.18 },
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
        {entry.photo_url ? (
          <img src={entry.photo_url} alt="meal" className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0" />
        ) : (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-base shadow-sm"
            style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}35` }}
          >
            {emoji}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-black text-[13px] truncate" style={{ color: 'var(--habit-text)' }}>
              {entry.food_name}
            </span>
            <span
              className="text-[10px] font-mono font-black px-1.5 py-0.2 rounded bg-[var(--habit-border)] shrink-0"
              style={{ color: 'var(--habit-gold, #f59e0b)' }}
            >
              [{entry.amount}{entry.unit || 'g'}]
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] font-mono font-bold">
            <span style={{ color: '#f59e0b' }}>🔥 {Math.round(entry.calories)} kcal</span>
            <span style={{ color: '#3b82f6' }}>P: {Math.round(entry.protein)}g</span>
            <span style={{ color: '#f97316' }}>F: {Math.round(entry.fat)}g</span>
            <span style={{ color: '#10b981' }}>C: {Math.round(entry.carbs)}g</span>
            {entry.note && <span className="opacity-40 italic font-normal truncate max-w-[120px]">· {entry.note}</span>}
          </div>
        </div>
      </div>
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => onDelete(entry.id)}
        className="p-1.5 rounded-lg opacity-40 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0"
        title={t('nutrition.delete_entry', 'Delete')}
        style={{ color: 'var(--habit-dim)' }}
      >
        <Trash2 size={14} />
      </motion.button>
    </motion.div>
  );
}

// ─── Collapsible Meal Section Card ───────────────────────────────────────────
function MealCard({ type, entries = [], onAddClick, onDeleteItem, cardIndex = 0 }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const meta = MEAL_META[type] || { key:type, defaultLabel:type, icon:Utensils, color:'#f59e0b', glow:'rgba(245,158,11,0.2)', bg:'rgba(245,158,11,0.1)' };
  const Icon = meta.icon;
  const label = t(`nutrition.meals.${meta.key}`, meta.defaultLabel);
  const totalCal = entries.reduce((s,e) => s + (e.calories||0), 0);
  const totalP   = entries.reduce((s,e) => s + (e.protein||0), 0);
  const totalF   = entries.reduce((s,e) => s + (e.fat||0), 0);
  const totalC   = entries.reduce((s,e) => s + (e.carbs||0), 0);

  return (
    <motion.div
      className="rounded-2xl overflow-hidden border"
      style={{
        background: 'var(--habit-panel)',
        borderColor: 'var(--habit-border)',
        borderLeft: `4px solid ${meta.color}`,
      }}
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: cardIndex * 0.07, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{
        boxShadow: `0 0 28px -4px ${meta.glow}`,
        transition: { duration: 0.25 },
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-3 text-left flex-1" style={{ cursor:'pointer' }}>
          <motion.div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}
            whileHover={{ rotate: 8, scale: 1.12 }}
            transition={{ type: 'spring', stiffness: 350 }}
          >
            <Icon size={16} style={{ color: meta.color }} />
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--habit-text)', letterSpacing: '-0.2px' }}>
                {label}
              </span>
              <span
                className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded"
                style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}
              >
                📊
              </span>
            </div>
            {entries.length > 0 ? (
              <div className="flex gap-2.5 mt-0.5 text-[11px] font-mono font-bold">
                <span style={{ color: '#f59e0b' }}>🔥 {Math.round(totalCal)} kcal</span>
                <span style={{ color: '#3b82f6' }}>P:{Math.round(totalP)}g</span>
                <span style={{ color: '#f97316' }}>F:{Math.round(totalF)}g</span>
                <span style={{ color: '#10b981' }}>C:{Math.round(totalC)}g</span>
              </div>
            ) : (
              <div className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--habit-dim)' }}>
                {t('nutrition.no_entries', 'No entries logged')}
              </div>
            )}
          </div>
        </button>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.07, boxShadow: `0 4px 16px ${meta.color}40` }}
            onClick={() => onAddClick(type)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all"
            style={{
              background: meta.bg,
              color: meta.color,
              border: `1px solid ${meta.color}50`,
              boxShadow: `0 2px 10px ${meta.color}25`,
              cursor: 'pointer',
            }}
          >
            <Plus size={13} /> {t('nutrition.add_food', 'Add')}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 opacity-50 hover:opacity-100 transition-opacity"
            animate={{ rotate: isOpen ? 0 : 180 }}
            transition={{ duration: 0.25 }}
          >
            <ChevronUp size={15} />
          </motion.button>
        </div>
      </div>

      {/* Entries */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity:0, height:0 }}
            animate={{ opacity:1, height:'auto' }}
            exit={{ opacity:0, height:0 }}
            transition={{ duration:0.22, ease:'easeOut' }}
          >
            <div className="px-3 pb-3 space-y-1.5">
              {entries.length === 0 ? (
                <motion.div
                  onClick={() => onAddClick(type)}
                  whileHover={{ scale: 1.01, borderColor: `${meta.color}70` }}
                  whileTap={{ scale: 0.98 }}
                  className="py-6 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed cursor-pointer"
                  style={{ borderColor: `${meta.color}30`, background: `${meta.color}05` }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}
                  >
                    <Plus size={14} style={{ color: meta.color }} />
                  </motion.div>
                  <span className="text-[11px] font-semibold" style={{ color:'var(--habit-dim)' }}>
                    {t('nutrition.tap_to_log', { meal: label.toLowerCase(), defaultValue: `Tap «Add» to log ${label.toLowerCase()}` })}
                  </span>
                </motion.div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {entries.map((entry, i) => (
                    <MealEntryRow key={entry.id} entry={entry} onDelete={onDeleteItem} accentColor={meta.color} index={i} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Calorie Gauge Bar ────────────────────────────────────────────────────────
function CalorieGauge({ consumed, goal }) {
  const { t } = useTranslation();
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const isOver = consumed > goal;
  const remaining = goal - consumed;
  const pctPx = `${Math.min(pct * 100, 100)}%`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-bold">
        <span style={{ color:'var(--habit-dim)' }}>{t('nutrition.consumed', 'Consumed')}</span>
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={isOver ? { scale: [1, 1.2, 1] } : {}}
            transition={isOver ? { repeat: Infinity, duration: 1.4, ease: 'easeInOut' } : {}}
          >
            <Flame size={13} style={{ color: isOver ? '#f74e52' : '#f59e0b' }} />
          </motion.div>
          <motion.span
            key={Math.round(remaining)}
            initial={{ y: -4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.25 }}
            style={{ color: isOver ? '#f74e52' : '#10b981', fontWeight:900, fontSize:13 }}
          >
            {isOver
              ? `+${Math.abs(Math.round(remaining))} ${t('nutrition.kcal_over', 'kcal over')}`
              : `${Math.round(remaining)} ${t('nutrition.kcal_left', 'kcal left')}`}
          </motion.span>
        </div>
        <span style={{ color:'var(--habit-dim)' }}>{t('nutrition.goal_label', 'Goal')} {Math.round(goal)}</span>
      </div>
      <div style={{ height:8, borderRadius:999, background:'var(--habit-border)', overflow:'hidden', position:'relative' }}>
        <motion.div
          style={{
            height:'100%', borderRadius:999,
            background: isOver
              ? 'linear-gradient(90deg, #f59e0b, #f74e52)'
              : 'linear-gradient(90deg, #f59e0b, #10b981)',
            position: 'relative',
            overflow: 'hidden',
          }}
          initial={{ width:0 }}
          animate={{
            width: pctPx,
            boxShadow: isOver
              ? ['0 0 12px rgba(247,78,82,0.5)', '0 0 22px rgba(247,78,82,0.8)', '0 0 12px rgba(247,78,82,0.5)']
              : '0 0 12px rgba(245,158,11,0.4)',
          }}
          transition={{
            width: { duration:0.9, ease:[0.16,1,0.3,1] },
            boxShadow: isOver ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' } : {},
          }}
        >
          {/* Shimmer beam */}
          {pct > 0 && (
            <motion.div
              style={{
                position: 'absolute', top: 0, left: 0, height: '100%', width: '45%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                borderRadius: 999,
              }}
              animate={{ x: ['-45%', '200%'] }}
              transition={{ duration: 2, delay: 1, ease: 'easeInOut', repeat: 0 }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Stats Summary Row (PC Sidebar) ──────────────────────────────────────────
function StatChip({ label, value, color, unit='' }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-xl" style={{ background:'var(--habit-border)' }}>
      <div style={{ fontSize:18, fontWeight:900, color, fontFamily:'monospace', letterSpacing:'-0.5px' }}>
        {Math.round(value)}<span style={{ fontSize:10, opacity:0.6 }}>{unit}</span>
      </div>
      <div style={{ fontSize:10, color:'var(--habit-dim)', fontWeight:700, marginTop:2 }}>{label}</div>
    </div>
  );
}

// ─── Main NutritionTab ────────────────────────────────────────────────────────
const FONT = "'Nunito', sans-serif";
const CARD = { background:'var(--habit-panel)', border:'1px solid var(--habit-border)', borderRadius:18, fontFamily:FONT };

export default function NutritionTab() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [targetAddMealType, setTargetAddMealType] = useState('breakfast');
  const [showAddModal, setShowAddModal]         = useState(false);
  const [showGoalModal, setShowGoalModal]       = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showCombosModal, setShowCombosModal]   = useState(false);
  const [showTrends, setShowTrends]             = useState(false);
  const [showReportCard, setShowReportCard]     = useState(false);

  const currentMonth = monthStr(new Date(selectedDate+'T12:00'));

  const { data: dayData } = useQuery({
    queryKey: NUTRITION_MEALS_KEY(selectedDate),
    queryFn: () => djangoApi.nutrition.getMeals(selectedDate),
    staleTime: 30_000,
  });
  const { data: calendarData } = useQuery({
    queryKey: NUTRITION_CALENDAR_KEY(currentMonth),
    queryFn: () => djangoApi.nutrition.getCalendar(currentMonth),
    staleTime: 60_000,
  });
  const { data: goal } = useQuery({
    queryKey: NUTRI_GOAL_KEY,
    queryFn: () => djangoApi.nutrition.getGoal(),
    staleTime: 5*60_000,
  });

  const deleteMealMut = useMutation({
    mutationFn: (id) => djangoApi.nutrition.deleteMeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NUTRITION_MEALS_KEY(selectedDate) });
      queryClient.invalidateQueries({ queryKey: ['nutrition','calendar'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition','trends'] });
      toast({ title: t('nutrition.entry_deleted','🗑️ Entry deleted') });
    },
    onError: (e) => toast({ title:'Error', description:e?.message, variant:'destructive' }),
  });

  const totals  = dayData?.totals || { calories:0, protein:0, fat:0, carbs:0 };
  const goalData = dayData?.goal || goal || { calories:2000, protein:150, fat:65, carbs:250, water_ml:2000 };
  const meals   = dayData?.meals || {};
  const isToday = selectedDate === todayStr();

  const handleOpenAddModal = (mealType='breakfast') => {
    setTargetAddMealType(mealType);
    setShowAddModal(true);
  };

  // ── Action toolbar ─────────────────────────────────────────────────────────
  const toolbar = (
    <div className="flex items-center gap-1.5">
      {[
        { icon: Utensils, action: () => setShowCombosModal(true), title: 'Saved combos', active: false },
        { icon: TrendingUp, action: () => setShowTrends(!showTrends), title: 'Trends', active: showTrends },
        { icon: Settings,  action: () => setShowGoalModal(true),  title: 'Goals', active: false },
        { icon: Share2,    action: () => setShowReportCard(true), title: 'Weekly Report', active: false, gold: true },
      ].map(({ icon: Icon, action, title, active, gold }, i) => (
        <motion.button
          key={i}
          whileTap={{ scale: 0.9 }}
          onClick={action}
          className="p-2 rounded-xl transition-all"
          title={title}
          style={{
            background: active ? 'rgba(245,158,11,0.18)' : 'var(--habit-border)',
            color: active || gold ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-text)',
            border: active ? '1px solid rgba(245,158,11,0.35)' : '1px solid transparent',
            cursor: 'pointer',
          }}
        >
          <Icon size={15} />
        </motion.button>
      ))}
    </div>
  );

  return (
    <div style={{ fontFamily:FONT }}>

      {/* ════════════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT: Two-column grid (sidebar + main)
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:grid" style={{ gridTemplateColumns:'340px 1fr', gap:20, alignItems:'start' }}>

        {/* ── LEFT SIDEBAR (sticky) ─────────────────────────────────────────── */}
        <div style={{ position:'sticky', top:80, display:'flex', flexDirection:'column', gap:14 }}>

          {/* Stats Card */}
          <div style={{ ...CARD, padding:18, boxShadow:'0 8px 32px -4px rgba(0,0,0,0.3)' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <div style={{ fontSize:17, fontWeight:900, color:'var(--habit-text)', letterSpacing:'-0.5px' }}>
                  {t('nutrition.title', 'Nutrition Tracker')}
                </div>
                <div style={{ fontSize:11, color:'var(--habit-dim)', fontWeight:700, marginTop:1 }}>
                  {isToday ? t('nutrition.today_goals', 'Today’s Targets') : formatDate(selectedDate, i18n.language)}
                </div>
              </div>
              {toolbar}
            </div>

            {/* Signature Macro Rings */}
            <div className="py-1">
              <MacroRings totals={totals} goal={goalData} compact />
            </div>

            {/* Macro bars — detailed numbers */}
            <div className="mt-3 pt-3 border-t border-[var(--habit-border)]">
              <MacroBars totals={totals} goal={goalData} />
            </div>

            {/* Calorie gauge */}
            <div className="mt-3 pt-3 border-t border-[var(--habit-border)]">
              <CalorieGauge consumed={totals.calories} goal={goalData.calories} />
            </div>
          </div>

          {/* Dynamic Date Navigator (Week & Multi-Week Horizon) */}
          <NutritionDateNavigator
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            calendarData={calendarData}
            onOpenCalendar={() => setShowCalendarModal(true)}
            goalCalories={goalData.calories}
          />

          {/* Water Tracker */}
          <WaterTracker dateStr={selectedDate} goalMl={goalData.water_ml} />

          {/* Body Weight */}
          <Suspense fallback={null}>
            <BodyWeightTracker goalData={goalData} />
          </Suspense>
        </div>

        {/* ── RIGHT MAIN COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Trends drawer */}
          <AnimatePresence>
            {showTrends && (
              <motion.div
                initial={{ opacity:0, y:-10 }}
                animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-10 }}
                transition={{ duration:0.22 }}
              >
                <Suspense fallback={null}>
                  <NutritionTrends />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Meal Cards */}
          {['breakfast','lunch','dinner','snack'].map((type, idx) => (
            <MealCard
              key={type}
              type={type}
              cardIndex={idx}
              entries={meals[type] || []}
              onAddClick={handleOpenAddModal}
              onDeleteItem={id => deleteMealMut.mutate(id)}
            />
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          MOBILE / TABLET LAYOUT: Single column
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3 pb-28 lg:hidden">

        {/* Date Navigator Card */}
        <NutritionDateNavigator
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          calendarData={calendarData}
          onOpenCalendar={() => setShowCalendarModal(true)}
          goalCalories={goalData.calories}
        />

        {/* Stats card */}
        <div style={{ ...CARD, boxShadow:'0 4px 20px -2px rgba(0,0,0,0.25)' }} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div style={{ fontWeight:900, fontSize:16, color:'var(--habit-text)' }}>
                {t('nutrition.macros_overview', 'Daily Breakdown')}
              </div>
              <div style={{ fontSize:11, color:'var(--habit-dim)', fontWeight:600 }}>
                {isToday ? t('nutrition.today', 'Today') : formatDate(selectedDate, i18n.language)}
              </div>
            </div>
            {toolbar}
          </div>

          <MacroRings totals={totals} goal={goalData} />

          <div className="mt-3 pt-3 border-t border-[var(--habit-border)]">
            <CalorieGauge consumed={totals.calories} goal={goalData.calories} />
          </div>
        </div>

        {/* Trends */}
        <AnimatePresence>
          {showTrends && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
              <Suspense fallback={null}><NutritionTrends /></Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Water & Weight */}
        <WaterTracker dateStr={selectedDate} goalMl={goalData.water_ml} />
        <Suspense fallback={null}>
          <BodyWeightTracker goalData={goalData} />
        </Suspense>

        {/* Meal cards */}
        <div className="flex flex-col gap-3">
          {['breakfast','lunch','dinner','snack'].map((type, idx) => (
            <MealCard
              key={type}
              type={type}
              cardIndex={idx}
              entries={meals[type] || []}
              onAddClick={handleOpenAddModal}
              onDeleteItem={id => deleteMealMut.mutate(id)}
            />
          ))}
        </div>

        {/* FAB — smart meal type by time of day */}
        <div className="fixed bottom-6 right-6 z-40">
          <motion.button
            whileHover={{ scale:1.08, boxShadow:'0 12px 36px rgba(245,158,11,0.6)' }}
            whileTap={{ scale:0.93 }}
            onClick={() => {
              const h = new Date().getHours();
              const smartType = h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
              handleOpenAddModal(smartType);
            }}
            className="flex items-center gap-2 px-5 py-3.5 rounded-full font-black text-sm shadow-2xl"
            style={{ background:'linear-gradient(135deg, #f59e0b, #d97706)', color:'#000', boxShadow:'0 8px 28px rgba(245,158,11,0.45)', cursor:'pointer' }}
          >
            <Plus size={18} />
            <span>{t('nutrition.add_meal_btn','Add Meal')}</span>
          </motion.button>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {showAddModal && (
            <AddMealModal dateStr={selectedDate} initialMealType={targetAddMealType} onClose={() => setShowAddModal(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showGoalModal && (
            <NutriGoalModal currentGoal={goalData} onClose={() => setShowGoalModal(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showCalendarModal && (
            <NutriCalendarModal
              selectedDate={selectedDate} goalCalories={goalData.calories}
              onSelectDate={setSelectedDate} onClose={() => setShowCalendarModal(false)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showCombosModal && (
            <SavedCombosModal dateStr={selectedDate} onClose={() => setShowCombosModal(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showReportCard && (
            <WeeklyReportCard onClose={() => setShowReportCard(false)} />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}
