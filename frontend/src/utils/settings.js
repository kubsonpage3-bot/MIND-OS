import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

/**
 * Saves settings to both localStorage (sync) and Capacitor Preferences (async on native platforms).
 */
export const saveSettings = async (settings) => {
  try {
    localStorage.setItem("mindos_settings", JSON.stringify(settings));
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: 'mindos_settings', value: JSON.stringify(settings) });
    }
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
};
