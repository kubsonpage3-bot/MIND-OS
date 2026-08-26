import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export const SUBJECT_RANKS = [
  { id: "F", min: 0, max: 9.99, color: "#94a3b8" },
  { id: "E", min: 10, max: 29.99, color: "#64748b" },
  { id: "D", min: 30, max: 59.99, color: "#38bdf8" },
  { id: "C", min: 60, max: 99.99, color: "#60a5fa" },
  { id: "B", min: 100, max: 199.99, color: "#34d399" },
  { id: "A", min: 200, max: 399.99, color: "#10b981" },
  { id: "S", min: 400, max: 699.99, color: "#c084fc" },
  { id: "SS", min: 700, max: 999.99, color: "#fbbf24" },
  { id: "SSS", min: 1000, max: 999999, color: "#f43f5e" },
];

export function getSubjectRank(hours) {
  const sorted = [...SUBJECT_RANKS].sort((a, b) => b.min - a.min);
  return sorted.find((r) => hours >= r.min) || SUBJECT_RANKS[0];
}

export function getNextSubjectRank(hours) {
  const current = getSubjectRank(hours);
  const idx = SUBJECT_RANKS.findIndex((r) => r.id === current.id);
  return idx < SUBJECT_RANKS.length - 1 ? SUBJECT_RANKS[idx + 1] : null;
}

export function SubjectRankProgressBar({ hours = 0, className = "" }) {
  const rank = getSubjectRank(hours);
  const next = getNextSubjectRank(hours);
  const progressPct = next
    ? Math.min(100, Math.max(0, ((hours - rank.min) / (next.min - rank.min)) * 100))
    : 100;
  const isHighRank = rank.id === "S" || rank.id === "SS" || rank.id === "SSS";

  return (
    <div className={cn("space-y-1 w-full", className)}>
      <div className="h-1.5 w-full rounded-full bg-black/60 border border-white/10 p-[0.5px] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${rank.color}88 0%, ${rank.color} 100%)`,
            boxShadow: isHighRank ? `0 0 8px ${rank.color}` : `0 0 4px ${rank.color}40`,
          }}
        />
      </div>
      <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground/80 font-bold px-0.5">
        <span>{hours.toFixed(1)}h</span>
        <span>{next ? `${next.min}h (${next.id})` : "MAX"}</span>
      </div>
    </div>
  );
}

export default function SubjectRankBadge({
  hours = 0,
  showProgress = false,
  className = "",
}) {
  const [showTip, setShowTip] = useState(false);
  const [tipCoords, setTipCoords] = useState({ top: 0, left: 0 });
  const badgeRef = useRef(null);

  const rank = getSubjectRank(hours);
  const next = getNextSubjectRank(hours);
  const hoursToGo = next ? Math.max(0, next.min - hours).toFixed(1) : 0;
  const progressPct = next
    ? Math.min(100, Math.max(0, ((hours - rank.min) / (next.min - rank.min)) * 100))
    : 100;
  const isHighRank = rank.id === "S" || rank.id === "SS" || rank.id === "SSS";

  const updateTipPosition = () => {
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setTipCoords({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  };

  const handleMouseEnter = () => {
    updateTipPosition();
    setShowTip(true);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    updateTipPosition();
    setShowTip((prev) => !prev);
  };

  // Close tooltip on global click outside
  useEffect(() => {
    if (!showTip) return;
    const onGlobalClick = () => setShowTip(false);
    window.addEventListener("click", onGlobalClick);
    return () => window.removeEventListener("click", onGlobalClick);
  }, [showTip]);

  return (
    <div className={cn("relative inline-flex flex-col", className)}>
      <div
        ref={badgeRef}
        className="cursor-pointer inline-flex items-center group/badge"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTip(false)}
        onClick={handleToggle}
        title={`Rank ${rank.id}: ${hours.toFixed(1)}h logged`}
      >
        <span
          className="text-[10px] font-pixel font-bold px-2 py-0.5 rounded leading-none flex items-center justify-center min-w-[24px] text-center relative overflow-hidden transition-transform group-hover/badge:scale-110 shadow-sm"
          style={{
            color: rank.color,
            background: isHighRank ? `${rank.color}25` : "rgba(10,8,20,0.85)",
            border: `1.5px solid ${rank.color}`,
            boxShadow: isHighRank
              ? `0 0 10px ${rank.color}50`
              : `0 0 5px ${rank.color}30`,
          }}
        >
          {rank.id}
        </span>

        {showTip && (
          <div
            className="fixed z-[99999] whitespace-nowrap bg-[#121022]/95 text-slate-100 border border-purple-500/50 rounded-lg p-2 text-[10px] font-mono shadow-[0_4px_20px_rgba(0,0,0,0.8),0_0_12px_rgba(168,85,247,0.3)] pointer-events-none backdrop-blur-md"
            style={{
              top: `${tipCoords.top}px`,
              left: `${tipCoords.left}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#2a243e] pb-1 mb-1 font-bold">
              <span style={{ color: rank.color }}>
                RANK {rank.id} ({hours.toFixed(1)}h)
              </span>
              <span className="text-purple-300">{progressPct.toFixed(0)}%</span>
            </div>
            <div className="text-slate-300 space-y-0.5">
              {next ? (
                <>
                  <div>
                    Next: <span className="text-amber-300 font-bold">Rank {next.id}</span> at {next.min}h
                  </div>
                  <div className="text-slate-400">
                    Remaining: <span className="text-cyan-300 font-bold">{hoursToGo}h</span>
                  </div>
                </>
              ) : (
                <div className="text-amber-400 font-bold">👑 MAX RANK REACHED</div>
              )}
            </div>
          </div>
        )}
      </div>

      {showProgress && (
        <SubjectRankProgressBar hours={hours} className="mt-1.5" />
      )}
    </div>
  );
}