// ─── MIND OS · CORE RPG ENGINE ──────────────────────────────────────────────
// Изолированный движок геймификации по аналогии с Habitica.
// Все функции — чистые (Pure Functions), никаких зависимостей от UI.
// Автор: Antigravity | Версия: 1.0.0
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// 1. ДИНАМИЧЕСКАЯ ЦЕННОСТЬ ЗАДАЧИ (Task Value & Color System)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Диапазоны ценности задачи (аналог Habitica).
 * value > 0  → задача "зеленеет" (привычная, маленькая награда)
 * value < 0  → задача "краснеет" (провальная, большой урон, большая награда)
 */
export const TASK_VALUE_LIMITS = { min: -20, max: 20 };

/**
 * Цвет задачи по текущему значению ценности.
 * @param {number} value — текущая ценность задачи (-20…+20)
 * @returns {string} HEX-цвет
 */
export function getTaskColor(value) {
  if (value >= 15)  return "#1fd01f"; // ярко-зелёный: очень привычная
  if (value >= 8)   return "#4bc461"; // зелёный
  if (value >= 3)   return "#84cc16"; // жёлто-зелёный
  if (value >= -1)  return "#f59e0b"; // янтарный: нейтральная
  if (value >= -5)  return "#f97316"; // оранжевый: небольшой провал
  if (value >= -12) return "#ef4444"; // красный: серьёзный провал
  return "#991b1b";                   // тёмно-красный: критический провал
}

/**
 * Рассчитать изменение ценности задачи после события.
 *
 * При выполнении: value снижается (задача становится привычной, награда падает).
 * При провале:   value растёт в отрицательную сторону (задача "краснеет",
 *                урон по HP увеличивается, но будущая награда тоже).
 *
 * @param {number}  currentValue - текущее значение задачи (-20…+20)
 * @param {"complete"|"fail"} event - тип события
 * @param {"habit"|"daily"|"todo"} taskType - тип задачи
 * @returns {number} новое значение value (зажато в пределах TASK_VALUE_LIMITS)
 */
export function calcNewTaskValue(currentValue, event, taskType) {
  // Базовые дельты (Habitica-подобные формулы с затуханием)
  const decay = 0.9747; // коэффициент затухания при повторении

  let delta;
  if (event === "complete") {
    // Каждое выполнение снижает ценность (монотонное уменьшение награды)
    // Чем ниже текущий value, тем меньше он падает (плавное дно)
    delta = -(1 + Math.abs(currentValue) * 0.1) * decay;
  } else {
    // fail: ценность растёт в минусовую сторону
    const multiplier = taskType === "daily" ? 1.5 : 1.0;
    delta = +(1 + Math.abs(currentValue) * 0.1) * multiplier;
  }

  const newValue = currentValue + delta;
  return Math.max(TASK_VALUE_LIMITS.min, Math.min(TASK_VALUE_LIMITS.max, newValue));
}

/**
 * Рассчитать итоговую награду (XP и Gold) за выполнение задачи.
 *
 * Красные задачи (value < 0) дают БОЛЬШЕ XP/Gold — риск оправдывается.
 * Зелёные задачи (value > 0) дают МЕНЬШЕ — привычное не награждается щедро.
 *
 * @param {number}  taskValue - текущая ценность задачи (-20…+20)
 * @param {"habit"|"daily"|"todo"} taskType
 * @param {object}  [buffs={}] - активные баффы персонажа (напр. { xpBonus: 0.5 })
 * @returns {{ xp: number, gold: number }}
 */
export function calcTaskReward(taskValue, taskType, buffs = {}) {
  const BASE = {
    habit: { xp: 1.0,  gold: 0.5  },
    daily: { xp: 1.5,  gold: 1.0  },
    todo:  { xp: 2.0,  gold: 1.5  },
  };
  const base = BASE[taskType] || BASE.habit;

  let modifier;
  if (taskValue < 0) {
    modifier = 1 + Math.abs(taskValue) * 0.07; // до +140% при value=-20
  } else {
    modifier = Math.max(0.3, 1 - taskValue * 0.04); // минимум 30% базы
  }

  const xpBonus = buffs.xpBonus || 0;
  const goldBonus = buffs.goldBonus || 0;

  return {
    xp:   Math.round(base.xp   * modifier * (1 + xpBonus)   * 10) / 10,
    gold: Math.round(base.gold * modifier * (1 + goldBonus)  * 10) / 10,
  };
}

/**
 * Рассчитать урон по HP персонажа при провале дейлика.
 *
 * @param {number}  taskValue - ценность задачи (чем краснее — тем больше урон)
 * @param {number}  [defStat=5] - статистика защиты персонажа (1-15)
 * @returns {number} урон (> 0)
 */
export function calcFailDamage(taskValue, defStat = 5) {
  const baseDmg = 1 + Math.abs(Math.min(0, taskValue)) * 0.2;
  const defReduction = Math.min(0.5, (defStat - 1) * 0.035);
  return Math.max(0.1, Math.round(baseDmg * (1 - defReduction) * 10) / 10);
}


// ══════════════════════════════════════════════════════════════════════════════
// 2. КОНВЕЙЕР БАФФОВ И ДЕБАФФОВ (Buff/Debuff Pipeline)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Типы баффов с описанием эффектов.
 */
export const BUFF_TYPES = {
  xp_boost:      { id: "xp_boost",      name: "XP BOOST",       icon: "⚡", desc: "Бонусный XP за все задачи" },
  gold_rush:     { id: "gold_rush",      name: "GOLD RUSH",      icon: "💰", desc: "Бонусное золото за все задачи" },
  double_xp:     { id: "double_xp",     name: "DOUBLE XP",      icon: "x2", desc: "x2 XP в течение сессии" },
  iron_shield:   { id: "iron_shield",   name: "IRON SHIELD",    icon: "🛡", desc: "Снижение урона от провалов" },
  no_daily_dmg:  { id: "no_daily_dmg",  name: "IRON FAST",      icon: "⛩", desc: "Нет урона от пропущенных дейликов" },
  mana_regen:    { id: "mana_regen",    name: "MANA REGEN",     icon: "🔵", desc: "Регенерация маны" },
  streak_lock:   { id: "streak_lock",   name: "TRANSCENDENCE",  icon: "🔒", desc: "Стрик не ломается" },
  cognitive_amp: { id: "cognitive_amp", name: "COGNITIVE AMP",  icon: "🧠", desc: "Усиление прироста когнитивных метрик" },
};

/**
 * Создать новый бафф.
 *
 * @param {string}  buffId       - ID из BUFF_TYPES
 * @param {object}  effects      - числовые эффекты { xpBonus, goldBonus, defBonus, ... }
 * @param {number}  durationMs   - длительность в миллисекундах (0 = постоянный)
 * @param {string}  [sourceSkill] - ID скилла, который создал бафф
 * @returns {object} объект баффа
 */
export function createBuff(buffId, effects, durationMs, sourceSkill = null) {
  return {
    id: buffId,
    type: BUFF_TYPES[buffId] || { id: buffId, name: buffId, icon: "✨" },
    effects,
    durationMs,
    appliedAt: Date.now(),
    expiresAt: durationMs > 0 ? Date.now() + durationMs : null,
    sourceSkill,
    isExpired: false,
  };
}

/**
 * Применить список активных баффов к персонажу и вернуть суммарные эффекты.
 *
 * @param {object[]} buffs - массив объектов баффов
 * @param {number}   nowMs - текущее время (Date.now())
 * @returns {{ activeBuffs: object[], combinedEffects: object }} результат
 */
export function applyBuffPipeline(buffs, nowMs = Date.now()) {
  const activeBuffs = buffs.filter(b =>
    !b.isExpired && (b.expiresAt === null || nowMs < b.expiresAt)
  );

  const combinedEffects = activeBuffs.reduce((acc, buff) => {
    const fx = buff.effects || {};
    return {
      xpBonus:        (acc.xpBonus       || 0) + (fx.xpBonus       || 0),
      goldBonus:      (acc.goldBonus     || 0) + (fx.goldBonus     || 0),
      defBonus:       (acc.defBonus      || 0) + (fx.defBonus      || 0),
      manaRegenRate:  (acc.manaRegenRate || 0) + (fx.manaRegenRate || 0),
      cognitiveAmp:   (acc.cognitiveAmp  || 0) + (fx.cognitiveAmp  || 0),
      noFailDmg:      acc.noFailDmg || fx.noFailDmg || false,
      streakLock:     acc.streakLock || fx.streakLock || false,
      doubleXP:       acc.doubleXP  || fx.doubleXP  || false,
    };
  }, {});

  if (combinedEffects.doubleXP) {
    combinedEffects.xpBonus = (combinedEffects.xpBonus || 0) + 1.0;
  }

  return { activeBuffs, combinedEffects };
}

/**
 * Просрочить истёкшие баффы — вернуть массив с обновлённым полем isExpired.
 *
 * @param {object[]} buffs
 * @param {number}   nowMs
 * @returns {object[]} обновлённый массив баффов
 */
export function tickBuffExpiry(buffs, nowMs = Date.now()) {
  return buffs.map(b => ({
    ...b,
    isExpired: b.isExpired || (b.expiresAt !== null && nowMs >= b.expiresAt),
  }));
}


// ══════════════════════════════════════════════════════════════════════════════
// 3. СУТОЧНЫЙ ТИК (Daily Tick)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Определить, наступили ли новые сутки с учётом кастомного часа начала дня.
 *
 * @param {number} lastCheckedMs     - timestamp последней проверки (ms)
 * @param {number} nowMs             - текущий timestamp (ms)
 * @param {number} [timezoneOffset=0] - смещение часового пояса в минутах
 * @param {number} [customDayStartHour=0] - час начала нового дня (0-23, напр. 4 = 04:00)
 * @returns {boolean}
 */
export function isNewDay(lastCheckedMs, nowMs, timezoneOffset = 0, customDayStartHour = 0) {
  const offsetMs = (timezoneOffset * 60 * 1000);
  const dayStartOffsetMs = customDayStartHour * 3600 * 1000;

  const lastDay = Math.floor((lastCheckedMs - offsetMs - dayStartOffsetMs) / (86400 * 1000));
  const nowDay  = Math.floor((nowMs        - offsetMs - dayStartOffsetMs) / (86400 * 1000));

  return nowDay > lastDay;
}

/**
 * Суточный тик: рассчитать урон от пропущенных дейликов,
 * обновить стрик, зафиксировать новый lastChecked.
 *
 * @param {object}   charState - текущее состояние персонажа (Character State)
 * @param {object[]} dailies   - массив объектов дейликов { id, value, completed }
 * @param {number}   nowMs     - текущий timestamp
 * @param {number}   [timezoneOffset=0]
 * @param {number}   [customDayStartHour=0]
 * @returns {{ updatedState: object, log: object[] }}
 */
export function runDailyTick(charState, dailies, nowMs, timezoneOffset = 0, customDayStartHour = 0) {
  const log = [];

  if (!isNewDay(charState.lastCheckedMs || nowMs - 1, nowMs, timezoneOffset, customDayStartHour)) {
    return { updatedState: charState, log: [{ type: "no_new_day" }] };
  }

  const { combinedEffects } = applyBuffPipeline(charState.buffs || [], nowMs);

  // ─── Урон за невыполненные дейлики ───────────────────────────────────────
  let totalDamage = 0;
  const missedDailies = dailies.filter(d => !d.completed);

  if (!combinedEffects.noFailDmg) {
    for (const daily of missedDailies) {
      const dmg = calcFailDamage(daily.value || 0, charState.stats?.def || 5);
      totalDamage += dmg;
      log.push({ type: "daily_missed", taskId: daily.id, damage: dmg });
    }
  } else {
    log.push({ type: "daily_damage_blocked_by_buff" });
  }

  // ─── Обновление стрика ───────────────────────────────────────────────────
  const hasMissedAny = missedDailies.length > 0;
  let newStreak = charState.streak || 0;

  if (!hasMissedAny) {
    newStreak += 1;
    log.push({ type: "streak_increment", newStreak });
  } else if (!combinedEffects.streakLock) {
    newStreak = 0;
    log.push({ type: "streak_broken" });
  } else {
    log.push({ type: "streak_locked_by_buff", streak: newStreak });
  }

  const newHP = Math.max(0, Math.min(charState.maxHp, (charState.hp || charState.maxHp) - totalDamage));
  const updatedBuffs = tickBuffExpiry(charState.buffs || [], nowMs);

  const updatedState = {
    ...charState,
    hp: newHP,
    streak: newStreak,
    buffs: updatedBuffs,
    lastCheckedMs: nowMs,
  };

  return { updatedState, log };
}


// ══════════════════════════════════════════════════════════════════════════════
// 4. СТРУКТУРА СОСТОЯНИЯ ПЕРСОНАЖА (Character State Shape)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Создать начальное состояние персонажа (Character State).
 *
 * @param {object} [overrides={}] - переопределение начальных значений
 * @returns {object} Character State
 *
 * @example
 * const hero = createCharacterState({ name: "Architect", chosenClass: "architect" });
 */
export function createCharacterState(overrides = {}) {
  return {
    // ─── Идентификация ─────────────────────────────────────────────────────
    id:            overrides.id            || `char_${Date.now()}`,
    name:          overrides.name          || "Hero",
    chosenClass:   overrides.chosenClass   || null,

    // ─── Живучесть ─────────────────────────────────────────────────────────
    hp:            overrides.hp            ?? 100,
    maxHp:         overrides.maxHp         ?? 100,
    mana:          overrides.mana          ?? 50,
    maxMana:       overrides.maxMana       ?? 100,

    // ─── Прогресс ──────────────────────────────────────────────────────────
    xp:            overrides.xp            ?? 0,
    level:         overrides.level         ?? 1,
    gold:          overrides.gold          ?? 0,

    // ─── Стрик ─────────────────────────────────────────────────────────────
    streak:        overrides.streak        ?? 0,

    // ─── Статы (зависят от класса) ─────────────────────────────────────────
    stats: {
      pwr: overrides.stats?.pwr ?? 5,  // Power   — урон боссу
      def: overrides.stats?.def ?? 5,  // Defense — снижает входящий урон
      foc: overrides.stats?.foc ?? 5,  // Focus   — ускоряет рост когнитивных метрик
      mem: overrides.stats?.mem ?? 5,  // Memory  — усиливает Gc и Vm
      spd: overrides.stats?.spd ?? 5,  // Speed   — ускоряет восполнение маны
      lck: overrides.stats?.lck ?? 5,  // Luck    — шанс крита и нахождения предметов
    },

    // ─── Когнитивные метрики ───────────────────────────────────────────────
    cognitiveMetrics: {
      gf: overrides.cognitiveMetrics?.gf ?? 80,  // Fluid Intelligence (Gf)
      gc: overrides.cognitiveMetrics?.gc ?? 80,  // Crystallized Intelligence (Gc)
      ps: overrides.cognitiveMetrics?.ps ?? 80,  // Processing Speed (Ps)
      vm: overrides.cognitiveMetrics?.vm ?? 80,  // Verbal Memory (Vm)
    },

    // ─── Снаряжение ────────────────────────────────────────────────────────
    equipment: {
      weapon: overrides.equipment?.weapon  || null,
      armor:  overrides.equipment?.armor   || null,
      ring:   overrides.equipment?.ring    || null,
      badge:  overrides.equipment?.badge   || null,
    },

    // ─── Союзники ──────────────────────────────────────────────────────────
    // Формат: { id, name, icon, unlockedAt, passiveBonus: { xpBonus?: 0.05 } }
    allies: overrides.allies || [],

    // ─── Активные баффы ────────────────────────────────────────────────────
    // Формат: createBuff(buffId, effects, durationMs)
    buffs: overrides.buffs || [],

    // ─── Ценности задач ────────────────────────────────────────────────────
    // { taskId: { value, type, completed } }
    taskValues: overrides.taskValues || {},

    // ─── Время ─────────────────────────────────────────────────────────────
    lastCheckedMs: overrides.lastCheckedMs || Date.now(),
    createdAt:     overrides.createdAt     || Date.now(),
  };
}

/**
 * Применить класс к персонажу — выставить статы и лимиты маны по данным класса.
 *
 * @param {object} charState  - текущий Character State
 * @param {object} classData  - объект класса из rpgSystem.js (CLASSES[id])
 * @returns {object} обновлённый Character State
 */
export function applyClassToCharacter(charState, classData) {
  return {
    ...charState,
    chosenClass: classData.id,
    maxMana: classData.maxMana,
    mana: Math.min(charState.mana, classData.maxMana),
    stats: { ...charState.stats, ...classData.stats },
  };
}

/**
 * Применить активный скилл — потратить ману, добавить бафф.
 *
 * @param {object} charState  - текущий Character State
 * @param {object} skill      - объект скилла { id, mana, buffId, buffEffects, buffDurationMs }
 * @param {number} [nowMs]    - текущее время
 * @returns {{ updatedState: object, success: boolean, reason?: string }}
 */
export function useSkill(charState, skill, nowMs = Date.now()) {
  if ((charState.mana || 0) < skill.mana) {
    return { updatedState: charState, success: false, reason: "NOT_ENOUGH_MANA" };
  }

  const newMana = charState.mana - skill.mana;
  let newBuffs = [...(charState.buffs || [])];

  if (skill.buffId && skill.buffEffects) {
    const buff = createBuff(skill.buffId, skill.buffEffects, skill.buffDurationMs || 0, skill.id);
    newBuffs = [...newBuffs, buff];
  }

  return {
    updatedState: {
      ...charState,
      mana: newMana,
      buffs: newBuffs,
    },
    success: true,
  };
}

/**
 * Выполнить задачу: начислить XP и Gold, обновить ценность задачи.
 *
 * @param {object}  charState - текущий Character State
 * @param {object}  task      - { id, type, value }
 * @param {object}  [combinedEffects] - из applyBuffPipeline
 * @returns {{ updatedState: object, reward: { xp, gold }, newTaskValue: number }}
 */
export function completeTask(charState, task, combinedEffects = {}) {
  const reward = calcTaskReward(task.value, task.type, combinedEffects);
  const newValue = calcNewTaskValue(task.value, "complete", task.type);

  const updatedTaskValues = {
    ...(charState.taskValues || {}),
    [task.id]: {
      ...(charState.taskValues?.[task.id] || {}),
      value: newValue,
      type: task.type,
      completed: true,
    },
  };

  return {
    updatedState: {
      ...charState,
      xp:   (charState.xp   || 0) + reward.xp,
      gold: (charState.gold || 0) + reward.gold,
      taskValues: updatedTaskValues,
    },
    reward,
    newTaskValue: newValue,
  };
}

/**
 * Зафиксировать провал задачи — обновить ценность задачи и нанести урон HP.
 *
 * @param {object} charState  - текущий Character State
 * @param {object} task       - { id, type, value }
 * @param {object} [combinedEffects] - из applyBuffPipeline
 * @returns {{ updatedState: object, damage: number, newTaskValue: number }}
 */
export function failTask(charState, task, combinedEffects = {}) {
  let damage = 0;

  if (!combinedEffects.noFailDmg) {
    damage = calcFailDamage(task.value, charState.stats?.def || 5);
    if (combinedEffects.defBonus) {
      damage = Math.max(0, damage - damage * combinedEffects.defBonus);
    }
  }

  const newValue = calcNewTaskValue(task.value, "fail", task.type);

  const updatedTaskValues = {
    ...(charState.taskValues || {}),
    [task.id]: {
      ...(charState.taskValues?.[task.id] || {}),
      value: newValue,
      type: task.type,
    },
  };

  return {
    updatedState: {
      ...charState,
      hp: Math.max(0, (charState.hp || 0) - damage),
      taskValues: updatedTaskValues,
    },
    damage,
    newTaskValue: newValue,
  };
}
