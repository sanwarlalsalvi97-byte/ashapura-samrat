import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ashapurasamrat.app',
  appName: 'Ashapura Samrat',
  webDir: 'dist',
  backgroundColor: '#0E7A3A',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    // Android 15+ enforces edge-to-edge: let Capacitor apply window insets
    // as margins so content never sits under the status/navigation bars.
    adjustMarginsForEdgeToEdge: 'auto',
  },
  // Custom URL scheme used for OAuth / password-recovery callbacks.
  // Must match `custom_url_scheme` in android/app/src/main/res/values/strings.xml
  server: {
    androidScheme: 'https',
  },
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
