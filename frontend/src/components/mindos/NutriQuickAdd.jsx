// @ts-nocheck
/**
 * NutriQuickAdd — one-tap logging for the foods this user actually eats.
 *
 * The recent-foods endpoint already existed but was buried three taps deep
 * inside the add-meal modal. Surfacing it on the journal turns the most common
 * action (re-logging yesterday's oatmeal) from ~6 interactions into one.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Zap, ChevronDown, CopyPlus, Utensils, Loader2 } from 'lucide-react';
import { djangoApi } from '@/api/djangoClient';
import {
  NUTRITION_RECENT_KEY,
  NUTRITION_MEALS_KEY,
} from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import { hapticLight, hapticSuccess } from '@/hooks/useHaptic';
import {
  getFoodEmoji, MEAL_ORDER, mealMeta, smartMealType, addDays,
} from '@/lib/nutritionUtils';
import { mealIcon } from '@/lib/nutritionIcons';
import { RailSkeleton } from './NutriSkeletons';

const PORTIONS = [50, 100, 150, 200, 250];

function QuickCard({ food, onLog, onPick, isPending }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const unit = food.unit || 'g';
  const kcal = Math.round(((food.calories_per_100 || 0) * 100) / 100);

  return (
    <div className="relative">
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => { hapticLight(); onLog(food, 100); }}
        disabled={isPending}
        className="ej-inset flex items-center gap-2.5 px-2.5 py-2 text-left"
        style={{ minWidth: 148, cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.6 : 1 }}
        title={t('nutrition.quick_add.tap_hint', 'Tap to log 100{{unit}}', { unit })}
      >
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--ej-surface-sunken)', fontSize: 15 }}
        >
          {getFoodEmoji(food.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ fontSize: 12, fontWeight: 800, color: 'var(--ej-text)', lineHeight: 1.2 }}>
            {food.name}
          </span>
          <span className="ej-num block" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ej-dim)', marginTop: 1 }}>
            {kcal} {t('nutrition.kcal', 'kcal')} · 100{unit}
          </span>
        </span>
      </motion.button>

      {/* Portion picker — the escape hatch when 100 g is wrong */}
      <button
        type="button"
        onClick={() => { hapticLight(); setOpen((v) => !v); }}
        className="absolute top-1 right-1 flex items-center justify-center"
        style={{
          width: 18, height: 18, borderRadius: 6,
          background: 'var(--ej-surface-sunken)', color: 'var(--ej-dim)', cursor: 'pointer',
        }}
        aria-label={t('nutrition.quick_add.portion', 'Choose portion')}
      >
        <ChevronDown size={11} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.14 }}
              className="ej-card ej-card--tight absolute z-50 p-1.5 flex flex-col gap-1"
              style={{ top: 'calc(100% + 6px)', right: 0, minWidth: 132 }}
            >
              {PORTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setOpen(false); onLog(food, p); }}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg"
                  style={{ cursor: 'pointer', background: 'transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ej-surface-raised)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span className="ej-num" style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ej-text)' }}>
                    {p}{unit}
                  </span>
                  <span className="ej-num" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ej-dim)' }}>
                    {Math.round(((food.calories_per_100 || 0) * p) / 100)} {t('nutrition.kcal', 'kcal')}
                  </span>
                </button>
              ))}
              <div className="ej-divider my-0.5" />
              <button
                type="button"
                onClick={() => { setOpen(false); onPick(food); }}
                className="px-2 py-1.5 rounded-lg text-left"
                style={{ fontSize: 11, fontWeight: 800, color: 'var(--ej-kcal)', cursor: 'pointer' }}
              >
                {t('nutrition.quick_add.custom', 'Custom amount…')}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NutriQuickAdd({ dateStr, isToday, onOpenModal, onOpenCombos }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [mealTarget, setMealTarget] = useState(() => smartMealType());

  const { data: recent, isLoading } = useQuery({
    queryKey: NUTRITION_RECENT_KEY,
    queryFn: () => djangoApi.nutrition.getRecentFoods(14),
    staleTime: 2 * 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: NUTRITION_MEALS_KEY(dateStr) });
    queryClient.invalidateQueries({ queryKey: ['nutrition', 'calendar'] });
    queryClient.invalidateQueries({ queryKey: ['nutrition', 'trends'] });
    queryClient.invalidateQueries({ queryKey: NUTRITION_RECENT_KEY });
  };

  const logMut = useMutation({
    mutationFn: ({ food, amount }) => djangoApi.nutrition.addMeal({
      date: dateStr,
      meal_type: mealTarget,
      amount,
      food_item_id: food.id,
    }),
    onSuccess: (_res, { food, amount }) => {
      hapticSuccess();
      invalidate();
      toast({
        title: t('nutrition.quick_add.logged', '⚡ {{name}} logged', { name: food.name }),
        description: `${amount}${food.unit || 'g'} · ${Math.round(((food.calories_per_100 || 0) * amount) / 100)} ${t('nutrition.kcal', 'kcal')}`,
      });
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  const copyDayMut = useMutation({
    mutationFn: async () => {
      const src = await djangoApi.nutrition.getMeals(addDays(dateStr, -1));
      const entries = MEAL_ORDER.flatMap((type) =>
        (src?.meals?.[type] || []).map((e) => ({ ...e, meal_type: type })),
      ).filter((e) => e.food_item_id);
      if (entries.length === 0) throw new Error('EMPTY');
      for (const e of entries) {
        // Sequential on purpose: the backend bumps per-food usage counters and
        // we want the resulting "recent foods" order to stay meaningful.
        await djangoApi.nutrition.addMeal({
          date: dateStr,
          meal_type: e.meal_type,
          amount: e.amount,
          food_item_id: e.food_item_id,
          note: e.note || '',
        });
      }
      return entries.length;
    },
    onSuccess: (count) => {
      hapticSuccess();
      invalidate();
      toast({ title: t('nutrition.quick_add.copied', '📋 Copied {{count}} entries from yesterday', { count }) });
    },
    onError: (e) => toast({
      title: e?.message === 'EMPTY'
        ? t('nutrition.quick_add.nothing_yesterday', 'Nothing was logged yesterday')
        : t('nutrition.error', 'Error'),
      description: e?.message === 'EMPTY' ? undefined : e?.message,
      variant: e?.message === 'EMPTY' ? undefined : 'destructive',
    }),
  });

  const foods = Array.isArray(recent) ? recent : [];
  const hasFoods = foods.length > 0;

  if (!isLoading && !hasFoods) {
    // Nothing to quick-add yet — offer the two paths that create the history.
    return (
      <section className="ej-card ej-card--tight" style={{ padding: '12px 14px' }}>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Zap size={14} style={{ color: 'var(--ej-kcal)' }} />
          <span className="flex-1 min-w-0" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ej-dim)' }}>
            {t('nutrition.quick_add.empty', 'Log a few meals and your favourites show up here for one-tap repeats.')}
          </span>
          <button type="button" onClick={onOpenCombos} className="ej-chip shrink-0">
            <Utensils size={11} /> {t('nutrition.saved_combos', 'Saved combos')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="ej-card ej-card--tight" style={{ padding: '12px 14px' }}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Zap size={14} style={{ color: 'var(--ej-kcal)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--ej-text)' }}>
            {t('nutrition.quick_add.title', 'Quick add')}
          </span>
        </div>

        {/* Where a one-tap entry lands. Defaults to the current time of day. */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl" style={{ background: 'var(--ej-surface-sunken)' }}>
          {MEAL_ORDER.map((type) => {
            const meta = mealMeta(type);
            const Icon = mealIcon(type);
            const active = mealTarget === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => { hapticLight(); setMealTarget(type); }}
                title={t(`nutrition.meals_short.${type}`, meta.defaultLabel)}
                className="flex items-center justify-center"
                style={{
                  width: 26, height: 24, borderRadius: 8, cursor: 'pointer',
                  background: active ? `${meta.color}22` : 'transparent',
                  color: active ? meta.color : 'var(--ej-dim)',
                  transition: 'background .14s ease, color .14s ease',
                }}
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <RailSkeleton />
      ) : (
        <div className="ej-rail">
          {foods.map((food) => (
            <QuickCard
              key={food.id}
              food={food}
              isPending={logMut.isPending && logMut.variables?.food?.id === food.id}
              onLog={(f, amount) => logMut.mutate({ food: f, amount })}
              onPick={(f) => onOpenModal?.(mealTarget, f)}
            />
          ))}

          {isToday && (
            <button
              type="button"
              onClick={() => copyDayMut.mutate()}
              disabled={copyDayMut.isPending}
              className="ej-inset flex items-center gap-2 px-3"
              style={{ minWidth: 130, cursor: 'pointer' }}
            >
              {copyDayMut.isPending
                ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--ej-dim)' }} />
                : <CopyPlus size={14} style={{ color: 'var(--ej-protein)' }} />}
              <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ej-text)', textAlign: 'left', lineHeight: 1.2 }}>
                {t('nutrition.quick_add.copy_yesterday', 'Repeat yesterday')}
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
