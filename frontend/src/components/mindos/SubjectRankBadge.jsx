import { useState, useRef } from "react";

export const SUBJECT_RANKS = [
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

export function SubjectRankProgressBar({ hours = 0, className = "" }) {
  const rank = getSubjectRank(hours);
  const next = getNextSubjectRank(hours);
  const progressPct = next ? Math.min(100, ((hours - rank.min) / (next.min - rank.min)) * 100) : 100;
  const isSSS = rank.id === "SSS";

  return (
    <div className={`h-1 w-full rounded-full bg-black/30 dark:bg-white/10 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${progressPct}%`,
          background: rank.color,
          animation: isSSS ? "pulse-glow 1.5s ease-in-out infinite" : undefined,
        }}
      />
    </div>
  );
}

export default function SubjectRankBadge({ hours = 0, showProgress = false, className = "" }) {
  const [showTip, setShowTip] = useState(false);
  const [tipCoords, setTipCoords] = useState({ top: 0, left: 0 });
  const badgeRef = useRef(null);

  const rank = getSubjectRank(hours);
  const next = getNextSubjectRank(hours);
  const hoursToGo = next ? Math.max(0, next.min - hours).toFixed(1) : 0;
  const isSSS = rank.id === "SSS";

  const handleMouseEnter = () => {
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setTipCoords({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
      setShowTip(true);
    }
  };

  return (
    <div className={`relative inline-flex flex-col ${className}`}>
      <div
        ref={badgeRef}
        className="cursor-help inline-flex items-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTip(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded leading-none flex items-center justify-center min-w-[18px] text-center"
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
          <div
            className="fixed z-[99999] whitespace-nowrap bg-slate-900/95 text-slate-100 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-[10px] font-mono shadow-2xl pointer-events-none backdrop-blur-sm"
            style={{
              top: `${tipCoords.top}px`,
              left: `${tipCoords.left}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            Total: {hours.toFixed(1)}h | Rank: {rank.id} | {next ? `Next: ${next.id} at ${next.min}h | ${hoursToGo}h to go` : "MAX RANK"}
          </div>
        )}
      </div>

      {showProgress && (
        <SubjectRankProgressBar hours={hours} className="mt-1.5" />
      )}
    </div>
  );
}