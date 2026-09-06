// @ts-nocheck
/**
 * NutriInsightBar — one line that tells the user what to do about today.
 *
 * The journal had plenty of numbers and no interpretation. This turns the day's
 * totals into a single sentence, plus the streak, which is the one piece of
 * motivation the calendar payload already contained but never showed.
 *
 * It never restates the pace verdict — the summary card owns that line.
 */

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Flame, Sparkles, Scale, Leaf, AlertTriangle, Check, PlusCircle, Beef,
} from 'lucide-react';

const TONE = {
  good: { color: 'var(--ej-good)', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.28)' },
  warn: { color: 'var(--ej-kcal)', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
  danger: { color: 'var(--ej-over)', bg: 'rgba(244,63,94,0.10)', border: 'rgba(244,63,94,0.28)' },
  neutral: { color: 'var(--ej-dim)', bg: 'var(--ej-surface-raised)', border: 'var(--ej-hairline)' },
};

const ICONS = {
  over: AlertTriangle,
  empty: PlusCircle,
  protein_behind: Beef,
  protein_gap: Beef,
  macro_high: Scale,
  macro_low: Scale,
  low_fiber: Leaf,
  nailed: Sparkles,
  logged: Check,
};

export default function NutriInsightBar({ insight, streak, onAct }) {
  const { t } = useTranslation();
  if (!insight && !streak) return null;

  const tone = TONE[insight?.tone || 'neutral'];
  const Icon = ICONS[insight?.id] || Check;
  const v = insight?.values || {};
  const macroLabel = v.macro
    ? t(`nutrition.macros.${v.macro}`, v.macro)
    : '';

  const messages = {
    over: t('nutrition.insight.over', "You're {{amount}} kcal past the target — an easy day tomorrow evens it out.", v),
    empty: t('nutrition.insight.empty', 'Nothing logged yet. Start with whatever you ate last.'),
    protein_behind: t('nutrition.insight.protein_behind', 'Protein is {{amount}} g short with the day mostly gone.', v),
    protein_gap: t('nutrition.insight.protein_gap', '{{amount}} g of protein left to hit today.', v),
    macro_high: t('nutrition.insight.macro_high', '{{macro}} is carrying {{amount}} points more of the day than planned.', { ...v, macro: macroLabel }),
    macro_low: t('nutrition.insight.macro_low', '{{macro}} is {{amount}} points below its share of the day.', { ...v, macro: macroLabel }),
    low_fiber: t('nutrition.insight.low_fiber', 'Only {{amount}} g of fiber so far — vegetables or oats would help.', v),
    nailed: t('nutrition.insight.nailed', 'Right on target today. Textbook.'),
    logged: t('nutrition.insight.logged', '{{count}} of {{total}} meals logged.', v),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl"
      style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
    >
      <Icon size={15} style={{ color: tone.color, flexShrink: 0 }} />

      <span className="flex-1 min-w-0" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ej-text)', lineHeight: 1.35 }}>
        {(insight && messages[insight.id]) || ''}
      </span>

      {streak > 1 && (
        <span
          className="ej-chip ej-chip--static shrink-0"
          title={t('nutrition.streak_title', 'Consecutive days logged')}
          style={{ background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)', color: 'var(--ej-kcal)' }}
        >
          <Flame size={11} />
          <span className="ej-num">{streak}</span>
        </span>
      )}

      {insight?.id === 'empty' && onAct && (
        <button
          type="button"
          onClick={onAct}
          className="ej-chip shrink-0"
          style={{ background: 'var(--ej-kcal)', color: '#000', borderColor: 'transparent' }}
        >
          {t('nutrition.add_food', 'Add')}
        </button>
      )}
    </motion.div>
  );
}
