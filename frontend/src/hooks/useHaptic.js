// @ts-nocheck
/**
 * useHaptic — тактильная отдача для нативных ощущений.
 *
 * On Android/iOS uses @capacitor/haptics.
 * In browser/desktop uses Web Vibration API as fallback.
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

function isHapticsEnabled() {
  if (Capacitor.isNativePlatform() && !window.mindos_settings_loaded) {
    return false;
  }
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
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
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
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
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
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
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
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.notification({ type: NotificationType.Success });
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
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.notification({ type: NotificationType.Error });
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
