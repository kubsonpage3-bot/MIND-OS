/**
 * MUTATOR ENGINE — applies active mutator effects to game events.
 *
 * All functions read state from localStorage (mutators, game_state).
 * They return modified values and may write side-effects (gold deductions, etc.)
 * back to localStorage.
 *
 * MUTATOR IDs and their rules:
 *
 * AMPLIFIERS
 *  bloodwork      — science sessions (math/physics/coding) +20% Rank XP, other -5%
 *  monks_path     — prayer/meditation +40% Rank XP, streak gives +2 XP
 *  iron_routine   — exercise/running +25% Rank XP, miss daily → bonus lost 24h
 *  lexicon        — language sessions +20% Rank XP, +0.01 Gc per session (handled via pending gains)
 *  night_owl      — after 21:00 +30%, before 09:00 -10%
 *  early_riser    — before 09:00 +30%, after 21:00 -10%
 *  tunnel_vision  — only 1 subject/day +50%, 2+ subjects → bonus lost
 *
 * ECONOMY
 *  loan_shark     — +40% Gold from tasks, -30G per midnight
 *  compound       — every 100G owned generates +1G/day
 *  miser          — no spending on shop, +5 Rank XP per 24h without spending
 *  tithe          — each task pay 3G or lose 5HP, but +15% Rank XP
 *
 * STREAK
 *  ascetic_loop   — streak × 0.2 Rank XP per day; break: lose all bonus
 *  double_nothing — streak milestone rewards ×2; miss 2 days: streak resets
 *  momentum       — each day 1h+: +2% Rank XP stacks to +20%
 *
 * CHALLENGE
 *  diversity_lock — can't log same subject twice in a row, +20% Rank XP
 *  silence        — skills disabled 48h, after: all cooldowns → 0
 *  ironman        — HP→0 = forced prestige, +15% Rank XP forever
 *  glass_cannon   — Rank XP +25%, HP miss loss +60%
 *  zero_hour      — no Gold 7 days, then ×3 payout
 *
 * SYNERGY BUILDERS
 *  catalyst       — each other active mutator: +8% Rank XP
 *  echo           — last subject gives double metric gains next session (diff subject)
 *  mirror         — same domain as last session: +15% boss damage
 *  resonance      — 2+ mutators share category: +10% to all their effects
 *
 * WILD
 *  gambler        — 20% double rewards, 20% 0 rewards, 60% normal
 *  phantom_load   — yesterday's hours count as +30% today for Rank XP
 *  cursed_clock   — idle hour 8:00-22:00: -2G; but +1 Rank XP per logged hour
 *  deja_vu        — same subject 3 days in a row: 3rd session +50% Rank XP
 *  volatile       — 1st task +100%, last (5+ tasks) +50%, between -10%
 *  weight_of_history — lifetime hours/100 = bonus % Rank XP
 */

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getMutators() {
  try { return JSON.parse(localStorage.getItem("mindos_mutators") || "{}"); } catch { return {}; }
}

function getGameState() {
  try { return JSON.parse(localStorage.getItem("mindos_game_state") || "{}"); } catch { return {}; }
}

function saveGameState(gs) {
  localStorage.setItem("mindos_game_state", JSON.stringify(gs));
}

function getActiveMutatorIds() {
  const m = getMutators();
  return (m.active || []).map(a => a.id);
}

function isActive(id) {
  return getActiveMutatorIds().includes(id);
}

function getHour() {
  return new Date().getHours();
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

// Activity key → domain
const ACTIVITY_DOMAINS = {
  math: "science", physics: "science", coding: "science",
  english: "language", japanese: "language", latin: "language", vocabulary: "language",
  exercise: "body", running: "body", nutrition: "body", sleep: "body",
  prayer: "spirit", meditation: "spirit",
  reading: "humanities", philosophy: "humanities", history: "humanities",
};

function getDomain(activityKey) {
  return ACTIVITY_DOMAINS[activityKey] || "other";
}

// ─── STAT BONUSES ────────────────────────────────────────────────────────────

/**
 * Get all stat bonuses from character stats (base + points + class + equip)
 * Returns { pwr, def, foc, mem, spd, lck }
 */
import { CLASSES, MUTATORS } from "./rpgSystem";

export function getStatBonuses() {
  try {
    const gs = getGameState();
    const cls = JSON.parse(localStorage.getItem("mindos_class") || "{}");
    const classInfo = cls.chosen ? CLASSES[cls.chosen] : null;
    const classStats = classInfo?.stats || {};
    const equipped = gs.equipped || {};

    const stats = ["pwr", "def", "foc", "mem", "spd", "lck"];
    const result = {};
    stats.forEach(k => {
      const base = 5;
      const points = gs.stats?.[k] || 0;
      const classBon = classStats[k] || 0;
      let equipBon = 0;
      Object.values(equipped).forEach(item => { if (item?.stats?.[k]) equipBon += item.stats[k]; });
      result[k] = base + points + classBon + equipBon;
    });
    return result;
  } catch { return { pwr: 5, def: 5, foc: 5, mem: 5, spd: 5, lck: 5 }; }
}

/**
 * PWR: each point above 5 = +2% boss damage
 */
export function getPwrBossDamageMultiplier() {
  const stats = getStatBonuses();
  return 1 + Math.max(0, stats.pwr - 5) * 0.02;
}

/**
 * DEF: each point above 5 = -1% HP damage taken (already in TasksPanel, re-exported for consistency)
 */
export function getDefDamageReduction() {
  const stats = getStatBonuses();
  return Math.min(0.5, Math.max(0, stats.def - 5) * 0.01);
}

/**
 * LCK: each point above 5 = +2% gold earned
 */
export function getLckGoldMultiplier() {
  const stats = getStatBonuses();
  return 1 + Math.max(0, stats.lck - 5) * 0.02;
}

/**
 * SPD: each point above 10 = task completions generate +1 extra gold per task
 * (kept as bonus gold per task completion)
 */
export function getSpdGoldBonus() {
  const stats = getStatBonuses();
  return Math.max(0, stats.spd - 5) * 0.5; // +0.5G per SPD point above 5
}

// ─── SESSION MODIFIERS (Training Logger) ─────────────────────────────────────

/**
 * Apply mutator effects to a training session.
 * Returns { rankXPMultiplier, goldMultiplier, gcBonus, notes }
 *
 * @param {string} activityKey
 * @param {number} hours
 * @param {object} logs - recent activity logs array
 */
export function applySessionMutators(activityKey, hours, logs = []) {
  const active = getActiveMutatorIds();
  if (!active.length) return { rankXPMultiplier: 1, goldMultiplier: 1, gcBonus: 0, notes: [] };

  const domain = getDomain(activityKey);
  const hour = getHour();
  const today = getTodayStr();
  const notes = [];
  let rankXPMult = 1;
  let goldMult = 1;
  let gcBonus = 0;

  // IRONMAN: +15% Rank XP forever
  if (isActive("ironman")) {
    rankXPMult *= 1.15;
    notes.push("☠️ Ironman +15% RankXP");
  }

  // GLASS CANNON: +25% Rank XP
  if (isActive("glass_cannon")) {
    rankXPMult *= 1.25;
    notes.push("💥 Glass Cannon +25% RankXP");
  }

  // BLOODWORK: science +20%, others -5%
  if (isActive("bloodwork")) {
    if (domain === "science") { rankXPMult *= 1.2; notes.push("🔬 Bloodwork +20%"); }
    else { rankXPMult *= 0.95; }
  }

  // MONKS_PATH: spirit +40%
  if (isActive("monks_path")) {
    if (domain === "spirit") { rankXPMult *= 1.4; notes.push("🧘 Monk's Path +40%"); }
  }

  // IRON_ROUTINE: body +25%
  if (isActive("iron_routine")) {
    if (domain === "body") { rankXPMult *= 1.25; notes.push("💪 Iron Routine +25%"); }
  }

  // LEXICON: language +20%, +0.01 Gc
  if (isActive("lexicon")) {
    if (domain === "language") {
      rankXPMult *= 1.2;
      gcBonus += 0.01;
      notes.push("📚 Lexicon +20% +Gc");
    }
  }

  // NIGHT_OWL / EARLY_RISER
  if (isActive("night_owl")) {
    if (hour >= 21) { rankXPMult *= 1.3; notes.push("🌙 Night Owl +30%"); }
    else if (hour < 9) { rankXPMult *= 0.9; }
  }
  if (isActive("early_riser")) {
    if (hour < 9) { rankXPMult *= 1.3; notes.push("☀️ Early Riser +30%"); }
    else if (hour >= 21) { rankXPMult *= 0.9; }
  }

  // TUNNEL_VISION: check if only 1 unique subject logged today
  if (isActive("tunnel_vision")) {
    const todayLogs = logs.filter(l => l.log_date?.startsWith(today));
    const uniqueSubjects = new Set(todayLogs.map(l => l.activity));
    uniqueSubjects.add(activityKey);
    if (uniqueSubjects.size === 1) {
      rankXPMult *= 1.5;
      notes.push("🎯 Tunnel Vision +50%");
    }
  }

  // DIVERSITY_LOCK: can't log same as last session, but +20% if followed
  if (isActive("diversity_lock")) {
    const lastLog = logs[0];
    if (lastLog && lastLog.activity === activityKey) {
      // penalty: -30% for repeating
      rankXPMult *= 0.7;
      notes.push("⚠️ Diversity Lock penalty");
    } else {
      rankXPMult *= 1.2;
      notes.push("🎨 Diversity Lock +20%");
    }
  }

  // DEJA_VU: same subject 3 days in a row → 3rd session +50%
  if (isActive("deja_vu")) {
    const recentDays = [];
    const dayMap = {};
    logs.forEach(l => {
      const d = l.log_date?.split("T")[0];
      if (d && l.activity === activityKey) dayMap[d] = true;
    });
    const days = Object.keys(dayMap).sort().reverse();
    if (days.length >= 2) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
      if (days[0] === yesterday && days[1] === dayBefore) {
        rankXPMult *= 1.5;
        notes.push("🔄 Déjà Vu +50%");
      }
    }
  }

  // MOMENTUM: count consecutive days with 1h+ logged
  if (isActive("momentum")) {
    let consecutiveDays = 0;
    for (let i = 1; i <= 10; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
      const dayHours = logs.filter(l => l.log_date?.startsWith(d)).reduce((s, l) => s + (l.hours || 0), 0);
      if (dayHours >= 1) consecutiveDays++;
      else break;
    }
    const bonus = Math.min(0.20, consecutiveDays * 0.02);
    if (bonus > 0) { rankXPMult *= (1 + bonus); notes.push(`⚡ Momentum +${Math.round(bonus*100)}%`); }
  }

  // PHANTOM_LOAD: yesterday's hours add 30% to rank XP multiplier
  if (isActive("phantom_load")) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const yesterdayHours = logs.filter(l => l.log_date?.startsWith(yesterday)).reduce((s, l) => s + (l.hours || 0), 0);
    if (yesterdayHours > 0) {
      const bonus = yesterdayHours * 0.3 / Math.max(hours, 0.5);
      rankXPMult *= (1 + Math.min(0.5, bonus));
      notes.push(`👻 Phantom Load +${Math.round(Math.min(50, bonus*100))}%`);
    }
  }

  // WEIGHT_OF_HISTORY: lifetime hours / 100 = bonus % Rank XP
  if (isActive("weight_of_history")) {
    const totalHours = logs.reduce((s, l) => s + (l.hours || 0), 0);
    const bonus = Math.min(0.20, totalHours / 100 * 0.01);
    if (bonus > 0) { rankXPMult *= (1 + bonus); notes.push(`📜 History +${Math.round(bonus*100)}%`); }
  }

  // CATALYST: each other active mutator +8%
  if (isActive("catalyst")) {
    const otherCount = active.filter(id => id !== "catalyst").length;
    if (otherCount > 0) { rankXPMult *= (1 + otherCount * 0.08); notes.push(`⚗️ Catalyst +${otherCount * 8}%`); }
  }

  // RESONANCE: 2+ mutators share a category → +10%
  if (isActive("resonance")) {
    const catCounts = {};
    active.forEach(id => {
      const m = MUTATORS.find(x => x.id === id);
      if (m) catCounts[m.cat] = (catCounts[m.cat] || 0) + 1;
    });
    const hasResonance = Object.values(catCounts).some(c => c >= 2);
    if (hasResonance) { rankXPMult *= 1.1; notes.push("🔔 Resonance +10%"); }
  }

  // TITHE: +15% Rank XP, but -3G per task (handled in task flow; here just the xp bonus)
  if (isActive("tithe")) {
    rankXPMult *= 1.15;
    notes.push("⛪ Tithe +15% RankXP");
  }

  // CURSED_CLOCK: +1 Rank XP per logged hour (flat, added later via hours param)
  // Returned as a flat bonus, not a multiplier — handled in Dashboard
  const cursedClockFlatXP = isActive("cursed_clock") ? hours : 0;

  // LOAN_SHARK: +40% gold from sessions
  if (isActive("loan_shark")) {
    goldMult *= 1.4;
    notes.push("🦈 Loan Shark +40% Gold");
  }

  // LCK stat bonus to gold
  goldMult *= getLckGoldMultiplier();

  // GAMBLER: 20% double, 20% zero, 60% normal
  let gamblerMult = 1;
  if (isActive("gambler")) {
    const r = Math.random();
    if (r < 0.2) { gamblerMult = 2; notes.push("🎲 GAMBLER: DOUBLE!"); }
    else if (r < 0.4) { gamblerMult = 0; notes.push("🎲 GAMBLER: NOTHING"); }
    else notes.push("🎲 Gambler: normal");
    rankXPMult *= gamblerMult;
    goldMult *= gamblerMult;
  }

  return {
    rankXPMultiplier: Math.max(0, rankXPMult),
    goldMultiplier: Math.max(0, goldMult),
    gcBonus,
    cursedClockFlatXP,
    notes,
  };
}

// ─── TASK MODIFIERS (Tasks/Habits/Dailies/Todos) ──────────────────────────────

/**
 * Apply mutator effects to a task completion.
 * Returns { rankXPMultiplier, goldMultiplier, hpDamageBonus, notes }
 *
 * @param {string} taskType - "habit" | "daily" | "todo"
 * @param {number} taskIndex - how many tasks completed today (for volatile)
 * @param {number} totalTasksToday - total for volatile
 */
export function applyTaskMutators(taskType, taskIndex = 0, totalTasksToday = 0) {
  const active = getActiveMutatorIds();
  if (!active.length) {
    const goldMult = getLckGoldMultiplier();
    return { rankXPMultiplier: 1, goldMultiplier: goldMult, hpDamageBonus: 1, notes: [] };
  }

  const notes = [];
  let rankXPMult = 1;
  let goldMult = getLckGoldMultiplier();
  let hpDamageBonus = 1;

  // IRONMAN: +15% Rank XP
  if (isActive("ironman")) rankXPMult *= 1.15;

  // GLASS_CANNON: Rank XP +25%, HP damage on miss +60%
  if (isActive("glass_cannon")) {
    rankXPMult *= 1.25;
    hpDamageBonus *= 1.6;
    notes.push("💥 Glass Cannon");
  }

  // TITHE: +15% Rank XP (cost handled separately in TasksPanel)
  if (isActive("tithe")) {
    rankXPMult *= 1.15;
    notes.push("⛪ Tithe +15%");
  }

  // LOAN_SHARK: +40% gold
  if (isActive("loan_shark")) {
    goldMult *= 1.4;
    notes.push("🦈 +40% Gold");
  }

  // SPD stat: bonus gold per task
  goldMult += getSpdGoldBonus() / 10; // small bonus, scaled

  // VOLATILE: 1st task +100%, last task (5+) +50%, between -10%
  if (isActive("volatile")) {
    if (taskIndex === 0) {
      rankXPMult *= 2.0;
      goldMult *= 2.0;
      notes.push("⚔️ Volatile: FIRST +100%");
    } else if (totalTasksToday >= 5 && taskIndex >= totalTasksToday - 1) {
      rankXPMult *= 1.5;
      goldMult *= 1.5;
      notes.push("⚔️ Volatile: LAST +50%");
    } else {
      rankXPMult *= 0.9;
      goldMult *= 0.9;
    }
  }

  // GAMBLER: 20% double, 20% zero, 60% normal
  if (isActive("gambler")) {
    const r = Math.random();
    if (r < 0.2) {
      rankXPMult *= 2; goldMult *= 2; notes.push("🎲 DOUBLE!");
    } else if (r < 0.4) {
      rankXPMult = 0; goldMult = 0; notes.push("🎲 NOTHING");
    }
  }

  // CATALYST: each other active mutator +8%
  if (isActive("catalyst")) {
    const otherCount = active.filter(id => id !== "catalyst").length;
    if (otherCount > 0) rankXPMult *= (1 + otherCount * 0.08);
  }

  return {
    rankXPMultiplier: Math.max(0, rankXPMult),
    goldMultiplier: Math.max(0, goldMult),
    hpDamageBonus,
    notes,
  };
}

// ─── BOSS DAMAGE MODIFIER ────────────────────────────────────────────────────

/**
 * Apply PWR stat + mutator effects to boss damage.
 */
export function applyBossDamageModifiers(baseDamage) {
  let mult = getPwrBossDamageMultiplier();

  // MIRROR: same domain as last session +15% boss damage
  if (isActive("mirror")) {
    mult *= 1.15;
  }

  // ECHO synergy (handled via session)
  return Math.round(baseDamage * mult);
}

// ─── DAILY ECONOMY TICK (call once per day) ──────────────────────────────────

/**
 * Run daily economy mutator effects.
 * Call this when the app loads and the day has changed.
 */
export function runDailyMutatorTick(lastTickDate) {
  const today = getTodayStr();
  if (lastTickDate === today) return false; // already ran today

  const active = getActiveMutatorIds();
  if (!active.length) return true;

  const gs = getGameState();
  let gold = gs.gold || 0;
  const notes = [];

  // LOAN_SHARK: -30G per midnight
  if (isActive("loan_shark")) {
    gold = Math.max(0, gold - 30);
    notes.push("🦈 Loan Shark: -30G");
  }

  // COMPOUND: every 100G owned generates +1G/day
  if (isActive("compound")) {
    const bonus = Math.floor(gold / 100);
    gold += bonus;
    if (bonus > 0) notes.push(`🏦 Compound: +${bonus}G`);
  }

  // MISER: +5 Rank XP for not spending (tracked separately via tithe-miser flag)
  // CURSED_CLOCK: -2G per idle hour 8:00-22:00 (14 hours = -28G if idle all day)
  if (isActive("cursed_clock")) {
    // Approximate: if no session logged today, 14 idle hours = -28G
    // Since we can't track in real-time easily, deduct a flat amount
    gold = Math.max(0, gold - 28);
    notes.push("⏰ Cursed Clock: -28G (idle)");
  }

  gs.gold = gold;
  saveGameState(gs);
  return true;
}

// ─── MISER: bonus Rank XP per 24h without spending ───────────────────────────

export function getMiserDailyRankXP() {
  if (!isActive("miser")) return 0;
  // Check last spending date
  try {
    const gs = getGameState();
    const lastSpend = gs.lastSpendDate;
    const today = getTodayStr();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (!lastSpend || lastSpend <= yesterday) return 5;
  } catch {}
  return 0;
}

// ─── TITHE: deduct 3G or deal 5HP damage per task ────────────────────────────

export function applyTithe() {
  if (!isActive("tithe")) return { deducted: 0, hpLost: 0 };
  const gs = getGameState();
  if ((gs.gold || 0) >= 3) {
    gs.gold = (gs.gold || 0) - 3;
    saveGameState(gs);
    return { deducted: 3, hpLost: 0 };
  } else {
    gs.hp = Math.max(0, (gs.hp !== undefined ? gs.hp : 100) - 5);
    saveGameState(gs);
    return { deducted: 0, hpLost: 5 };
  }
}

// ─── ASCETIC LOOP: streak-based daily Rank XP ────────────────────────────────

export function getAsceticLoopBonus(streakCount) {
  if (!isActive("ascetic_loop")) return 0;
  return streakCount * 0.2;
}