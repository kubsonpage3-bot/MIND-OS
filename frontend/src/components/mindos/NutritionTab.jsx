// @ts-nocheck
import { useState, lazy, Suspense } from 'react';
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

// ─── Date Strip ───────────────────────────────────────────────────────────────
function DateStrip({ selected, onSelect, calendarData, onOpenCalendar }) {
  const { t, i18n } = useTranslation();
  const calMap = {};
  (calendarData || []).forEach(d => { calMap[d.date] = d; });
  const days = [];
  for (let i = -6; i <= 0; i++) days.push(addDays(todayStr(), i));

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-0.5 scrollbar-none">
      {days.map(d => {
        const entry = calMap[d];
        const isToday = d === todayStr();
        const isSel = d === selected;
        const cal = entry?.calories || 0;
        let dot = null;
        if (cal > 0) {
          const pct = cal / 2000;
          dot = pct >= 0.8 && pct <= 1.2 ? '#10b981' : pct > 1.2 ? '#f74e52' : '#f59e0b';
        }
        const [,,dd] = d.split('-');
        return (
          <motion.button
            key={d}
            whileTap={{ scale: 0.9 }}
            whileHover={{ y: -2 }}
            onClick={() => onSelect(d)}
            className="relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-colors min-w-[44px] flex-1 select-none"
            style={{
              background: isSel ? 'transparent' : isToday ? 'rgba(245,158,11,0.08)' : 'var(--habit-border)',
              border: isToday && !isSel ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            {isSel && (
              <motion.div
                layoutId="active-date-pill"
                className="absolute inset-0 rounded-xl"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 16px rgba(245,158,11,0.45)' }}
                transition={{ type:'spring', stiffness:480, damping:34 }}
              />
            )}
            <span className="relative z-10 text-[9px] font-extrabold uppercase tracking-wider" style={{ color: isSel ? '#000' : 'var(--habit-dim)' }}>
              {new Date(d+'T12:00').toLocaleDateString(i18n.language==='ru'?'ru-RU':'en-US', { weekday:'short' }).slice(0,3)}
            </span>
            <span className="relative z-10 text-sm font-black" style={{ color: isSel ? '#000' : 'var(--habit-text)' }}>{dd}</span>
            <div className="relative z-10" style={{
              width: 5, height: 5, borderRadius: '50%',
              background: dot || (isSel ? 'rgba(0,0,0,0.2)' : 'transparent'),
              border: dot ? 'none' : '1px solid var(--habit-border)',
            }} />
          </motion.button>
        );
      })}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onOpenCalendar}
        className="p-2.5 rounded-xl flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity shrink-0"
        style={{ background: 'var(--habit-border)' }}
      >
        <CalendarIcon size={15} />
      </motion.button>
    </div>
  );
}

// ─── Single Meal Entry Row ────────────────────────────────────────────────────
function MealEntryRow({ entry, onDelete, accentColor }) {
  const { t } = useTranslation();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all"
      style={{ background: 'var(--habit-border)' }}
      whileHover={{ backgroundColor: 'var(--habit-border)', scale: 1.005 }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
        {entry.photo_url ? (
          <img src={entry.photo_url} alt="meal" className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accentColor}20` }}>
            <Utensils size={13} style={{ color: accentColor, opacity: 0.8 }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-[12.5px] truncate" style={{ color: 'var(--habit-text)' }}>
              {entry.food_name}
            </span>
            <span className="text-[10px] font-mono opacity-50 shrink-0">{entry.amount}{entry.unit||'g'}</span>
          </div>
          <div className="flex flex-wrap gap-x-2.5 gap-y-0 text-[10px] font-bold">
            <span style={{ color: '#f59e0b' }}>{Math.round(entry.calories)} kcal</span>
            <span style={{ color: '#3b82f6' }}>P {Math.round(entry.protein)}g</span>
            <span style={{ color: '#f97316' }}>F {Math.round(entry.fat)}g</span>
            <span style={{ color: '#10b981' }}>C {Math.round(entry.carbs)}g</span>
            {entry.note && <span className="opacity-40 italic font-normal truncate max-w-[100px]">· {entry.note}</span>}
          </div>
        </div>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0"
        title={t('nutrition.delete_entry', 'Delete')}
        style={{ color: 'var(--habit-dim)' }}
      >
        <Trash2 size={13} />
      </button>
    </motion.div>
  );
}

// ─── Collapsible Meal Section Card ───────────────────────────────────────────
function MealCard({ type, entries = [], onAddClick, onDeleteItem }) {
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
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'var(--habit-panel)',
        border: '1px solid var(--habit-border)',
        borderLeft: `3px solid ${meta.color}`,
        boxShadow: `0 0 0 0 ${meta.glow}`,
        transition: 'box-shadow 0.3s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 20px -4px ${meta.glow}`}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 0 transparent'}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-3 text-left flex-1" style={{ cursor:'pointer' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all" style={{ background: meta.bg }}>
            <Icon size={15} style={{ color: meta.color }} />
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--habit-text)', letterSpacing:'-0.2px' }}>{label}</div>
            {entries.length > 0 ? (
              <div className="flex gap-2.5 mt-0.5 text-[10.5px] font-bold">
                <span style={{ color:'#f59e0b' }}>{Math.round(totalCal)} kcal</span>
                <span style={{ color:'#3b82f6' }}>P {Math.round(totalP)}g</span>
                <span style={{ color:'#f97316' }}>F {Math.round(totalF)}g</span>
                <span style={{ color:'#10b981' }}>C {Math.round(totalC)}g</span>
              </div>
            ) : (
              <div className="text-[10px] mt-0.5" style={{ color:'var(--habit-dim)' }}>{t('nutrition.no_entries','No entries')}</div>
            )}
          </div>
        </button>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => onAddClick(type)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all"
            style={{ background: meta.bg, color: meta.color, border:`1px solid ${meta.color}30`, cursor:'pointer' }}
          >
            <Plus size={12} /> {t('nutrition.add_food','Add')}
          </motion.button>
          <button onClick={() => setIsOpen(!isOpen)} className="p-1 opacity-40 hover:opacity-100 transition-opacity">
            {isOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
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
                <div
                  onClick={() => onAddClick(type)}
                  className="py-6 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed cursor-pointer transition-all hover:border-opacity-60"
                  style={{ borderColor: `${meta.color}30`, background: `${meta.color}05` }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: meta.bg }}>
                    <Plus size={14} style={{ color: meta.color }} />
                  </div>
                  <span className="text-[11px] font-semibold" style={{ color:'var(--habit-dim)' }}>
                    {t('nutrition.tap_to_log','Click to log')} {label.toLowerCase()}
                  </span>
                </div>
              ) : (
                <AnimatePresence>
                  {entries.map(entry => (
                    <MealEntryRow key={entry.id} entry={entry} onDelete={onDeleteItem} accentColor={meta.color} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Calorie Gauge Bar ────────────────────────────────────────────────────────
function CalorieGauge({ consumed, goal }) {
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const isOver = consumed > goal;
  const remaining = goal - consumed;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-bold">
        <span style={{ color:'var(--habit-dim)' }}>Consumed</span>
        <div className="flex items-center gap-1.5">
          <Flame size={13} style={{ color: isOver ? '#f74e52' : '#f59e0b' }} />
          <span style={{ color: isOver ? '#f74e52' : '#10b981', fontWeight:900, fontSize:13 }}>
            {isOver
              ? `+${Math.abs(remaining)} kcal over`
              : `${Math.round(remaining)} kcal left`}
          </span>
        </div>
        <span style={{ color:'var(--habit-dim)' }}>Goal {Math.round(goal)}</span>
      </div>
      <div style={{ height:8, borderRadius:999, background:'var(--habit-border)', overflow:'hidden', position:'relative' }}>
        <motion.div
          style={{
            height:'100%', borderRadius:999,
            background: isOver
              ? 'linear-gradient(90deg, #f59e0b, #f74e52)'
              : 'linear-gradient(90deg, #f59e0b, #10b981)',
            boxShadow: isOver ? '0 0 12px rgba(247,78,82,0.5)' : '0 0 12px rgba(245,158,11,0.4)',
          }}
          initial={{ width:0 }}
          animate={{ width:`${pct*100}%` }}
          transition={{ duration:0.9, ease:[0.16,1,0.3,1] }}
        />
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
          <div style={{ ...CARD, padding:20, boxShadow:'0 8px 32px -4px rgba(0,0,0,0.3)' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div style={{ fontSize:22, fontWeight:900, color:'var(--habit-text)', letterSpacing:'-0.5px' }}>
                  {isToday ? '📅 ' + t('nutrition.today','Today') : formatDate(selectedDate, i18n.language)}
                </div>
                <div style={{ fontSize:12, color:'var(--habit-dim)', fontWeight:600, marginTop:1 }}>
                  {new Date(selectedDate+'T12:00').toLocaleDateString(i18n.language==='ru'?'ru-RU':'en-US', { weekday:'long' })}
                </div>
              </div>
              {toolbar}
            </div>

            {/* Calorie gauge */}
            <CalorieGauge consumed={totals.calories} goal={goalData.calories} />

            {/* Macro bars */}
            <div className="mt-5">
              <MacroBars totals={totals} goal={goalData} />
            </div>

            {/* Mini stat chips */}
            <div className="grid grid-cols-4 gap-2 mt-5">
              <StatChip label="Protein" value={totals.protein} color="#3b82f6" unit="g" />
              <StatChip label="Fat"     value={totals.fat}     color="#f97316" unit="g" />
              <StatChip label="Carbs"   value={totals.carbs}   color="#10b981" unit="g" />
              <StatChip label="Logged"  value={Object.values(meals).flat().length} color="var(--habit-dim)" />
            </div>
          </div>

          {/* Date navigation */}
          <div style={{ ...CARD, padding:'10px 12px' }}>
            <div className="flex items-center gap-2 mb-2.5">
              <button
                onClick={() => setSelectedDate(addDays(selectedDate,-1))}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                style={{ background:'var(--habit-border)' }}
              >
                <ChevronLeft size={15} />
              </button>
              <div className="flex-1 text-center">
                <span style={{ fontSize:12, fontWeight:800, color:'var(--habit-text)' }}>
                  {isToday ? t('nutrition.today','Today') : formatDate(selectedDate, i18n.language)}
                </span>
              </div>
              <button
                onClick={() => setSelectedDate(addDays(selectedDate,1))}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                style={{ background:'var(--habit-border)' }}
              >
                <ChevronRight size={15} />
              </button>
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(todayStr())}
                  className="px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase"
                  style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b' }}
                >
                  Now
                </button>
              )}
            </div>
            <DateStrip
              selected={selectedDate} onSelect={setSelectedDate}
              calendarData={calendarData} onOpenCalendar={() => setShowCalendarModal(true)}
            />
          </div>

          {/* Water Tracker */}
          <WaterTracker dateStr={selectedDate} goalMl={goalData.water_ml} />

          {/* Body Weight */}
          <Suspense fallback={null}>
            <BodyWeightTracker goalData={goalData} />
          </Suspense>

          {/* Quick Add FAB */}
          <motion.button
            whileHover={{ scale:1.02 }}
            whileTap={{ scale:0.97 }}
            onClick={() => handleOpenAddModal('breakfast')}
            className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2"
            style={{
              background:'linear-gradient(135deg, #f59e0b, #d97706)',
              color:'#000',
              boxShadow:'0 4px 20px rgba(245,158,11,0.35)',
              cursor:'pointer',
            }}
          >
            <Plus size={16} /> {t('nutrition.add_meal_btn','Add Meal')}
          </motion.button>
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
          {['breakfast','lunch','dinner','snack'].map(type => (
            <MealCard
              key={type}
              type={type}
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

        {/* Stats card */}
        <div style={{ ...CARD, boxShadow:'0 4px 20px -2px rgba(0,0,0,0.25)' }} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedDate(addDays(selectedDate,-1))}
                className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
                style={{ background:'var(--habit-border)' }}
              >
                <ChevronLeft size={15} />
              </button>
              <div className="px-1 text-center">
                <div style={{ fontWeight:900, fontSize:16, color:'var(--habit-text)' }}>
                  {isToday ? t('nutrition.today','Today') : formatDate(selectedDate, i18n.language)}
                </div>
                <div style={{ fontSize:11, color:'var(--habit-dim)', fontWeight:600 }}>
                  {new Date(selectedDate+'T12:00').toLocaleDateString(i18n.language==='ru'?'ru-RU':'en-US', { weekday:'long' })}
                </div>
              </div>
              <button
                onClick={() => setSelectedDate(addDays(selectedDate,1))}
                className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
                style={{ background:'var(--habit-border)' }}
              >
                <ChevronRight size={15} />
              </button>
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(todayStr())}
                  className="px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase ml-1"
                  style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b' }}
                >
                  {t('nutrition.today','Today')}
                </button>
              )}
            </div>
            {toolbar}
          </div>

          <MacroRings totals={totals} goal={goalData} />

          <div className="mt-3 pt-3 border-t border-[var(--habit-border)]">
            <CalorieGauge consumed={totals.calories} goal={goalData.calories} />
          </div>
        </div>

        {/* Date Strip */}
        <div style={CARD} className="p-2.5">
          <DateStrip
            selected={selectedDate} onSelect={setSelectedDate}
            calendarData={calendarData} onOpenCalendar={() => setShowCalendarModal(true)}
          />
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
          {['breakfast','lunch','dinner','snack'].map(type => (
            <MealCard
              key={type}
              type={type}
              entries={meals[type] || []}
              onAddClick={handleOpenAddModal}
              onDeleteItem={id => deleteMealMut.mutate(id)}
            />
          ))}
        </div>

        {/* FAB */}
        <div className="fixed bottom-6 right-6 z-40">
          <motion.button
            whileHover={{ scale:1.06 }}
            whileTap={{ scale:0.93 }}
            onClick={() => handleOpenAddModal('breakfast')}
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
