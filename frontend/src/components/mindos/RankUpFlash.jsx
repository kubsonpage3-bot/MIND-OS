import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import ConfettiBurst from "@/components/mindos/ConfettiBurst";
import { playSound } from "@/lib/soundEffects";

const RANKS = [
  { id: "E",   color: "#64748b", label: "DORMANT"   },
  { id: "D",   color: "#ef4444", label: "AWAKENING" },
  { id: "C",   color: "#f97316", label: "GRINDING"  },
  { id: "B",   color: "#eab308", label: "SHARPENED" },
  { id: "A",   color: "#22c55e", label: "ELITE"     },
  { id: "S",   color: "#3b82f6", label: "APEX"      },
  { id: "SS",  color: "#a855f7", label: "SOVEREIGN" },
  { id: "SSS", color: "#f59e0b", label: "GOD MODE ✨" },
];

export default function RankUpFlash({ newRankId, onDone }) {
  const { t } = useTranslation();
  const rankObj = newRankId ? RANKS.find((r) => r.id === newRankId) : null;
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!newRankId) return;

    const soundTimer = setTimeout(() => playSound("rank_up"), 200);
    const confettiTimer = setTimeout(() => setShowConfetti(true), 100);
    const doneTimer = setTimeout(() => {
      setShowConfetti(false);
      onDone();
    }, 3800);

    return () => {
      clearTimeout(soundTimer);
      clearTimeout(confettiTimer);
      clearTimeout(doneTimer);
    };
  }, [newRankId]);

  return (
    <>
      {/* Confetti burst */}
      {rankObj && (
        <ConfettiBurst active={showConfetti} color={rankObj.color} count={60} />
      )}

      <AnimatePresence>
        {rankObj && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            {/* Full-screen color flash */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.25, 0] }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ background: rankObj.color }}
            />

            {/* Edge glow */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0.3, 0] }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ boxShadow: `inset 0 0 160px ${rankObj.color}` }}
            />

            {/* Rotating light rays */}
            <motion.div
              className="absolute"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              style={{
                width: 600,
                height: 600,
                background: `conic-gradient(
                  ${rankObj.color}22 0deg,
                  transparent 30deg,
                  ${rankObj.color}11 60deg,
                  transparent 90deg,
                  ${rankObj.color}22 120deg,
                  transparent 150deg,
                  ${rankObj.color}11 180deg,
                  transparent 210deg,
                  ${rankObj.color}22 240deg,
                  transparent 270deg,
                  ${rankObj.color}11 300deg,
                  transparent 330deg,
                  ${rankObj.color}22 360deg
                )`,
                borderRadius: "50%",
              }}
            />

            {/* Main card */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 1.1, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.05 }}
              className="relative text-center px-14 py-10 rounded-3xl border-2 z-10"
              style={{
                borderColor: rankObj.color,
                background: `rgba(4,2,14,0.92)`,
                boxShadow: `0 0 80px ${rankObj.color}55, 0 0 160px ${rankObj.color}22`,
              }}
            >
              {/* "RANK UP" label */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="font-mono text-xs tracking-[0.3em] mb-3"
                style={{ color: rankObj.color + "aa" }}
              >
                {t("rankUpFlash.rankUp", "RANK UP")}
              </motion.div>

              {/* Rank letter */}
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: [0.3, 1.25, 0.95, 1.05, 1], opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.7, ease: "easeOut" }}
                className="font-mono font-black leading-none"
                style={{
                  fontSize: "5.5rem",
                  color: rankObj.color,
                  textShadow: `0 0 30px ${rankObj.color}, 0 0 80px ${rankObj.color}88`,
                }}
              >
                {rankObj.id}
              </motion.div>

              {/* Rank name */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="font-mono font-bold tracking-[0.2em] text-lg mt-2"
                style={{ color: rankObj.color }}
              >
                {rankObj.label}
              </motion.div>

              {/* Pulsing glow ring */}
              <motion.div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                animate={{ boxShadow: [
                  `0 0 30px ${rankObj.color}44`,
                  `0 0 60px ${rankObj.color}88`,
                  `0 0 30px ${rankObj.color}44`,
                ] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
