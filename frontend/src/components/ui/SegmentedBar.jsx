import { motion } from "framer-motion";

/**
 * SegmentedBar — игровая полоска HP/Mana с видимыми сегментами
 * @param {number} value - текущее значение
 * @param {number} max - максимальное значение
 * @param {string} color - цвет полоски (hex)
 * @param {string} label - метка (HP, MANA, etc.)
 * @param {number} segments - количество сегментов (по умолчанию 10)
 * @param {boolean} animated - анимировать заполнение (по умолчанию true)
 */
export default function SegmentedBar({ value, max, color, label, segments = 10, animated = true }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const filledSegments = Math.round((pct / 100) * segments);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground/50">
        <span>{label}</span>
        <span style={{ color }}>{value}/{max}</span>
      </div>
      <div className="flex gap-0.5 h-3">
        {Array.from({ length: segments }).map((_, i) => {
          const isFilled = i < filledSegments;
          return (
            <motion.div
              key={i}
              className="flex-1 rounded-sm overflow-hidden"
              style={{
                background: isFilled ? color : "rgba(30,30,35,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              initial={animated ? { scale: 0.8, opacity: 0 } : {}}
              animate={animated ? { scale: 1, opacity: 1 } : {}}
              transition={{ delay: i * 0.03, type: "spring", stiffness: 400, damping: 25 }}
            >
              {/* Inner glow for filled segments */}
              {isFilled && (
                <div
                  className="w-full h-full"
                  style={{
                    background: `linear-gradient(180deg, ${color}dd 0%, ${color}88 100%)`,
                    boxShadow: `0 0 8px ${color}66`,
                  }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}