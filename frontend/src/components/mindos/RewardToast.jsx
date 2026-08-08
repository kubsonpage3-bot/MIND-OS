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
      setToasts((prev) => [...prev.slice(-3), { id, xp, gold, boss, streak, label, effectNotes, isCrit, itemDropped, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };
    return () => {
      _showToast = null;
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ t }) {
  const isError = t.type === "error";
  const accentColor = isError ? "#ef4444" : t.isCrit ? "#fbbf24" : "#f0c040";
  const bgFrom = isError ? "rgba(40,8,8,0.97)" : t.isCrit ? "rgba(30,20,5,0.97)" : "rgba(22,18,8,0.97)";
  const bgTo = isError ? "rgba(20,4,4,0.98)" : "rgba(12,10,4,0.98)";

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.88 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.90 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className="relative overflow-hidden flex flex-col px-4 py-3 rounded-xl"
      style={{
        background: `linear-gradient(135deg, ${bgFrom} 0%, ${bgTo} 100%)`,
        border: `1px solid ${accentColor}40`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.65), 0 0 20px ${accentColor}18`,
        minWidth: 180,
      }}
    >
      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ x: "-100%" }}
        animate={{ x: "200%" }}
        transition={{ duration: 1.0, delay: 0.1, ease: "easeInOut" }}
        style={{
          background: `linear-gradient(105deg, transparent 30%, ${accentColor}18 50%, transparent 70%)`,
          width: "60%",
        }}
      />

      {/* Crit pulse ring */}
      {t.isCrit && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          animate={{ boxShadow: [
            `0 0 0px ${accentColor}00`,
            `0 0 12px ${accentColor}77`,
            `0 0 0px ${accentColor}00`,
          ] }}
          transition={{ duration: 0.8, repeat: 2, ease: "easeInOut" }}
        />
      )}

      <div className="relative flex items-center gap-3 flex-wrap">
        {t.label && (
          <span
            className="font-game text-xs font-semibold"
            style={{ color: isError ? "#ef4444" : t.isCrit ? "#fbbf24" : "#f0c040" }}
          >
            {t.isCrit && (
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.4, repeat: 2 }}
                className="inline-block mr-1"
              >
                ⚡
              </motion.span>
            )}
            {t.isCrit && "Critical Focus! "}
            {t.label}
          </span>
        )}

        {t.xp > 0 && (
          <motion.span
            initial={{ scale: 0.7 }}
            animate={{ scale: [0.7, 1.15, 1] }}
            transition={{ duration: 0.35 }}
            className="font-hud text-sm font-bold"
            style={{ color: "#a78bfa" }}
          >
            +{t.xp} XP
          </motion.span>
        )}

        {t.gold > 0 && (
          <motion.span
            initial={{ scale: 0.7 }}
            animate={{ scale: [0.7, 1.15, 1] }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="font-hud text-sm font-bold"
            style={{ color: "#f0c040" }}
          >
            +{normalizeGold(t.gold)} G
          </motion.span>
        )}

        {t.boss > 0 && (
          <span className="font-hud text-sm font-bold" style={{ color: "#ef4444" }}>
            ⚔️ {t.boss}
          </span>
        )}

        {t.streak > 0 && (
          <motion.span
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.5, repeat: 1 }}
            className="font-hud text-sm font-bold text-orange-400"
          >
            🔥{t.streak}
          </motion.span>
        )}
      </div>

      {t.itemDropped && (
        <div className="relative mt-1.5 flex items-center gap-1.5">
          <motion.span
            animate={{ rotate: [0, 15, -10, 5, 0] }}
            transition={{ duration: 0.5 }}
            className="text-base"
          >
            🎁
          </motion.span>
          <span className="font-hud text-xs font-bold text-yellow-300">
            Loot: {t.itemDropped}
          </span>
        </div>
      )}

      {t.effectNotes?.length > 0 && (
        <div className="relative mt-1 flex flex-col gap-0.5">
          {t.effectNotes.map((note, idx) => (
            <span key={idx} className="font-hud text-[10px] text-cyan-400">
              ✨ {note}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
