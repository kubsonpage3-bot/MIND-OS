import { computeEfficiency, getEfficiencyColor } from "@/lib/cognitiveEngine";

export default function EfficiencyMeter({ focus, streakDays, hoursToday, subjectHoursToday, statFoc, statMem }) {
  const eff = computeEfficiency({ focus, streakDays, hoursToday, subjectHoursToday, statFoc, statMem });
  const color = getEfficiencyColor(eff.total);

  const rows = [
    { label: "Focus", value: eff.focus, tag: `×${eff.focus.toFixed(2)}` },
    { label: "Streak", value: eff.streak, tag: `×${eff.streak.toFixed(2)}` },
    { label: "Fatigue", value: eff.fatigue, tag: `×${eff.fatigue.toFixed(2)}` },
    { label: "Diminishing", value: eff.diminishing, tag: `×${eff.diminishing.toFixed(2)}` },
  ];

  return (
    <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-3">
      {/* Main readout */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Current Efficiency
        </span>
        <span
          className="font-mono text-lg font-bold"
          style={{ color, textShadow: `0 0 12px ${color}60` }}
        >
          ×{eff.total.toFixed(2)}
        </span>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-1.5">
        {rows.map(({ label, value, tag }) => {
          const pct = Math.min((value / 1.5) * 100, 100);
          const barColor = value >= 1.0 ? "#22c55e" : value >= 0.7 ? "#f59e0b" : "#ef4444";
          return (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground/60 w-20 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
              <span className="text-[10px] font-mono w-10 text-right" style={{ color: barColor }}>{tag}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}