import { motion } from "framer-motion";
import { RANK_XP_TABLE, getRankFromXP, getNextRankFromXP } from "@/lib/rankEngine";
import { Trophy } from "lucide-react";

export default function PixelRankRoad({ rankXP = 0 }) {
  const currentRank = getRankFromXP(rankXP);
  const nextRank = getNextRankFromXP(rankXP);

  // Calculate progress within current rank range to next rank
  const progressPct = nextRank
    ? Math.min(100, ((rankXP - currentRank.xpMin) / (nextRank.xpMin - currentRank.xpMin)) * 100)
    : 100;

  const rankColors = {
    F: "#475569", // Darker slate for readability on light bg
    D: "#ef4444",
    C: "#f97316",
    B: "#d97706", // Darker gold/amber for readability
    A: "#16a34a", // Darker green
    S: "#2563eb", // Darker blue
    SS: "#7c3aed", // Darker violet
    SSS: "#ca8a04", // Darker golden yellow
  };

  return (
    <div
      className="p-5 rounded-2xl border relative overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm"
    >
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, var(--habit-text) 1px, transparent 0)",
          backgroundSize: "16px 16px"
        }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-[var(--habit-border)] relative z-10">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#ffbe5d] animate-bounce" />
          <h3 className="font-game text-[10px] text-[var(--habit-text)] tracking-wider uppercase">
            Rank Progression
          </h3>
        </div>
        
        {/* Next Rank Progress Display */}
        {nextRank ? (
          <div className="font-game text-[8px] text-[var(--habit-dim)]">
            Next: <span style={{ color: rankColors[nextRank.id] }}>{nextRank.id}</span> | {Math.floor(rankXP)} / {nextRank.xpMin} XP
          </div>
        ) : (
          <div className="font-game text-[8px] text-[#ca8a04]">Max Rank Reached!</div>
        )}
      </div>

      {/* Progress Bar (Habitica Pixel Style) */}
      {nextRank && (
        <div className="mb-5 p-4 bg-[var(--habit-bg)] border border-[var(--habit-border)] rounded-xl relative z-10">
          <div className="flex justify-between items-center mb-2 font-game text-[8px]">
            <span className="text-[var(--habit-dim)]">Progress to {nextRank.label}</span>
            <span style={{ color: rankColors[nextRank.id] }}>{progressPct.toFixed(1)}%</span>
          </div>
          <div className="h-4 bg-[var(--habit-bg)] border-2 border-[var(--habit-dim)] p-0.5 relative overflow-hidden" style={{ clipPath: "polygon(2px 0%, calc(100% - 2px) 0%, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0% calc(100% - 2px), 0% 2px)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full relative overflow-hidden"
              style={{
                background: `linear-gradient(90deg, ${rankColors[currentRank.id]} 0%, ${rankColors[nextRank.id]} 100%)`,
              }}
            >
              {/* Retro pixel overlay effect */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.15]"
                style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 2px, #ffffff 2px, #ffffff 4px)" }} />
            </motion.div>
          </div>
          <div className="mt-2 text-[7px] font-game text-[var(--habit-dim)] text-center">
            {Math.ceil(nextRank.xpMin - rankXP)} XP remaining to advance
          </div>
        </div>
      )}

      {/* Ranks list */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 relative z-10">
        {RANK_XP_TABLE.map((row) => {
          const isCurrent = row.id === currentRank.id;
          const color = rankColors[row.id];
          
          // Determine status: unlocked, current, or locked
          const rankIndex = RANK_XP_TABLE.findIndex(r => r.id === row.id);
          const currentRankIndex = RANK_XP_TABLE.findIndex(r => r.id === currentRank.id);
          const isUnlocked = rankIndex < currentRankIndex;
          const isLocked = rankIndex > currentRankIndex;

          return (
            <motion.div
              key={row.id}
              whileHover={{ scale: 1.05, y: -2 }}
              className="relative p-2.5 border-2 transition-all flex flex-col justify-between min-h-[96px]"
              style={{
                background: isCurrent 
                  ? `${color}18`
                  : isUnlocked 
                  ? "var(--habit-purple-light)" 
                  : "var(--habit-bg)",
                borderColor: isCurrent ? color : isUnlocked ? "var(--habit-purple)" : "var(--habit-border)",
                boxShadow: isCurrent ? `0 4px 12px ${color}20` : "none",
                clipPath: "polygon(3px 0%, calc(100% - 3px) 0%, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0% calc(100% - 3px), 0% 3px)",
                opacity: isLocked ? 0.5 : 1,
              }}
            >
              {/* Corner status light for current rank */}
              {isCurrent && (
                <div className="absolute top-1 right-1 flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                </div>
              )}

              <div className="space-y-1">
                {/* Badge Row */}
                <div className="flex items-center justify-between">
                  <div
                    className="font-game text-[12px] font-black"
                    style={{
                      color: color,
                      textShadow: isCurrent ? `1px 1px 0px rgba(0,0,0,0.1)` : "none",
                    }}
                  >
                    {row.id}
                  </div>
                </div>

                {/* Label */}
                <div className="font-game text-[6px] text-[var(--habit-text)] font-bold uppercase tracking-wide truncate">
                  {row.label}
                </div>

                {/* Estimate */}
                <div className="font-game text-[5px] mt-1 whitespace-pre-wrap leading-tight" style={{ color: "var(--habit-purple)" }}>
                  ⌛ {row.hoursEst.replace(" at focus 8", "")}
                </div>
              </div>

              {/* XP Requirement indicator */}
              <div className="mt-2 pt-1.5 border-t border-[var(--habit-border)] flex items-center justify-between font-game text-[5.5px]">
                <span className="text-[var(--habit-dim)] font-bold">REQ:</span>
                <span className="text-[#ff8800]">{row.xpNeeded}XP</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
