// @ts-nocheck
import { Preferences } from '@capacitor/preferences';
import { registerPlugin, Capacitor } from '@capacitor/core';

const WidgetSync = registerPlugin('WidgetSync');

/**
 * Saves character stats and dailies to Capacitor Preferences and triggers native Android widgets refresh.
 * @param {Object} profile - { hp, max_hp, mp, max_mp, xp, max_xp, class, rank, theme, gold, sp, streak, level }
 * @param {Array} [dailies] - Optional list of daily tasks [{ id, title, completed, category, difficulty, streak, value }]
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
        completed: Boolean(d.done || d.is_completed || d.completedToday || d.completed_today || d.completed),
        category: d.category || 'Other',
        difficulty: d.difficulty || 'medium',
        streak: d.streak || 0,
        value: d.value ?? d.rpgValue ?? 0,
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

/**
 * Flushes any pending toggle actions recorded directly on Android home screen widgets.
 * @param {Function} onCompleteTask - Callback `async (taskId, isCompleting) => Promise<void>`
 */
export const processPendingWidgetActions = async (onCompleteTask) => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const res = await Preferences.get({ key: 'mindos_pending_widget_actions' });
    if (!res?.value) return;

    let actions = [];
    try {
      actions = JSON.parse(res.value);
    } catch {
      actions = [];
    }

    if (!Array.isArray(actions) || actions.length === 0) return;

    // Reset pending queue immediately to avoid duplicate dispatch
    await Preferences.set({ key: 'mindos_pending_widget_actions', value: '[]' });

    for (const item of actions) {
      if (item.action === 'toggle_daily' && item.taskId && typeof onCompleteTask === 'function') {
        try {
          await onCompleteTask(item.taskId, Boolean(item.isCompleted));
        } catch (err) {
          console.error(`Failed to process widget toggle for task ${item.taskId}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('Failed to process pending widget actions:', error);
  }
};
