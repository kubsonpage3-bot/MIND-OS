/**
 * useBattleStripBridge
 *
 * Utility hook for sending events to the Taskbar Battle Strip window.
 * Safely no-ops in browser environments (where Tauri is unavailable).
 *
 * Usage:
 *   const { notifySessionComplete } = useBattleStripBridge()
 *   notifySessionComplete(1) // call when user logs a study session
 */

import { useCallback } from 'react'

const emitTauriEvent = async (eventName, payload) => {
  try {
    const { emit } = await import('@tauri-apps/api/event')
    await emit(eventName, payload)
  } catch {
    // Running in a browser without Tauri — silently ignore
  }
}

export function useBattleStripBridge() {
  const notifySessionComplete = useCallback((count = 1) => {
    emitTauriEvent('mindos-action', {
      type: 'session-complete',
      payload: { count },
    })
  }, [])

  return { notifySessionComplete }
}
