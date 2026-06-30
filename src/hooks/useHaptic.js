/**
 * useHaptic — тактильная отдача для нативных ощущений.
 *
 * На Android/iOS (Tauri mobile) использует @tauri-apps/plugin-haptics.
 * В браузере/десктопе — Web Vibration API как фоллбэк.
 */

let tauriHaptics = null;

// Ленивая загрузка плагина только в мобильном окружении Tauri
async function getTauriHaptics() {
  if (tauriHaptics !== null) return tauriHaptics;

  try {
    // Проверяем, что мы внутри Tauri
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      const mod = await import('@tauri-apps/plugin-haptics');
      tauriHaptics = mod;
    } else {
      tauriHaptics = false;
    }
  } catch {
    tauriHaptics = false;
  }

  return tauriHaptics;
}

function isHapticsEnabled() {
  try {
    const settings = JSON.parse(localStorage.getItem('mindos_settings') || '{}');
    return settings.hapticsEnabled !== false;
  } catch {
    return true;
  }
}

/**
 * Лёгкая вибрация — нажатие на кнопку, тап
 */
export async function hapticLight() {
  if (!isHapticsEnabled()) return;
  const haptics = await getTauriHaptics();
  if (haptics) {
    try {
      await haptics.impactFeedback('light');
      return;
    } catch {}
  }
  // Фоллбэк: Web Vibration API (работает на Android Chrome)
  if (navigator.vibrate) navigator.vibrate(30);
}

/**
 * Средняя вибрация — переключение, свайп
 */
export async function hapticMedium() {
  if (!isHapticsEnabled()) return;
  const haptics = await getTauriHaptics();
  if (haptics) {
    try {
      await haptics.impactFeedback('medium');
      return;
    } catch {}
  }
  if (navigator.vibrate) navigator.vibrate(50);
}

/**
 * Сильная вибрация — завершение задачи, успех
 */
export async function hapticHeavy() {
  if (!isHapticsEnabled()) return;
  const haptics = await getTauriHaptics();
  if (haptics) {
    try {
      await haptics.impactFeedback('heavy');
      return;
    } catch {}
  }
  if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
}

/**
 * Вибрация успеха — как Habitica, когда выполнил привычку
 */
export async function hapticSuccess() {
  if (!isHapticsEnabled()) return;
  const haptics = await getTauriHaptics();
  if (haptics) {
    try {
      await haptics.notificationFeedback('success');
      return;
    } catch {}
  }
  if (navigator.vibrate) navigator.vibrate([40, 20, 60]);
}

/**
 * Вибрация ошибки — неправильное действие
 */
export async function hapticError() {
  if (!isHapticsEnabled()) return;
  const haptics = await getTauriHaptics();
  if (haptics) {
    try {
      await haptics.notificationFeedback('error');
      return;
    } catch {}
  }
  if (navigator.vibrate) navigator.vibrate([60, 30, 60, 30, 60]);
}

/**
 * React hook: возвращает функции haptic для использования в компонентах.
 *
 * @example
 * const { light, success } = useHaptic();
 * <button onClick={() => { light(); doSomething(); }}>...</button>
 */
export function useHaptic() {
  return {
    light: hapticLight,
    medium: hapticMedium,
    heavy: hapticHeavy,
    success: hapticSuccess,
    error: hapticError,
  };
}
