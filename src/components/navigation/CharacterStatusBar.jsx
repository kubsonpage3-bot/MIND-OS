import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CLASSES } from "@/lib/rpgSystem";
import { getRankFromXP, getNextRankFromXP } from "@/lib/rankEngine";
import PixelCharacter from "../mindos/PixelCharacter";
import { Menu } from "lucide-react";
import { normalizeGold } from "@/lib/utils";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";

function PixelBar({ pct, fillColor, glowColor, label, value }) {
  return (
    <div className="flex items-center gap-1.5 md:gap-2">
      <span style={{ fontFamily: "'Pixeltype'", fontSize: 6, color: fillColor, minWidth: 16 }}>{label}</span>
      <div className="flex-1 relative" style={{ height: 10, background: "#1a1a2e", border: "2px solid #333", borderRadius: 0 }}>
        <motion.div
          animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ height: "100%", background: fillColor, boxShadow: `0 0 6px ${glowColor}`, position: "relative", overflow: "hidden" }}
        >
          <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.25) 3px, rgba(0,0,0,0.25) 4px)` }} />
        </motion.div>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "rgba(0,0,0,0.4)" }} />
      </div>
      <span style={{ fontFamily: "'Pixeltype'", fontSize: 5.5, color: "#878190", minWidth: 36, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function CharacterStatusBar({ rankXP, currentRankId, onToggleSidebar }) {
  const { profile } = useDjangoAuth();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        const st = JSON.parse(localStorage.getItem("mindos_streak") || "{}");
        setStreak(st.streakCount || 0);
      } catch {}
    };
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, []);

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
  const rankInfo = getRankFromXP(rankXP || 0);
  const rankId = currentRankId || rankInfo.id;
  const rankColor = rankInfo.color || "#7B61FF";

  const nextRankInfo = getNextRankFromXP(rankXP || 0);
  const xpInRank = Math.max(0, (rankXP || 0) - (rankInfo.xpMin || 0));
  const xpRange = Math.max(1, ((nextRankInfo?.xpMin || rankInfo.xpMax || 9999)) - (rankInfo.xpMin || 0));
  const xpPct = Math.min(100, (xpInRank / xpRange) * 100);
  const hpPct = Math.max(0, (gameState.hp / gameState.maxHp) * 100);
  const manaPct = Math.min(100, (classData.mana / classData.maxMana) * 100);

  return (
    <div
      className="sticky top-0 z-40"
      style={{
        background: "#1a1a2e",
        borderBottom: "2px solid #333",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
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
          <PixelBar pct={hpPct} fillColor="#f74e52" glowColor="#f74e5288" label="HP" value={`${Math.round(gameState.hp)}/${gameState.maxHp}`} />
          <PixelBar pct={manaPct} fillColor={classColor} glowColor={classColor + "88"} label="MP" value={`${Math.round(classData.mana)}/${classData.maxMana}`} />
          <PixelBar pct={xpPct} fillColor="#7B61FF" glowColor="#7B61FF88" label="XP" value={`${Math.round(xpInRank)}/${Math.round(xpRange)}`} />
        </div>

        {/* Right section: Gold/Rank/Streak + Portrait */}
        <div className="shrink-0 flex items-stretch">
          {/* Info block: Rank, Gold, Streak */}
          <div className="flex flex-col items-end justify-center gap-1 pr-2 pl-1 py-2">
            <div style={{
              fontFamily: "'Pixeltype'", fontSize: 8,
              background: `${rankColor}22`, color: rankColor,
              border: `1px solid ${rankColor}55`,
              padding: "2px 5px", borderRadius: 2,
              lineHeight: 1
            }}>{rankId}</div>
            <div className="flex items-center gap-0.5">
              <span className="text-[10px]">🪙</span>
              <span style={{ fontFamily: "'Pixeltype'", fontSize: 6, color: "#ffbe5d" }}>{normalizeGold(gameState.gold)}</span>
            </div>
            {streak > 0 && (
              <div style={{ fontFamily: "'Pixeltype'", fontSize: 6, color: "#ff8800" }}>🔥{streak}</div>
            )}
          </div>

          {/* Portrait — flush right */}
          <div className="flex items-center justify-center shrink-0"
            style={{
              width: 64, minHeight: 64,
              background: `${classColor}22`,
              borderLeft: `2px solid ${classColor}44`,
              imageRendering: "pixelated",
            }}>
            {classData.chosen
              ? <PixelCharacter rankId={rankId} rankColor={classColor} size={60} />
              : <span style={{ fontSize: 28 }}>⚔️</span>}
          </div>
        </div>
      </div>
    </div>
  );
}