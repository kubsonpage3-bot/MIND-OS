import { useMemo } from "react";
import { ACTIVITIES, METRIC_CONFIG } from "@/lib/cognitiveEngine";
import { getRankFromXP } from "@/lib/rankEngine";
import { Clock } from "lucide-react";

export default function HistoryLog({ logs }) {
  const sorted = [...logs].sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());

  const dailyRankMap = useMemo(() => {
    const map = {};
    logs.forEach(log => {
      const day = new Date(log.log_date || log.created_date).toDateString();
      if (!map[day]) map[day] = { iq: log.iq_after || 110, hours: 0, focusRatings: [], activities: new Set() };
      map[day].hours += log.hours || 0;
      if (log.focus_rating) map[day].focusRatings.push(log.focus_rating);
      if (log.iq_after) map[day].iq = log.iq_after;
      if (log.activity) map[day].activities.add(log.activity);
    });
    const result = {};
    Object.entries(map).forEach(([day, data]) => {
      const focusAvg = data.focusRatings.length > 0
        ? data.focusRatings.reduce((a, b) => a + b, 0) / data.focusRatings.length
        : 5;
      const score = data.hours * focusAvg;
      result[day] = { score, rank: getRankFromXP(score * 10) };
    });
    return result;
  }, [logs]);

  const bestRankScore = useMemo(() => {
    const scores = Object.values(dailyRankMap).map(d => d.score);
    return scores.length > 0 ? Math.max(...scores) : -1;
  }, [dailyRankMap]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12" style={{ fontFamily: "'Nunito'", fontSize: 13, color: "var(--habit-dim)" }}>
        <div className="text-4xl mb-2">📋</div>
        No sessions logged yet.<br />Start training to build your history.
      </div>
    );
  }

  const colorMap = { gf: "#3b82f6", gc: "#22c55e", ps: "#f59e0b", vm: "#a855f7" };

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
      {sorted.map((log) => {
        const activity = ACTIVITIES[log.activity];
        const gains = Object.entries(METRIC_CONFIG)
          .filter(([mk]) => (log[`${mk}_gain`] || 0) > 0)
          .map(([mk, mc]) => ({ mk, mc, val: log[`${mk}_gain`] }));

        const date = new Date(log.created_date);
        const timeStr = date.toLocaleString("en-US", {
          month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit"
        });

        const day = new Date(log.log_date || log.created_date).toDateString();
        const dayData = dailyRankMap[day];
        const rank = dayData?.rank;
        const isBestDay = dayData && Math.abs(dayData.score - bestRankScore) < 0.001;

        return (
          <div
            key={log.id}
            className="p-3 rounded-xl"
            style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0">{activity?.icon || "📌"}</span>
                <div className="min-w-0">
                  <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 13, color: "var(--habit-text)" }} className="truncate">
                    {activity?.label || log.activity}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5" style={{ fontFamily: "'Nunito'", fontSize: 11, color: "var(--habit-dim)" }}>
                    <Clock className="w-3 h-3" />
                    <span>{log.hours}h</span>
                    <span style={{ color: "var(--habit-dim)" }}>·</span>
                    <span>{timeStr}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {rank && (
                  <div className="flex items-center gap-1">
                    {isBestDay && <span className="text-xs">🏆</span>}
                    <span
                      style={{
                        fontFamily: "'Pixeltype'", fontSize: 8,
                        color: rank.color, background: `${rank.color}22`,
                        border: `1px solid ${rank.color}44`,
                        padding: "2px 6px", borderRadius: 4
                      }}
                    >
                      {rank.id}
                    </span>
                  </div>
                )}
                {log.xp_earned && (
                  <div style={{ fontFamily: "'Pixeltype'", fontSize: 8, color: "var(--habit-purple)" }}>
                    +{log.xp_earned} XP
                  </div>
                )}
              </div>
            </div>

            {gains.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {gains.map(({ mk, mc, val }) => (
                  <span
                    key={mk}
                    className="px-2 py-0.5 rounded-full text-white"
                    style={{
                      fontFamily: "'Nunito'", fontWeight: 700, fontSize: 10,
                      background: colorMap[mk],
                    }}
                  >
                    {mc.abbr} +{val.toFixed(3)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}