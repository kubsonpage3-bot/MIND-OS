import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { METRIC_CONFIG } from "@/lib/cognitiveEngine";

const COLOR_MAP = {
  gf: { bar: "#3b82f6", glow: "rgba(59,130,246,0.5)",  text: "#3b82f6",  track: "#dbeafe" },
  gc: { bar: "#22c55e", glow: "rgba(34,197,94,0.5)",   text: "#22c55e",  track: "#dcfce7" },
  ps: { bar: "#f59e0b", glow: "rgba(245,158,11,0.5)",  text: "#f59e0b",  track: "#fef3c7" },
  vm: { bar: "#a855f7", glow: "rgba(168,85,247,0.5)",  text: "#a855f7",  track: "#f3e8ff" },
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
        setTimeout(() => setDelta(null), 1600);
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
  const displayPct = Math.min((displayValue / ceiling) * 100, 100);

  return (
    <div className="space-y-1.5 group">
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
          <span style={{ fontFamily: "'Pixeltype'", fontSize: 9, color: colors.text }}>
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
                style={{ fontFamily: "'Pixeltype'", fontSize: 7, color: "#22c55e", whiteSpace: "nowrap", textShadow: "0 0 8px #22c55e55" }}
              >
                {delta}
              </motion.span>
            )}
          </AnimatePresence>
          <motion.span
            style={{ fontFamily: "'Pixeltype'", fontSize: 9, color: colors.text }}
            animate={animating ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.4 }}
          >
            {displayValue.toFixed(1)}
          </motion.span>
          <span style={{ fontFamily: "'Nunito'", fontSize: 10, color: "#c4c2cc" }}>/ {ceiling}</span>
        </div>
      </div>

      {/* Progress track */}
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: colors.track }}>
        {/* Fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          animate={{ width: `${displayPct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: `linear-gradient(90deg, ${colors.bar}cc, ${colors.bar})`,
            boxShadow: `0 0 10px ${colors.glow}`,
          }}
        />
        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-y-0 rounded-full pointer-events-none"
          style={{
            width: "40%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
          }}
          animate={{ left: ["-40%", "120%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
        />
      </div>

      {/* Floor / ceiling labels */}
      <div className="flex justify-between" style={{ fontFamily: "'Nunito'", fontSize: 10, color: "#c4c2cc" }}>
        <span>80</span>
        <div className="flex items-center gap-1">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: colors.bar }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span>ceiling: {ceiling}</span>
        </div>
      </div>
    </div>
  );
}