import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aistudio.indianopenworld.x9k4m2',
  appName: 'Indian Open World 3D',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    backgroundColor: '#090D16',
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#090D16',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      overlaysWebView: true
    }
  }
};

export default config;
