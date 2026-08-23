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
import MacroRings from './MacroRings';
import WaterTracker from './WaterTracker';
import {
  Plus,
  Settings,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  TrendingUp,
  Utensils,
  UtensilsCrossed,
  Sunrise,
  Sun,
  Moon,
  Apple,
  Flame,
} from 'lucide-react';

const AddMealModal = lazy(() => import('./AddMealModal'));
const NutriGoalModal = lazy(() => import('./NutriGoalModal'));
const NutriCalendarModal = lazy(() => import('./NutriCalendarModal'));
const SavedCombosModal = lazy(() => import('./SavedCombosModal'));
const NutritionTrends = lazy(() => import('./NutritionTrends'));

// ─── Utils ─────────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(dateStr, lang = 'en') {
  const [y, m, day] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, day);
  return date.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' });
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const MEAL_META = {
  breakfast: {
    key: 'breakfast',
    defaultLabel: 'Breakfast',
    icon: Sunrise,
    color: 'var(--habit-gold, #ffbe5d)',
    bg: 'rgba(255, 190, 93, 0.15)',
  },
  lunch: {
    key: 'lunch',
    defaultLabel: 'Lunch',
    icon: Sun,
    color: 'var(--habit-orange, #ff8800)',
    bg: 'rgba(255, 136, 0, 0.15)',
  },
  dinner: {
    key: 'dinner',
    defaultLabel: 'Dinner',
    icon: Moon,
    color: 'var(--habit-purple, #7B61FF)',
    bg: 'rgba(123, 97, 255, 0.15)',
  },
  snack: {
    key: 'snack',
    defaultLabel: 'Snacks & Other',
    icon: Apple,
    color: 'var(--habit-green, #1ca830)',
    bg: 'rgba(28, 168, 48, 0.15)',
  },
};

const CARD_STYLE = {
  background: 'var(--habit-panel)',
  border: '1px solid var(--habit-border)',
  borderRadius: 18,
  fontFamily: "'Nunito', sans-serif",
};

// ─── Mini Strip Calendar with Sliding Pill ────────────────────────────────────
function DateStrip({ selected, onSelect, calendarData, onOpenCalendar }) {
  const { t, i18n } = useTranslation();
  const calMap = {};
  (calendarData || []).forEach((d) => {
    calMap[d.date] = d;
  });

  const days = [];
  for (let i = -6; i <= 0; i++) days.push(addDays(todayStr(), i));

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-0.5 scrollbar-none">
      {days.map((d) => {
        const entry = calMap[d];
        const isToday = d === todayStr();
        const isSel = d === selected;
        const cal = entry?.calories || 0;

        let dot = null;
        if (cal > 0) {
          const pct = cal / 2000;
          dot =
            pct >= 0.8 && pct <= 1.2
              ? 'var(--habit-green, #1ca830)'
              : pct > 1.2
              ? 'var(--habit-red, #f74e52)'
              : 'var(--habit-gold, #ffbe5d)';
        }

        const [, , dd] = d.split('-');
        return (
          <motion.button
            key={d}
            whileTap={{ scale: 0.92 }}
            whileHover={{ y: -1.5 }}
            onClick={() => onSelect(d)}
            className="relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors min-w-[42px] flex-1 select-none"
            style={{
              background: isSel ? 'transparent' : isToday ? 'rgba(255, 190, 93, 0.1)' : 'var(--habit-border)',
              border: isToday && !isSel ? '1px solid rgba(255, 190, 93, 0.35)' : '1px solid transparent',
              color: isSel ? '#000' : 'var(--habit-text)',
              cursor: 'pointer',
            }}
          >
            {/* Sliding Active Pill */}
            {isSel && (
              <motion.div
                layoutId="active-date-pill"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'var(--habit-gold, #ffbe5d)',
                  boxShadow: '0 2px 10px rgba(255, 190, 93, 0.4)',
                }}
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}

            <span
              className="relative z-10 text-[9.5px] font-extrabold"
              style={{
                color: isSel ? '#000' : 'var(--habit-dim, #888)',
              }}
            >
              {new Date(d + 'T12:00').toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' }).toUpperCase()}
            </span>
            <span className="relative z-10 text-[13px] font-black">{dd}</span>
            <div
              className="relative z-10"
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: dot || (isSel ? 'rgba(0,0,0,0.2)' : 'transparent'),
                border: dot ? 'none' : '1px solid var(--habit-border)',
              }}
            />
          </motion.button>
        );
      })}

      {/* Calendar modal trigger */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        whileHover={{ y: -1.5 }}
        onClick={onOpenCalendar}
        className="p-2.5 rounded-xl flex items-center justify-center transition-all opacity-80 hover:opacity-100 shrink-0"
        style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
        title={t('nutrition.open_calendar', 'Open full calendar')}
      >
        <CalendarIcon size={16} />
      </motion.button>
    </div>
  );
}

// ─── Collapsible Meal Section ─────────────────────────────────────────────────
function CollapsibleMealCard({ type, entries = [], onAddClick, onDeleteItem }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const meta = MEAL_META[type] || {
    key: type,
    defaultLabel: type,
    icon: Utensils,
    color: 'var(--habit-gold, #ffbe5d)',
    bg: 'rgba(255, 190, 93, 0.15)',
  };
  const IconComponent = meta.icon;
  const mealLabel = t(`nutrition.meals.${meta.key}`, meta.defaultLabel);

  const totalCal = entries.reduce((s, e) => s + (e.calories || 0), 0);
  const totalP = entries.reduce((s, e) => s + (e.protein || 0), 0);
  const totalF = entries.reduce((s, e) => s + (e.fat || 0), 0);
  const totalC = entries.reduce((s, e) => s + (e.carbs || 0), 0);

  return (
    <div
      className="rounded-2xl transition-all overflow-hidden mb-3"
      style={{
        background: 'var(--habit-panel)',
        border: '1px solid var(--habit-border)',
        borderLeft: `3.5px solid ${meta.color}`,
      }}
    >
      {/* Category Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--habit-border)]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 text-left flex-1"
          style={{ cursor: 'pointer' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: meta.bg, color: meta.color }}
          >
            <IconComponent size={15} />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--habit-text)' }}>
              {mealLabel}
            </div>
            {entries.length > 0 ? (
              <div className="flex gap-2 text-[10.5px] font-bold mt-0.5">
                <span style={{ color: 'var(--habit-gold, #ffbe5d)' }}>
                  {Math.round(totalCal)} {t('nutrition.kcal', 'kcal')}
                </span>
                <span style={{ color: 'var(--habit-blue, #50b5e9)' }}>
                  {t('nutrition.macros.p_short', 'P')}:{Math.round(totalP)}{t('nutrition.g', 'g')}
                </span>
                <span style={{ color: 'var(--habit-orange, #ff8800)' }}>
                  {t('nutrition.macros.f_short', 'F')}:{Math.round(totalF)}{t('nutrition.g', 'g')}
                </span>
                <span style={{ color: 'var(--habit-green, #1ca830)' }}>
                  {t('nutrition.macros.c_short', 'C')}:{Math.round(totalC)}{t('nutrition.g', 'g')}
                </span>
              </div>
            ) : (
              <div className="text-[10px] text-[var(--habit-dim)] font-medium">
                {t('nutrition.no_entries', 'No entries')}
              </div>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ y: -1 }}
            onClick={() => onAddClick(type)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition-all"
            style={{
              background: meta.bg,
              color: meta.color,
              border: `1px solid ${meta.color}40`,
              cursor: 'pointer',
            }}
          >
            <Plus size={12} />
            <span>{t('nutrition.add_food', 'Add')}</span>
          </motion.button>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 opacity-50 hover:opacity-100 transition-opacity"
          >
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Items List */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="p-2.5 space-y-1.5"
          >
            {entries.length === 0 ? (
              <div className="py-5 px-3 flex flex-col items-center justify-center text-center gap-1 rounded-xl border border-dashed border-[var(--habit-border)]">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center opacity-30 mb-0.5"
                  style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
                >
                  <UtensilsCrossed size={14} />
                </div>
                <span className="text-[11px] font-semibold" style={{ color: 'var(--habit-dim, #888)' }}>
                  {t('nutrition.tap_to_log', 'Tap «Add» to log {{meal}}', { meal: mealLabel.toLowerCase() })}
                </span>
              </div>
            ) : (
              entries.map((entry) => (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl group transition-all"
                  style={{ background: 'var(--habit-border)' }}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    {entry.photo_url ? (
                      <img
                        src={entry.photo_url}
                        alt="meal"
                        className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-40 shrink-0"
                        style={{ background: 'var(--habit-panel)' }}
                      >
                        <Utensils size={13} />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate text-[var(--habit-text)]">
                          {entry.food_name}
                        </span>
                        <span className="text-[10px] opacity-60 font-mono shrink-0">
                          {entry.amount}{entry.unit || t('nutrition.g', 'g')}
                        </span>
                      </div>
                      <div className="flex gap-2 text-[10px] font-bold mt-0.5">
                        <span style={{ color: 'var(--habit-gold, #ffbe5d)' }}>
                          {entry.calories} {t('nutrition.kcal', 'kcal')}
                        </span>
                        <span style={{ color: 'var(--habit-blue, #50b5e9)' }}>
                          {t('nutrition.macros.p_short', 'P')} {entry.protein}{t('nutrition.g', 'g')}
                        </span>
                        <span style={{ color: 'var(--habit-orange, #ff8800)' }}>
                          {t('nutrition.macros.f_short', 'F')} {entry.fat}{t('nutrition.g', 'g')}
                        </span>
                        <span style={{ color: 'var(--habit-green, #1ca830)' }}>
                          {t('nutrition.macros.c_short', 'C')} {entry.carbs}{t('nutrition.g', 'g')}
                        </span>
                        {entry.note && (
                          <span className="opacity-50 italic truncate max-w-[120px] font-normal">
                            · {entry.note}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteItem(entry.id)}
                    className="p-1 opacity-30 hover:opacity-100 hover:text-red-400 transition-all shrink-0"
                    title={t('nutrition.delete_entry', 'Delete entry')}
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main NutritionTab ────────────────────────────────────────────────────────
export default function NutritionTab() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [targetAddMealType, setTargetAddMealType] = useState('breakfast');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showCombosModal, setShowCombosModal] = useState(false);
  const [showTrends, setShowTrends] = useState(false);

  const currentMonth = monthStr(new Date(selectedDate + 'T12:00'));

  // ── Queries ──────────────────────────────────────────────────────────────────
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
    staleTime: 5 * 60_000,
  });

  // ── Delete mutation ───────────────────────────────────────────────────────────
  const deleteMealMut = useMutation({
    mutationFn: (id) => djangoApi.nutrition.deleteMeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NUTRITION_MEALS_KEY(selectedDate) });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'calendar'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'trends'] });
      toast({ title: t('nutrition.entry_deleted', '🗑️ Entry deleted') });
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  const totals = dayData?.totals || { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const goalData = dayData?.goal || goal || { calories: 2000, protein: 150, fat: 65, carbs: 250, water_ml: 2000 };
  const meals = dayData?.meals || {};

  const isToday = selectedDate === todayStr();
  const remainingCal = Math.round(goalData.calories - totals.calories);

  const handleOpenAddModal = (mealType = 'breakfast') => {
    setTargetAddMealType(mealType);
    setShowAddModal(true);
  };

  return (
    <div className="flex flex-col gap-3 pb-24 font-sans">
      {/* ── Top Bar & Actions (Elevated Stats Card) ────────────────────────── */}
      <div
        style={{
          ...CARD_STYLE,
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.25)',
        }}
        className="p-4"
      >
        <div className="flex items-center justify-between mb-3">
          {/* Date Selector */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
              style={{ background: 'var(--habit-border)' }}
            >
              <ChevronLeft size={16} />
            </button>

            <div className="px-1 text-center">
              <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--habit-text)' }}>
                {isToday ? t('nutrition.today', 'Today') : formatDate(selectedDate, i18n.language)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--habit-dim, #888)', fontWeight: 700 }}>
                {new Date(selectedDate + 'T12:00').toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long' })}
              </div>
            </div>

            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
              style={{ background: 'var(--habit-border)' }}
            >
              <ChevronRight size={16} />
            </button>

            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayStr())}
                className="px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase ml-1"
                style={{
                  background: 'rgba(255, 190, 93, 0.15)',
                  color: 'var(--habit-gold, #ffbe5d)',
                }}
              >
                {t('nutrition.today', 'Today')}
              </button>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowCombosModal(true)}
              className="p-2 rounded-xl transition-all opacity-80 hover:opacity-100"
              style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
              title={t('nutrition.combos.title', 'Saved meal combos')}
            >
              <Utensils size={15} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowTrends(!showTrends)}
              className="p-2 rounded-xl transition-all opacity-80 hover:opacity-100"
              style={{
                background: showTrends ? 'rgba(255, 190, 93, 0.2)' : 'var(--habit-border)',
                color: showTrends ? 'var(--habit-gold, #ffbe5d)' : 'var(--habit-text)',
              }}
              title={t('nutrition.trends.title', 'Trends & analytics')}
            >
              <TrendingUp size={15} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowGoalModal(true)}
              className="p-2 rounded-xl transition-all opacity-80 hover:opacity-100"
              style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
              title={t('nutrition.goal_modal.title', 'Configure nutrition goals')}
            >
              <Settings size={15} />
            </motion.button>
          </div>
        </div>

        {/* Macro Rings */}
        <MacroRings totals={totals} goal={goalData} />

        {/* Calories Remaining Banner */}
        <div className="text-center mt-2.5 pt-2.5 border-t border-[var(--habit-border)] flex items-center justify-center gap-1.5 text-xs font-bold">
          <Flame size={14} style={{ color: remainingCal >= 0 ? 'var(--habit-gold, #ffbe5d)' : 'var(--habit-red, #f74e52)' }} />
          <span style={{ color: 'var(--habit-dim, #888)', fontWeight: 600 }}>
            {t('nutrition.remaining', 'Remaining:')}
          </span>
          <span
            style={{
              color: remainingCal >= 0 ? 'var(--habit-green, #1ca830)' : 'var(--habit-red, #f74e52)',
              fontWeight: 900,
            }}
          >
            {remainingCal >= 0
              ? `${remainingCal} ${t('nutrition.kcal', 'kcal')}`
              : `+${Math.abs(remainingCal)} ${t('nutrition.kcal', 'kcal')} (${t('nutrition.over_budget', 'over')})`}
          </span>
        </div>
      </div>

      {/* ── 7-Day Strip Navigation ─────────────────────────────────────────── */}
      <div style={CARD_STYLE} className="p-2">
        <DateStrip
          selected={selectedDate}
          onSelect={setSelectedDate}
          calendarData={calendarData}
          onOpenCalendar={() => setShowCalendarModal(true)}
        />
      </div>

      {/* ── Toggable Trends & Analytics Drawer ─────────────────────────────── */}
      <AnimatePresence>
        {showTrends && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Suspense fallback={null}>
              <NutritionTrends />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Water Tracker ──────────────────────────────────────────────────── */}
      <WaterTracker dateStr={selectedDate} goalMl={goalData.water_ml} />

      {/* ── Collapsible Meal Categories ─────────────────────────────────────── */}
      <div>
        {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
          <CollapsibleMealCard
            key={type}
            type={type}
            entries={meals[type] || []}
            onAddClick={handleOpenAddModal}
            onDeleteItem={(id) => deleteMealMut.mutate(id)}
          />
        ))}
      </div>

      {/* ── Floating Add Button for Mobile ─────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => handleOpenAddModal('breakfast')}
          className="flex items-center gap-2 px-4 py-3 rounded-full font-black text-sm shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, var(--habit-gold, #ffbe5d), #d97706)',
            color: '#000',
            boxShadow: '0 8px 24px rgba(255, 190, 93, 0.4)',
          }}
        >
          <Plus size={18} />
          <span>{t('nutrition.add_meal_btn', 'Add Meal')}</span>
        </motion.button>
      </div>

      {/* ── Lazy Loaded Modals ─────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {showAddModal && (
            <AddMealModal
              dateStr={selectedDate}
              initialMealType={targetAddMealType}
              onClose={() => setShowAddModal(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showGoalModal && (
            <NutriGoalModal
              currentGoal={goalData}
              onClose={() => setShowGoalModal(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCalendarModal && (
            <NutriCalendarModal
              selectedDate={selectedDate}
              goalCalories={goalData.calories}
              onSelectDate={setSelectedDate}
              onClose={() => setShowCalendarModal(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCombosModal && (
            <SavedCombosModal
              dateStr={selectedDate}
              onClose={() => setShowCombosModal(false)}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}
