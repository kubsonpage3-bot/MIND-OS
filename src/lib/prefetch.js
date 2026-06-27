const PREFETCH_MAP = {
  tasks: () => import("@/components/mindos/TasksPanel"),
  character: () => import("@/components/mindos/CharacterTab"),
  train: () => import("@/components/mindos/ActivityLogger"),
  stats: () => import("@/components/mindos/ProjectionTable"),
  history: () => import("@/components/mindos/HistoryLog"),
  pomodoro: () => import("@/components/mindos/PomodoroPanel"),
  calendar: () => import("@/components/mindos/CalendarPanel"),
  rival: () => import("@/components/mindos/RivalTab"),
  settings: () => import("@/components/mindos/SettingsPanel"),
};

const prefetched = new Set();

export function prefetchTab(tabId) {
  if (!tabId) return;
  const normalizedId = tabId === "training" ? "train" : tabId;
  if (PREFETCH_MAP[normalizedId] && !prefetched.has(normalizedId)) {
    prefetched.add(normalizedId);
    PREFETCH_MAP[normalizedId]().catch(() => {
      // Ignore load errors during prefetch
      prefetched.delete(normalizedId);
    });
  }
}
