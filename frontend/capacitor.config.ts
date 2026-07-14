import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mindos.app',
  appName: 'MIND OS',
  webDir: 'dist',
  android: {
    webContentsDebuggingEnabled: true
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#0a0a0f",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP"
    },
    Keyboard: {
      resize: "none",
      resizeOnFullScreen: true
    },
    StatusBar: {
      overlaysWebView: true
    }
  }
};

export default config;
