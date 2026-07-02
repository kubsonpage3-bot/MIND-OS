// Pure display system for MIND OS ranks
// Note: Actual xp calculations and thresholds are now computed on the backend (SSOT)

export const RANKS = [
  { id: "F",   label: "DORMANT",   color: "#64748b", glow: "rgba(100,116,139,0.15)", desc: "Cast thy burden upon the Lord, and he shall sustain thee. — Ps. 55:22" },
  { id: "D",   label: "AWAKENING", color: "#ef4444", glow: "rgba(239,68,68,0.15)",   desc: "I can do all things through Christ which strengtheneth me. — Phil. 4:13" },
  { id: "C",   label: "GRINDING",  color: "#f97316", glow: "rgba(249,115,22,0.15)",  desc: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee. — Josh. 1:9" },
  { id: "B",   label: "SHARPENED", color: "#eab308", glow: "rgba(234,179,8,0.15)",   desc: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee. — Isa. 41:10" },
  { id: "A",   label: "ELITE",     color: "#22c55e", glow: "rgba(34,197,94,0.15)",   desc: "The Lord is my shepherd; I shall not want. — Ps. 23:1" },
  { id: "S",   label: "APEX",      color: "#3b82f6", glow: "rgba(59,130,246,0.15)",  desc: "All things work together for good to them that love God. — Rom. 8:28" },
  { id: "SS",  label: "SOVEREIGN", color: "#a855f7", glow: "rgba(168,85,247,0.15)",  desc: "I know the thoughts that I think toward you... thoughts of peace, and not of evil. — Jer. 29:11" },
  { id: "SSS", label: "GOD MODE",  color: "#f59e0b", glow: "rgba(245,158,11,0.2)", desc: "They that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles. — Isa. 40:31", god: true },
];

export function getRankDisplayData(rankId) {
  return RANKS.find(r => r.id === rankId) || RANKS[0];
}

// Keep for backward compat with any remaining usage
export function getRank(score) {
  return RANKS[0];
}

export function getNextRank(score) {
  return RANKS[1];
}

export function calcRankScore() {
  return { total: 0 };
}

/** Session Rank XP = hours × focus_rating */
export function calcSessionRankXP(hours, focusRating) {
  return hours * focusRating;
}

export function getBrutalTruth(breakdown) {
  return "Keep pushing.";
}