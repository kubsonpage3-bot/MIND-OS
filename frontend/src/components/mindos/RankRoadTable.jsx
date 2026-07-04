import { getRankDisplayData } from "@/lib/rankEngine";
import { useTranslation } from "react-i18next";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";

export default function RankRoadTable({ rankXP = 0 }) {
  const { profile } = useDjangoAuth();
  const { t } = useTranslation();
  
  const thresholds = profile?.rank_info?.thresholds || [];
  const currentRankId = profile?.rank_info?.current_id || "F";
  const currentRank = getRankDisplayData(currentRankId, profile);
  
  const currentIdx = thresholds.findIndex(t => t.id === currentRankId);
  const nextRankId = currentIdx >= 0 && currentIdx < thresholds.length - 1 ? thresholds[currentIdx + 1].id : null;
  const nextRank = nextRankId ? getRankDisplayData(nextRankId, profile) : null;
  const currentMin = currentIdx >= 0 ? thresholds[currentIdx].min : 0;
  const nextMin = currentIdx >= 0 && currentIdx < thresholds.length - 1 ? thresholds[currentIdx + 1].min : null;

  const progressPct = nextMin !== null
    ? Math.min(100, ((rankXP - currentMin) / (nextMin - currentMin)) * 100)
    : 100;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">▸ RANK ROAD</div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-muted-foreground/50 border-b border-border">
              <th className="text-left py-2 pr-3">RANK</th>
              <th className="text-left py-2 pr-3">TITLE</th>
              <th className="text-right py-2 pr-3">XP NEEDED</th>
              <th className="text-right py-2 hidden sm:table-cell">HOURS EST.</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map((row) => {
              const isCurrent = row.id === currentRank.id;
              const isNext = nextRank && row.id === nextRank.id;
              const displayData = getRankDisplayData(row.id, profile);
              // color from RANKS
              const rankColors = {
                F: "#64748b", D: "#ef4444", C: "#f97316", B: "#eab308",
                A: "#22c55e", S: "#3b82f6", SS: "#a855f7", SSS: "#f59e0b"
              };
              const color = rankColors[row.id] || "#64748b";

              return (
                <tr
                  key={row.id}
                  className={`border-b border-border/30 ${isCurrent ? "bg-primary/5" : isNext ? "bg-yellow-500/5" : ""}`}
                  style={{ borderLeft: isCurrent ? "3px solid #3b82f6" : isNext ? "3px solid #f59e0b" : "3px solid transparent" }}
                >
                  <td className="py-2 pr-3 pl-2">
                    <span className="font-bold" style={{ color }}>{row.id}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={isCurrent ? "text-foreground" : "text-muted-foreground/70"}>{t(`ranks.${displayData.id}`, displayData.label)}</span>
                    {isCurrent && <span className="ml-2 text-[10px] text-primary">← YOU</span>}
                    {isNext && <span className="ml-2 text-[10px] text-yellow-400">← NEXT</span>}
                  </td>
                  <td className="py-2 pr-3 text-right text-muted-foreground/80">{row.min}</td>
                  <td className="py-2 text-right text-muted-foreground/60 hidden sm:table-cell">~{Math.round(row.min/10)}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] font-mono text-muted-foreground/40 italic">* Estimated at focus 8.0 average</div>

      {nextRank && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center mb-1 text-xs font-mono text-muted-foreground uppercase tracking-widest">
            <span>Progress to <span style={{ color: nextRank.color }}>{nextRank.id} {t(`ranks.${nextRank.id}`, nextRank.label)}</span></span>
            <span>{progressPct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #3b82f6, #60a5fa)" }}
            />
          </div>
          <div className="text-[10px] text-right font-mono text-muted-foreground/60 mt-1">
            {Math.floor(rankXP)} / {nextMin} XP — {progressPct.toFixed(0)}% to {nextRank.id} {t(`ranks.${nextRank.id}`, nextRank.label)}
          </div>
        </div>
      )}
    </div>
  );
}