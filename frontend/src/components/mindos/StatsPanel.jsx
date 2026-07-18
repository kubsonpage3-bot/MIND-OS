import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { djangoApi } from "@/api/djangoClient";
import { motion, AnimatePresence } from "framer-motion";
import TitleSelectorModal from "@/components/mindos/TitleSelectorModal";

const XP_PER_LEVEL = 500;

export default function StatsPanel({ profile, logs }) {
  const { t } = useTranslation();
  const [showTitleModal, setShowTitleModal] = useState(false);

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const weekLogs = logs.filter(l => new Date(l.created_at) >= weekAgo);

  const weeklyXP = profile?.weekly_xp || 0;
  const xpPct = (weeklyXP % XP_PER_LEVEL) / XP_PER_LEVEL * 100;

  const cognitiveROI = useMemo(() => {
    const withEff = weekLogs.filter(l => l.efficiency != null);
    if (withEff.length === 0) return null;
    const avg = withEff.reduce((s, l) => s + l.efficiency, 0) / withEff.length;
    return Math.round(Math.min((avg / 1.5) * 100, 100));
  }, [weekLogs]);

  const roiColor = cognitiveROI == null ? "#878190"
    : cognitiveROI >= 70 ? "#1ca830"
    : cognitiveROI >= 45 ? "#f59e0b"
    : "#f74e52";

  const playstyleInfo = profile?.playstyle_info || {};
  const activeTitle = playstyleInfo.active_title || {
    id: "awakened_one",
    name: "Пробуждённый",
    icon: "✨",
    color: "#a855f7",
  };
  const unlockedCount = playstyleInfo.unlocked_count || 1;
  const totalCount = playstyleInfo.total_count || 52;

  const titleColor = activeTitle.color || "#a855f7";

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StreakCard profile={profile} />

        {/* Weekly XP */}
        <div
          className="rounded-xl p-3 text-center flex flex-col items-center gap-1"
          style={{ background: "#7B61FF10", border: "1.5px solid #7B61FF30" }}
        >
          <span className="text-xl">⭐</span>
          <div style={{ fontFamily: "'PixeloidSans'", fontSize: "1.4rem", color: "#7B61FF" }}>{weeklyXP}</div>
          <div style={{ fontFamily: "'Nunito'", fontSize: 10, fontWeight: 700, color: "#878190", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Weekly XP
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden mt-1" style={{ background: "#f0eef8" }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${xpPct}%`, background: "#7B61FF" }} />
          </div>
        </div>

        {/* Cogn. ROI */}
        <div
          className="rounded-xl p-3 text-center flex flex-col items-center gap-1"
          style={{ background: `${roiColor}10`, border: `1.5px solid ${roiColor}30` }}
        >
          <span className="text-xl">📈</span>
          <div style={{ fontFamily: "'PixeloidSans'", fontSize: "1.4rem", color: roiColor }}>{cognitiveROI != null ? cognitiveROI : "—"}</div>
          <div style={{ fontFamily: "'Nunito'", fontSize: 10, fontWeight: 700, color: "#878190", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Cogn. ROI
          </div>
        </div>

        {/* Playstyle Title Card (Interactive) */}
        <button
          onClick={() => setShowTitleModal(true)}
          className="rounded-xl p-3 text-center flex flex-col items-center justify-between gap-1 transition-all hover:scale-[1.02] cursor-pointer group relative overflow-hidden"
          style={{ background: `${titleColor}15`, border: `1.5px solid ${titleColor}40` }}
        >
          <span className="text-xl group-hover:scale-110 transition-transform">{activeTitle.icon || "👑"}</span>
          
          <div
            className="truncate max-w-full px-1 font-bold"
            style={{ fontFamily: "'Nunito'", fontSize: "0.85rem", color: titleColor }}
          >
            {t(`titles.${activeTitle.id}.name`, activeTitle.name)}
          </div>

          <div style={{ fontFamily: "'Nunito'", fontSize: 10, fontWeight: 700, color: "#878190", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            TITLE
          </div>

          <div className="text-[9px] font-mono text-purple-400/80 font-semibold mt-0.5">
            🏆 {unlockedCount}/{totalCount}
          </div>
        </button>
      </div>

      <AnimatePresence>
        {showTitleModal && (
          <TitleSelectorModal
            profile={profile}
            onClose={() => setShowTitleModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

const getStreakTier = (streak) => {
  if (streak >= 30) return { label: "Legendary", color: "#FBBF24", next: null, shadow: "0 0 15px rgba(251,191,36,0.4)" };
  if (streak >= 15) return { label: "Epic", color: "#A78BFA", next: 30, shadow: "0 0 12px rgba(167,139,250,0.3)" };
  if (streak >= 8) return { label: "Rare", color: "#60A5FA", next: 15, shadow: "0 0 10px rgba(96,165,250,0.3)" };
  if (streak >= 4) return { label: "Uncommon", color: "#4ADE80", next: 8, shadow: "0 0 8px rgba(74,222,128,0.2)" };
  return { label: "Common", color: "#9CA3AF", next: 4, shadow: "0 0 5px rgba(156,163,175,0.1)" };
};

function StreakCard({ profile }) {
  const streak = profile?.streak || 0;
  const maxStreak = Math.max(streak, profile?.max_streak || 0);

  const prevStreakRef = useRef(streak);
  const [justIncremented, setJustIncremented] = useState(false);

  useEffect(() => {
    if (streak > prevStreakRef.current) {
      setJustIncremented(true);
      const timer = setTimeout(() => setJustIncremented(false), 1500);
      return () => clearTimeout(timer);
    }
    prevStreakRef.current = streak;
  }, [streak]);

  const { data: effectsData } = useQuery({
    queryKey: ["active_effects"],
    queryFn: djangoApi.skills.getActiveEffects,
    refetchInterval: 10000,
  });

  const activeEffects = effectsData?.active_effects || [];
  const isProtected = activeEffects.some(
    (e) => e.skill_id === "transcendence" || e.skill_id === "streak_shield"
  );

  const tier = getStreakTier(streak);

  let progressPct = 100;
  let remaining = 0;
  if (tier.next) {
    const prevThreshold = tier.next === 30 ? 15 : tier.next === 15 ? 8 : tier.next === 8 ? 4 : 1;
    const range = tier.next - prevThreshold;
    progressPct = Math.max(5, Math.min(100, ((streak - prevThreshold) / range) * 100));
    remaining = tier.next - streak;
  }

  const flameScale = streak >= 30 ? 1.4 : streak >= 15 ? 1.25 : streak >= 8 ? 1.15 : streak >= 4 ? 1.05 : 0.95;

  return (
    <div
      className="relative rounded-xl p-3 text-center flex flex-col items-center justify-between overflow-hidden"
      style={{
        background: `${tier.color}15`,
        border: `1.5px solid ${tier.color}40`,
        boxShadow: tier.shadow,
      }}
    >
      {isProtected && (
        <div className="absolute top-1.5 right-1.5" title="Streak Protected!">
          <span className="text-sm drop-shadow-md filter sepia hue-rotate-[180deg]">🛡️</span>
        </div>
      )}

      <motion.div
        animate={{
          scale: justIncremented ? [1, 1.5, flameScale] : [flameScale, flameScale * 1.05, flameScale],
          opacity: [0.9, 1, 0.9],
        }}
        transition={
          justIncremented
            ? { duration: 0.6, type: "spring" }
            : { duration: 2.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
        }
        className="text-2xl mt-1 z-10 drop-shadow-lg"
      >
        🔥
      </motion.div>

      <motion.div
        animate={justIncremented ? { scale: [1, 1.2, 1], color: ["#fff", tier.color, tier.color] } : {}}
        style={{ fontFamily: "'PixeloidSans'", fontSize: "1.4rem", color: tier.color, zIndex: 10, marginTop: "2px" }}
      >
        {streak}
      </motion.div>

      <div
        style={{
          fontFamily: "'Nunito'",
          fontSize: "0.6rem",
          fontWeight: 800,
          color: "#878190",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          zIndex: 10,
        }}
      >
        DAY STREAK
      </div>

      <div
        style={{
          fontFamily: "'Nunito'",
          fontSize: "0.6rem",
          fontWeight: 700,
          color: tier.color,
          opacity: 0.8,
          marginTop: "1px",
        }}
      >
        Best: {maxStreak}
      </div>

      {tier.next ? (
        <div className="w-full mt-2 z-10" title={`${remaining} days to next tier`}>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.15)" }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ background: tier.color }}
            />
          </div>
        </div>
      ) : (
        <div className="w-full mt-2 h-1.5 z-10 flex items-center justify-center">
          <span style={{ fontSize: "0.55rem", color: tier.color, fontWeight: "bold" }}>MAX TIER</span>
        </div>
      )}
    </div>
  );
}