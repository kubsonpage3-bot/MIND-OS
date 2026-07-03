import { getRankDisplayData } from "@/lib/rankEngine";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import PixelCharacter from "./PixelCharacter";

const pixelBox = (color) => ({
  borderColor: color,
  clipPath: "polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0% calc(100% - 4px), 0% 4px)",
  fontFamily: "'Space Mono', monospace",
});

function getRankBarColor(rankId) {
  if (["F", "D"].includes(rankId)) return "#64748b";
  if (["C", "B"].includes(rankId)) return "#3b82f6";
  if (["A", "S"].includes(rankId)) return "#a855f7";
  return "#f59e0b";
}

export default function RankBadge({ rankXP = 0, compact = false }) {
  const { profile } = useDjangoAuth();
  
  const thresholds = profile?.rank_info?.thresholds || [];
  const currentRankId = profile?.rank_info?.current_id || "F";
  const rank = getRankDisplayData(currentRankId);
  
  const currentIdx = thresholds.findIndex(t => t.id === currentRankId);
  const nextRankId = currentIdx >= 0 && currentIdx < thresholds.length - 1 ? thresholds[currentIdx + 1].id : null;
  const nextRank = nextRankId ? getRankDisplayData(nextRankId) : null;
  const currentMin = currentIdx >= 0 ? thresholds[currentIdx].min : 0;
  const nextMin = currentIdx >= 0 && currentIdx < thresholds.length - 1 ? thresholds[currentIdx + 1].min : null;

  const progressPct = nextMin !== null
    ? Math.min(100, ((rankXP - currentMin) / (nextMin - currentMin)) * 100)
    : 100;

  const xpToNext = nextMin !== null ? nextMin - rankXP : 0;
  const barColor = getRankBarColor(rank.id);

  if (compact) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold"
        style={{ color: rank.color, background: rank.glow, border: `1px solid ${rank.color}40` }}
      >
        {rank.id}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Character + Badge row */}
      <div className="flex items-center gap-6 w-full justify-center">
        <PixelCharacter rankId={rank.id} rankColor={rank.color} size={100} />

        <div
          className="px-8 py-3 border-2 text-center transition-all duration-300"
          style={{
            ...pixelBox(rank.color),
            boxShadow: `0 0 24px ${rank.glow}, 0 0 48px ${rank.glow}, inset 0 0 20px ${rank.glow}`,
            background: "rgba(0,0,0,0.8)",
          }}
        >
          <div
            className="font-mono font-black tracking-widest leading-none"
            style={{
              fontSize: "2.4rem",
              color: rank.color,
              textShadow: `0 0 20px ${rank.color}, 2px 2px 0px rgba(0,0,0,0.8)`,
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {rank.id}{rank.god ? " ✨" : ""}
          </div>
          <div
            className="font-mono font-bold tracking-[0.3em] text-xs mt-1 uppercase"
            style={{ color: rank.color, opacity: 0.85, textShadow: `0 0 10px ${rank.color}`, fontFamily: "'Space Mono', monospace" }}
          >
            {rank.label}
          </div>
        </div>
      </div>

      {/* XP bar */}
      <div className="w-full space-y-1.5 px-2">
        <div className="flex justify-between text-xs font-mono text-muted-foreground">
          <span>RANK XP: <span className="text-foreground font-bold">{Math.floor(rankXP)}</span> / <span>{nextRank ? nextMin : currentMin}</span></span>
          <span className="text-foreground">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)` }}
          />
        </div>
        {nextRank ? (
          <div className="text-[11px] font-mono text-muted-foreground/60 text-center">
            {Math.ceil(xpToNext)} XP to <span style={{ color: nextRank.color }}>{nextRank.id} {nextRank.label}</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-center" style={{ color: rank.color }}>Maximum rank achieved.</div>
        )}
      </div>

      {/* Brutal truth */}
      <div
        className="w-full text-center text-xs font-mono italic px-4 py-2 border"
        style={{
          color: rank.color,
          background: "rgba(0,0,0,0.7)",
          textShadow: `0 0 8px ${rank.color}`,
          ...pixelBox(rank.color),
        }}
      >
        &gt; "{rank.desc}"
      </div>
    </div>
  );
}