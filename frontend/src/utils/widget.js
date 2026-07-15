import { Preferences } from '@capacitor/preferences';
import { registerPlugin, Capacitor } from '@capacitor/core';

const WidgetSync = registerPlugin('WidgetSync');

/**
 * Saves character stats to Capacitor Preferences and triggers an Android widget refresh.
 * @param {Object} profile - { hp, max_hp, mp, max_mp, xp, max_xp, avatar_res_name }
 */
export const syncWidgetStats = async (profile) => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // 1. Persist in preferences (will write to CapacitorStorage shared preferences)
    await Preferences.set({
      key: 'mindos_profile',
      value: JSON.stringify({
        hp: profile.hp,
        max_hp: profile.max_hp,
        mp: profile.mp,
        max_mp: profile.max_mp,
        xp: profile.xp,
        max_xp: profile.max_xp,
        class: profile.class || 'wanderer',
        rank: profile.rank || 'F',
        avatar_res_name: profile.avatar_res_name || 'avatar_default'
      })
    });

    // 2. Notify native widget to update
    await WidgetSync.updateWidget();
  } catch (error) {
    console.error('Failed to sync widget stats:', error);
  }
};
