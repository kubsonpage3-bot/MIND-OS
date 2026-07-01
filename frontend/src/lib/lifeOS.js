// LIFE OS - Data engine (localStorage-based)

const STORAGE_KEY = "lifeos_v1";

export const CLASSES = ["Warrior", "Mage", "Healer", "Rogue"];
export const CLASS_ICONS = { Warrior: "⚔️", Mage: "🔮", Healer: "💚", Rogue: "🗡️" };
export const CLASS_BONUSES = {
  Warrior: { str: 3, con: 2 },
  Mage:    { int: 3, per: 1 },
  Healer:  { con: 3, int: 1 },
  Rogue:   { per: 3, str: 1 },
};

export const DIFFICULTIES = [
  { id: "trivial", label: "Trivial", xp: 5,   gold: 1  },
  { id: "easy",    label: "Easy",    xp: 10,  gold: 3  },
  { id: "medium",  label: "Medium",  xp: 15,  gold: 5  },
  { id: "hard",    label: "Hard",    xp: 25,  gold: 10 },
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const XP_FOR_LEVEL = (lvl) => lvl * 150;

export function defaultState() {
  return {
    initialized: false,
    name: "Hero",
    avatar: "🧙",
    charClass: null,
    level: 1,
    xp: 0,
    hp: 50,
    maxHp: 50,
    gold: 0,
    statPoints: 0,
    stats: { str: 1, int: 1, con: 1, per: 1 },
    equipment: { weapon: null, armor: null, helmet: null },
    inventory: [],
    habits: [],
    dailies: [],
    todos: [],
    rewards: [
      { id: "potion", label: "Health Potion", cost: 25, icon: "🧪", builtIn: true },
      { id: "skip",   label: "Skip a Daily",  cost: 40, icon: "🛡️", builtIn: true },
    ],
    lastDailyReset: null,
    perfectDayStreak: 0,
    logs: [],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch { return defaultState(); }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function gainXP(state, amount) {
  const intBonus = 1 + state.stats.int * 0.02;
  let xp = state.xp + Math.round(amount * intBonus);
  let level = state.level;
  let hp = state.hp;
  let maxHp = state.maxHp;
  let statPoints = state.statPoints;
  let logs = [...state.logs];

  while (xp >= XP_FOR_LEVEL(level)) {
    xp -= XP_FOR_LEVEL(level);
    level++;
    hp = Math.min(maxHp + 5, hp + 20);
    maxHp += 5;
    statPoints++;
    logs = [{ type: "levelup", msg: `Level Up! Now level ${level}!`, ts: Date.now() }, ...logs].slice(0, 50);
  }
  return { ...state, xp, level, hp, maxHp, statPoints, logs };
}

export function gainGold(state, amount) {
  const strBonus = 1 + state.stats.str * 0.02;
  return { ...state, gold: Math.round((state.gold || 0) + amount * strBonus) };
}

export function loseHP(state, amount) {
  const conBonus = 1 - Math.min(0.5, state.stats.con * 0.02);
  const dmg = Math.max(1, Math.round(amount * conBonus));
  const hp = state.hp - dmg;
  let logs = [...state.logs];
  if (hp <= 0) {
    logs = [{ type: "death", msg: "HP hit 0! Lost a level.", ts: Date.now() }, ...logs].slice(0, 50);
    return {
      ...state,
      hp: state.maxHp,
      level: Math.max(1, state.level - 1),
      xp: 0,
      logs,
    };
  }
  return { ...state, hp, logs };
}

export function getXPPercent(state) {
  return Math.min(100, (state.xp / XP_FOR_LEVEL(state.level)) * 100);
}

export function getHPPercent(state) {
  return Math.min(100, (state.hp / state.maxHp) * 100);
}

export function getDifficulty(id) {
  return DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[1];
}

// Habit color based on streak (blue=high → red=low)
export function getHabitColor(positiveStreak, negativeStreak) {
  const net = positiveStreak - negativeStreak;
  if (net >= 5)  return "#3b82f6";
  if (net >= 2)  return "#22c55e";
  if (net >= 0)  return "#eab308";
  if (net >= -3) return "#f97316";
  return "#ef4444";
}

export function getTodayKey() {
  return new Date().toDateString();
}

export function getTodayDayName() {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
}

export function isDailyDueToday(daily) {
  if (!daily.activeDays || daily.activeDays.length === 0) return true;
  return daily.activeDays.includes(getTodayDayName());
}

export function checkMidnightReset(state) {
  const today = getTodayKey();
  if (state.lastDailyReset === today) return state;

  let newState = { ...state, lastDailyReset: today };

  // Apply damage for missed dailies
  const dueDailies = state.dailies.filter(d => isDailyDueToday(d) && !d.completedToday);
  dueDailies.forEach(d => {
    const diff = getDifficulty(d.difficulty);
    newState = loseHP(newState, diff.xp * 0.3);
  });

  // Check perfect day
  const allDone = state.dailies.filter(d => isDailyDueToday(d)).every(d => d.completedToday);
  if (allDone && state.dailies.length > 0) {
    newState = gainXP(newState, 30);
    newState = gainGold(newState, 15);
    newState = {
      ...newState,
      perfectDayStreak: (newState.perfectDayStreak || 0) + 1,
      logs: [{ type: "perfect", msg: "Perfect Day! Bonus XP + Gold!", ts: Date.now() }, ...newState.logs].slice(0, 50),
    };
  }

  // Reset dailies completedToday
  newState.dailies = newState.dailies.map(d => ({ ...d, completedToday: false }));

  return newState;
}

// Random item drop from task completion
const ITEMS = [
  { id: "sword1",   label: "Iron Sword",    slot: "weapon", icon: "⚔️",  str: 2 },
  { id: "staff1",   label: "Oak Staff",     slot: "weapon", icon: "🪄",  int: 2 },
  { id: "armor1",   label: "Leather Armor", slot: "armor",  icon: "🛡️",  con: 2 },
  { id: "helm1",    label: "Iron Helm",     slot: "helmet", icon: "⛑️",  per: 1 },
  { id: "dagger1",  label: "Shadow Dagger", slot: "weapon", icon: "🗡️",  per: 2 },
  { id: "robe1",    label: "Mage Robe",     slot: "armor",  icon: "🥋",  int: 2 },
];

export function maybeDropItem(state) {
  const chance = 0.05 + state.stats.per * 0.01;
  if (Math.random() > chance) return state;
  const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  const alreadyHas = state.inventory.some(i => i.id === item.id);
  if (alreadyHas) return state;
  return {
    ...state,
    inventory: [...state.inventory, item],
    logs: [{ type: "drop", msg: `Item dropped: ${item.icon} ${item.label}!`, ts: Date.now() }, ...state.logs].slice(0, 50),
  };
}

export function equipItem(state, item) {
  const newEquip = { ...state.equipment, [item.slot]: item };
  // Recalculate stat bonuses from all equipped items
  const baseStats = { str: 1, int: 1, con: 1, per: 1 };
  Object.values(newEquip).filter(Boolean).forEach(eq => {
    ["str", "int", "con", "per"].forEach(s => { if (eq[s]) baseStats[s] += eq[s]; });
  });
  return { ...state, equipment: newEquip };
}