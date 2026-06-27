// XP-based rank system for MIND OS

export const RANKS = [
  { id: "F",   label: "DORMANT",   xpMin: 0,    xpMax: 49,   color: "#64748b", glow: "rgba(100,116,139,0.15)", desc: "Cast thy burden upon the Lord, and he shall sustain thee. — Ps. 55:22" },
  { id: "D",   label: "AWAKENING", xpMin: 50,   xpMax: 149,  color: "#ef4444", glow: "rgba(239,68,68,0.15)",   desc: "I can do all things through Christ which strengtheneth me. — Phil. 4:13" },
  { id: "C",   label: "GRINDING",  xpMin: 150,  xpMax: 399,  color: "#f97316", glow: "rgba(249,115,22,0.15)",  desc: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee. — Josh. 1:9" },
  { id: "B",   label: "SHARPENED", xpMin: 400,  xpMax: 799,  color: "#eab308", glow: "rgba(234,179,8,0.15)",   desc: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee. — Isa. 41:10" },
  { id: "A",   label: "ELITE",     xpMin: 800,  xpMax: 1499, color: "#22c55e", glow: "rgba(34,197,94,0.15)",   desc: "The Lord is my shepherd; I shall not want. — Ps. 23:1" },
  { id: "S",   label: "APEX",      xpMin: 1500, xpMax: 2499, color: "#3b82f6", glow: "rgba(59,130,246,0.15)",  desc: "All things work together for good to them that love God. — Rom. 8:28" },
  { id: "SS",  label: "SOVEREIGN", xpMin: 2500, xpMax: 3999, color: "#a855f7", glow: "rgba(168,85,247,0.15)",  desc: "I know the thoughts that I think toward you... thoughts of peace, and not of evil. — Jer. 29:11" },
  { id: "SSS", label: "GOD MODE",  xpMin: 4000, xpMax: 999999, color: "#f59e0b", glow: "rgba(245,158,11,0.2)", desc: "They that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles. — Isa. 40:31", god: true },
];

export const RANK_XP_TABLE = [
  { id: "F",   label: "DORMANT",   xpNeeded: 0,    hoursEst: "—" },
  { id: "D",   label: "AWAKENING", xpNeeded: 50,   hoursEst: "~6h at focus 8" },
  { id: "C",   label: "GRINDING",  xpNeeded: 150,  hoursEst: "~19h at focus 8" },
  { id: "B",   label: "SHARPENED", xpNeeded: 400,  hoursEst: "~50h at focus 8" },
  { id: "A",   label: "ELITE",     xpNeeded: 800,  hoursEst: "~100h at focus 8" },
  { id: "S",   label: "APEX",      xpNeeded: 1500, hoursEst: "~188h at focus 8" },
  { id: "SS",  label: "SOVEREIGN", xpNeeded: 2500, hoursEst: "~313h at focus 8" },
  { id: "SSS", label: "GOD MODE",  xpNeeded: 4000, hoursEst: "~500h at focus 8" },
];

export function getRankFromXP(rankXP) {
  const sorted = [...RANKS].sort((a, b) => b.xpMin - a.xpMin);
  return sorted.find(r => rankXP >= r.xpMin) || RANKS[0];
}

export function getNextRankFromXP(rankXP) {
  const current = getRankFromXP(rankXP);
  const idx = RANKS.findIndex(r => r.id === current.id);
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
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