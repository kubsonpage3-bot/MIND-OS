import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { djangoApi } from "@/api/djangoClient";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import TitleSelectorModal from "@/components/mindos/TitleSelectorModal";
import TitleIcon from "@/components/mindos/TitleIcon";

const XP_PER_LEVEL = 500;

const RARITY_STYLES = {
  common:    { color: "#9CA3AF", glowStrength: "10px", glowOpacity: "30", borderOpacity: "60", bgOpacity: "10" },
  uncommon:  { color: "#4ADE80", glowStrength: "15px", glowOpacity: "40", borderOpacity: "70", bgOpacity: "15" },
  rare:      { color: "#60A5FA", glowStrength: "20px", glowOpacity: "50", borderOpacity: "80", bgOpacity: "15" },
  epic:      { color: "#A78BFA", glowStrength: "25px", glowOpacity: "60", borderOpacity: "90", bgOpacity: "20" },
  legendary: { color: "#FBBF24", glowStrength: "35px", glowOpacity: "80", borderOpacity: "ff", bgOpacity: "25" },
};

// ─── Streak heatmap tiers ──────────────────────────────────────────────────────
const STREAK_TIERS = [
  { min: 30, label: "LEGENDARY", color: "#FBBF24", glow: "rgba(251,191,36,0.7)",   bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.5)", next: null },
  { min: 15, label: "EPIC",      color: "#A78BFA", glow: "rgba(167,139,250,0.6)",  bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.4)", next: 30 },
  { min: 8,  label: "RARE",      color: "#60A5FA", glow: "rgba(96,165,250,0.55)",  bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.35)", next: 15 },
  { min: 4,  label: "UNCOMMON",  color: "#4ADE80", glow: "rgba(74,222,128,0.5)",   bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.3)", next: 8 },
  { min: 1,  label: "COMMON",    color: "#f97316", glow: "rgba(249,115,22,0.45)",  bg: "rgba(249,115,22,0.07)", border: "rgba(249,115,22,0.28)", next: 4 },
  { min: 0,  label: "COLD",      color: "#64748b", glow: "rgba(100,116,139,0.3)",  bg: "rgba(100,116,139,0.05)", border: "rgba(100,116,139,0.2)", next: 1 },
];

function getStreakTier(streak) {
  return STREAK_TIERS.find(t => streak >= t.min) || STREAK_TIERS[STREAK_TIERS.length - 1];
}

// ─── 3D card wrapper ──────────────────────────────────────────────────────────
function Card3D({ children, style, className = "", onClick }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 25 });
  const springY = useSpring(y, { stiffness: 200, damping: 25 });
  const rotateX = useTransform(springY, [-0.5, 0.5], ["9deg", "-9deg"]);
  const rotateY = useTransform(springX, [-0.5, 0.5], ["-9deg", "9deg"]);

  const handleMouseMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  const Tag = onClick ? motion.button : motion.div;

  return (
    <div style={{ perspective: "800px" }} className={className}>
      <Tag
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
          willChange: "transform",
          ...style,
        }}
        className="relative rounded-2xl p-3.5 text-center flex flex-col items-center justify-between h-[142px] w-full overflow-hidden cursor-default select-none border"
        whileHover={{ scale: 1.03, z: 25 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Inner shine layer (3D depth illusion) */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)",
            zIndex: 1,
          }}
        />
        {/* Top-edge highlight */}
        <div
          className="absolute top-0 left-4 right-4 h-px pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)", zIndex: 2 }}
        />
        {/* Content sits above layers with 3D preserve context */}
        <div className="relative z-10 flex flex-col items-center justify-between w-full h-full" style={{ transformStyle: "preserve-3d" }}>
          {children}
        </div>
      </Tag>
    </div>
  );
}

// ─── Battery indicator (Daily Energy) ─────────────────────────────────────────
function BatteryIndicator({ level, color }) {
  const roundedLevel = Math.round(level || 0);

  return (
    <div className="relative w-12 h-6 border-[1.5px] rounded p-[1.5px] flex items-center bg-black/30" style={{ borderColor: `${color}40`, transform: "translateZ(10px)" }}>
      {/* Battery body filling */}
      <motion.div 
        className="h-full rounded-[1px] origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: roundedLevel / 100 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        style={{ 
          width: "100%",
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}80`
        }} 
      />
      {/* Battery tip */}
      <div 
        className="absolute -right-[4px] w-[2.5px] h-2.5 rounded-r-[1px] opacity-70"
        style={{ backgroundColor: color }} 
      />
    </div>
  );
}

// ─── Mini heatmap dots (7 days) ───────────────────────────────────────────────
function MiniHeatmap({ streak, tier }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const dayOffset = 6 - i;
    const isActive = dayOffset < streak;
    const intensity = isActive ? Math.max(0.3, 1 - (dayOffset / Math.max(streak, 1)) * 0.5) : 0;
    return { isActive, intensity };
  });

  return (
    <div className="flex gap-1 items-center justify-center">
      {days.map((d, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.03, type: "spring", stiffness: 300 }}
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: d.isActive ? tier.color : "rgba(255,255,255,0.08)",
            opacity: d.isActive ? d.intensity : 0.25,
            boxShadow: d.isActive ? `0 0 6px ${tier.glow}` : "none",
          }}
        />
      ))}
    </div>
  );
}

export default function StatsPanel({ profile, logs }) {
  const { t } = useTranslation();
  const [showTitleModal, setShowTitleModal] = useState(false);

  const weeklyXP = profile?.weekly_xp || 0;
  const xpPct = (weeklyXP % XP_PER_LEVEL) / XP_PER_LEVEL * 100;

  // XP color heatmap based on value
  const xpTier = weeklyXP >= 2000 ? { color: "#FBBF24", glow: "rgba(251,191,36,0.6)" }
    : weeklyXP >= 1000 ? { color: "#A78BFA", glow: "rgba(167,139,250,0.55)" }
    : weeklyXP >= 500  ? { color: "#60A5FA", glow: "rgba(96,165,250,0.5)" }
    : weeklyXP >= 200  ? { color: "#7B61FF", glow: "rgba(123,97,255,0.45)" }
    : { color: "#6d5bd0", glow: "rgba(109,91,208,0.35)" };

  const batteryInfo = profile?.battery_info || { level: 100, habits: 0, todos: 0, dailies: 0, hours: 0 };
  const batteryLevel = batteryInfo.level;
  const batteryColor = batteryLevel >= 60 ? "#22c55e"
    : batteryLevel >= 25 ? "#f59e0b"
    : "#f74e52";

  const playstyleInfo = profile?.playstyle_info || {};
  const activeTitle = playstyleInfo.active_title || { id: "awakened_one", name: "Awakened One", icon: "✨", color: "#a855f7" };
  const unlockedCount = playstyleInfo.unlocked_count || 1;
  const totalCount = playstyleInfo.total_count || 52;

  const rarityStyle = useMemo(() => {
    const priority = activeTitle.priority || 0;
    let rarity = "common";
    if (activeTitle.id === "awakened_one") rarity = "rare";
    else if (priority >= 120) rarity = "legendary";
    else if (priority >= 95) rarity = "epic";
    else if (priority >= 75) rarity = "rare";
    else if (priority >= 50) rarity = "uncommon";
    return RARITY_STYLES[rarity];
  }, [activeTitle]);

  const rColor = rarityStyle.color;
  const isLegendary = activeTitle.priority >= 120;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* ── STREAK CARD ──────────────────────────────── */}
        <StreakCard profile={profile} />

        {/* ── WEEKLY XP ────────────────────────────────── */}
        <Card3D
          style={{
            background: `linear-gradient(145deg, ${xpTier.color}10, ${xpTier.color}04)`,
            borderColor: `${xpTier.color}35`,
            boxShadow: `0 4px 24px ${xpTier.glow}, 0 1px 0 rgba(255,255,255,0.06) inset`,
          }}
        >
          <motion.span
            className="text-2xl"
            animate={{ scale: [1, 1.1, 1], rotate: [0, 8, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            style={{ transform: "translateZ(30px)" }}
          >⭐</motion.span>

          <motion.div
            key={weeklyXP}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              fontFamily: "'PixeloidSans'",
              fontSize: "1.5rem",
              color: xpTier.color,
              textShadow: `0 0 20px ${xpTier.glow}`,
              lineHeight: 1,
              transform: "translateZ(40px)",
            }}
          >
            {weeklyXP}
          </motion.div>

          <div style={{ fontFamily: "'Nunito'", fontSize: 9, fontWeight: 800, color: "#878190", textTransform: "uppercase", letterSpacing: "0.1em", transform: "translateZ(15px)" }}>
            Weekly XP
          </div>

          {/* Segmented XP bar */}
          <div className="w-full mt-1 relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", transform: "translateZ(20px)" }}>
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              animate={{ width: `${xpPct}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: `linear-gradient(90deg, ${xpTier.color}88, ${xpTier.color})`,
                boxShadow: `0 0 8px ${xpTier.glow}`,
              }}
            />
            {/* Shimmer */}
            <motion.div
              className="absolute inset-y-0 rounded-full pointer-events-none"
              style={{ width: "30%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)" }}
              animate={{ left: ["-30%", "110%"] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
            />
          </div>
        </Card3D>

        {/* ── ENERGY BATTERY ────────────────────────────── */}
        <Card3D
          style={{
            background: `linear-gradient(145deg, ${batteryColor}10, ${batteryColor}04)`,
            borderColor: `${batteryColor}35`,
            boxShadow: `0 4px 24px ${batteryColor}40, 0 1px 0 rgba(255,255,255,0.06) inset`,
          }}
        >
          <div className="relative flex items-center justify-center gap-2 h-[52px]" style={{ transform: "translateZ(30px)" }}>
            <BatteryIndicator level={batteryLevel} color={batteryColor} />
            <motion.span
              key={batteryLevel}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                fontFamily: "'PixeloidSans'",
                fontSize: "0.8rem",
                color: batteryColor,
                textShadow: `0 0 12px ${batteryColor}`,
                transform: "translateZ(10px)",
              }}
            >
              {batteryLevel}%
            </motion.span>
          </div>

          <div style={{ fontFamily: "'Nunito'", fontSize: 9, fontWeight: 800, color: "#878190", textTransform: "uppercase", letterSpacing: "0.1em", transform: "translateZ(15px)" }}>
            Energy
          </div>

          {/* Battery breakdown */}
          <div 
            className="text-[8.5px] text-center opacity-80"
            style={{
              fontFamily: "'Nunito'",
              fontWeight: 600,
              color: "#a39fb0",
              transform: "translateZ(20px)",
              lineHeight: "1.2",
              maxWidth: "95%",
              whiteSpace: "nowrap"
            }}
          >
            {`${batteryInfo.habits} hab · ${batteryInfo.todos} tod · ${batteryInfo.dailies} day · ${batteryInfo.hours} hr`}
          </div>
        </Card3D>

        {/* ── TITLE CARD ───────────────────────────────── */}
        <Card3D
          onClick={() => setShowTitleModal(true)}
          style={{
            background: `linear-gradient(145deg, ${rColor}15, ${rColor}05)`,
            borderColor: `${rColor}${rarityStyle.borderOpacity}`,
            boxShadow: `0 4px 28px ${rColor}${rarityStyle.glowOpacity}, 0 1px 0 rgba(255,255,255,0.08) inset`,
            cursor: "pointer",
          }}
          className="cursor-pointer"
        >
          {/* Legendary shimmer overlay */}
          {isLegendary && (
            <motion.div
              className="absolute inset-0 rounded-xl pointer-events-none"
              animate={{ opacity: [0, 0.3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${rColor}50 0%, transparent 70%)`, zIndex: 3 }}
            />
          )}

          <motion.div
            className="w-8 h-8 flex items-center justify-center"
            whileHover={{ scale: 1.2, rotate: 10 }}
            transition={{ type: "spring", stiffness: 400 }}
            style={{ transform: "translateZ(30px)" }}
          >
            <TitleIcon title={activeTitle} className="w-8 h-8" />
          </motion.div>

          <div
            className="truncate max-w-full px-1 font-bold leading-tight"
            style={{
              fontFamily: "'Nunito'",
              fontSize: "0.82rem",
              color: rColor,
              textShadow: `0 0 14px ${rColor}80`,
              transform: "translateZ(40px)",
            }}
          >
            {t(`titles.${activeTitle.id}.name`, activeTitle.name)}
          </div>

          <div style={{ fontFamily: "'Nunito'", fontSize: 9, fontWeight: 800, color: "#878190", textTransform: "uppercase", letterSpacing: "0.1em", transform: "translateZ(15px)" }}>
            TITLE
          </div>

          <div
            className="text-[8px] font-mono font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: `${rColor}18`,
              border: `1px solid ${rColor}30`,
              color: rColor,
              transform: "translateZ(20px)",
            }}
          >
            🏆 {unlockedCount}/{totalCount}
          </div>
        </Card3D>
      </div>

      <AnimatePresence>
        {showTitleModal && (
          <TitleSelectorModal profile={profile} onClose={() => setShowTitleModal(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── STREAK CARD (standalone, full heatmap treatment) ─────────────────────────
function StreakCard({ profile }) {
  const streak = profile?.streak || 0;
  const maxStreak = Math.max(streak, profile?.max_streak || 0);
  const tier = getStreakTier(streak);

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
  const isProtected = activeEffects.some(e => e.skill_id === "transcendence" || e.skill_id === "streak_shield");

  let progressPct = 100;
  let remaining = 0;
  if (tier.next) {
    const thresholds = [1, 4, 8, 15, 30];
    const curIdx = thresholds.indexOf(tier.min);
    const prevThreshold = curIdx > 0 ? thresholds[curIdx] : 0;
    const range = tier.next - tier.min;
    progressPct = Math.max(5, Math.min(100, ((streak - tier.min) / range) * 100));
    remaining = tier.next - streak;
  }

  const flameScale = streak >= 30 ? 1.35 : streak >= 15 ? 1.25 : streak >= 8 ? 1.12 : streak >= 4 ? 1.05 : 0.9;

  return (
    <Card3D
      style={{
        background: `linear-gradient(145deg, ${tier.bg}, rgba(0,0,0,0.25))`,
        borderColor: tier.border,
        boxShadow: `0 4px 28px ${tier.glow}, 0 1px 0 rgba(255,255,255,0.07) inset`,
      }}
    >
      {/* Radial glow bg */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: streak >= 8 ? 1.5 : 3, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${tier.glow} 0%, transparent 70%)`,
          zIndex: 0,
        }}
      />

      {/* Shield badge */}
      {isProtected && (
        <div className="absolute top-1.5 right-1.5 z-20 animate-pulse" title="Streak Protected!">
          <span className="text-sm drop-shadow-md">🛡️</span>
        </div>
      )}

      {/* Flame */}
      <motion.div
        animate={justIncremented
          ? { scale: [1, 1.8, flameScale], rotate: [0, -15, 15, 0] }
          : { scale: [flameScale, flameScale * 1.06, flameScale], opacity: [0.85, 1, 0.85] }
        }
        transition={justIncremented
          ? { duration: 0.7, type: "spring" }
          : { duration: 2.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
        }
        className="text-2xl z-10 drop-shadow-lg"
        style={{
          filter: streak >= 15 ? `drop-shadow(0 0 8px ${tier.color})` : "none",
          transform: "translateZ(30px)",
        }}
      >
        🔥
      </motion.div>

      {/* Streak number */}
      <motion.div
        key={streak}
        initial={justIncremented ? { scale: 0.5, opacity: 0 } : {}}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          fontFamily: "'PixeloidSans'",
          fontSize: "1.4rem",
          color: tier.color,
          zIndex: 10,
          lineHeight: 1,
          textShadow: `0 0 20px ${tier.glow}`,
          transform: "translateZ(40px)",
        }}
      >
        {streak}
      </motion.div>

      {/* Label */}
      <div style={{ fontFamily: "'Nunito'", fontSize: 9, fontWeight: 800, color: "#878190", textTransform: "uppercase", letterSpacing: "0.1em", zIndex: 10, transform: "translateZ(15px)" }}>
        DAY STREAK
      </div>

      {/* Tier badge */}
      <motion.div
        className="px-2 py-0.5 rounded-full z-10"
        style={{
          background: `${tier.color}20`,
          border: `1px solid ${tier.color}40`,
          fontSize: 7,
          fontFamily: "'Nunito'",
          fontWeight: 850,
          color: tier.color,
          letterSpacing: "0.07em",
          textShadow: `0 0 8px ${tier.glow}`,
          transform: "translateZ(20px)",
        }}
      >
        {tier.label} · Best: {maxStreak}
      </motion.div>

      {/* Spaced Heatmap and Progress wrapper to ensure zero overlap */}
      <div className="w-full space-y-1.5 mt-auto flex flex-col items-center justify-end z-10" style={{ transform: "translateZ(25px)" }}>
        {/* Heatmap */}
        <MiniHeatmap streak={streak} tier={tier} />

        {/* Progress bar to next tier */}
        {tier.next ? (
          <div className="w-full relative h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: `linear-gradient(90deg, ${tier.color}80, ${tier.color})`,
                boxShadow: `0 0 6px ${tier.glow}`,
              }}
            />
          </div>
        ) : (
          <div className="w-full flex items-center justify-center h-1">
            <motion.span
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ fontSize: 7, color: tier.color, fontWeight: 800, fontFamily: "'Nunito'" }}
            >
              ✦ MAX TIER ✦
            </motion.span>
          </div>
        )}
      </div>
    </Card3D>
  );
}
