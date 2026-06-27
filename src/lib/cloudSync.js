const STORAGE_KEYS = {
  game_state: "mindos_game_state",
  class_data: "mindos_class",
  rank_xp: "mindos_rank_xp",
  tasks: "mindos_tasks",
  streak: "mindos_streak",
  skill_tree: "mindos_skill_tree",
  allies_data: "mindos_allies",
  mutators: "mindos_mutators",
  prestige: "mindos_prestige",
  scrolls: "mindos_scrolls",
  settings: "mindos_settings",
};

// Load all game data from localStorage
export function loadAllGameData() {
  const data = {};
  Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        data[key] = JSON.parse(raw);
      }
    } catch {}
  });
  return data;
}

// Save all game data to localStorage
export function saveAllGameData(data) {
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && STORAGE_KEYS[key]) {
      localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
    }
  });
}

// Sync localStorage to database (Mocked for offline gameplay synchronization)
export async function syncToCloud(userId) {
  try {
    const gameData = loadAllGameData();
    gameData.last_sync = new Date().toISOString();
    return { success: true };
  } catch (error) {
    console.error("Sync to cloud failed:", error);
    return { success: false, error: error.message };
  }
}

// Load from database to localStorage (Mocked for offline gameplay synchronization)
export async function syncFromCloud(userId) {
  try {
    return { success: true, data: loadAllGameData() };
  } catch (error) {
    console.error("Sync from cloud failed:", error);
    return { success: false, error: error.message };
  }
}

// Auto-sync on changes (debounced)
let syncTimeout = null;
export function queueAutoSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    // Mock local synchronization status
  }, 2000); // 2 second debounce
}