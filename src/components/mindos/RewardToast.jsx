import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { normalizeGold } from "@/lib/utils";

let _showToast = null;

export function showRewardToast({ xp = 0, gold = 0, boss = 0, streak = 0, label = "" }) {
  if (_showToast) _showToast({ xp, gold, boss, streak, label });
}

export default function RewardToast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    _showToast = ({ xp, gold, boss, streak, label }) => {
      const id = Date.now();
      setToasts(prev => [...prev.slice(-3), { id, xp, gold, boss, streak, label }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800);
    };
    return () => { _showToast = null; };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(30,24,14,0.98) 0%, rgba(22,18,10,0.99) 100%)",
              border: "1px solid rgba(240,192,64,0.35)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 16px rgba(240,192,64,0.15)",
            }}
          >
            {t.label && (
              <span className="font-game text-xs font-semibold" style={{ color: "#f0c040" }}>{t.label}</span>
            )}
            {t.xp > 0 && (
              <span className="font-hud text-sm font-bold" style={{ color: "#a78bfa" }}>+{t.xp} XP</span>
            )}
            {t.gold > 0 && (
              <span className="font-hud text-sm font-bold" style={{ color: "#f0c040" }}>+{normalizeGold(t.gold)} G</span>
            )}
            {t.boss > 0 && (
              <span className="font-hud text-sm font-bold" style={{ color: "#ef4444" }}>⚔ {t.boss}</span>
            )}
            {t.streak > 0 && (
              <span className="font-hud text-sm font-bold text-orange-400">🔥{t.streak}</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}