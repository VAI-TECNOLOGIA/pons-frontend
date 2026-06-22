import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.grupopons.vai',
  appName: 'Grupo Pons',
  webDir: 'dist',
  server: {
    // Origin do WebView = dominio real -> same-origin com a API, sem exceção CORS
    hostname: 'app.grupopons.com.br',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#263654',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      backgroundColor: '#263654',
      style: 'DARK',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
