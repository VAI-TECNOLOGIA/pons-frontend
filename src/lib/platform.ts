import { Capacitor } from '@capacitor/core';

// Detecta se está rodando dentro do app nativo (Capacitor iOS/Android) ou no
// navegador. Usado para exibir a Academia Pons (pública), exclusiva do app.
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

export const currentPlatform = (): 'ios' | 'android' | 'web' =>
  Capacitor.getPlatform() as 'ios' | 'android' | 'web';
