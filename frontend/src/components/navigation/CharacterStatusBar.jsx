import { motion } from "framer-motion";
import { CLASSES } from "@/constants/rpgData";
import { getRankDisplayData } from "@/lib/rankEngine";
import PixelCharacter from "../mindos/PixelCharacter";
import { Menu, ShieldAlert } from "lucide-react";
import { normalizeGold } from "@/lib/utils";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";

function PixelBar({ pct, fillColor, glowColor, label, value, trackColor = "#110e1e", isCritical = false }) {
  const clampedPct = Math.max(0, Math.min(100, pct));

  return (
    <div className="flex items-center gap-2">
      <span
        className="font-mono font-bold text-[10px] tracking-wider shrink-0 flex items-center gap-1 select-none"
        style={{ color: fillColor, textShadow: `0 0 6px ${glowColor}` }}
      >
        {isCritical && <ShieldAlert size={11} className="text-red-400 animate-pulse" />}
        {label}
      </span>
      <div
        className="flex-1 relative h-3 overflow-hidden"
        style={{
          background: trackColor,
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "inset 0 1px 4px rgba(0, 0, 0, 0.8)",
        }}
      >
        {/* Animated fill */}
        <motion.div
          animate={{ width: `${clampedPct}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className={`h-full relative ${isCritical ? "animate-pulse" : ""}`}
          style={{
            background: `linear-gradient(180deg, rgba(255,255,255,0.3) 0%, ${fillColor} 40%, rgba(0,0,0,0.3) 100%)`,
            boxShadow: `0 0 10px ${glowColor}`,
          }}
        >
          {/* LED Segmented Notches */}
          <div
            className="absolute inset-0 pixel-led-stripes opacity-40 pointer-events-none"
          />
          {/* Glowing cursor head */}
          <div
            className="absolute top-0 right-0 bottom-0 w-1 bg-white opacity-80"
            style={{ boxShadow: `0 0 8px ${glowColor}` }}
          />
        </motion.div>
        {/* Top glossy highlight line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/20 pointer-events-none" />
      </div>
      <span
        className="font-mono text-[9px] text-muted-foreground font-semibold shrink-0 min-w-[48px] text-right select-none"
        style={{ letterSpacing: "0.02em" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function CharacterStatusBar({ rankXP, currentRankId, onToggleSidebar, theme }) {
  const { profile } = useDjangoAuth();
  const streak = profile?.streak || 0;

  const classData = {
    chosen: profile?.character_class !== "Wanderer" ? profile?.character_class : null,
    mana: profile?.mana || 0,
    maxMana: profile?.mana_max || 100
  };
  const gameState = {
    gold: profile?.gold || 0,
    hp: profile?.hp !== undefined ? profile.hp : 100,
    maxHp: profile?.hp_max || 100
  };

  const classInfo = classData.chosen ? CLASSES[classData.chosen] : null;
  const classColor = classInfo?.color || "#7B61FF";
  const rankInfo = getRankDisplayData(profile?.rank_info?.current_id || "E", null);
  const rankId = currentRankId || rankInfo.id;
  const rankColor = rankInfo.color || "#7B61FF";

  const thresholds = profile?.rank_info?.thresholds || [];
  const currentIdx = thresholds.findIndex(t => t.id === rankInfo.id);
  const currentRankMin = currentIdx >= 0 ? thresholds[currentIdx].min : 0;
  let nextRankMin = currentIdx >= 0 && currentIdx < thresholds.length - 1 ? thresholds[currentIdx + 1].min : null;
  if (nextRankMin === null) {
    nextRankMin = profile?.prestige_xp_required || 8000;
  }

  const xpInRank = Math.max(0, (rankXP || 0) - currentRankMin);
  const xpRange = Math.max(1, nextRankMin - currentRankMin);
  const xpPct = Math.min(100, (xpInRank / xpRange) * 100);
  const hpPct = Math.max(0, (gameState.hp / gameState.maxHp) * 100);
  const manaPct = Math.min(100, (classData.mana / classData.maxMana) * 100);
  const isHpCritical = hpPct <= 25 && hpPct > 0;

  return (
    <div
      className="sticky top-0 z-40 safe-top backdrop-blur-md transition-colors"
      style={{
        background: "var(--habit-status-bg, rgba(18, 14, 30, 0.88))",
        borderTop: `2px solid ${theme?.xpColor || "var(--habit-purple)"}`,
        borderBottom: "1px solid var(--habit-status-border, rgba(139, 92, 246, 0.2))",
        boxShadow: "var(--habit-status-shadow, 0 4px 20px rgba(0, 0, 0, 0.6))",
        paddingTop: "var(--sat)"
      }}
    >
      <div className="flex items-stretch gap-0 max-w-7xl mx-auto">
        {/* Left: Mobile hamburger menu trigger */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden flex items-center justify-center w-11 hover:bg-black/5 dark:hover:bg-white/10 text-[var(--habit-text)] shrink-0 border-r border-[var(--habit-border)]"
        >
          <Menu size={18} />
        </button>

        {/* Bars (Middle: HP, MP, XP) */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-5 md:py-2.5">
          <PixelBar
            pct={hpPct}
            fillColor={theme?.hpColor || "#f74e52"}
            glowColor={(theme?.hpColor || "#f74e52") + "88"}
            label="HP"
            value={`${Math.round(gameState.hp)}/${gameState.maxHp}`}
            isCritical={isHpCritical}
          />
          <PixelBar
            pct={manaPct}
            fillColor={theme?.mpColor || classColor}
            glowColor={(theme?.mpColor || classColor) + "88"}
            label="MP"
            value={`${Math.round(classData.mana)}/${classData.maxMana}`}
          />
          <PixelBar
            pct={xpPct}
            fillColor={theme?.xpColor || "var(--habit-purple)"}
            glowColor={(theme?.xpColor || "var(--habit-purple)") + "88"}
            label="XP"
            value={`${Math.round(rankXP || 0)}/${Math.round(nextRankMin)}`}
          />
        </div>

        {/* Right section: Gold/Rank/Streak + Portrait */}
        <div className="shrink-0 flex items-stretch border-l border-[var(--habit-border)] bg-black/5 dark:bg-black/20">
          {/* Info block: Rank, Gold, Streak */}
          <div className="flex flex-col items-end justify-center gap-0.5 pr-2 pl-1.5 py-1.5 sm:gap-1 sm:pr-3 sm:pl-2 sm:py-2">
            <div
              className="font-mono font-bold text-[8.5px] sm:text-[10px] px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded border"
              style={{
                background: `${rankColor}18`,
                color: rankColor,
                borderColor: `${rankColor}55`,
                boxShadow: `0 0 8px ${rankColor}33`,
                lineHeight: 1.1
              }}
            >
              RANK {rankId}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] sm:text-[11px]">🪙</span>
              <span className="font-mono text-[9px] sm:text-[10px] font-bold" style={{ color: "#ffbe5d" }}>
                {normalizeGold(gameState.gold)}G
              </span>
            </div>
            {streak > 0 && (
              <div className="font-mono text-[9px] sm:text-[10px] font-bold text-orange-400 flex items-center gap-0.5">
                <span>🔥</span>
                <span>{streak}d</span>
              </div>
            )}
          </div>

          {/* Portrait with Glowing Tactical Border */}
          <div
            className="flex items-center justify-center shrink-0 overflow-hidden relative w-14 min-h-[56px] sm:w-[68px] sm:min-h-[68px]"
            style={{
              background: `radial-gradient(circle, ${classColor}22 0%, rgba(0,0,0,0.6) 100%)`,
              borderLeft: `1px solid ${classColor}55`,
              imageRendering: "pixelated",
            }}
          >
            {classData.chosen
              ? <PixelCharacter rankId={rankId} rankColor={classColor} size={52} hideLabel={true} />
              : <span style={{ fontSize: 22 }}>⚔️</span>}
          </div>
        </div>
      </div>
    </div>
  );
}