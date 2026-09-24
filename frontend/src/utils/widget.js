// @ts-nocheck
import { Preferences } from '@capacitor/preferences';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { HOST_ORIGIN } from '@/api/djangoClient';

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
 * Mirrors the calendar_feed_token into native storage so the Calendar home
 * screen widget's own WorkManager background sync can authenticate -- native
 * code can't read the app's JWT (it lives in the WebView's localStorage), so
 * it reuses the same opaque, revocable token the ICS subscription feed uses.
 * Call with the `url` from GET/POST /calendar/feed-info/ (the widget's
 * feed-info response never exposes the raw token, only the built .ics URL,
 * so it's extracted here); call with a falsy value to clear a stale token
 * (e.g. after rotation, before the fresh one lands).
 * @param {string|null} feedUrl - e.g. "https://host/api/calendar/feed/<token>.ics"
 */
export const syncCalendarWidgetToken = async (feedUrl) => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const match = typeof feedUrl === 'string' ? feedUrl.match(/\/calendar\/feed\/([^/?#]+)\.ics/) : null;
    await WidgetSync.syncCalendarToken({ token: match ? match[1] : '', apiBase: HOST_ORIGIN });
  } catch (error) {
    console.error('Failed to sync calendar widget token:', error);
  }
};

/**
 * Checks if the app was launched from a widget quick action button.
 * @returns {Promise<{action: string, date: string|null}|null>} e.g. { action: "create_daily", date: null },
 *   { action: "open_calendar_date", date: "2026-09-24" }
 */
export const getWidgetLaunchIntentAction = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await WidgetSync.getInitialAction();
    if (!res?.action) return null;
    return { action: res.action, date: res.date || null };
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

    // Reset pending queue immediately to avoid duplicate dispatch (a second
    // resume/focus firing mid-flush must not replay the same items).
    await Preferences.set({ key: 'mindos_pending_widget_actions', value: '[]' });

    // Items that fail (offline, server error) are re-queued instead of being
    // silently dropped -- a toggle tapped on the widget with no signal used
    // to be lost forever, leaving the widget's optimistic checkmark
    // permanently out of sync with the real task state.
    const failed = [];
    for (const item of actions) {
      if (item.action === 'toggle_daily' && item.taskId && typeof onCompleteTask === 'function') {
        try {
          await onCompleteTask(item.taskId, Boolean(item.isCompleted));
        } catch (err) {
          console.error(`Failed to process widget toggle for task ${item.taskId}:`, err);
          failed.push(item);
        }
      }
    }

    if (failed.length > 0) {
      try {
        const current = await Preferences.get({ key: 'mindos_pending_widget_actions' });
        const stillPending = current?.value ? JSON.parse(current.value) : [];
        await Preferences.set({
          key: 'mindos_pending_widget_actions',
          value: JSON.stringify([...(Array.isArray(stillPending) ? stillPending : []), ...failed]),
        });
      } catch (err) {
        console.error('Failed to re-queue failed widget actions:', err);
      }
    }
  } catch (error) {
    console.error('Failed to process pending widget actions:', error);
  }
};
