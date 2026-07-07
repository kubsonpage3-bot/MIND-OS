import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
export default function RankUpFlash({ newRankId, onDone }) {
  const { t } = useTranslation();
  const rankObj = newRankId
    ? [
        { id: "F", color: "#64748b", label: "DORMANT" },
        { id: "D", color: "#ef4444", label: "AWAKENING" },
        { id: "C", color: "#f97316", label: "GRINDING" },
        { id: "B", color: "#eab308", label: "SHARPENED" },
        { id: "A", color: "#22c55e", label: "ELITE" },
        { id: "S", color: "#3b82f6", label: "APEX" },
        { id: "SS", color: "#a855f7", label: "SOVEREIGN" },
        { id: "SSS", color: "#f59e0b", label: "GOD MODE ✨" },
      ].find(r => r.id === newRankId)
    : null;

  useEffect(() => {
    if (newRankId) {
      const t = setTimeout(onDone, 3000);
      return () => clearTimeout(t);
    }
  }, [newRankId]);

  return (
    <AnimatePresence>
      {rankObj && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          style={{ background: `${rankObj.color}18` }}
        >
          {/* Edge flash */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
            style={{ boxShadow: `inset 0 0 120px ${rankObj.color}` }}
          />
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-center px-12 py-8 rounded-3xl border-2"
            style={{
              borderColor: rankObj.color,
              background: `rgba(0,0,0,0.85)`,
              boxShadow: `0 0 60px ${rankObj.color}, 0 0 120px ${rankObj.color}40`,
            }}
          >
            <div className="font-mono text-sm tracking-widest text-muted-foreground mb-2">{t('rankUpFlash.rankUp')}</div>
            <div
              className="font-mono font-black tracking-widest"
              style={{ fontSize: "4rem", color: rankObj.color, textShadow: `0 0 40px ${rankObj.color}` }}
            >
              {rankObj.id}
            </div>
            <div className="font-mono font-bold tracking-widest text-lg mt-1" style={{ color: rankObj.color }}>
              {rankObj.label}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}