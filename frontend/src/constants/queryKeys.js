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
