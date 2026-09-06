// @ts-nocheck
/**
 * NutriDaySummary — the hero card of the Eat Journal.
 *
 * Replaces the old "rings + identical bars + calorie line" stack, which showed
 * the same four numbers three times. Each block below answers a different
 * question:
 *   rings      → how much of each target is used
 *   budget     → how much is left, and are we ahead of the clock
 *   split      → is the balance of the day right (independent of amount)
 *   micro      → the nutrients we already track but never surfaced
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Flame, TrendingUp, TrendingDown, Check, AlertTriangle } from 'lucide-react';
import MacroRings from './MacroRings';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { macroCalorieSplit, calculatePace } from '@/lib/nutritionUtils';

const MACRO_COLORS = { protein: 'var(--ej-protein)', fat: 'var(--ej-fat)', carbs: 'var(--ej-carbs)' };

// ─── Calorie budget + pace ────────────────────────────────────────────────────

function PaceBar({ consumed, goal, isToday }) {
  const { t } = useTranslation();
  const pace = useMemo(() => calculatePace({ consumed, goal }), [consumed, goal]);
  const fillPct = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;
  const nowPct = Math.min(100, pace.progress * 100);
  const isOver = consumed > goal;

  const statusMeta = {
    on_track: { icon: Check, color: 'var(--ej-good)', label: t('nutrition.pace.on_track', 'On pace for this time of day') },
    ahead: { icon: TrendingUp, color: 'var(--ej-kcal)', label: t('nutrition.pace.ahead', 'Ahead of pace — go lighter later') },
    behind: { icon: TrendingDown, color: 'var(--ej-protein)', label: t('nutrition.pace.behind', 'Behind pace — room for a real meal') },
    over: { icon: AlertTriangle, color: 'var(--ej-over)', label: t('nutrition.pace.over', 'Over the daily target') },
  }[pace.status];
  const StatusIcon = statusMeta.icon;

  return (
    <div>
      {/* Headline: remaining / over */}
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Flame size={15} style={{ color: isOver ? 'var(--ej-over)' : 'var(--ej-kcal)', flexShrink: 0 }} />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <AnimatedNumber
              value={Math.abs(goal - consumed)}
              className="ej-num"
              style={{ fontSize: 24, fontWeight: 900, color: isOver ? 'var(--ej-over)' : 'var(--ej-good)', lineHeight: 1 }}
            />
            <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ej-dim)' }}>
              {isOver ? t('nutrition.kcal_over', 'kcal over') : t('nutrition.kcal_left', 'kcal left')}
            </span>
          </div>
        </div>
        <span className="ej-num shrink-0" style={{ fontSize: 11, fontWeight: 800, color: 'var(--ej-dim)' }}>
          {Math.round(consumed)} / {Math.round(goal)}
        </span>
      </div>

      {/* Track with a "now" marker so the bar answers *two* questions at once */}
      <div
        className="relative"
        style={{ height: 10, borderRadius: 999, background: 'var(--ej-surface-sunken)', overflow: 'hidden' }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: '100%',
            borderRadius: 999,
            background: isOver
              ? 'linear-gradient(90deg, #f59e0b, var(--ej-over))'
              : 'linear-gradient(90deg, #fbbf24, var(--ej-kcal))',
          }}
        />
        {isToday && nowPct > 1 && nowPct < 99 && (
          <div
            title={t('nutrition.pace.marker', 'Expected by now')}
            style={{
              position: 'absolute',
              left: `${nowPct}%`,
              top: -2,
              bottom: -2,
              width: 2,
              borderRadius: 2,
              background: 'var(--ej-text)',
              opacity: 0.55,
              boxShadow: '0 0 0 2px var(--ej-surface)',
            }}
          />
        )}
      </div>

      {isToday && (
        <div className="flex items-center gap-1.5 mt-2">
          <StatusIcon size={12} style={{ color: statusMeta.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ej-dim)' }}>{statusMeta.label}</span>
        </div>
      )}
    </div>
  );
}

// ─── Macro balance (share of calories, not amount) ────────────────────────────

function MacroSplitBar({ totals, goal }) {
  const { t } = useTranslation();
  const actual = macroCalorieSplit(totals);
  const target = macroCalorieSplit(goal);

  const rows = [
    { key: 'protein', label: t('nutrition.macros.p_short', 'P') },
    { key: 'fat', label: t('nutrition.macros.f_short', 'F') },
    { key: 'carbs', label: t('nutrition.macros.c_short', 'C') },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ej-dim)' }}>
          {t('nutrition.macro_split', 'Macro balance')}
        </span>
        <span className="ej-num" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ej-faint)' }}>
          {t('nutrition.target_short', 'target')} {rows.map((r) => Math.round((target[r.key] || 0) * 100)).join('/')}
        </span>
      </div>

      <div
        className="flex overflow-hidden"
        style={{ height: 12, borderRadius: 999, background: 'var(--ej-surface-sunken)' }}
      >
        {actual.empty ? (
          <div style={{ flex: 1 }} />
        ) : (
          rows.map(({ key }) => (
            <motion.div
              key={key}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: actual[key] }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ background: MACRO_COLORS[key], flexBasis: 0, minWidth: actual[key] > 0 ? 3 : 0 }}
            />
          ))
        )}
      </div>

      <div className="flex items-center gap-3 mt-1.5">
        {rows.map(({ key, label }) => {
          const pct = Math.round((actual[key] || 0) * 100);
          const tgt = Math.round((target[key] || 0) * 100);
          const drift = Math.abs(pct - tgt);
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span style={{ width: 7, height: 7, borderRadius: 2, background: MACRO_COLORS[key] }} />
              <span className="ej-num" style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ej-text)' }}>
                {label} {actual.empty ? '—' : `${pct}%`}
              </span>
              {!actual.empty && drift >= 8 && (
                <span className="ej-num" style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ej-faint)' }}>
                  ({pct > tgt ? '+' : '−'}{drift})
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Micronutrients we already store but never displayed ──────────────────────

function MicroRow({ totals }) {
  const { t } = useTranslation();
  const items = [
    { key: 'fiber', label: t('nutrition.micro.fiber', 'Fiber'), unit: 'g' },
    { key: 'sugar', label: t('nutrition.micro.sugar', 'Sugar'), unit: 'g' },
    { key: 'saturated_fat', label: t('nutrition.micro.sat_fat', 'Sat. fat'), unit: 'g' },
    { key: 'sodium', label: t('nutrition.micro.sodium', 'Sodium'), unit: 'mg' },
  ];
  const anyValue = items.some(({ key }) => (totals?.[key] || 0) > 0);
  if (!anyValue) return null;

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map(({ key, label, unit }) => (
        <div key={key} className="ej-inset flex flex-col items-center py-1.5 px-1">
          <span className="ej-num" style={{ fontSize: 13, fontWeight: 900, color: 'var(--ej-text)', lineHeight: 1.1 }}>
            {Math.round(totals?.[key] || 0)}
            <span style={{ fontSize: 8.5, opacity: 0.55, marginLeft: 1 }}>{unit}</span>
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ej-dim)', marginTop: 1 }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export default function NutriDaySummary({
  totals,
  goal,
  isToday,
  title,
  subtitle,
  toolbar,
  compact = false,
}) {
  return (
    <section className="ej-card" style={{ padding: compact ? 16 : 18 }}>
      <header className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h2 style={{ fontSize: 16.5, fontWeight: 900, color: 'var(--ej-text)', letterSpacing: '-0.4px', lineHeight: 1.15 }}>
            {title}
          </h2>
          <p style={{ fontSize: 11, color: 'var(--ej-dim)', fontWeight: 700, marginTop: 2 }}>{subtitle}</p>
        </div>
        {toolbar}
      </header>

      <div className="py-1">
        <MacroRings totals={totals} goal={goal} compact={compact} />
      </div>

      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--ej-hairline)' }}>
        <PaceBar consumed={totals.calories || 0} goal={goal.calories || 0} isToday={isToday} />
      </div>

      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--ej-hairline)' }}>
        <MacroSplitBar totals={totals} goal={goal} />
      </div>

      <div className="mt-3">
        <MicroRow totals={totals} />
      </div>
    </section>
  );
}
