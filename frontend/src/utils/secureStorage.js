/**
 * Secure Storage Helper for Tauri/React applications.
 * Uses `@tauri-apps/plugin-store` when running inside Tauri,
 * and falls back to browser's `localStorage` in web environments.
 */

// Simple in-memory fallback cache to avoid multiple storage accesses
let memoryCache = {};

// Helper to check if running inside Tauri
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

/**
 * Get Tauri store instance dynamically if inside Tauri.
 * This prevents import issues in web-only browser environments.
 */
async function getTauriStore() {
  if (!isTauri) return null;
  try {
    const { LazyStore } = await import('@tauri-apps/plugin-store');
    return new LazyStore('.tokens.dat');
  } catch (error) {
    console.warn('Tauri Store plugin is not installed/configured, falling back to localStorage.', error);
    return null;
  }
}

export const secureStorage = {
  /**
   * Retrieves a value from storage
   * @param {string} key 
   * @returns {Promise<string|null>}
   */
  async getItem(key) {
    if (memoryCache[key]) {
      return memoryCache[key];
    }

    const tauriStore = await getTauriStore();
    if (tauriStore) {
      try {
        const val = await tauriStore.get(key);
        if (val) {
          memoryCache[key] = val;
          return val;
        }
      } catch (err) {
        console.error(`Error reading ${key} from Tauri Store:`, err);
      }
    }

    // Web fallback
    const value = localStorage.getItem(key);
    if (value) {
      memoryCache[key] = value;
    }
    return value;
  },

  /**
   * Saves a value to storage
   * @param {string} key 
   * @param {string} value 
   */
  async setItem(key, value) {
    memoryCache[key] = value;

    const tauriStore = await getTauriStore();
    if (tauriStore) {
      try {
        await tauriStore.set(key, value);
        await tauriStore.save();
        return;
      } catch (err) {
        console.error(`Error saving ${key} to Tauri Store:`, err);
      }
    }

    // Web fallback
    localStorage.setItem(key, value);
  },

  /**
   * Removes a value from storage
   * @param {string} key 
   */
  async removeItem(key) {
    delete memoryCache[key];

    const tauriStore = await getTauriStore();
    if (tauriStore) {
      try {
        await tauriStore.delete(key);
        await tauriStore.save();
        return;
      } catch (err) {
        console.error(`Error deleting ${key} from Tauri Store:`, err);
      }
    }

    // Web fallback
    localStorage.removeItem(key);
  },

  /**
   * Clear all items in cache and storage
   */
  async clear() {
    memoryCache = {};
    const tauriStore = await getTauriStore();
    if (tauriStore) {
      try {
        await tauriStore.clear();
        await tauriStore.save();
        return;
      } catch (err) {
        console.error('Error clearing Tauri Store:', err);
      }
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
};
