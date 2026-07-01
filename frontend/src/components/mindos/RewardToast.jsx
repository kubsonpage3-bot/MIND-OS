import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { normalizeGold } from "@/lib/utils";

let _showToast = null;

export function showRewardToast({ xp = 0, gold = 0, boss = 0, streak = 0, label = "", effectNotes = [], isCrit = false, itemDropped = null, type = "success" }) {
  if (_showToast) _showToast({ xp, gold, boss, streak, label, effectNotes, isCrit, itemDropped, type });
}

export default function RewardToast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    _showToast = ({ xp, gold, boss, streak, label, effectNotes, isCrit, itemDropped, type }) => {
      const id = Date.now();
      setToasts(prev => [...prev.slice(-3), { id, xp, gold, boss, streak, label, effectNotes, isCrit, itemDropped, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
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
            className="flex flex-col px-4 py-3 rounded-xl border shadow-2xl"
            style={{
              background: t.type === 'error' 
                ? "linear-gradient(135deg, rgba(40,10,10,0.98) 0%, rgba(30,5,5,0.99) 100%)"
                : "linear-gradient(135deg, rgba(30,24,14,0.98) 0%, rgba(22,18,10,0.99) 100%)",
              border: t.type === 'error'
                ? "1px solid rgba(240,64,64,0.35)"
                : "1px solid rgba(240,192,64,0.35)",
              boxShadow: t.type === 'error'
                ? "0 8px 32px rgba(0,0,0,0.6), 0 0 16px rgba(240,64,64,0.15)"
                : "0 8px 32px rgba(0,0,0,0.6), 0 0 16px rgba(240,192,64,0.15)",
            }}
          >
            <div className="flex items-center gap-3">
              {t.label && (
                <span className="font-game text-xs font-semibold" style={{ color: t.type === 'error' ? "#ef4444" : (t.isCrit ? "#fbbf24" : "#f0c040") }}>
                  {t.isCrit && "⚡ Critical Focus! "}
                  {t.label}
                </span>
              )}
              {t.xp > 0 && (
                <span className="font-hud text-sm font-bold" style={{ color: "#a78bfa" }}>+{t.xp} XP</span>
              )}
              {t.gold > 0 && (
                <span className="font-hud text-sm font-bold" style={{ color: "#f0c040" }}>+{normalizeGold(t.gold)} G</span>
              )}
              {t.boss > 0 && (
                <span className="font-hud text-sm font-bold" style={{ color: "#ef4444" }}>⚔️ {t.boss}</span>
              )}
              {t.streak > 0 && (
                <span className="font-hud text-sm font-bold text-orange-400">🔥{t.streak}</span>
              )}
            </div>
            
            {t.itemDropped && (
              <div className="mt-1">
                <span className="font-hud text-xs font-bold text-yellow-300">🎁 Loot Dropped: {t.itemDropped}</span>
              </div>
            )}

            {t.effectNotes?.length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5">
                {t.effectNotes.map((note, idx) => (
                  <span key={idx} className="font-hud text-[10px] text-cyan-400">✨ {note}</span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}