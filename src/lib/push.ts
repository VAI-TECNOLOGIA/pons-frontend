// Wiring de PUSH NOTIFICATION nativa (Capacitor + FCM/APNs).
// Só roda dentro do app nativo (iOS/Android). No navegador é no-op.
//
// Fluxo: pede permissão -> registra no APNs/FCM -> recebe o token ->
// manda pro backend (/notifications/device-token). Ao tocar numa
// notificação, navega pro destino conforme o `data.tipo`.
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { Api } from './api';

let jaIniciado = false;

// iOS: o evento `registration` do plugin entrega o token do APNs (cru), mas o
// backend envia por FCM (Firebase Admin). O AppDelegate nativo troca o APNs pelo
// FCM token e o guarda em Preferences (chave `fcmToken`). Aqui aguardamos ele
// aparecer (chega assíncrono, logo após o registro no APNs).
async function aguardarFcmToken(): Promise<string | null> {
  for (let i = 0; i < 15; i++) {
    const { value } = await Preferences.get({ key: 'fcmToken' });
    if (value) return value;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

export async function initPush(navigate?: (path: string) => void) {
  if (jaIniciado) return;
  if (!Capacitor.isNativePlatform()) return; // web: não há push nativo
  jaIniciado = true;

  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return; // usuário recusou

    // Token do aparelho -> backend. Android: o `registration` já é o FCM token.
    // iOS: é o APNs token; o que o backend precisa (FCM) vem do bridge nativo.
    await PushNotifications.addListener('registration', async (token) => {
      try {
        const fcm = platform === 'ios' ? await aguardarFcmToken() : token.value;
        if (fcm) await Api.registerDevice(fcm, platform);
      } catch { /* backend indisponível: tenta de novo no próximo boot */ }
    });

    await PushNotifications.addListener('registrationError', () => { /* silencioso */ });

    // Toque na notificação -> navega pro destino
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification?.data || {};
      const path = destinoPorTipo(data);
      if (path && navigate) navigate(path);
    });

    await PushNotifications.register();
  } catch {
    jaIniciado = false; // deixa tentar de novo depois
  }
}

function destinoPorTipo(data: Record<string, any>): string | null {
  switch (data?.tipo) {
    case 'lead': return '/meus-leads';
    case 'tarefa': return '/tarefas';
    case 'aviso': return '/avisos';
    default: return '/dashboard';
  }
}
