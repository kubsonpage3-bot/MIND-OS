import { motion } from 'framer-motion';

const MACRO_CONFIG = [
  { key: 'calories', label: 'ккал', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  { key: 'protein',  label: 'Б',    color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  { key: 'fat',      label: 'Ж',    color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  { key: 'carbs',    label: 'У',    color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
];

/**
 * SVG-кольцо прогресса для одного макронутриента.
 * @param {{ value: number, goal: number, color: string, bg: string, label: string, size?: number }} props
 */
export function MacroRing({ value, goal, color, bg, label, size = 80 }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const offset = circumference * (1 - pct);
  const isOver = goal > 0 && value > goal;

  return (
    <div className="flex flex-col items-center gap-1" style={{ minWidth: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" style={{ display: 'block' }}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={bg} strokeWidth={10}
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={isOver ? '#ef4444' : color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: size < 80 ? 14 : 17,
              color: isOver ? '#ef4444' : color,
              lineHeight: 1,
            }}
          >
            {Math.round(value)}
          </span>
          <span style={{ fontSize: 9, color: 'var(--habit-text)', opacity: 0.6, lineHeight: 1 }}>
            /{Math.round(goal)}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--habit-text)', opacity: 0.7, fontWeight: 700 }}>
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
    <div className="flex items-end justify-around gap-2 py-2 px-1">
      {MACRO_CONFIG.map(({ key, label, color, bg }) => (
        <MacroRing
          key={key}
          value={totals[key] ?? 0}
          goal={goal[key] ?? 0}
          color={color}
          bg={bg}
          label={label}
          size={key === 'calories' ? 92 : 72}
        />
      ))}
    </div>
  );
}
