import { motion } from "framer-motion";
import { Lock, Swords, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getRankDisplayData } from "@/lib/rankEngine";

export default function FeatureLockScreen({ feature, requiredRank, profile }) {
  const { t } = useTranslation();

  const currentRank = profile?.rank_info?.current_id || profile?.rank || "F";
  const currentXP = profile?.rank_xp || 0;

  // Find target XP threshold from rank_info thresholds, or fallback to standard defaults
  const thresholds = profile?.rank_info?.thresholds || [
    { id: "F", min: 0 },
    { id: "D", min: 200 },
    { id: "C", min: 600 },
  ];

  const targetThreshold = thresholds.find((t) => t.id === requiredRank);
  const targetXP = targetThreshold ? targetThreshold.min : (requiredRank === "D" ? 200 : 600);
  const xpNeeded = Math.max(0, targetXP - currentXP);
  
  // Percent progress
  const progressPercent = Math.min(100, Math.max(0, (currentXP / targetXP) * 100));

  const targetRankData = getRankDisplayData(requiredRank, profile);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[400px] rounded-2xl relative overflow-hidden"
      style={{
        background: "var(--habit-panel)",
        border: "1px solid var(--habit-border)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
      }}
    >
      {/* Decorative scanlines and grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 3px)" }} />

      {/* Glow Effect */}
      <div 
        className="absolute w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-20"
        style={{
          background: `radial-gradient(circle, ${targetRankData.color || '#3b82f6'} 0%, transparent 70%)`,
          top: "10%",
        }}
      />

      {/* Floating Sparkles */}
      <motion.div
        animate={{ y: [0, -10, 0], opacity: [0.4, 0.8, 0.4] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="absolute top-10 right-10 text-primary/40 pointer-events-none"
      >
        <Sparkles size={24} />
      </motion.div>

      {/* Main Lock Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        className="relative w-20 h-20 mb-6 flex items-center justify-center rounded-2xl border-2 bg-background/50"
        style={{ borderColor: `${targetRankData.color || '#3b82f6'}50` }}
      >
        <Lock className="w-10 h-10 text-muted-foreground/80" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          className="absolute inset-0 border border-dashed rounded-2xl"
          style={{ borderColor: `${targetRankData.color || '#3b82f6'}30` }}
        />
      </motion.div>

      {/* Header */}
      <h3 className="font-mono text-lg font-bold uppercase tracking-wider mb-2 text-foreground">
        {String(t(`feature_lock.${feature}_name`, feature.replace("_", " ")))} {String(t("feature_lock.locked_suffix", "Locked"))}
      </h3>

      <p className="font-mono text-xs text-muted-foreground/80 max-w-sm mb-6 leading-relaxed">
        {String(t("feature_lock.subtitle", { rank: targetRankData.label || requiredRank, feature: String(t(`feature_lock.${feature}_name`, feature)) }))}
      </p>

      {/* Progress Bar Container */}
      <div className="w-full max-w-xs space-y-2 mb-4 relative z-10">
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>{String(t("feature_lock.current_rank", "Current Rank"))}: <strong className="text-foreground">{currentRank}</strong></span>
          <span>{currentXP} / {targetXP} XP</span>
        </div>
        
        {/* Bar */}
        <div className="h-3 w-full bg-background/60 rounded-full border border-border/60 overflow-hidden p-[2px]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${targetRankData.color || '#3b82f6'}aa, ${targetRankData.color || '#3b82f6'})`,
              boxShadow: `0 0 10px ${targetRankData.color || '#3b82f6'}44`,
            }}
          />
        </div>

        <div className="text-[10px] font-mono text-muted-foreground/60">
          {xpNeeded > 0 ? (
            <span>✦ {t("feature_lock.remaining", { xp: xpNeeded, rank: targetRankData.label || requiredRank })}</span>
          ) : (
            <span className="text-green-400">✦ Ready to Unlock!</span>
          )}
        </div>
      </div>

      <div className="text-[9px] font-mono text-muted-foreground/40 mt-2">
        {t("feature_lock.hint", "Complete tasks and log focus sessions to earn XP.")}
      </div>
    </div>
  );
}
