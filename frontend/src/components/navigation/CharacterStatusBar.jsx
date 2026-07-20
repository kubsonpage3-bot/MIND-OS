import { motion } from "framer-motion";
import { CLASSES } from "@/constants/rpgData";
import { getRankDisplayData } from "@/lib/rankEngine";
import PixelCharacter from "../mindos/PixelCharacter";
import { Menu } from "lucide-react";
import { normalizeGold } from "@/lib/utils";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";

function PixelBar({ pct, fillColor, glowColor, label, value, trackColor = "#1a1a2e" }) {
  return (
    <div className="flex items-center gap-1.5 md:gap-2">
      <span style={{ fontFamily: "'Bildungswirkung'", fontSize: 9, color: fillColor, minWidth: 16 }}>{label}</span>
      <div className="flex-1 relative" style={{ height: 10, background: trackColor, border: "2px solid #333", borderRadius: 0 }}>
        <motion.div
          animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ height: "100%", background: fillColor, boxShadow: `0 0 6px ${glowColor}`, position: "relative", overflow: "hidden" }}
        >
          <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.25) 3px, rgba(0,0,0,0.25) 4px)` }} />
        </motion.div>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "rgba(0,0,0,0.4)" }} />
      </div>
      <span style={{ fontFamily: "'Bildungswirkung'", fontSize: 8.5, color: "#878190", minWidth: 36, textAlign: "right" }}>{value}</span>
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

  return (
    <div
      className="sticky top-0 z-40 safe-top"
      style={{
        background: theme?.bgOverlay || "#1a1a2e",
        borderTop: `3px solid ${theme?.xpColor || "#7B61FF"}`,
        borderBottom: "2px solid #333",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
        paddingTop: "var(--sat)"
      }}
    >
      <div className="flex items-stretch gap-0">
        {/* Left: Mobile hamburger menu trigger */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden flex items-center justify-center w-11 hover:bg-white/10 text-white shrink-0 border-r border-[#333]"
        >
          <Menu size={18} />
        </button>

        {/* Bars (Middle) */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 px-2 py-2 md:px-3 md:py-2.5">
          <PixelBar trackColor={theme?.bgOverlay} pct={hpPct} fillColor={theme?.hpColor || "#f74e52"} glowColor={(theme?.hpColor || "#f74e52") + "88"} label="HP" value={`${Math.round(gameState.hp)}/${gameState.maxHp}`} />
          <PixelBar trackColor={theme?.bgOverlay} pct={manaPct} fillColor={theme?.mpColor || classColor} glowColor={(theme?.mpColor || classColor) + "88"} label="MP" value={`${Math.round(classData.mana)}/${classData.maxMana}`} />
          <PixelBar trackColor={theme?.bgOverlay} pct={xpPct} fillColor={theme?.xpColor || "#7B61FF"} glowColor={(theme?.xpColor || "#7B61FF") + "88"} label="XP" value={`${Math.round(rankXP || 0)}/${Math.round(nextRankMin)}`} />
        </div>

        {/* Right section: Gold/Rank/Streak + Portrait */}
        <div className="shrink-0 flex items-stretch">
          {/* Info block: Rank, Gold, Streak */}
          <div className="flex flex-col items-end justify-center gap-1 pr-2 pl-1 py-2">
            <div style={{
              fontFamily: "'Bildungswirkung'", fontSize: 10,
              background: `${rankColor}22`, color: rankColor,
              border: `1px solid ${rankColor}55`,
              padding: "2px 5px", borderRadius: 2,
              lineHeight: 1
            }}>{rankId}</div>
            <div className="flex items-center gap-0.5">
              <span className="text-[12px]">🪙</span>
              <span style={{ fontFamily: "'Bildungswirkung'", fontSize: 9, color: "#ffbe5d" }}>{normalizeGold(gameState.gold)}</span>
            </div>
            {streak > 0 && (
              <div style={{ fontFamily: "'Bildungswirkung'", fontSize: 9, color: "#ff8800" }}>🔥{streak}</div>
            )}
          </div>

          {/* Portrait — flush right */}
          <div className="flex items-center justify-center shrink-0 overflow-hidden"
            style={{
              width: 64, minHeight: 64, maxWidth: 70,
              background: `${classColor}22`,
              borderLeft: `2px solid ${classColor}44`,
              imageRendering: "pixelated",
            }}>
            {classData.chosen
              ? <PixelCharacter rankId={rankId} rankColor={classColor} size={60} hideLabel={true} />
              : <span style={{ fontSize: 28 }}>⚔️</span>}
          </div>
        </div>
      </div>
    </div>
  );
}