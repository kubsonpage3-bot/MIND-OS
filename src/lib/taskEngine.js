// ─── MIND OS · HABITICA TASK ENGINE ─────────────────────────────────────────
import { queueAutoSync } from '@/lib/cloudSync';

// ═══ 1. КОНСТАНТЫ ═══════════════════════════════════════════════════════════

export const TV_MIN = -47;
export const TV_MAX = 21;
export const TV_START = 0;

/** Базовый урон по HP при нейтральном value (difficulty multiplier применяется сверху) */
export const BASE_DAMAGE = { trivial: 10, easy: 10, medium: 10, hard: 10, critical: 10 };
export const BASE_XP     = { trivial: 5,  easy: 5,  medium: 5,  hard: 5,  critical: 5 };
export const BASE_GOLD   = { trivial: 5,  easy: 5,  medium: 5,  hard: 5,  critical: 5 };
export const DIFF_MULT   = { trivial: 0.5, easy: 1,  medium: 2,  hard: 3,  critical: 4 };

/** Цвет задачи по Task Value (красный → жёлтый → зелёный → синий) */
export function getTaskValueColor(value) {
  if (value >= 16)  return '#2196f3';
  if (value >= 8)   return '#4caf50';
  if (value >= 1)   return '#8bc34a';
  if (value >= -1)  return '#cddc39';
  if (value >= -10) return '#ff9800';
  if (value >= -20) return '#f44336';
  if (value >= -35) return '#b71c1c';
  return '#4a0000';
}

// ═══ 2. TASK VALUE — diminishing returns ═════════════════════════════════════

export function calcNewValue(current, event, type) {
  const step = 1 + Math.abs(current) * 0.1;
  const decay = 0.9747;
  let delta;
  if (event === 'complete') {
    delta = step * decay;
  } else {
    const failMult = type === 'daily' ? 1.5 : 1.0;
    delta = -step * failMult;
  }
  const range = event === 'complete' ? TV_MAX - current : current - TV_MIN;
  const squeeze = Math.max(0.1, Math.min(1, range / 15));
  return Math.max(TV_MIN, Math.min(TV_MAX, current + delta * squeeze));
}

// ═══ 3. УРОН — общая формула ═════════════════════════════════════════════════

export function calcDamage(taskValue, difficulty, conStat, checklistRatio) {
  if (difficulty === undefined) difficulty = 'medium';
  if (conStat === undefined) conStat = 5;
  if (checklistRatio === undefined) checklistRatio = 1;
  const base = BASE_DAMAGE[difficulty] !== undefined ? BASE_DAMAGE[difficulty] : 1;
  const diffMult = DIFF_MULT[difficulty] !== undefined ? DIFF_MULT[difficulty] : 1;
  const valueMult = taskValue < 0
    ? 1 + Math.abs(taskValue) / 15
    : Math.max(0.5, 1 - taskValue / 30);
  const conReduction = Math.min(0.55, (conStat - 1) * 0.035);
  const raw = base * diffMult * valueMult * checklistRatio;
  return Math.max(0.01, Math.round(raw * (1 - conReduction) * 100) / 100);
}

// ═══ 4. НАГРАДА ══════════════════════════════════════════════════════════════

export function calcReward(taskValue, difficulty, type, buffs) {
  if (difficulty === undefined) difficulty = 'medium';
  if (type === undefined) type = 'habit';
  if (buffs === undefined) buffs = {};
  const baseXP   = BASE_XP[difficulty]   !== undefined ? BASE_XP[difficulty]   : 10;
  const baseGold = BASE_GOLD[difficulty] !== undefined ? BASE_GOLD[difficulty] : 10;
  const diffMult = DIFF_MULT[difficulty] !== undefined ? DIFF_MULT[difficulty] : 1;
  let valueMod;
  if (taskValue < 0) {
    valueMod = 1 + Math.abs(taskValue) * 0.05;
  } else {
    const scale = type === 'todo' ? 0.06 : 0.04;
    valueMod = Math.max(0.1, 1 - taskValue * scale);
  }
  const lck = buffs.lckStat || 5;
  const critChance = lck / 100;
  const critBonus = Math.random() < critChance ? 0.5 : 0;
  const xp   = Math.round(baseXP   * diffMult * valueMod * (1 + (buffs.xpBonus   || 0)) * (1 + critBonus) * 10) / 10;
  const gold = Math.round(baseGold * diffMult * valueMod * (1 + (buffs.goldBonus || 0)) * (1 + critBonus));
  return { xp: Math.round(xp), gold: Math.round(gold), critBonus };
}

export function previewHabitDamage(taskValue, difficulty, conStat) {
  if (conStat === undefined) conStat = 5;
  const nextValue = calcNewValue(taskValue, 'fail', 'habit');
  return calcDamage(nextValue, difficulty, conStat);
}

// ═══ 5. DAILY CRON ═══════════════════════════════════════════════════════════

export function isNewDay(lastTickMs, nowMs, dayStartHour, tzOffsetMin) {
  if (nowMs === undefined) nowMs = Date.now();
  if (dayStartHour === undefined) dayStartHour = 0;
  if (tzOffsetMin === undefined) tzOffsetMin = 0;
  const offsetMs = tzOffsetMin * 60 * 1000;
  const startMs  = dayStartHour * 3600 * 1000;
  const prev = Math.floor((lastTickMs - offsetMs - startMs) / 86400000);
  const now  = Math.floor((nowMs     - offsetMs - startMs) / 86400000);
  return now > prev;
}

export function runDailyCron(dailies, gsSnap, nowMs, dayStartHour) {
  if (nowMs === undefined) nowMs = Date.now();
  if (dayStartHour === undefined) dayStartHour = 0;
  const log = [];
  let totalDmg = 0;
  const con = (gsSnap.stats && gsSnap.stats.def) ? gsSnap.stats.def : 5;
  const buffs = gsSnap.buffs || [];
  const ironFast = buffs.some(function(b) { return !b.isExpired && b.id === 'no_daily_dmg'; });
  const streakLock = buffs.some(function(b) { return !b.isExpired && b.id === 'streak_lock'; });
  let allDone = true;
  const updatedDailies = dailies.map(function(task) {
    const activeDays = task.activeDays;
    const todayStr = new Date(nowMs).toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase().slice(0, 3);
    const isActiveToday = !activeDays || activeDays.includes(todayStr);
    if (!isActiveToday) return Object.assign({}, task, { completedToday: false });
    if (task.completedToday) {
      const newValue = calcNewValue(task.rpgValue !== undefined ? task.rpgValue : 0, 'complete', 'daily');
      log.push({ type: 'daily_done', id: task.id, name: task.name });
      return Object.assign({}, task, { rpgValue: newValue, streak: (task.streak || 0) + 1, completedToday: false });
    } else {
      allDone = false;
      const tv = task.rpgValue !== undefined ? task.rpgValue : 0;
      const dmg = ironFast ? 0 : calcDamage(tv, task.difficulty || 'medium', con);
      totalDmg += dmg;
      const newValue = calcNewValue(tv, 'fail', 'daily');
      const newStreak = streakLock ? (task.streak || 0) : 0;
      log.push({ type: 'daily_missed', id: task.id, name: task.name, damage: dmg });
      return Object.assign({}, task, { rpgValue: newValue, streak: newStreak, completedToday: false });
    }
  });
  return { updatedDailies: updatedDailies, hpDelta: -totalDmg, allDone: allDone, log: log };
}

// ═══ 6. СМЕРТЬ ═══════════════════════════════════════════════════════════════

export function applyDeathPenalty(gs, rankThresholds) {
  if (rankThresholds === undefined) rankThresholds = {};
  const level = gs.level || 1;
  const newLevel = Math.max(1, level - 1);
  const newXP = rankThresholds[newLevel] || 0;
  const equippedEntries = Object.entries(gs.equipped || {}).filter(function(e) { return e[1]; });
  let lostItem = null;
  const newEquipped = Object.assign({}, gs.equipped || {});
  if (equippedEntries.length > 0) {
    const randIdx = Math.floor(Math.random() * equippedEntries.length);
    const lostSlot = equippedEntries[randIdx][0];
    lostItem = gs.equipped[lostSlot];
    newEquipped[lostSlot] = null;
  }
  return {
    updatedGs: Object.assign({}, gs, { hp: gs.maxHp, level: newLevel, xp: newXP, equipped: newEquipped }),
    lostItem: lostItem,
    log: lostItem ? 'lost ' + lostItem : 'no items lost',
  };
}

// ═══ 7. HP / GOLD / MANA HELPERS ═════════════════════════════════════════════

const GS_KEY = 'mindos_game_state';
const TASKS_KEY = 'mindos_tasks';
export const CRON_KEY = 'mindos_last_daily_cron';

function loadGS() { try { return JSON.parse(localStorage.getItem(GS_KEY) || '{}'); } catch { return {}; } }
function saveGS(gs) { try { localStorage.setItem(GS_KEY, JSON.stringify(gs)); queueAutoSync(); } catch {} }
function loadAllTasks() { try { return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]'); } catch { return []; } }
function saveAllTasks(t) { try { localStorage.setItem(TASKS_KEY, JSON.stringify(t)); queueAutoSync(); } catch {} }

export function applyHpDamage(dmg) {
  const gs = loadGS();
  gs.maxHp = gs.maxHp || 100;
  const curHp = gs.hp !== undefined ? gs.hp : gs.maxHp;
  const newHp = Math.max(0, curHp - dmg);
  if (newHp <= 0) {
    const result = applyDeathPenalty(gs);
    saveGS(result.updatedGs);
    return { newHp: result.updatedGs.maxHp, died: true, deathLog: result.log, lostItem: result.lostItem };
  }
  gs.hp = newHp;
  saveGS(gs);
  return { newHp: newHp, died: false };
}

export function applyHpHeal(amount) {
  const gs = loadGS();
  gs.maxHp = gs.maxHp || 100;
  gs.hp = Math.min(gs.maxHp, (gs.hp !== undefined ? gs.hp : gs.maxHp) + amount);
  saveGS(gs);
  return gs.hp;
}

export function getHpState() {
  const gs = loadGS();
  return { hp: gs.hp !== undefined ? gs.hp : (gs.maxHp || 100), maxHp: gs.maxHp || 100 };
}

export function getConStat() { const gs = loadGS(); return (gs.stats && gs.stats.def) ? gs.stats.def : 5; }
export function getLckStat() { const gs = loadGS(); return (gs.stats && gs.stats.lck) ? gs.stats.lck : 5; }

export function addGoldToGS(amount) {
  const gs = loadGS();
  gs.gold = Math.max(0, Math.round((gs.gold || 0) + amount));
  gs.totalGoldEarned = (gs.totalGoldEarned || 0) + amount;
  saveGS(gs);
}

export function addManaToGS(amount) {
  try {
    const cls = JSON.parse(localStorage.getItem('mindos_class') || '{}');
    if (!cls.chosen) return;
    cls.mana = Math.max(0, Math.min(cls.maxMana || 100, (cls.mana || 0) + amount));
    localStorage.setItem('mindos_class', JSON.stringify(cls));
    queueAutoSync();
  } catch {}
}

// ═══ 8. DAILY CRON RUNNER ════════════════════════════════════════════════════

export function checkAndRunDailyCron(dayStartHour) {
  if (dayStartHour === undefined) dayStartHour = 0;
  try {
    const nowMs = Date.now();
    const lastTick = parseInt(localStorage.getItem(CRON_KEY) || '0', 10);
    if (!isNewDay(lastTick, nowMs, dayStartHour)) return { fired: false, log: [], totalDmg: 0 };
    const allTasks = loadAllTasks();
    const dailies = allTasks.filter(function(t) { return t.type === 'daily'; });
    if (dailies.length === 0) {
      localStorage.setItem(CRON_KEY, String(nowMs));
      return { fired: true, log: [{ type: 'no_dailies' }], totalDmg: 0 };
    }
    const gs = loadGS();
    const cronResult = runDailyCron(dailies, gs, nowMs, dayStartHour);
    const otherTasks = allTasks.filter(function(t) { return t.type !== 'daily'; });
    saveAllTasks(otherTasks.concat(cronResult.updatedDailies));
    const totalDmg = Math.abs(cronResult.hpDelta);
    let died = false;
    if (totalDmg > 0) { const r = applyHpDamage(totalDmg); died = r.died; }
    localStorage.setItem(CRON_KEY, String(nowMs));
    return { fired: true, log: cronResult.log, totalDmg: totalDmg, died: died };
  } catch (e) {
    console.error('[taskEngine] cron error:', e);
    return { fired: false, log: [], totalDmg: 0 };
  }
}
