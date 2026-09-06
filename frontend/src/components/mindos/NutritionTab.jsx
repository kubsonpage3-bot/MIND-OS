// @ts-nocheck
/**
 * NutritionTab — the LIFE OS · Eat Journal.
 *
 * Layout contract:
 *   desktop → sticky summary rail on the left, the day's log on the right
 *   mobile  → one column, log-first, with a time-aware floating add button
 *
 * This module owns data + mutations only; every visual block lives in its own
 * component so the two layouts can compose the same pieces differently.
 */

import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import {
  NUTRITION_MEALS_KEY,
  NUTRITION_CALENDAR_KEY,
  NUTRI_GOAL_KEY,
  NUTRITION_RECENT_KEY,
} from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { hapticLight, hapticSuccess } from '@/hooks/useHaptic';
import useNutritionShortcuts from '@/hooks/useNutritionShortcuts';
import {
  Plus, Settings, TrendingUp, Utensils, Share2, Calculator, X,
  Calendar as CalendarIcon, Keyboard,
} from 'lucide-react';

import WaterTracker from './WaterTracker';
import NutritionDateNavigator from './NutritionDateNavigator';
import NutriDaySummary from './NutriDaySummary';
import NutriMealCard from './NutriMealCard';
import NutriQuickAdd from './NutriQuickAdd';
import NutriInsightBar from './NutriInsightBar';
import { SummarySkeleton, MealCardSkeleton } from './NutriSkeletons';

import {
  todayStr, monthStr, formatDate, formatWeekday, addDays, relativeDayKey,
  MEAL_ORDER, mealMeta, smartMealType, calculateStreak, calculatePace, dayInsight,
} from '@/lib/nutritionUtils';

const AddMealModal = lazy(() => import('./AddMealModal'));
const NutriGoalModal = lazy(() => import('./NutriGoalModal'));
const NutriCalendarModal = lazy(() => import('./NutriCalendarModal'));
const SavedCombosModal = lazy(() => import('./SavedCombosModal'));
const NutritionTrends = lazy(() => import('./NutritionTrends'));
const BodyWeightTracker = lazy(() => import('./BodyWeightTracker'));
const WeeklyReportCard = lazy(() => import('./WeeklyReportCard'));

const EMPTY_TOTALS = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0, saturated_fat: 0 };
const FALLBACK_GOAL = { calories: 2000, protein: 150, fat: 65, carbs: 250, water_ml: 2000 };

// ─── TDEE calculator discoverability hint ────────────────────────────────────
// The calculator lives inside the goals modal; this just points at it once.
function TdeeHint({ onOpenCalculator }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('nutriTdeeHintDismissed') === '1'; } catch { return false; }
  });
  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl mb-3"
      style={{ background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.26)' }}
    >
      <Calculator size={15} style={{ color: 'var(--ej-kcal)', flexShrink: 0 }} />
      <span className="flex-1" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ej-text)' }}>
        {t('nutrition.tdee_hint_cta', "Don't know your calorie target? Calculate it in 30 seconds.")}
      </span>
      <button
        type="button"
        onClick={onOpenCalculator}
        className="ej-chip shrink-0"
        style={{ background: 'var(--ej-kcal)', color: '#000', borderColor: 'transparent' }}
      >
        {t('nutrition.tdee_hint_btn', 'Calculate')}
      </button>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          try { localStorage.setItem('nutriTdeeHintDismissed', '1'); } catch { /* ignore */ }
        }}
        className="ej-icon-btn shrink-0"
        style={{ width: 24, height: 24, color: 'var(--ej-dim)' }}
        aria-label={t('nutrition.tdee_hint_dismiss', 'Dismiss')}
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

// ─── Shortcut cheat sheet (desktop only) ─────────────────────────────────────
function ShortcutSheet({ onClose }) {
  const { t } = useTranslation();
  const rows = [
    ['A', t('nutrition.shortcuts.add', 'Add a meal')],
    ['← →', t('nutrition.shortcuts.nav', 'Previous / next day')],
    ['T', t('nutrition.shortcuts.today', 'Jump to today')],
    ['W', t('nutrition.shortcuts.water', 'Add a glass of water')],
    ['C', t('nutrition.shortcuts.calendar', 'Open the calendar')],
    ['G', t('nutrition.shortcuts.goals', 'Goals & macros')],
    ['R', t('nutrition.shortcuts.trends', 'Toggle trends')],
  ];
  return (
    <div
      className="fixed inset-0 z-[70] hidden lg:flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="ej-card"
        style={{ padding: 22, minWidth: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <Keyboard size={16} style={{ color: 'var(--ej-kcal)' }} />
          <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--ej-text)' }}>
            {t('nutrition.shortcuts.title', 'Keyboard shortcuts')}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-6">
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ej-dim)' }}>{label}</span>
              <kbd
                className="ej-num"
                style={{
                  fontSize: 11, fontWeight: 900, color: 'var(--ej-text)', padding: '3px 8px',
                  borderRadius: 6, background: 'var(--ej-surface-sunken)', border: '1px solid var(--ej-hairline)',
                }}
              >
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NutritionTab() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [targetAddMealType, setTargetAddMealType] = useState(() => smartMealType());
  const [prefillFood, setPrefillFood] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalModalTab, setGoalModalTab] = useState('goals');
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showCombosModal, setShowCombosModal] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [showReportCard, setShowReportCard] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const currentMonth = monthStr(new Date(`${selectedDate}T12:00`));
  const isToday = selectedDate === todayStr();

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: dayData, isLoading: dayLoading } = useQuery({
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

  const totals = dayData?.totals || EMPTY_TOTALS;
  const goalData = dayData?.goal || goal || FALLBACK_GOAL;
  const meals = dayData?.meals || {};

  const invalidateDay = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: NUTRITION_MEALS_KEY(selectedDate) });
    queryClient.invalidateQueries({ queryKey: ['nutrition', 'calendar'] });
    queryClient.invalidateQueries({ queryKey: ['nutrition', 'trends'] });
    queryClient.invalidateQueries({ queryKey: NUTRITION_RECENT_KEY });
  }, [queryClient, selectedDate]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  /** Re-create a just-deleted entry. Undo is what makes delete safe to one-tap. */
  const restoreMut = useMutation({
    mutationFn: ({ entry, mealType }) => djangoApi.nutrition.addMeal({
      date: selectedDate,
      meal_type: mealType,
      amount: entry.amount,
      food_item_id: entry.food_item_id,
      note: entry.note || '',
      photo_url: entry.photo_url || '',
    }),
    onSuccess: () => {
      invalidateDay();
      toast({ title: t('nutrition.entry_restored', '↩️ Entry restored') });
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  const deleteMealMut = useMutation({
    mutationFn: ({ entry }) => djangoApi.nutrition.deleteMeal(entry.id),
    // Optimistic: the row disappears on tap instead of after a round trip.
    onMutate: async ({ entry, mealType }) => {
      const key = NUTRITION_MEALS_KEY(selectedDate);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old) => {
        if (!old) return old;
        const list = old.meals?.[mealType] || [];
        const next = list.filter((e) => e.id !== entry.id);
        const nextTotals = { ...old.totals };
        for (const k of ['calories', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'sodium', 'saturated_fat']) {
          nextTotals[k] = Math.max(0, Math.round(((nextTotals[k] || 0) - (entry[k] || 0)) * 10) / 10);
        }
        return { ...old, meals: { ...old.meals, [mealType]: next }, totals: nextTotals };
      });
      return { previous, key };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous);
      toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' });
    },
    onSuccess: (_res, { entry, mealType }) => {
      invalidateDay();
      toast({
        title: t('nutrition.entry_deleted', '🗑️ Entry deleted'),
        description: entry.food_name,
        action: (
          <ToastAction
            altText={t('nutrition.undo', 'Undo')}
            onClick={() => restoreMut.mutate({ entry, mealType })}
          >
            {t('nutrition.undo', 'Undo')}
          </ToastAction>
        ),
      });
    },
  });

  const updateAmountMut = useMutation({
    mutationFn: ({ id, amount }) => djangoApi.nutrition.updateMeal(id, { amount }),
    onSuccess: () => {
      hapticSuccess();
      invalidateDay();
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  // ── Derived insight ────────────────────────────────────────────────────────
  const streak = useMemo(() => calculateStreak(calendarData), [calendarData]);
  const pace = useMemo(
    () => calculatePace({ consumed: totals.calories || 0, goal: goalData.calories || 0 }),
    [totals.calories, goalData.calories],
  );
  const insight = useMemo(
    () => dayInsight({ totals, goal: goalData, meals, pace }),
    [totals, goalData, meals, pace],
  );

  const liveSlot = isToday ? smartMealType() : null;

  // ── Actions ────────────────────────────────────────────────────────────────
  const openAddModal = useCallback((mealType = smartMealType(), food = null) => {
    hapticLight();
    setTargetAddMealType(mealType);
    setPrefillFood(food);
    setShowAddModal(true);
  }, []);

  const addWaterGlass = useCallback(async () => {
    try {
      await djangoApi.nutrition.updateWater({ date: selectedDate, delta_ml: 250 });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'water'] });
      queryClient.invalidateQueries({ queryKey: NUTRITION_MEALS_KEY(selectedDate) });
      hapticSuccess();
      toast({ title: t('nutrition.water.added', '💧 +250 ml') });
    } catch (e) {
      toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' });
    }
  }, [selectedDate, queryClient, t]);

  useNutritionShortcuts({
    onAdd: () => openAddModal(smartMealType()),
    onToday: () => setSelectedDate(todayStr()),
    onPrevDay: () => setSelectedDate((d) => addDays(d, -1)),
    onNextDay: () => setSelectedDate((d) => addDays(d, 1)),
    onWater: addWaterGlass,
    onGoals: () => { setGoalModalTab('goals'); setShowGoalModal(true); },
    onCalendar: () => setShowCalendarModal(true),
    onTrends: () => setShowTrends((v) => !v),
    onHelp: () => setShowShortcuts((v) => !v),
  });

  const anyModalOpen = showAddModal || showGoalModal || showCalendarModal || showCombosModal || showReportCard;

  // ── Shared pieces ──────────────────────────────────────────────────────────
  const toolbar = (
    <div className="flex items-center gap-1 shrink-0">
      {[
        { icon: Utensils, onClick: () => setShowCombosModal(true), label: t('nutrition.saved_combos', 'Saved meal combos') },
        { icon: CalendarIcon, onClick: () => setShowCalendarModal(true), label: `${t('nutrition.open_calendar', 'Open full calendar')} (C)` },
        { icon: TrendingUp, onClick: () => setShowTrends((v) => !v), label: `${t('nutrition.trends_title', 'Trends & analytics')} (R)`, active: showTrends },
        { icon: Settings, onClick: () => { setGoalModalTab('goals'); setShowGoalModal(true); }, label: `${t('nutrition.goal_settings', 'Configure nutrition goals')} (G)` },
        { icon: Share2, onClick: () => setShowReportCard(true), label: t('nutrition.weekly_report', 'Weekly report card') },
      ].map(({ icon: Icon, onClick, label, active }) => (
        <button
          key={label}
          type="button"
          onClick={() => { hapticLight(); onClick(); }}
          className="ej-icon-btn"
          data-active={active ? 'true' : 'false'}
          title={label}
          aria-label={label}
          style={{ width: 30, height: 30 }}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );

  const dayLabelKey = relativeDayKey(selectedDate);
  const summaryTitle = dayLabelKey
    ? t(`nutrition.day.${dayLabelKey}`, { defaultValue: dayLabelKey === 'today' ? 'Today' : dayLabelKey === 'yesterday' ? 'Yesterday' : 'Tomorrow' })
    : formatWeekday(selectedDate, i18n.language);
  const summarySubtitle = `${formatWeekday(selectedDate, i18n.language)} · ${formatDate(selectedDate, i18n.language)}`;

  const daySummary = (compact) => (
    dayLoading && !dayData
      ? <SummarySkeleton />
      : (
        <NutriDaySummary
          totals={totals}
          goal={goalData}
          isToday={isToday}
          title={summaryTitle}
          subtitle={summarySubtitle}
          toolbar={toolbar}
          compact={compact}
        />
      )
  );

  // Suppressed during the first load: "nothing logged yet" next to a skeleton
  // is a lie, not a nudge.
  const insightBar = dayLoading && !dayData
    ? null
    : <NutriInsightBar insight={insight} streak={streak} onAct={() => openAddModal(smartMealType())} />;

  const quickAdd = (
    <NutriQuickAdd
      dateStr={selectedDate}
      isToday={isToday}
      onOpenModal={openAddModal}
      onOpenCombos={() => setShowCombosModal(true)}
    />
  );

  const mealList = (
    dayLoading && !dayData
      ? (
        <div className="flex flex-col gap-3">
          {MEAL_ORDER.map((type) => <MealCardSkeleton key={type} accent={mealMeta(type).color} />)}
        </div>
      )
      : (
        <div className="flex flex-col gap-3">
          {MEAL_ORDER.map((type, idx) => (
            <NutriMealCard
              key={type}
              type={type}
              index={idx}
              entries={meals[type] || []}
              goalCalories={goalData.calories}
              isLiveSlot={liveSlot === type}
              onAddClick={openAddModal}
              onDeleteItem={(entry, mealType) => deleteMealMut.mutate({ entry, mealType })}
              onUpdateAmount={(id, amount) => updateAmountMut.mutate({ id, amount })}
              onUseCombo={() => setShowCombosModal(true)}
            />
          ))}
        </div>
      )
  );

  const trendsDrawer = (
    <AnimatePresence>
      {showTrends && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          style={{ overflow: 'hidden' }}
        >
          <Suspense fallback={null}><NutritionTrends /></Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="eat-journal" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <TdeeHint onOpenCalculator={() => { setGoalModalTab('calculator'); setShowGoalModal(true); }} />

      {/* ══ DESKTOP ══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:grid" style={{ gridTemplateColumns: 'minmax(320px, 360px) 1fr', gap: 20, alignItems: 'start' }}>
        <aside style={{ position: 'sticky', top: 76, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {daySummary(true)}
          <NutritionDateNavigator
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            calendarData={calendarData}
            onOpenCalendar={() => setShowCalendarModal(true)}
            goalCalories={goalData.calories}
          />
          <WaterTracker dateStr={selectedDate} goalMl={goalData.water_ml} />
          <Suspense fallback={null}>
            <BodyWeightTracker goalData={goalData} />
          </Suspense>

          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            className="flex items-center justify-center gap-1.5 py-1.5"
            style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ej-faint)', cursor: 'pointer' }}
          >
            <Keyboard size={12} />
            {t('nutrition.shortcuts.hint', 'Press ? for shortcuts')}
          </button>
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {insightBar}
          {quickAdd}
          {trendsDrawer}
          {mealList}
        </main>
      </div>

      {/* ══ MOBILE / TABLET ══════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3 pb-28 lg:hidden min-w-0">
        <NutritionDateNavigator
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          calendarData={calendarData}
          onOpenCalendar={() => setShowCalendarModal(true)}
          goalCalories={goalData.calories}
        />
        {daySummary(false)}
        {insightBar}
        {quickAdd}
        {trendsDrawer}
        {mealList}
        <WaterTracker dateStr={selectedDate} goalMl={goalData.water_ml} />
        <Suspense fallback={null}>
          <BodyWeightTracker goalData={goalData} />
        </Suspense>

        {/* Time-aware FAB — hidden while a modal owns the screen. */}
        {!anyModalOpen && (
          <div className="fixed bottom-6 right-5 z-40">
            <motion.button
              type="button"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => openAddModal(smartMealType())}
              className="flex items-center gap-2 px-5 py-3.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                color: '#000', fontWeight: 900, fontSize: 14,
                boxShadow: '0 10px 30px rgba(245,158,11,0.42)', cursor: 'pointer',
              }}
              aria-label={t('nutrition.add_meal_btn', 'Add Meal')}
            >
              <Plus size={18} />
              <span>{t(`nutrition.meals_short.${liveSlot || 'snack'}`, t('nutrition.add_meal_btn', 'Add Meal'))}</span>
            </motion.button>
          </div>
        )}
      </div>

      {/* ══ Modals ═══════════════════════════════════════════════════════════ */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {showAddModal && (
            <AddMealModal
              dateStr={selectedDate}
              initialMealType={targetAddMealType}
              initialFood={prefillFood}
              onClose={() => { setShowAddModal(false); setPrefillFood(null); }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showGoalModal && (
            <NutriGoalModal currentGoal={goalData} onClose={() => setShowGoalModal(false)} initialTab={goalModalTab} />
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
            <SavedCombosModal dateStr={selectedDate} onClose={() => setShowCombosModal(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showReportCard && <WeeklyReportCard onClose={() => setShowReportCard(false)} />}
        </AnimatePresence>
      </Suspense>

      <AnimatePresence>
        {showShortcuts && <ShortcutSheet onClose={() => setShowShortcuts(false)} />}
      </AnimatePresence>
    </div>
  );
}
