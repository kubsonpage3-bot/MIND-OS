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
    }
  }
};

export default config;
