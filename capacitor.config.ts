import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.grupopons.sistema',
  appName: 'Grupo Pons',
  webDir: 'dist',
  server: {
    // SERVER MODE: o app carrega a prod ao vivo (app.grupopons.com.br). Cada deploy
    // na Vercel reflete no app automaticamente — sem precisar subir pacote novo na loja.
    // A Academia Pons vai pela prod e aparece só no app via gate isNativeApp().
    url: 'https://app.grupopons.com.br',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      backgroundColor: '#000000',
      style: 'DARK',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
