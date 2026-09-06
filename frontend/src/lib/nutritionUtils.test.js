import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, relativeDayKey, todayStr, smartMealType, alpha, getFoodEmoji,
  eatingDayProgress, calculatePace, calculateStreak, macroCalorieSplit,
  mealBudget, dayInsight,
} from './nutritionUtils.js';

const at = (h, m = 0) => new Date(2026, 0, 15, h, m, 0);

test('addDays crosses month and DST boundaries without drifting a day', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  // Europe/Moscow has no DST, but a UTC-midnight parse would slip here.
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('relativeDayKey names only the three days around today', () => {
  const today = todayStr();
  assert.equal(relativeDayKey(today), 'today');
  assert.equal(relativeDayKey(addDays(today, -1)), 'yesterday');
  assert.equal(relativeDayKey(addDays(today, 1)), 'tomorrow');
  assert.equal(relativeDayKey(addDays(today, -2)), null);
});

test('smartMealType follows the clock', () => {
  assert.equal(smartMealType(at(8)), 'breakfast');
  assert.equal(smartMealType(at(13)), 'lunch');
  assert.equal(smartMealType(at(19)), 'dinner');
  assert.equal(smartMealType(at(23)), 'snack');
});

test('alpha converts hex to rgba and leaves CSS values alone', () => {
  assert.equal(alpha('#10b981', 0.5), 'rgba(16, 185, 129, 0.5)');
  assert.equal(alpha('#fff', 1), 'rgba(255, 255, 255, 1)');
  assert.equal(alpha('var(--x)', 0.5), 'var(--x)');
});

test('getFoodEmoji prefers the more specific rule', () => {
  // "кофе с молоком" must read as coffee, not milk.
  assert.equal(getFoodEmoji('Кофе с молоком'), '☕');
  assert.equal(getFoodEmoji('Овсянка на молоке'), '🥣');
  assert.equal(getFoodEmoji('Grilled chicken breast'), '🍗');
  assert.equal(getFoodEmoji(''), '🍽️');
  assert.equal(getFoodEmoji(null), '🍽️');
});

test('eatingDayProgress is clamped to the 07:00–21:00 window', () => {
  assert.equal(eatingDayProgress(at(6)), 0);
  assert.equal(eatingDayProgress(at(14)), 0.5);
  assert.equal(eatingDayProgress(at(23)), 1);
});

test('calculatePace reports ahead / behind / over against the clock', () => {
  const goal = 2000;
  assert.equal(calculatePace({ consumed: 1000, goal, now: at(14) }).status, 'on_track');
  assert.equal(calculatePace({ consumed: 1600, goal, now: at(14) }).status, 'ahead');
  assert.equal(calculatePace({ consumed: 200, goal, now: at(14) }).status, 'behind');
  assert.equal(calculatePace({ consumed: 2400, goal, now: at(14) }).status, 'over');
});

test('calculateStreak counts back from today, and tolerates an unlogged today', () => {
  const anchor = '2026-01-15';
  const logged = (...dates) => dates.map((date) => ({ date, calories: 500 }));

  assert.equal(calculateStreak(logged('2026-01-15', '2026-01-14', '2026-01-13'), anchor), 3);
  // Today not logged yet: the streak still stands on yesterday.
  assert.equal(calculateStreak(logged('2026-01-14', '2026-01-13'), anchor), 2);
  // A gap ends it.
  assert.equal(calculateStreak(logged('2026-01-15', '2026-01-13'), anchor), 1);
  // Days present but empty do not count.
  assert.equal(calculateStreak([{ date: '2026-01-15', calories: 0 }], anchor), 0);
  assert.equal(calculateStreak([], anchor), 0);
  assert.equal(calculateStreak(undefined, anchor), 0);
});

test('macroCalorieSplit weights by calories per gram, not grams', () => {
  // 100 g protein (400 kcal) vs 100 g fat (900 kcal) vs 100 g carbs (400 kcal).
  const s = macroCalorieSplit({ protein: 100, fat: 100, carbs: 100 });
  assert.equal(Math.round(s.protein * 100), 24);
  assert.equal(Math.round(s.fat * 100), 53);
  assert.equal(Math.round(s.carbs * 100), 24);
  assert.equal(macroCalorieSplit({}).empty, true);
});

test('mealBudget splits the daily goal across the four slots', () => {
  assert.equal(mealBudget(2000, 'breakfast'), 500);
  assert.equal(mealBudget(2000, 'lunch'), 700);
  assert.equal(mealBudget(2000, 'dinner'), 600);
  assert.equal(mealBudget(2000, 'snack'), 200);
  assert.equal(
    ['breakfast', 'lunch', 'dinner', 'snack'].reduce((n, m) => n + mealBudget(2000, m), 0),
    2000,
  );
});

test('dayInsight picks the most urgent thing and never repeats the pace line', () => {
  const goal = { calories: 2000, protein: 150, fat: 65, carbs: 250 };
  const meals = { breakfast: [{ id: 1 }], lunch: [], dinner: [], snack: [] };
  const empty = { breakfast: [], lunch: [], dinner: [], snack: [] };
  const pace = { progress: 0.8 };

  assert.equal(
    dayInsight({ totals: { calories: 2400, protein: 150 }, goal, meals, pace }).id,
    'over',
  );
  assert.equal(
    dayInsight({ totals: { calories: 0, protein: 0 }, goal, meals: empty, pace }).id,
    'empty',
  );
  assert.equal(
    dayInsight({ totals: { calories: 900, protein: 40, fat: 30, carbs: 100 }, goal, meals, pace }).id,
    'protein_behind',
  );
  // A carb-heavy day trips the balance nudge rather than a pace restatement.
  const balance = dayInsight({
    totals: { calories: 1200, protein: 120, fat: 10, carbs: 180 },
    goal,
    meals,
    pace: { progress: 0.3 },
  });
  assert.ok(['macro_high', 'macro_low'].includes(balance.id), balance.id);

  const ids = ['behind', 'ahead', 'on_track'];
  for (const totals of [
    { calories: 100, protein: 10 },
    { calories: 1900, protein: 145, fat: 62, carbs: 240, fiber: 30 },
  ]) {
    assert.ok(!ids.includes(dayInsight({ totals, goal, meals, pace }).id));
  }
});
