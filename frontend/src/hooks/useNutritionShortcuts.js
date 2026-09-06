// @ts-nocheck
/**
 * Keyboard shortcuts for the Eat Journal (desktop).
 *
 * Deliberately inert while typing and while a modal is open, so it can never
 * steal a keystroke from a form. Handlers live in a ref, so passing a fresh
 * object every render does not re-bind the listener.
 */

import { useEffect, useRef } from 'react';

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export const NUTRITION_SHORTCUTS = ['add', 'nav', 'today', 'water', 'goals', 'calendar', 'trends'];

export default function useNutritionShortcuts(handlers, { enabled = true } = {}) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return undefined;

    function onKeyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const el = e.target;
      if (el && (TYPING_TAGS.has(el.tagName) || el.isContentEditable)) return;
      // Any open dialog owns the keyboard.
      if (document.querySelector('[role="dialog"], [data-nutri-modal="open"]')) return;

      const h = ref.current || {};
      const map = {
        a: h.onAdd,
        t: h.onToday,
        w: h.onWater,
        g: h.onGoals,
        c: h.onCalendar,
        r: h.onTrends,
        arrowleft: h.onPrevDay,
        arrowright: h.onNextDay,
        '?': h.onHelp,
      };

      const fn = map[e.key.toLowerCase()];
      if (typeof fn !== 'function') return;
      e.preventDefault();
      fn();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
