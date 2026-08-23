import { motion } from "framer-motion";
import { getRankDisplayData } from "@/lib/rankEngine";
import { Trophy, Sparkles, Lock, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { ANIM_CONFIG } from "@/lib/animations";

const toRoman = (n) =>
  ['', 'I','II','III','IV','V','VI','VII','VIII','IX','X'][n] ?? `${n}`;

const RANK_COLORS = {
  E: "#64748b",
  D: "#ef4444",
  C: "#f97316",
  B: "#f59e0b",
  A: "#10b981",
  S: "#3b82f6",
  SS: "#8b5cf6",
  SSS: "#eab308",
};

const RANK_GLOWS = {
  E: "rgba(100,116,139,0.3)",
  D: "rgba(239,68,68,0.4)",
  C: "rgba(249,115,22,0.4)",
  B: "rgba(245,158,11,0.45)",
  A: "rgba(16,185,129,0.45)",
  S: "rgba(59,130,246,0.5)",
  SS: "rgba(139,92,246,0.55)",
  SSS: "rgba(234,179,8,0.6)",
};

const RANK_BG = {
  E: "rgba(100,116,139,0.08)",
  D: "rgba(239,68,68,0.1)",
  C: "rgba(249,115,22,0.1)",
  B: "rgba(245,158,11,0.12)",
  A: "rgba(16,185,129,0.12)",
  S: "rgba(59,130,246,0.14)",
  SS: "rgba(139,92,246,0.15)",
  SSS: "rgba(234,179,8,0.18)",
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
    ? Math.min(100, Math.max(0, ((rankXP - currentMin) / (nextMin - currentMin)) * 100))
    : 100;

  return (
    <div 
      className="p-4 md:p-5 rounded-xl border relative overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] pixel-corner-brackets"
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)" }}
    >
      {/* Background ambient radial glow */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${RANK_GLOWS[currentRank.id]} 0%, transparent 70%)`
        }}
      />

      {/* Subtle pixel grid texture */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, var(--habit-text) 1px, transparent 0)",
          backgroundSize: "14px 14px"
        }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4 pb-3 border-b border-[var(--habit-border)] relative z-10">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#ffbe5d] animate-bounce" />
          <h3 className="font-game text-[10px] text-[var(--habit-text)] tracking-wider uppercase font-black">
            ✦ {t("rankProgression", "RANK ROAD & ASCENSION")} ✦
          </h3>
        </div>

        {nextRank ? (
          <div className="font-game text-[8.5px] text-[var(--habit-dim)] flex items-center gap-1.5">
            <span className="opacity-70">{t("next", "NEXT")}:</span>
            <span 
              className="font-bold px-1.5 py-0.2 rounded border"
              style={{ 
                color: RANK_COLORS[nextRank.id], 
                borderColor: `${RANK_COLORS[nextRank.id]}50`,
                background: `${RANK_COLORS[nextRank.id]}15` 
              }}
            >
              [ {nextRank.id} · {t(`ranks.${nextRank.id}`, nextRank.label)} ]
            </span>
            <span className="text-[var(--habit-text)] font-mono font-bold">
              <AnimatedNumber value={Math.floor(rankXP)} /> / {nextMin.toLocaleString()} XP
            </span>
          </div>
        ) : (
          <div className="font-game text-[8.5px] text-[#ca8a04] font-bold">👑 {t("maxRankReached", "MAX RANK REACHED")}</div>
        )}
      </div>

      {/* Segmented XP Progress Bar */}
      {nextRank && (
        <div 
          className="mb-4 p-3.5 bg-black/25 border border-[var(--habit-border)] rounded-xl relative z-10"
          style={{ boxShadow: "inset 0 1px 4px rgba(0,0,0,0.3)" }}
        >
          <div className="flex justify-between items-center mb-2 font-game text-[8.5px]">
            <span className="text-[var(--habit-text)] font-bold tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[var(--habit-purple)]" />
              PROGRESS TO [ {nextRank.id} · {t(`ranks.${nextRank.id}`, nextRank.label).toUpperCase()} ]
            </span>
            <span 
              className="font-black text-[9px]"
              style={{ color: RANK_COLORS[nextRank.id], textShadow: `0 0 8px ${RANK_GLOWS[nextRank.id]}` }}
            >
              <AnimatedNumber value={progressPct} formatter={(v) => v.toFixed(1)} />%
            </span>
          </div>

          {/* Segmented Progress Track */}
          <div 
            className="h-4.5 bg-black/60 border-2 border-[var(--habit-border)] rounded-lg p-0.5 relative overflow-hidden shadow-inner"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={ANIM_CONFIG.springBar}
              className="h-full rounded-md relative overflow-hidden"
              style={{
                background: `linear-gradient(90deg, ${RANK_COLORS[currentRank.id]} 0%, ${RANK_COLORS[nextRank.id]} 100%)`,
                boxShadow: `0 0 12px ${RANK_GLOWS[nextRank.id]}`,
              }}
            />
            {/* Pixel Meter Segment Overlay */}
            <div className="absolute inset-0 pixel-meter-pattern pointer-events-none opacity-35" />
          </div>

          <div className="mt-2 text-[7.5px] font-game text-[var(--habit-dim)] text-center font-bold tracking-wider uppercase">
            <span className="text-[var(--habit-text)]"><AnimatedNumber value={Math.max(0, Math.ceil(nextMin - rankXP))} /> XP</span> REMAINING TO ADVANCE
          </div>
        </div>
      )}

      {/* Rank Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 relative z-10">
        {thresholds.map((row, index) => {
          const isCurrent = row.id === currentRank.id;
          const isUnlocked = index < currentIdx;
          const isLocked = index > currentIdx;
          const color = RANK_COLORS[row.id] || "#fff";
          const glow = RANK_GLOWS[row.id] || "rgba(255,255,255,0.2)";
          const rankData = getRankDisplayData(row.id, null);

          return (
            <motion.div
              key={row.id}
              whileHover={{
                scale: 1.05,
                y: -3,
              }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className="relative flex flex-col justify-between min-h-[108px] rounded-xl border-2 overflow-hidden cursor-default group"
              style={{
                background: isCurrent
                  ? `linear-gradient(145deg, ${RANK_BG[row.id]}, rgba(0,0,0,0.4))`
                  : isUnlocked
                  ? "rgba(123, 97, 255, 0.06)"
                  : "rgba(0,0,0,0.25)",
                borderColor: isCurrent ? color : isUnlocked ? "rgba(123, 97, 255, 0.4)" : "var(--habit-border)",
                boxShadow: isCurrent
                  ? `0 6px 20px ${glow}, inset 0 1px 0 rgba(255,255,255,0.12)`
                  : isUnlocked
                  ? `0 2px 8px rgba(0,0,0,0.2)`
                  : `0 1px 4px rgba(0,0,0,0.1)`,
                opacity: isLocked ? 0.45 : 1,
                padding: "8px",
              }}
            >
              {/* Inner shine highlight for current */}
              {isCurrent && (
                <div 
                  className="absolute inset-0 pointer-events-none rounded-xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%)",
                  }}
                />
              )}

              {/* Status Indicator */}
              <div className="flex items-center justify-between w-full relative z-10 mb-1">
                {/* Rank letter */}
                <span
                  className="font-game font-black"
                  style={{
                    fontSize: row.id.length > 1 ? "14px" : "18px",
                    color,
                    textShadow: isCurrent ? `0 0 12px ${glow}` : "none",
                  }}
                >
                  {row.id}
                </span>

                {/* Status Pill */}
                {isCurrent && (
                  <div className="flex items-center gap-1 font-game text-[6.5px] font-black text-emerald-400 bg-emerald-500/20 px-1 py-0.2 rounded border border-emerald-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>ACTIVE</span>
                  </div>
                )}
                {isUnlocked && (
                  <CheckCircle2 className="w-3 h-3 text-[var(--habit-purple)] opacity-80" />
                )}
                {isLocked && (
                  <Lock className="w-3 h-3 text-[var(--habit-dim)] opacity-50" />
                )}
              </div>

              {/* Rank Title */}
              <div className="space-y-0.5 relative z-10">
                <div className="font-game text-[8.5px] text-[var(--habit-text)] font-bold uppercase tracking-tight truncate">
                  {t(`ranks.${rankData.id}`, rankData.label)}
                </div>

                {/* Est time */}
                <div className="font-game text-[7.5px] text-[var(--habit-dim)] truncate">
                  ⌛ {rankData.hoursEst?.replace(" at focus 8", "") || "~"}
                </div>
              </div>

              {/* XP Requirement */}
              <div 
                className="mt-2 pt-1.5 border-t flex items-center justify-between font-game text-[8px] relative z-10"
                style={{ borderColor: isCurrent ? `${color}40` : "var(--habit-border)" }}
              >
                <span className="text-[var(--habit-dim)] font-bold">REQ:</span>
                <span className="font-bold font-mono opacity-90">{row.min} XP</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Ascendant Path (Prestige) */}
      {(profile?.prestige_count || 0) > 0 && (() => {
        const prestigeCount = profile.prestige_count;

        const getLevelBonuses = (level) => ({
          statsPct: level * 10,
          maxHp: 100 + level * 50,
          skillPoints: level * 5,
        });

        const visibleLevels = [
          ...Array.from({ length: prestigeCount }, (_, i) => ({
            level: i + 1,
            status: i + 1 < prestigeCount ? 'completed' : 'current',
          })),
          { level: prestigeCount + 1, status: 'locked' },
        ];

        return (
          <div className="mt-4 border-t pt-3.5 space-y-2 border-amber-500/30 relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-game text-[9px] tracking-widest uppercase font-black text-amber-400">
                ✦ ASCENDANT PATH ✦
              </span>
              <span className="font-game text-[7px] text-amber-400/50">
                · Prestige to unlock higher tiers
              </span>
            </div>

            {visibleLevels.map(({ level, status }) => {
              const bonuses = getLevelBonuses(level);
              const isCurrent = status === 'current';
              const isCompleted = status === 'completed';
              const isLocked = status === 'locked';

              return (
                <motion.div
                  key={level}
                  initial={isCurrent ? { opacity: 0, x: -8 } : false}
                  animate={isCurrent ? { opacity: 1, x: 0 } : false}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="relative px-3.5 py-2 rounded-xl border flex items-center justify-between font-game text-[9px] overflow-hidden"
                  style={{
                    borderColor: isCurrent
                      ? "rgba(202,138,4,0.75)"
                      : isCompleted
                      ? "rgba(202,138,4,0.25)"
                      : "rgba(202,138,4,0.15)",
                    background: isCurrent
                      ? "rgba(202,138,4,0.12)"
                      : "rgba(202,138,4,0.03)",
                    boxShadow: isCurrent ? "0 0 16px rgba(202,138,4,0.25)" : "none",
                  }}
                >
                  <div className="flex items-center gap-2.5 relative z-10">
                    <div className="flex items-center justify-center w-4 h-4 shrink-0">
                      {isCurrent && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                      {isCompleted && <span className="text-[9px] text-amber-400">✓</span>}
                      {isLocked && <span className="text-[9px] text-amber-400/40">🔒</span>}
                    </div>

                    <div>
                      <div className="font-black tracking-wider text-amber-300">
                        ASCENDANT {toRoman(level)}
                      </div>
                      <div className="mt-0.5 text-[7px] text-amber-300/70">
                        +{bonuses.statsPct}% stats · {bonuses.maxHp} HP · +{bonuses.skillPoints} SP
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 font-bold text-[7px] text-amber-400">
                    {isCurrent ? "CURRENT" : isCompleted ? "COMPLETED" : "LOCKED"}
                  </div>
                </motion.div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
