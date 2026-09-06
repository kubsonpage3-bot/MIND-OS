// @ts-nocheck
/**
 * NutriMealCard — one slot of the day (breakfast / lunch / dinner / snacks).
 *
 * Two deliberate shapes:
 *   • empty  → a single 56 px row. Four empty meals used to take ~800 px of
 *              identical dashed boxes; now the whole day fits above the fold.
 *   • filled → expands with entries, per-slot totals and a budget bar.
 *
 * Entries can be re-weighed inline (the update endpoint existed but nothing
 * called it) and deleted with an undo, so a mis-tap is no longer destructive.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronUp, Check, X } from 'lucide-react';
import { hapticLight } from '@/hooks/useHaptic';
import { getFoodEmoji, mealMeta, mealBudget, alpha } from '@/lib/nutritionUtils';
import { mealIcon } from '@/lib/nutritionIcons';

// ─── Entry ────────────────────────────────────────────────────────────────────

function AmountEditor({ entry, accent, onCommit, onCancel }) {
  const [value, setValue] = useState(String(Math.round(entry.amount)));
  const ref = useRef(null);

  useEffect(() => { ref.current?.select(); }, []);

  function commit() {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return onCancel();
    if (Math.round(n) === Math.round(entry.amount)) return onCancel();
    onCommit(n);
  }

  return (
    <span className="flex items-center gap-1">
      <input
        ref={ref}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        className="ej-num"
        style={{
          width: 54, padding: '2px 6px', borderRadius: 7, background: 'var(--ej-surface-sunken)',
          border: `1px solid ${accent}`, color: 'var(--ej-text)', fontSize: 11.5, fontWeight: 800,
        }}
      />
      <button type="button" onClick={commit} className="ej-icon-btn" style={{ width: 22, height: 22, color: 'var(--ej-good)' }} aria-label="Save">
        <Check size={12} />
      </button>
      <button type="button" onClick={onCancel} className="ej-icon-btn" style={{ width: 22, height: 22 }} aria-label="Cancel">
        <X size={12} />
      </button>
    </span>
  );
}

function MealEntryRow({ entry, accent, index, onDelete, onUpdateAmount }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const unit = entry.unit || 'g';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.15), ease: [0.16, 1, 0.3, 1] }}
      className="group flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
      style={{ background: 'var(--ej-surface-raised)', border: '1px solid var(--ej-hairline)' }}
    >
      {entry.photo_url ? (
        <img
          src={entry.photo_url}
          alt=""
          className="shrink-0 object-cover"
          style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--ej-hairline)' }}
        />
      ) : (
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: 30, height: 30, borderRadius: 10, background: alpha(accent, 0.13), fontSize: 15 }}
        >
          {getFoodEmoji(entry.food_name)}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate" style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ej-text)' }}>
            {entry.food_name}
          </span>
          {editing ? (
            <AmountEditor
              entry={entry}
              accent={accent}
              onCommit={(n) => { setEditing(false); onUpdateAmount(entry.id, n); }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => { hapticLight(); setEditing(true); }}
              className="ej-num shrink-0"
              title={t('nutrition.edit_amount', 'Change the amount')}
              style={{
                fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 6,
                background: 'var(--ej-surface-sunken)', color: 'var(--ej-dim)', cursor: 'pointer',
              }}
            >
              {Math.round(entry.amount)}{unit}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5">
          {/* On wide rows the calorie figure moves to the right-hand ledger. */}
          <span className="ej-num sm:hidden" style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ej-kcal)' }}>
            {Math.round(entry.calories)} {t('nutrition.kcal', 'kcal')}
          </span>
          <span className="ej-num" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ej-protein)' }}>
            {t('nutrition.macros.p_short', 'P')} {Math.round(entry.protein)}
          </span>
          <span className="ej-num" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ej-fat)' }}>
            {t('nutrition.macros.f_short', 'F')} {Math.round(entry.fat)}
          </span>
          <span className="ej-num" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ej-carbs)' }}>
            {t('nutrition.macros.c_short', 'C')} {Math.round(entry.carbs)}
          </span>
          {entry.note && (
            <span className="truncate italic" style={{ fontSize: 10, color: 'var(--ej-faint)', maxWidth: 160 }}>
              {entry.note}
            </span>
          )}
        </div>
      </div>

      <span className="ej-num hidden sm:block shrink-0 text-right" style={{ minWidth: 74 }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--ej-text)' }}>{Math.round(entry.calories)}</span>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ej-dim)', marginLeft: 3 }}>
          {t('nutrition.kcal', 'kcal')}
        </span>
      </span>

      <button
        type="button"
        onClick={() => onDelete(entry)}
        className="ej-icon-btn shrink-0 md:opacity-45 md:group-hover:opacity-100 focus-visible:opacity-100"
        style={{ width: 28, height: 28, color: 'var(--ej-dim)' }}
        title={t('nutrition.delete_entry', 'Delete entry')}
        aria-label={t('nutrition.delete_entry', 'Delete entry')}
      >
        <Trash2 size={13} />
      </button>
    </motion.li>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export default function NutriMealCard({
  type,
  entries = [],
  goalCalories = 0,
  isLiveSlot = false,
  onAddClick,
  onDeleteItem,
  onUpdateAmount,
  onUseCombo,
  index = 0,
}) {
  const { t } = useTranslation();
  const meta = mealMeta(type);
  const Icon = mealIcon(type);
  const label = t(`nutrition.meals.${meta.key}`, meta.defaultLabel);
  const [open, setOpen] = useState(true);

  const totalCal = entries.reduce((s, e) => s + (e.calories || 0), 0);
  const totalP = entries.reduce((s, e) => s + (e.protein || 0), 0);
  const totalF = entries.reduce((s, e) => s + (e.fat || 0), 0);
  const totalC = entries.reduce((s, e) => s + (e.carbs || 0), 0);
  const budget = mealBudget(goalCalories, type);
  const budgetPct = budget > 0 ? Math.min(100, (totalCal / budget) * 100) : 0;
  const isEmpty = entries.length === 0;

  const addButton = (
    <motion.button
      type="button"
      whileTap={{ scale: 0.93 }}
      onClick={() => { hapticLight(); onAddClick(type); }}
      className="flex items-center gap-1.5 shrink-0"
      style={{
        padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
        background: alpha(meta.color, 0.14),
        border: `1px solid ${alpha(meta.color, 0.34)}`,
        color: meta.color, fontSize: 12, fontWeight: 900,
      }}
    >
      <Plus size={13} /> {t('nutrition.add_food', 'Add')}
    </motion.button>
  );

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay: Math.min(index * 0.05, 0.2), ease: [0.16, 1, 0.3, 1] }}
      className="ej-card"
      style={{
        borderLeft: `3px solid ${isEmpty ? alpha(meta.color, 0.4) : meta.color}`,
        boxShadow: isLiveSlot ? `var(--ej-shadow-md), 0 0 0 1px ${alpha(meta.color, 0.28)}` : 'var(--ej-shadow-sm)',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3.5" style={{ paddingTop: isEmpty ? 11 : 13, paddingBottom: isEmpty ? 11 : 13 }}>
        <button
          type="button"
          onClick={() => { if (!isEmpty) { hapticLight(); setOpen((v) => !v); } }}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          style={{ cursor: isEmpty ? 'default' : 'pointer', background: 'transparent' }}
        >
          <span
            className="flex items-center justify-center shrink-0"
            style={{
              width: 32, height: 32, borderRadius: 11,
              background: alpha(meta.color, 0.13),
              border: `1px solid ${alpha(meta.color, 0.26)}`,
            }}
          >
            <Icon size={15} style={{ color: meta.color }} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span style={{ fontSize: 13.5, fontWeight: 900, color: 'var(--ej-text)', letterSpacing: '-0.2px' }}>
                {label}
              </span>
              {isLiveSlot && (
                <span
                  style={{
                    fontSize: 8.5, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '2px 5px', borderRadius: 5, color: meta.color, background: alpha(meta.color, 0.15),
                  }}
                >
                  {t('nutrition.now', 'now')}
                </span>
              )}
            </span>

            {isEmpty ? (
              <span className="block ej-num" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ej-faint)', marginTop: 1 }}>
                {budget > 0
                  ? t('nutrition.budget_hint', '~{{kcal}} kcal budgeted', { kcal: budget })
                  : t('nutrition.no_entries', 'No entries')}
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5" style={{ marginTop: 2 }}>
                <span className="ej-num" style={{ fontSize: 11.5, fontWeight: 900, color: 'var(--ej-kcal)' }}>
                  {Math.round(totalCal)} {t('nutrition.kcal', 'kcal')}
                </span>
                <span className="ej-num" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ej-protein)' }}>
                  {t('nutrition.macros.p_short', 'P')} {Math.round(totalP)}
                </span>
                <span className="ej-num" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ej-fat)' }}>
                  {t('nutrition.macros.f_short', 'F')} {Math.round(totalF)}
                </span>
                <span className="ej-num" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ej-carbs)' }}>
                  {t('nutrition.macros.c_short', 'C')} {Math.round(totalC)}
                </span>
                {budget > 0 && (
                  <span className="ej-num" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ej-faint)' }}>
                    / {budget}
                  </span>
                )}
              </span>
            )}
          </span>
        </button>

        {isEmpty && onUseCombo && (
          <button
            type="button"
            onClick={() => onUseCombo(type)}
            className="hidden sm:inline-flex shrink-0"
            style={{ fontSize: 11, fontWeight: 800, color: 'var(--ej-dim)', cursor: 'pointer' }}
          >
            {t('nutrition.use_combo_short', 'Combo')}
          </button>
        )}

        {addButton}

        {!isEmpty && (
          <motion.button
            type="button"
            onClick={() => { hapticLight(); setOpen((v) => !v); }}
            animate={{ rotate: open ? 0 : 180 }}
            transition={{ duration: 0.22 }}
            className="ej-icon-btn shrink-0"
            style={{ width: 26, height: 26, color: 'var(--ej-dim)' }}
            aria-label={open ? t('nutrition.collapse', 'Collapse') : t('nutrition.expand', 'Expand')}
          >
            <ChevronUp size={14} />
          </motion.button>
        )}
      </div>

      {/* Per-slot budget bar — only meaningful once something is logged. */}
      {!isEmpty && budget > 0 && (
        <div style={{ height: 3, background: 'var(--ej-surface-sunken)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${budgetPct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ height: '100%', background: totalCal > budget ? 'var(--ej-over)' : meta.color, opacity: 0.85 }}
          />
        </div>
      )}

      {/* ── Entries ───────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {!isEmpty && open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <ul className="flex flex-col gap-1.5 px-3 pb-3 pt-2.5 m-0 list-none">
              <AnimatePresence mode="popLayout" initial={false}>
                {entries.map((entry, i) => (
                  <MealEntryRow
                    key={entry.id}
                    entry={entry}
                    index={i}
                    accent={meta.color}
                    onDelete={(e) => onDeleteItem(e, type)}
                    onUpdateAmount={onUpdateAmount}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
