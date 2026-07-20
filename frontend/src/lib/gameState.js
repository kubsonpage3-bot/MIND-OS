

export const BOSSES = [
  {
    id: "void",
    name: "THE VOID",
    maxHP: 500,
    lore: "The absence of thought given form.",
    attack: "Mental Fog",
    attackEffect: "missed daily = −5 weekly XP",
    requiredRank: "E",
    color: "#00e5ff",
  },
  {
    id: "static",
    name: "COGNITIVE STATIC",
    maxHP: 1200,
    lore: "Distraction rendered conscious.",
    attack: "Signal Interference",
    attackEffect: "missed daily = −10 XP",
    requiredRank: "D",
    color: "#ff2222",
  },
  {
    id: "algorithm",
    name: "THE ALGORITHM",
    maxHP: 2500,
    lore: "Optimization without purpose.",
    attack: "Routine Override",
    attackEffect: "missed daily = streak −1",
    requiredRank: "C",
    color: "#00ff88",
  },
  {
    id: "parasite",
    name: "MEMETIC PARASITE",
    maxHP: 5000,
    lore: "A thought that thinks it is you.",
    attack: "Cognitive Drain",
    attackEffect: "missed daily = −0.1 Gf",
    requiredRank: "B",
    color: "#aa00ff",
  },
  {
    id: "recursive",
    name: "THE RECURSIVE",
    maxHP: 15000,
    lore: "The final test before transcendence.",
    attack: "Infinite Regress",
    attackEffect: "missed daily = −15 XP −0.2 metrics",
    requiredRank: "A",
    color: "#3b82f6",
  },
];


// ── Gear Class System (E→S) ────────────────────────────────────────────
export const GEAR_CLASS_COLORS = {
  E: '#6b7280', // Scrap — grey
  D: '#22c55e', // Integrated — green
  C: '#3b82f6', // Enhanced — blue
  B: '#a855f7', // Advanced — purple
  A: '#f59e0b', // Elite — gold
  S: '#ef4444', // Anomaly — red
};

export const GEAR_CLASS_NAMES = {
  E: 'SCRAP',
  D: 'INTEGRATED',
  C: 'ENHANCED',
  B: 'ADVANCED',
  A: 'ELITE',
  S: 'ANOMALY',
};

export const GEAR_CLASS_STAT_BUDGETS = {
  E: '2–3 pts', D: '4–5 pts', C: '6–8 pts',
  B: '9–11 pts', A: '12–15 pts', S: '16–20 pts',
};

/** @param {string} gearClass - 'E'|'D'|'C'|'B'|'A'|'S' */
export const getGearClassColor = (gearClass) => GEAR_CLASS_COLORS[gearClass] || '#6b7280';

// Backward-compat alias (old tier strings may still exist in boss drops)
const TIER_COLORS = { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#3b82f6', Epic: '#a855f7', Legendary: '#f59e0b' };
export const getTierColor = (tier) => TIER_COLORS[tier] || '#94a3b8';

const RANK_ORDER = ["E","D","C","B","A","S","SS","SSS"];
export function rankMeetsReq(currentRankId, reqRank) {
  if (!reqRank) return true;
  return RANK_ORDER.indexOf(currentRankId) >= RANK_ORDER.indexOf(reqRank);
}
