// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { motion, animate } from 'framer-motion';
import { useTranslation } from 'react-i18next';

function AnimatedCounter({ value, style, className }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  useEffect(() => {
    const controls = animate(prevValueRef.current, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    prevValueRef.current = value;
    return () => controls.stop();
  }, [value]);
  return <span className={className} style={style}>{displayValue}</span>;
}

export function MacroRing({ value, goal, color, bg, label, size = 80, isPrimary = false, index = 0 }) {
  const strokeWidth = isPrimary ? 9 : 7;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const rawPct = goal > 0 ? value / goal : 0;
  const pctClamped = Math.min(rawPct, 1.25);
  const offset = circumference * (1 - Math.min(pctClamped, 1));
  const isOver = goal > 0 && value > goal;
  const isGoal = goal > 0 && rawPct >= 1 && !isOver;
  const percentInt = Math.round(rawPct * 100);
  const displayColor = isOver ? 'var(--habit-red, #f74e52)' : color;

  // Pulse animation for goal reached
  const pulseAnim = isGoal
    ? {
        filter: [
          `drop-shadow(0 0 6px ${color}80)`,
          `drop-shadow(0 0 18px ${color}cc)`,
          `drop-shadow(0 0 6px ${color}80)`,
        ],
      }
    : { filter: `drop-shadow(0 0 6px ${displayColor}80)` };

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      // Fluid: grows in proportion to `size` but never exceeds it, so four
      // rings always fit a narrow sidebar instead of overflowing it.
      style={{ flex: `${size} 1 0`, minWidth: 0, maxWidth: size }}
      initial={{ opacity: 0, y: 16, scale: 0.88 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay: index * 0.09, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.06, transition: { duration: 0.2 } }}
    >
      <div className="relative flex items-center justify-center w-full" style={{ aspectRatio: '1 / 1', maxWidth: size }}>
        {/* Soft glow background */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${displayColor}22 0%, transparent 70%)`,
            filter: 'blur(10px)',
            transform: 'scale(0.85)',
          }}
          animate={isGoal ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
          transition={isGoal ? { repeat: Infinity, duration: 2.2, ease: 'easeInOut' } : {}}
        />

        <svg
          viewBox={`0 0 ${size} ${size}`}
          width="100%"
          height="100%"
          className="-rotate-90"
          style={{ display: 'block', position: 'relative' }}
        >
          {/* Track */}
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bg} strokeWidth={strokeWidth} />

          {/* Animated fill */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={displayColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{
              strokeDashoffset: offset,
              ...pulseAnim,
            }}
            transition={{
              strokeDashoffset: { duration: 1.0, delay: index * 0.09 + 0.1, ease: [0.16, 1, 0.3, 1] },
              filter: isGoal ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : { duration: 0.4 },
            }}
          />

          {/* Overflow shimmer arc - only when over goal */}
          {isOver && (
            <motion.circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={strokeWidth - 3}
              strokeLinecap="round"
              strokeDasharray={`${circumference * 0.12} ${circumference}`}
              animate={{ strokeDashoffset: [0, -circumference] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
            />
          )}
        </svg>

        {/* Center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <AnimatedCounter
            value={value}
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontSize: isPrimary ? 20 : 15,
              color: displayColor,
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: '-0.5px',
            }}
          />
          <span style={{
            fontSize: isPrimary ? 10 : 8.5,
            color: 'var(--habit-dim, #888)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginTop: 2,
          }}>
            /{Math.round(goal)}
          </span>
        </div>
      </div>

      {/* Label + % */}
      <div className="flex flex-col items-center gap-1">
        <span style={{ fontSize: 11.5, color: 'var(--habit-text)', fontWeight: 800, letterSpacing: '0.01em' }}>
          {label}
        </span>
        <motion.span
          className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wide"
          style={{
            background: isOver ? 'rgba(247, 78, 82, 0.15)' : `${displayColor}1a`,
            color: displayColor,
            border: `1px solid ${isOver ? 'rgba(247, 78, 82, 0.35)' : `${displayColor}35`}`,
          }}
          animate={isGoal ? { scale: [1, 1.08, 1] } : {}}
          transition={isGoal ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : {}}
        >
          {percentInt}%
        </motion.span>
      </div>
    </motion.div>
  );
}

// ── Desktop horizontal macro bars (shown in sidebar on PC) ────────────────────
export function MacroBars({ totals = {}, goal = {} }) {
  const { t } = useTranslation();
  const items = [
    { key: 'calories', label: t('nutrition.macros.calories_short', 'kcal'), color: '#f59e0b', unit: 'kcal' },
    { key: 'protein',  label: t('nutrition.macros.protein', 'Protein'),     color: '#3b82f6', unit: 'g' },
    { key: 'fat',      label: t('nutrition.macros.fat', 'Fat'),             color: '#f97316', unit: 'g' },
    { key: 'carbs',    label: t('nutrition.macros.carbs', 'Carbs'),         color: '#10b981', unit: 'g' },
  ];
  return (
    <div className="flex flex-col gap-3">
      {items.map(({ key, label, color, unit }, i) => {
        const val = totals[key] ?? 0;
        const g = goal[key] ?? 1;
        const pct = Math.min(100, Math.round((val / g) * 100));
        const isOver = val > g;
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-baseline justify-between mb-1.5">
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--habit-text)' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: isOver ? 'var(--habit-red, #f74e52)' : color, fontFamily: 'monospace' }}>
                {Math.round(val)}
                <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 2 }}>{unit}</span>
                <span style={{ fontSize: 9, color: 'var(--habit-dim)', marginLeft: 3 }}>/ {Math.round(g)}</span>
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--habit-border)', overflow: 'hidden', position: 'relative' }}>
              <motion.div
                style={{ height: '100%', borderRadius: 999, background: isOver ? 'var(--habit-red, #f74e52)' : color, boxShadow: `0 0 8px ${color}50` }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: i * 0.07 + 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
              {/* Shimmer beam */}
              {pct > 0 && (
                <motion.div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: '30%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                    borderRadius: 999,
                  }}
                  animate={{ x: ['-30%', `${pct + 30}%`] }}
                  transition={{ duration: 1.6, delay: i * 0.07 + 0.9, ease: 'easeInOut', repeat: 0 }}
                />
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Unified Macro Rings (Desktop & Mobile) ───────────────────────────────────
export default function MacroRings({ totals = {}, goal = {}, compact = false }) {
  const { t } = useTranslation();
  const macroConfig = [
    { key: 'calories', label: t('nutrition.macros.calories_short', 'kcal'), color: 'var(--habit-gold, #f59e0b)', bg: 'rgba(245, 158, 11, 0.12)', isPrimary: true,  size: compact ? 82 : 94 },
    { key: 'protein',  label: t('nutrition.macros.protein', 'Protein'),     color: 'var(--habit-blue, #3b82f6)', bg: 'rgba(59,130,246,0.12)',    isPrimary: false, size: compact ? 64 : 74 },
    { key: 'fat',      label: t('nutrition.macros.fat', 'Fat'),             color: 'var(--habit-orange, #f97316)', bg: 'rgba(249,115,22,0.12)',  isPrimary: false, size: compact ? 64 : 74 },
    { key: 'carbs',    label: t('nutrition.macros.carbs', 'Carbs'),         color: 'var(--habit-green, #10b981)', bg: 'rgba(16,185,129,0.12)',   isPrimary: false, size: compact ? 64 : 74 },
  ];
  return (
    <div className="flex items-end justify-between gap-2 py-1 w-full">
      {macroConfig.map(({ key, label, color, bg, isPrimary, size }, i) => (
        <MacroRing
          key={key}
          index={i}
          value={totals[key] ?? 0}
          goal={goal[key] ?? 0}
          color={color}
          bg={bg}
          label={label}
          isPrimary={isPrimary}
          size={size}
        />
      ))}
    </div>
  );
}
