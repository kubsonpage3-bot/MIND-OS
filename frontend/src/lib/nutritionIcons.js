// @ts-nocheck
/**
 * Meal-slot icons, kept apart from nutritionUtils so that module stays free of
 * React/lucide imports and can be unit-tested with plain `node --test`.
 */

import { Sunrise, Sun, Moon, Apple, Utensils } from 'lucide-react';

export const MEAL_ICONS = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
  snack: Apple,
};

export function mealIcon(type) {
  return MEAL_ICONS[type] || Utensils;
}
