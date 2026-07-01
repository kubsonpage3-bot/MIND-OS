import { useMemo } from "react";
import { getLevelTitle } from "@/lib/cognitiveEngine";



const XP_PER_LEVEL = 500;

export default function StatsPanel({ profile, logs }) {
  const iq = profile ? (profile.gf * 0.30 + profile.gc * 0.30 + profile.ps * 0.20 + profile.vm * 0.20) : 110;
  const level = getLevelTitle(Math.round(iq));

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const weekLogs = logs.filter(l => new Date(l.log_date) >= weekAgo);

  const weeklyXP = weekLogs.reduce((sum, l) => sum + (l.xp_earned || 0), 0);
  const xpPct = (weeklyXP % XP_PER_LEVEL) / XP_PER_LEVEL * 100;
  const streak = 0;

  const cognitiveROI = useMemo(() => {
    const withEff = weekLogs.filter(l => l.efficiency_total != null);
    if (withEff.length === 0) return null;
    const avg = withEff.reduce((s, l) => s + l.efficiency_total, 0) / withEff.length;
    return Math.round(Math.min((avg / 1.5) * 100, 100));
  }, [weekLogs]);

  const roiColor = cognitiveROI == null ? "#878190"
    : cognitiveROI >= 70 ? "#1ca830"
    : cognitiveROI >= 45 ? "#f59e0b"
    : "#f74e52";

  const cards = [
    {
      icon: "🔥",
      value: streak,
      label: "Day Streak",
      color: "#ff8800",
      valueStyle: { fontFamily: "'Pixeltype'", fontSize: "1.4rem", color: "#ff8800" },
    },
    {
      icon: "⭐",
      value: weeklyXP,
      label: "Weekly XP",
      color: "#7B61FF",
      valueStyle: { fontFamily: "'Pixeltype'", fontSize: "1.4rem", color: "#7B61FF" },
      bar: true,
      barPct: xpPct,
      barColor: "#7B61FF",
    },
    {
      icon: "📈",
      value: cognitiveROI != null ? cognitiveROI : "—",
      label: "Cogn. ROI",
      color: roiColor,
      valueStyle: { fontFamily: "'Pixeltype'", fontSize: "1.4rem", color: roiColor },
    },
    {
      icon: "🏆",
      value: level.title,
      label: "Level",
      color: level.color,
      valueStyle: { fontFamily: "'Nunito'", fontWeight: 800, fontSize: "0.9rem", color: level.color },
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {cards.map((card, i) => (
        <div
          key={i}
          className="rounded-xl p-3 text-center flex flex-col items-center gap-1"
          style={{ background: `${card.color}10`, border: `1.5px solid ${card.color}30` }}
        >
          <span className="text-xl">{card.icon}</span>
          <div style={card.valueStyle}>{card.value}</div>
          <div style={{ fontFamily: "'Nunito'", fontSize: 10, fontWeight: 700, color: "#878190", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {card.label}
          </div>
          {card.bar && (
            <div className="w-full h-1.5 rounded-full overflow-hidden mt-1" style={{ background: "#f0eef8" }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${card.barPct}%`, background: card.barColor }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}