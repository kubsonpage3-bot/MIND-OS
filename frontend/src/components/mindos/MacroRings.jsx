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

export function MacroRing({ value, goal, color, bg, label, size = 80, isPrimary = false }) {
  const strokeWidth = isPrimary ? 9 : 7;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const rawPct = goal > 0 ? value / goal : 0;
  const pctClamped = Math.min(rawPct, 1.25);
  const offset = circumference * (1 - Math.min(pctClamped, 1));
  const isOver = goal > 0 && value > goal;
  const percentInt = Math.round(rawPct * 100);
  const displayColor = isOver ? 'var(--habit-red, #f74e52)' : color;

  return (
    <div className="flex flex-col items-center gap-2" style={{ minWidth: size }}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Soft glow background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${displayColor}18 0%, transparent 70%)`,
          filter: 'blur(8px)',
          transform: 'scale(0.85)',
        }} />
        <svg width={size} height={size} className="-rotate-90" style={{ display: 'block', position: 'relative' }}>
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
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${displayColor}80)` }}
          />
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
        <span
          className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wide"
          style={{
            background: isOver ? 'rgba(247, 78, 82, 0.15)' : `${displayColor}1a`,
            color: displayColor,
            border: `1px solid ${isOver ? 'rgba(247, 78, 82, 0.35)' : `${displayColor}35`}`,
          }}
        >
          {percentInt}%
        </span>
      </div>
    </div>
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
      {items.map(({ key, label, color, unit }) => {
        const val = totals[key] ?? 0;
        const g = goal[key] ?? 1;
        const pct = Math.min(100, Math.round((val / g) * 100));
        const isOver = val > g;
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--habit-text)' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: isOver ? 'var(--habit-red, #f74e52)' : color, fontFamily: 'monospace' }}>
                {Math.round(val)}
                <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 2 }}>{unit}</span>
                <span style={{ fontSize: 9, color: 'var(--habit-dim)', marginLeft: 3 }}>/ {Math.round(g)}</span>
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--habit-border)', overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', borderRadius: 999, background: isOver ? 'var(--habit-red, #f74e52)' : color, boxShadow: `0 0 8px ${color}50` }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Unified Macro Rings (Desktop & Mobile) ───────────────────────────────────
export default function MacroRings({ totals = {}, goal = {}, compact = false }) {
  const { t } = useTranslation();
  const macroConfig = [
    { key: 'calories', label: t('nutrition.macros.calories_short', 'kcal'), color: 'var(--habit-gold, #f59e0b)', bg: 'rgba(245, 158, 11, 0.12)', isPrimary: true,  size: compact ? 84 : 94 },
    { key: 'protein',  label: t('nutrition.macros.protein', 'Protein'),     color: 'var(--habit-blue, #3b82f6)', bg: 'rgba(59,130,246,0.12)',    isPrimary: false, size: compact ? 68 : 74 },
    { key: 'fat',      label: t('nutrition.macros.fat', 'Fat'),             color: 'var(--habit-orange, #f97316)', bg: 'rgba(249,115,22,0.12)',  isPrimary: false, size: compact ? 68 : 74 },
    { key: 'carbs',    label: t('nutrition.macros.carbs', 'Carbs'),         color: 'var(--habit-green, #10b981)', bg: 'rgba(16,185,129,0.12)',   isPrimary: false, size: compact ? 68 : 74 },
  ];
  return (
    <div className="flex items-end justify-between gap-1 py-1 px-0.5 w-full">
      {macroConfig.map(({ key, label, color, bg, isPrimary, size }) => (
        <MacroRing
          key={key}
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

