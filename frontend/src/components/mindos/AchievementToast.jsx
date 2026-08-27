// @ts-nocheck
﻿import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

let _showAchievement = null;

export function showAchievementToast(name, description = "") {
  if (_showAchievement) _showAchievement({ name, description });
}

export default function AchievementToast() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    _showAchievement = ({ name, description }) => {
      const id = Date.now();
      setItems((prev) => [...prev.slice(-2), { id, name, description }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 5500);
    };
    return () => {
      _showAchievement = null;
    };
  }, []);

  return (
    <div className="fixed top-20 right-3 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 280 }}>
      <AnimatePresence>
        {items.map((item) => (
          <AchievementCard key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function AchievementCard({ item }) {
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef(null);

  useEffect(() => {
    const total = 5000;
    const tick = 50;
    let elapsed = 0;

    intervalRef.current = setInterval(() => {
      elapsed += tick;
      setProgress(Math.max(0, 100 - (elapsed / total) * 100));
      if (elapsed >= total) clearInterval(intervalRef.current);
    }, tick);

    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <motion.div
      initial={{ x: 300, opacity: 0, scale: 0.9 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 300, opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #1a0e38 0%, #0d0820 100%)",
        border: "1px solid rgba(251,191,36,0.45)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(251,191,36,0.2)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 pt-3 pb-1 flex items-center gap-2"
        style={{ borderBottom: "1px solid rgba(251,191,36,0.15)" }}
      >
        <motion.span
          initial={{ rotate: -20, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.1 }}
          className="text-2xl"
          style={{ filter: "drop-shadow(0 0 8px #fbbf24)" }}
        >
          🏆
        </motion.span>
        <div>
          <p
            className="text-[9px] font-black uppercase tracking-[0.2em]"
            style={{ color: "#fbbf24" }}
          >
            Achievement Unlocked
          </p>
          <p className="text-sm font-bold leading-tight" style={{ color: "#fff" }}>
            {item.name}
          </p>
          {item.description && (
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.50)" }}>
              {item.description}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1" style={{ background: "rgba(255,255,255,0.08)" }}>
        <motion.div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
            transition: "width 50ms linear",
          }}
        />
      </div>
    </motion.div>
  );
}
