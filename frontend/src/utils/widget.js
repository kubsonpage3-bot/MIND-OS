// @ts-nocheck
import { Preferences } from '@capacitor/preferences';
import { registerPlugin, Capacitor } from '@capacitor/core';

const WidgetSync = registerPlugin('WidgetSync');

/**
 * Saves character stats and dailies to Capacitor Preferences and triggers native Android widgets refresh.
 * @param {Object} profile - { hp, max_hp, mp, max_mp, xp, max_xp, class, rank, theme, gold, sp, streak, level }
 * @param {Array} [dailies] - Optional list of daily tasks [{ id, title, completed, category, difficulty }]
 */
export const syncWidgetStats = async (profile, dailies = null) => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (profile) {
      await Preferences.set({
        key: 'mindos_profile',
        value: JSON.stringify({
          hp: profile.hp ?? 100,
          max_hp: profile.max_hp ?? 100,
          mp: profile.mp ?? 50,
          max_mp: profile.max_mp ?? 100,
          xp: profile.xp ?? 0,
          max_xp: profile.max_xp ?? 100,
          class: profile.class || 'wanderer',
          rank: profile.rank || 'F',
          theme: profile.theme || 'solid_dark',
          gold: profile.gold ?? 0,
          sp: profile.sp ?? 0,
          streak: profile.streak ?? 0,
          level: profile.level ?? 1,
          avatar_res_name: profile.avatar_res_name || 'avatar_default',
        })
      });
    }

    if (Array.isArray(dailies)) {
      const sanitizedDailies = dailies.map(d => ({
        id: d.id,
        title: d.name || d.title || 'Daily Task',
        completed: Boolean(d.done || d.is_completed || d.completed_today || d.completed),
        category: d.category || 'misc',
        difficulty: d.difficulty || 'medium',
      }));

      await Preferences.set({
        key: 'mindos_dailies',
        value: JSON.stringify(sanitizedDailies)
      });
    }

    // Notify native widgets to refresh
    await WidgetSync.updateWidget();
  } catch (error) {
    console.error('Failed to sync widget stats and dailies:', error);
  }
};

/**
 * Checks if the app was launched from a widget quick action button.
 * @returns {Promise<string|null>} e.g. "create_habit", "create_daily", "create_todo", "open_chest", "open_dailies"
 */
export const getWidgetLaunchIntentAction = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await WidgetSync.getInitialAction();
    return res?.action || null;
  } catch (error) {
    return null;
  }
};
