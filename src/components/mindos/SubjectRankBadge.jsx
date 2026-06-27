import { useState } from "react";

const SUBJECT_RANKS = [
  { id: "F",   min: 0,    max: 9.99,  color: "#888888" },
  { id: "E",   min: 10,   max: 29.99, color: "#888888" },
  { id: "D",   min: 30,   max: 59.99, color: "#3388ff" },
  { id: "C",   min: 60,   max: 99.99, color: "#3388ff" },
  { id: "B",   min: 100,  max: 199.99,color: "#00cc88" },
  { id: "A",   min: 200,  max: 399.99,color: "#00cc88" },
  { id: "S",   min: 400,  max: 699.99,color: "#9944ff" },
  { id: "SS",  min: 700,  max: 999.99,color: "#ffaa00" },
  { id: "SSS", min: 1000, max: 999999,color: "#ff2244" },
];

export function getSubjectRank(hours) {
  const sorted = [...SUBJECT_RANKS].sort((a, b) => b.min - a.min);
  return sorted.find(r => hours >= r.min) || SUBJECT_RANKS[0];
}

export function getNextSubjectRank(hours) {
  const current = getSubjectRank(hours);
  const idx = SUBJECT_RANKS.findIndex(r => r.id === current.id);
  return idx < SUBJECT_RANKS.length - 1 ? SUBJECT_RANKS[idx + 1] : null;
}

export default function SubjectRankBadge({ hours = 0 }) {
  const [showTip, setShowTip] = useState(false);
  const rank = getSubjectRank(hours);
  const next = getNextSubjectRank(hours);
  const progressPct = next ? Math.min(100, ((hours - rank.min) / (next.min - rank.min)) * 100) : 100;
  const hoursToGo = next ? Math.max(0, next.min - hours).toFixed(1) : 0;

  const isSSS = rank.id === "SSS";

  return (
    <div className="relative w-full">
      {/* Progress bar */}
      <div className="h-1 rounded-full bg-black/30 overflow-hidden mt-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progressPct}%`,
            background: rank.color,
            animation: isSSS ? "pulse-glow 1.5s ease-in-out infinite" : undefined,
          }}
        />
      </div>

      {/* Rank badge + tooltip */}
      <div
        className="absolute bottom-0 right-0 translate-y-[-110%] cursor-default"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <span
          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
          style={{
            color: rank.color,
            background: `${rank.color}22`,
            border: `1px solid ${rank.color}44`,
            animation: isSSS ? "pulse-glow 1s ease-in-out infinite" : undefined,
          }}
        >
          {rank.id}
        </span>

        {showTip && (
          <div className="absolute bottom-full right-0 mb-1 z-50 whitespace-nowrap bg-card border border-border rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-foreground shadow-xl">
            Total: {hours.toFixed(1)}h | Rank: {rank.id} | {next ? `Next: ${next.id} at ${next.min}h | ${hoursToGo}h to go` : "MAX RANK"}
          </div>
        )}
      </div>
    </div>
  );
}