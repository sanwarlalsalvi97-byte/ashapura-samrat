import type { CapacitorConfig } from '@capacitor/cli';

// Toggle hot-reload against the Lovable sandbox by setting
// CAP_LIVE_RELOAD=1 in your shell before running `npx cap sync`.
// For Play Store release builds, leave it unset so the app loads from `dist/`.
const useLiveReload = process.env.CAP_LIVE_RELOAD === '1';

const config: CapacitorConfig = {
  appId:'com.ashapurasamrat.app',
  appName: 'Ashapura Samrat',
  webDir: 'dist',
  backgroundColor: '#0E7A3A',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ...(useLiveReload
    ? {
        server: {
          url: 'https://346ff4ab-a1fe-4e49-a9bb-d6312b10ff9f.lovableproject.com?forceHideBadge=true',
          cleartext: true,
        },
      }
    : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0E7A3A',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      backgroundColor: '#0E7A3A',
      style: 'LIGHT',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0E7A3A',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
