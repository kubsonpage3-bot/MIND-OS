export const TASKS_QUERY_KEY = ["tasks"];

/**
 * Generates a query key for raw task list consumers to avoid collision
 * with the Dashboard's mapped ["tasks"] query key, while maintaining
 * hierarchical invalidation (invalidation of ["tasks"] will still clear subkeys).
 * 
 * Current subkeys:
 * - ["tasks", "calendar"] in CalendarPanel.jsx
 * - ["tasks", "raw"] in useGameplayInsights.js
 * 
 * Any NEW hook or component needing raw task data must use this helper
 * to define a distinct subkey (e.g. rawTasksQueryKey("feature")).
 * 
 * @param {string} name 
 * @returns {[string, string]}
 */
export const rawTasksQueryKey = (name) => ["tasks", name];

// ─── Nutrition (NutriLog) ────────────────────────────────────────────────────
export const NUTRITION_MEALS_KEY = (dateStr) => ["nutrition", "meals", dateStr];
export const NUTRITION_CALENDAR_KEY = (month) => ["nutrition", "calendar", month];
export const FOOD_ITEMS_KEY = (search = "") => ["nutrition", "foods", search];
export const GLOBAL_FOOD_KEY = (query = "") => ["nutrition", "search-global", query];
export const NUTRITION_WATER_KEY = (dateStr) => ["nutrition", "water", dateStr];
export const NUTRITION_COMBOS_KEY = ["nutrition", "combos"];
export const NUTRITION_TRENDS_KEY = (days = 30) => ["nutrition", "trends", days];
export const NUTRI_GOAL_KEY = ["nutrition", "goal"];
