// @ts-nocheck
/**
 * nutritionUtils — shared logic for the LIFE OS · Eat Journal.
 *
 * Everything here is pure — no React, no icon imports — so it runs under
 * `node --test` directly. Meal icons live in ./nutritionIcons.js.
 */

// ─── Dates ────────────────────────────────────────────────────────────────────

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Parse a YYYY-MM-DD string into a local-noon Date (immune to TZ drift). */
export function parseDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(dateStr, lang = 'en') {
  return parseDate(dateStr).toLocaleDateString(lang?.startsWith('ru') ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
  });
}

export function formatWeekday(dateStr, lang = 'en') {
  return parseDate(dateStr).toLocaleDateString(lang?.startsWith('ru') ? 'ru-RU' : 'en-US', {
    weekday: 'long',
  });
}

/** "Today" / "Yesterday" / "Tomorrow" / formatted date. Returns a key + fallback. */
export function relativeDayKey(dateStr) {
  const t = todayStr();
  if (dateStr === t) return 'today';
  if (dateStr === addDays(t, -1)) return 'yesterday';
  if (dateStr === addDays(t, 1)) return 'tomorrow';
  return null;
}

// ─── Meals ────────────────────────────────────────────────────────────────────

/**
 * `share` = fraction of the daily calorie goal this slot is expected to carry.
 * Used for the per-meal budget hint and the "pace" model. Sums to 1.0.
 */
export const MEAL_META = {
  breakfast: { key: 'breakfast', defaultLabel: 'Breakfast', color: '#eab308', share: 0.25 },
  lunch: { key: 'lunch', defaultLabel: 'Lunch', color: '#f97316', share: 0.35 },
  dinner: { key: 'dinner', defaultLabel: 'Dinner', color: '#7B61FF', share: 0.30 },
  snack: { key: 'snack', defaultLabel: 'Snacks & Other', color: '#10b981', share: 0.10 },
};

export const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

export function mealMeta(type) {
  return MEAL_META[type] || { key: type, defaultLabel: type, color: '#f59e0b', share: 0.25 };
}

/** Which meal slot is "live" right now — drives the FAB and quick-add target. */
export function smartMealType(now = new Date()) {
  const h = now.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

/** `#rrggbb` + 0..1 alpha → rgba() string. Falls back to the input for var()/rgba(). */
export function alpha(color, a) {
  if (typeof color !== 'string' || color[0] !== '#') return color;
  const hex = color.length === 4
    ? color.slice(1).split('').map((c) => c + c).join('')
    : color.slice(1);
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ─── Food emoji ───────────────────────────────────────────────────────────────

const EMOJI_RULES = [
  [['пицц', 'pizza'], '🍕'],
  [['овсян', 'oat', 'каша', 'porridge', 'мюсли', 'granola'], '🥣'],
  [['сырник', 'блин', 'pancake', 'оладь', 'waffle', 'вафл'], '🥞'],
  [['яйц', 'яичниц', 'egg', 'omelet', 'омлет'], '🍳'],
  [['куриц', 'курин', 'филе', 'chicken', 'птиц', 'индейк', 'turkey'], '🍗'],
  [['говядин', 'стейк', 'beef', 'steak', 'мясо', 'свинин', 'pork'], '🥩'],
  [['рыб', 'лосос', 'тунец', 'fish', 'salmon', 'tuna', 'сельд'], '🐟'],
  [['кревет', 'shrimp', 'seafood', 'мидии', 'краб'], '🦐'],
  [['гречк', 'buckwheat', 'булгур', 'киноа', 'quinoa'], '🌾'],
  [['рис', 'rice', 'плов'], '🍚'],
  [['макарон', 'паст', 'pasta', 'spaghetti', 'лапш', 'noodle'], '🍝'],
  [['картоф', 'potato', 'фри', 'fries'], '🥔'],
  [['кофе', 'coffee', 'капучино', 'латте', 'эспрессо', 'espresso'], '☕'],
  [['чай', 'tea', 'матча', 'matcha'], '🍵'],
  [['творог', 'cottage', 'сыр', 'cheese'], '🧀'],
  [['молок', 'milk', 'йогурт', 'yogurt', 'кефир'], '🥛'],
  [['протеин', 'protein', 'шейк', 'shake', 'смузи', 'smoothie'], '🥤'],
  [['бургер', 'burger', 'сэндвич', 'sandwich'], '🍔'],
  [['шаурм', 'shawarma', 'ролл', 'wrap', 'буррито', 'burrito', 'тако', 'taco'], '🌯'],
  [['суши', 'sushi'], '🍣'],
  [['банан', 'banana'], '🍌'],
  [['яблок', 'apple'], '🍎'],
  [['авокадо', 'avocado'], '🥑'],
  [['ягод', 'berry', 'клубник', 'малин', 'strawberr'], '🍓'],
  [['апельсин', 'мандарин', 'orange', 'citrus'], '🍊'],
  [['виноград', 'grape'], '🍇'],
  [['орех', 'nut', 'миндал', 'almond', 'арахис', 'peanut'], '🥜'],
  [['салат', 'salad', 'огур', 'помидор', 'tomato', 'cucumber', 'зелен'], '🥗'],
  [['борщ', 'суп', 'soup', 'бульон', 'broth'], '🍲'],
  [['хлеб', 'bread', 'тост', 'toast', 'булк', 'багет'], '🍞'],
  [['шоколад', 'chocolate', 'конфет', 'candy', 'печень', 'cookie'], '🍫'],
  [['торт', 'cake', 'пирог', 'десерт', 'dessert'], '🍰'],
  [['мороженое', 'ice cream'], '🍨'],
  [['пиво', 'beer', 'вино', 'wine', 'алкогол', 'alcohol'], '🍷'],
  [['сок', 'juice', 'вода', 'water', 'лимонад', 'soda', 'кола', 'cola'], '🥤'],
  [['масл', 'oil', 'butter'], '🧈'],
  [['мёд', 'мед ', 'honey', 'сахар', 'sugar', 'джем', 'jam'], '🍯'],
  [['фасол', 'бобы', 'bean', 'чечевиц', 'lentil', 'нут', 'chickpea', 'хумус'], '🫘'],
  [['гриб', 'mushroom'], '🍄'],
  [['батончик', 'bar ', 'снек', 'snack', 'чипс', 'chips'], '🍫'],
];

export function getFoodEmoji(name = '') {
  const lower = String(name || '').toLowerCase();
  for (const [needles, emoji] of EMOJI_RULES) {
    for (const n of needles) if (lower.includes(n)) return emoji;
  }
  return '🍽️';
}

// ─── Derived day stats ────────────────────────────────────────────────────────

/**
 * How far through the "eating day" we are right now (0..1).
 * Anchored to a 07:00 → 21:00 window rather than midnight-to-midnight, so a
 * normal eater sits near 100 % by dinner instead of 87 %.
 */
export function eatingDayProgress(now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = 7 * 60;
  const end = 21 * 60;
  if (mins <= start) return 0;
  if (mins >= end) return 1;
  return (mins - start) / (end - start);
}

/**
 * Pace verdict for the current day: are we ahead of, behind, or on the
 * calorie curve for this time of day? Only meaningful for "today".
 */
export function calculatePace({ consumed, goal, now = new Date() }) {
  const progress = eatingDayProgress(now);
  const expected = goal * progress;
  const diff = consumed - expected;
  const tolerance = Math.max(goal * 0.12, 120);
  let status = 'on_track';
  if (consumed > goal) status = 'over';
  else if (diff > tolerance) status = 'ahead';
  else if (diff < -tolerance) status = 'behind';
  return { progress, expected, diff, status };
}

/**
 * Consecutive days (ending today or yesterday) with at least one logged meal.
 * Derived from the calendar payload we already fetch — no extra request.
 */
export function calculateStreak(calendarData, anchor = todayStr()) {
  if (!Array.isArray(calendarData) || calendarData.length === 0) return 0;
  const logged = new Set(
    calendarData.filter((d) => (d?.calories || 0) > 0).map((d) => d.date),
  );
  // Allow the streak to still "count" before today's first entry lands.
  let cursor = logged.has(anchor) ? anchor : addDays(anchor, -1);
  let streak = 0;
  while (logged.has(cursor) && streak < 400) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Calorie contribution of each macro, as a share of the total (0..1). */
export function macroCalorieSplit(totals = {}) {
  const p = (totals.protein || 0) * 4;
  const f = (totals.fat || 0) * 9;
  const c = (totals.carbs || 0) * 4;
  const sum = p + f + c;
  if (sum <= 0) return { protein: 0, fat: 0, carbs: 0, empty: true };
  return { protein: p / sum, fat: f / sum, carbs: c / sum, empty: false };
}

/** Per-meal calorie budget from the daily goal and the slot's expected share. */
export function mealBudget(goalCalories, type) {
  return Math.round((goalCalories || 0) * mealMeta(type).share);
}

/**
 * The single most useful nudge we can give right now, or null when the day
 * looks fine. Returned as a translation key + values so the component stays
 * language-agnostic.
 *
 * Deliberately never restates the pace verdict — the summary card's pace bar
 * already says that, and two sentences of the same news reads as padding.
 */
export function dayInsight({ totals, goal, meals, pace }) {
  const kcal = totals.calories || 0;
  const goalKcal = goal.calories || 0;
  const protein = totals.protein || 0;
  const goalProtein = goal.protein || 0;
  const loggedSlots = MEAL_ORDER.filter((m) => (meals?.[m]?.length || 0) > 0).length;

  if (goalKcal > 0 && kcal > goalKcal * 1.05) {
    return { id: 'over', values: { amount: Math.round(kcal - goalKcal) }, tone: 'danger' };
  }
  if (loggedSlots === 0) {
    return { id: 'empty', values: {}, tone: 'neutral' };
  }
  if (goalProtein > 0 && protein < goalProtein * 0.55 && (pace?.progress || 0) > 0.6) {
    return { id: 'protein_behind', values: { amount: Math.round(goalProtein - protein) }, tone: 'warn' };
  }

  // Biggest drift between the day's calorie split and the target split.
  if (goalKcal > 0 && kcal >= goalKcal * 0.3) {
    const actual = macroCalorieSplit(totals);
    const target = macroCalorieSplit(goal);
    if (!actual.empty && !target.empty) {
      const worst = ['protein', 'fat', 'carbs']
        .map((k) => ({ k, drift: Math.round((actual[k] - target[k]) * 100) }))
        .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))[0];
      if (Math.abs(worst.drift) >= 15) {
        return {
          id: worst.drift > 0 ? 'macro_high' : 'macro_low',
          values: { macro: worst.k, amount: Math.abs(worst.drift) },
          tone: 'warn',
        };
      }
    }
  }

  if (goalKcal > 0 && kcal >= goalKcal * 0.6 && (totals.fiber || 0) > 0 && (totals.fiber || 0) < 18) {
    return { id: 'low_fiber', values: { amount: Math.round(totals.fiber || 0) }, tone: 'warn' };
  }
  if (goalKcal > 0 && kcal >= goalKcal * 0.9) {
    return { id: 'nailed', values: {}, tone: 'good' };
  }
  if (goalProtein > 0 && protein < goalProtein * 0.95) {
    return { id: 'protein_gap', values: { amount: Math.round(goalProtein - protein) }, tone: 'good' };
  }
  return { id: 'logged', values: { count: loggedSlots, total: MEAL_ORDER.length }, tone: 'good' };
}

/** Round to a sane number of digits for display without trailing noise. */
export function fmt(n, digits = 0) {
  const v = Number(n) || 0;
  return digits === 0 ? Math.round(v).toString() : v.toFixed(digits).replace(/\.0+$/, '');
}
