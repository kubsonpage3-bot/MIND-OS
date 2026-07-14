import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { Share } from '@capacitor/share';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Keyboard } from '@capacitor/keyboard';

export const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

class NativeServices {
  async hideSplashScreen() {
    if (!isNative) return;
    try {
      await SplashScreen.hide();
    } catch (e) {
      console.warn('Failed to hide splash screen', e);
    }
  }

  async lockOrientation() {
    if (!isNative) return;
    try {
      await ScreenOrientation.lock({ orientation: 'portrait' });
    } catch (e) {
      console.warn('Failed to lock orientation', e);
    }
  }

  async share(title, text, url) {
    if (!isNative) return false;
    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({ title, text, url, dialogTitle: 'Share with allies' });
        return true;
      }
    } catch (e) {
      console.warn('Share failed', e);
    }
    return false;
  }
}

export const native = new NativeServices();
