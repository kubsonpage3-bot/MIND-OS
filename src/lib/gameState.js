// Global game state for RPG features — persisted to localStorage

const KEY = "mindos_game_state";

export const DEFAULT_GAME_STATE = {
  gold: 0,
  hp: 100,
  maxHp: 100,
  statPoints: 0,
  stats: { pwr: 5, def: 5, foc: 5, mem: 5, spd: 5, lck: 5 },
  equipped: {}, // slot -> item
  inventory: [],
  bossIndex: 0,
  bossHP: null, // null = use boss max
  tasks: [], // habits, dailies, todos
  consumables: {}, // active consumable effects
  // ─── RPG Engine fields ───────────────────────────────────────────────────
  buffs: [],          // активные баффы [ createBuff(...) ]
  streak: 0,          // дней подряд без пропусков дейликов
  lastDailyTickMs: 0, // timestamp последнего суточного тика
};

export function loadGameState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_GAME_STATE };
    return { ...DEFAULT_GAME_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GAME_STATE };
  }
}

export function saveGameState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export const BOSSES = [
  {
    id: "void",
    name: "THE VOID",
    maxHP: 500,
    lore: "The absence of thought given form.",
    attack: "Mental Fog",
    attackEffect: "missed daily = −5 weekly XP",
    requiredRank: "F",
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



const TIER_COLORS = { Common: "#94a3b8", Uncommon: "#22c55e", Rare: "#3b82f6", Epic: "#a855f7", Legendary: "#f59e0b" };
export const getTierColor = (tier) => TIER_COLORS[tier] || "#94a3b8";

const RANK_ORDER = ["F","D","C","B","A","S","SS","SSS"];
export function rankMeetsReq(currentRankId, reqRank) {
  if (!reqRank) return true;
  return RANK_ORDER.indexOf(currentRankId) >= RANK_ORDER.indexOf(reqRank);
}

// ─── RPG Engine buff helpers (работают через loadGameState/saveGameState) ────

/**
 * Добавить бафф в gameState.buffs.
 * @param {object} buff - объект баффа из createBuff()
 */
export function addBuffToState(buff) {
  try {
    const gs = loadGameState();
    gs.buffs = [...(gs.buffs || []), buff];
    saveGameState(gs);
  } catch {}
}

/**
 * Получить активные баффы (без просроченных).
 * @returns {object[]}
 */
export function getActiveBuffs() {
  try {
    const gs = loadGameState();
    const now = Date.now();
    return (gs.buffs || []).filter(b =>
      !b.isExpired && (b.expiresAt === null || now < b.expiresAt)
    );
  } catch { return []; }
}

/**
 * Удалить все просроченные баффы из gameState.
 */
export function pruneExpiredBuffs() {
  try {
    const gs = loadGameState();
    const now = Date.now();
    gs.buffs = (gs.buffs || []).filter(b =>
      !b.isExpired && (b.expiresAt === null || now < b.expiresAt)
    );
    saveGameState(gs);
  } catch {}
}