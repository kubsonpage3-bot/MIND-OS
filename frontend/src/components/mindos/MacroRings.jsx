import { useEffect, useRef, useState } from 'react';
import { motion, animate } from 'framer-motion';
import { useTranslation } from 'react-i18next';

/**
 * Animated number counter hook/component for smooth value transitions.
 */
function AnimatedCounter({ value, style, className }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const controls = animate(prevValueRef.current, value, {
      duration: 0.75,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    prevValueRef.current = value;
    return () => controls.stop();
  }, [value]);

  return (
    <span className={className} style={style}>
      {displayValue}
    </span>
  );
}

/**
 * SVG Progress Ring with neon glow & animated number counter.
 * @param {{ value: number, goal: number, color: string, bg: string, label: string, size?: number, isPrimary?: boolean }} props
 */
export function MacroRing({ value, goal, color, bg, label, size = 76, isPrimary = false }) {
  const strokeWidth = isPrimary ? 8.5 : 6.5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const rawPct = goal > 0 ? value / goal : 0;
  const pctClamped = Math.min(rawPct, 1.25);
  const offset = circumference * (1 - Math.min(pctClamped, 1));
  const isOver = goal > 0 && value > goal;
  const percentInt = Math.round(rawPct * 100);

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ minWidth: size }}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          style={{
            display: 'block',
            filter: isOver
              ? 'drop-shadow(0 0 5px rgba(247, 78, 82, 0.55))'
              : `drop-shadow(0 0 5px ${color}50)`,
          }}
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={bg}
            strokeWidth={strokeWidth}
          />
          {/* Animated fill stroke */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isOver ? 'var(--habit-red, #f74e52)' : color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <AnimatedCounter
            value={value}
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontSize: isPrimary ? 19 : 14,
              color: isOver ? 'var(--habit-red, #f74e52)' : color,
              lineHeight: 1,
              fontWeight: 900,
            }}
          />
          <span
            style={{
              fontSize: isPrimary ? 9.5 : 8,
              color: 'var(--habit-dim, #888)',
              fontWeight: 700,
              lineHeight: 1.1,
              marginTop: 1.5,
            }}
          >
            /{Math.round(goal)}
          </span>
        </div>
      </div>

      {/* Label & % Badge */}
      <div className="flex flex-col items-center gap-0.5">
        <span
          style={{
            fontSize: 11,
            color: 'var(--habit-text)',
            fontWeight: 800,
            letterSpacing: '0.02em',
          }}
        >
          {label}
        </span>
        <span
          className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold"
          style={{
            background: isOver
              ? 'rgba(247, 78, 82, 0.15)'
              : `${color}18`,
            color: isOver ? 'var(--habit-red, #f74e52)' : color,
            border: `1px solid ${isOver ? 'rgba(247, 78, 82, 0.3)' : `${color}30`}`,
          }}
        >
          {percentInt}%
        </span>
      </div>
    </div>
  );
}

/**
 * 4 Macro Rings (Calories, Protein, Fat, Carbs) with layout hierarchy.
 * @param {{ totals: object, goal: object }} props
 */
export default function MacroRings({ totals = {}, goal = {} }) {
  const { t } = useTranslation();

  const macroConfig = [
    {
      key: 'calories',
      label: t('nutrition.macros.calories_short', 'kcal'),
      color: 'var(--habit-gold, #ffbe5d)',
      bg: 'rgba(255, 190, 93, 0.12)',
      isPrimary: true,
      size: 92,
    },
    {
      key: 'protein',
      label: t('nutrition.macros.protein', 'Protein'),
      color: 'var(--habit-blue, #50b5e9)',
      bg: 'rgba(80, 181, 233, 0.12)',
      isPrimary: false,
      size: 74,
    },
    {
      key: 'fat',
      label: t('nutrition.macros.fat', 'Fat'),
      color: 'var(--habit-orange, #ff8800)',
      bg: 'rgba(255, 136, 0, 0.12)',
      isPrimary: false,
      size: 74,
    },
    {
      key: 'carbs',
      label: t('nutrition.macros.carbs', 'Carbs'),
      color: 'var(--habit-green, #1ca830)',
      bg: 'rgba(28, 168, 48, 0.12)',
      isPrimary: false,
      size: 74,
    },
  ];

  return (
    <div className="flex items-end justify-around gap-1 sm:gap-3 py-2 px-1">
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
