import { motion } from 'framer-motion';

const MACRO_CONFIG = [
  { key: 'calories', label: 'ккал', color: 'var(--habit-gold, #f59e0b)', bg: 'rgba(245,158,11,0.12)' },
  { key: 'protein',  label: 'Белки', color: 'var(--habit-blue, #3b82f6)', bg: 'rgba(59,130,246,0.12)' },
  { key: 'fat',      label: 'Жиры',  color: 'var(--habit-orange, #f97316)', bg: 'rgba(249,115,22,0.12)' },
  { key: 'carbs',    label: 'Углев.', color: 'var(--habit-green, #10b981)', bg: 'rgba(16,185,129,0.12)' },
];

/**
 * SVG-кольцо прогресса для одного макронутриента.
 * @param {{ value: number, goal: number, color: string, bg: string, label: string, size?: number }} props
 */
export function MacroRing({ value, goal, color, bg, label, size = 80 }) {
  const strokeWidth = size > 80 ? 9 : 7;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? Math.min(value / goal, 1.25) : 0;
  const offset = circumference * (1 - Math.min(pct, 1));
  const isOver = goal > 0 && value > goal;

  return (
    <div className="flex flex-col items-center gap-1" style={{ minWidth: size }}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" style={{ display: 'block' }}>
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={bg}
            strokeWidth={strokeWidth}
          />
          {/* Animated fill */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isOver ? 'var(--habit-red, #ef4444)' : color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: size > 80 ? 20 : 15,
              color: isOver ? 'var(--habit-red, #ef4444)' : color,
              lineHeight: 1,
              fontWeight: 700,
            }}
          >
            {Math.round(value)}
          </span>
          <span
            style={{
              fontSize: size > 80 ? 10 : 8.5,
              color: 'var(--habit-dim, #888)',
              lineHeight: 1.1,
              marginTop: 2,
            }}
          >
            /{Math.round(goal)}
          </span>
        </div>
      </div>

      <span
        style={{
          fontSize: 11,
          color: 'var(--habit-text)',
          opacity: 0.8,
          fontWeight: 700,
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Четыре кольца КБЖУ в ряд.
 * @param {{ totals: object, goal: object }} props
 */
export default function MacroRings({ totals = {}, goal = {} }) {
  return (
    <div className="flex items-end justify-around gap-1 sm:gap-3 py-2 px-1">
      {MACRO_CONFIG.map(({ key, label, color, bg }) => (
        <MacroRing
          key={key}
          value={totals[key] ?? 0}
          goal={goal[key] ?? 0}
          color={color}
          bg={bg}
          label={label}
          size={key === 'calories' ? 94 : 74}
        />
      ))}
    </div>
  );
}
