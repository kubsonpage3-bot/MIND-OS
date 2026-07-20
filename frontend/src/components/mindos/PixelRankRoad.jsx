import { motion } from "framer-motion";
import { getRankDisplayData } from "@/lib/rankEngine";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { ANIM_CONFIG } from "@/lib/animations";

const toRoman = (n) =>
  ['', 'I','II','III','IV','V','VI','VII','VIII','IX','X'][n] ?? `${n}`;

const RANK_COLORS = {
  F: "#475569",
  D: "#ef4444",
  C: "#f97316",
  B: "#d97706",
  A: "#16a34a",
  S: "#2563eb",
  SS: "#7c3aed",
  SSS: "#ca8a04",
};

const RANK_GLOWS = {
  F: "rgba(71,85,105,0.25)",
  D: "rgba(239,68,68,0.30)",
  C: "rgba(249,115,22,0.30)",
  B: "rgba(217,119,6,0.30)",
  A: "rgba(22,163,74,0.30)",
  S: "rgba(37,99,235,0.35)",
  SS: "rgba(124,58,237,0.40)",
  SSS: "rgba(202,138,4,0.45)",
};

const RANK_BG = {
  F: "rgba(71,85,105,0.07)",
  D: "rgba(239,68,68,0.07)",
  C: "rgba(249,115,22,0.07)",
  B: "rgba(217,119,6,0.07)",
  A: "rgba(22,163,74,0.07)",
  S: "rgba(37,99,235,0.08)",
  SS: "rgba(124,58,237,0.10)",
  SSS: "rgba(202,138,4,0.10)",
};

export default function PixelRankRoad({ rankXP = 0 }) {
  const { profile } = useDjangoAuth();
  const { t } = useTranslation();

  const thresholds = profile?.rank_info?.thresholds || [];
  const currentRankId = profile?.rank_info?.current_id || "E";
  const currentRank = getRankDisplayData(currentRankId, profile);

  const currentIdx = thresholds.findIndex(t => t.id === currentRankId);
  const nextRank = currentIdx >= 0 && currentIdx < thresholds.length - 1
    ? getRankDisplayData(thresholds[currentIdx + 1].id, profile)
    : null;
  const currentMin = currentIdx >= 0 ? thresholds[currentIdx].min : 0;
  const nextMin = currentIdx >= 0 && currentIdx < thresholds.length - 1
    ? thresholds[currentIdx + 1].min
    : null;

  const progressPct = nextMin !== null
    ? Math.min(100, ((rankXP - currentMin) / (nextMin - currentMin)) * 100)
    : 100;

  return (
    <div className="p-5 rounded-2xl border relative overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)]"
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10)" }}
    >
      {/* Subtle background grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.018]"
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
            {t("rankProgression")}
          </h3>
        </div>

        {nextRank ? (
          <div className="font-game text-[8px] text-[var(--habit-dim)]">
            {t("next")}: <span style={{ color: RANK_COLORS[nextRank.id] }}>{nextRank.id}</span> | <AnimatedNumber value={Math.floor(rankXP)} /> / {nextMin} XP
          </div>
        ) : (
          <div className="font-game text-[8px] text-[#ca8a04]">{t("maxRankReached")}</div>
        )}
      </div>

      {/* Progress Bar */}
      {nextRank && (
        <div className="mb-5 p-4 bg-[var(--habit-bg)] border border-[var(--habit-border)] rounded-xl relative z-10"
          style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)" }}
        >
          <div className="flex justify-between items-center mb-2 font-game text-[8px]">
            <span className="text-[var(--habit-dim)]">{t("progressTo", { rank: t(`ranks.${nextRank.id}`, nextRank.label) })}</span>
            <span style={{ color: RANK_COLORS[nextRank.id] }}><AnimatedNumber value={progressPct} formatter={(v) => v.toFixed(1)} />%</span>
          </div>
          <div className="h-4 bg-[var(--habit-bg)] border-2 border-[var(--habit-dim)] p-0.5 relative overflow-hidden"
            style={{ clipPath: "polygon(2px 0%, calc(100% - 2px) 0%, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0% calc(100% - 2px), 0% 2px)" }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={ANIM_CONFIG.springBar}
              className="h-full relative overflow-hidden"
              style={{
                background: `linear-gradient(90deg, ${RANK_COLORS[currentRank.id]} 0%, ${RANK_COLORS[nextRank.id]} 100%)`,
                boxShadow: `0 0 8px ${RANK_GLOWS[nextRank.id]}`,
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-[0.15]"
                style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 2px, #ffffff 2px, #ffffff 4px)" }} />
            </motion.div>
          </div>
          <div className="mt-2 text-[7px] font-game text-[var(--habit-dim)] text-center">
            <AnimatedNumber value={Math.ceil(nextMin - rankXP)} /> {t("xpRemaining")}
          </div>
        </div>
      )}

      {/* Rank Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 relative z-10">
        {thresholds.map((row, index) => {
          const isCurrent = row.id === currentRank.id;
          const isUnlocked = index < currentIdx;
          const isLocked = index > currentIdx;
          const color = RANK_COLORS[row.id];
          const glow = RANK_GLOWS[row.id];
          const rankData = getRankDisplayData(row.id, null);

          return (
            <motion.div
              key={row.id}
              whileHover={{
                scale: 1.06,
                y: -4,
                rotateX: 4,
                rotateY: -2,
              }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="relative flex flex-col justify-between min-h-[100px] rounded-xl border-2 overflow-hidden"
              style={{
                background: isCurrent
                  ? `linear-gradient(135deg, ${RANK_BG[row.id]}, rgba(0,0,0,0))`
                  : isUnlocked
                  ? "var(--habit-purple-light)"
                  : "var(--habit-bg)",
                borderColor: isCurrent ? color : isUnlocked ? "var(--habit-purple)" : "var(--habit-border)",
                boxShadow: isCurrent
                  ? `0 8px 24px ${glow}, 0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)`
                  : isUnlocked
                  ? `0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)`
                  : `0 2px 6px rgba(0,0,0,0.12)`,
                opacity: isLocked ? 0.42 : 1,
                transformStyle: "preserve-3d",
                padding: "10px",
              }}
            >
              {/* Inner shine overlay for current/unlocked */}
              {(isCurrent || isUnlocked) && (
                <div className="absolute inset-0 pointer-events-none rounded-xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 60%)",
                  }}
                />
              )}

              {/* Pulsing corner dot for current */}
              {isCurrent && (
                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping absolute" />
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                </div>
              )}

              <div className="space-y-0.5 relative z-10">
                {/* Rank letter */}
                <div
                  className="font-game font-black"
                  style={{
                    fontSize: row.id.length > 1 ? "15px" : "20px",
                    color,
                    textShadow: isCurrent
                      ? `0 0 12px ${glow}, 0 2px 4px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.15)`
                      : `0 2px 4px rgba(0,0,0,0.3)`,
                    letterSpacing: row.id.length > 1 ? "0.02em" : "0",
                  }}
                >
                  {row.id}
                </div>

                {/* Title */}
                <div className="font-game text-[10px] text-[var(--habit-text)] font-bold uppercase tracking-wide leading-tight truncate">
                  {t(`ranks.${rankData.id}`, rankData.label)}
                </div>

                {/* Est time */}
                <div className="font-game text-[10px] mt-0.5 leading-tight" style={{ color: "var(--habit-purple)" }}>
                  ⌛ {rankData.hoursEst?.replace(" at focus 8", "") || ""}
                </div>
              </div>

              {/* XP Req */}
              <div className="mt-2 pt-1.5 border-t flex items-center justify-between font-game text-[10px] relative z-10"
                style={{ borderColor: isCurrent ? `${color}40` : "var(--habit-border)" }}
              >
                <span className="text-[var(--habit-dim)] font-bold">REQ:</span>
                <span className="opacity-80 text-[10px] truncate">{row.min} XP</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Prestige rows */}
      {profile?.prestige_count > 0 && (
        <div className="mt-4 border-t border-yellow-500/30 pt-3 space-y-2">
          {Array.from({ length: profile?.prestige_count ?? 0 }, (_, i) => {
            const level = i + 1;
            const isCurrent = level === profile.prestige_count;
            return (
              <div key={level} className={`mt-2 px-4 py-2 rounded-lg border text-sm font-pixel flex justify-between
                ${isCurrent
                  ? 'border-yellow-400 text-yellow-400 bg-yellow-500/10'
                  : 'border-yellow-500/20 text-yellow-600/40'
                }`}>
                <span>{isCurrent ? '✦' : '✓'} ASCENDANT {toRoman(level)}</span>
                <span>{isCurrent ? 'CURRENT' : 'COMPLETED'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
