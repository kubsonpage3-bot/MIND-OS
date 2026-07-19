import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { METRIC_CONFIG } from "@/lib/cognitiveEngine";

const COLOR_MAP = {
  gf: { bar: "#3b82f6", glow: "rgba(59,130,246,0.5)",  text: "#3b82f6",  track: "rgba(59,130,246,0.1)", gradient: "linear-gradient(90deg, #1d4ed8, #3b82f6)" },
  gc: { bar: "#22c55e", glow: "rgba(34,197,94,0.5)",   text: "#22c55e",  track: "rgba(34,197,94,0.1)", gradient: "linear-gradient(90deg, #047857, #22c55e)" },
  ps: { bar: "#f59e0b", glow: "rgba(245,158,11,0.5)",  text: "#f59e0b",  track: "rgba(245,158,11,0.1)", gradient: "linear-gradient(90deg, #b45309, #f59e0b)" },
  vm: { bar: "#a855f7", glow: "rgba(168,85,247,0.5)",  text: "#a855f7",  track: "rgba(168,85,247,0.1)", gradient: "linear-gradient(90deg, #7e22ce, #a855f7)" },
};

export default function MetricBar({ metricKey, current, ceiling, showHoursHint = false }) {
  const config = METRIC_CONFIG[metricKey];
  const [displayValue, setDisplayValue] = useState(current);
  const [animating, setAnimating] = useState(false);
  const [delta, setDelta] = useState(null);

  useEffect(() => {
    if (current !== displayValue) {
      const diff = current - displayValue;
      if (diff > 0.001) {
        setDelta(`+${diff.toFixed(3)}`);
        const timer = setTimeout(() => setDelta(null), 1600);
        return () => clearTimeout(timer);
      }

      setAnimating(true);
      const start = displayValue;
      const end = current;
      const duration = 700;
      const startTime = performance.now();
      const animate = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round((start + (end - start) * eased) * 1000) / 1000);
        if (progress < 1) requestAnimationFrame(animate);
        else setAnimating(false);
      };
      requestAnimationFrame(animate);
    }
  }, [current]);

  const colors = COLOR_MAP[metricKey];
  // Calculate percentage of progress from floor 80 to ceiling
  const displayPct = Math.max(0, Math.min(100, ((displayValue - 80) / (ceiling - 80 || 1)) * 100));

  return (
    <div className="space-y-1 group">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Colored dot */}
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: colors.bar }}
            animate={animating ? { scale: [1, 1.6, 1], opacity: [1, 0.7, 1] } : {}}
            transition={{ duration: 0.5 }}
          />
          <span style={{ fontFamily: "'PixeloidSans'", fontSize: 9, color: colors.text }}>
            {config.abbr}
          </span>
          <span style={{ fontFamily: "'Nunito'", fontSize: 11, color: "#878190" }} className="hidden sm:inline">
            {config.label}
          </span>
        </div>
        <div className="relative flex items-center gap-2">
          {/* Delta float */}
          <AnimatePresence>
            {delta && (
              <motion.span
                initial={{ opacity: 0, y: 4, scale: 0.8 }}
                animate={{ opacity: 1, y: -10, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 1.4 }}
                className="absolute right-16 pointer-events-none"
                style={{ fontFamily: "'PixeloidSans'", fontSize: 7, color: "#22c55e", whiteSpace: "nowrap", textShadow: "0 0 8px #22c55e55" }}
              >
                {delta}
              </motion.span>
            )}
          </AnimatePresence>
          <motion.span
            style={{ fontFamily: "'PixeloidSans'", fontSize: 9, color: colors.text }}
            animate={animating ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.4 }}
          >
            {displayValue.toFixed(1)}
          </motion.span>
          <span style={{ fontFamily: "'Nunito'", fontSize: 10, color: "#c4c2cc" }}>/ {ceiling}</span>
        </div>
      </div>

      {/* Progress track */}
      <div className="relative h-3.5 rounded-full overflow-hidden border border-white/5 flex items-center bg-black/20" style={{ background: colors.track }}>
        {/* Fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          animate={{ width: `${displayPct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: colors.gradient,
            boxShadow: `0 0 10px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.15)`,
          }}
        />
        
        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-y-0 rounded-full pointer-events-none"
          style={{
            width: "40%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
          }}
          animate={{ left: ["-40%", "120%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
        />

        {/* Ceiling Tick line directly on the bar */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-0.5 z-10" 
          style={{ backgroundColor: colors.bar, opacity: 0.6 }}
        />
        
        {/* Ceiling value label inside track at the right */}
        <span 
          className="absolute right-2 text-[8px] font-mono font-bold pointer-events-none z-10 select-none"
          style={{ color: colors.text, opacity: 0.8 }}
        >
          {ceiling}
        </span>
      </div>

      {/* Floor label only */}
      <div className="flex justify-between" style={{ fontFamily: "'Nunito'", fontSize: 9, color: "#878190" }}>
        <span>80</span>
      </div>
    </div>
  );
}