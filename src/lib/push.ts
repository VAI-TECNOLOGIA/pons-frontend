// Wiring de PUSH NOTIFICATION nativa (Capacitor + FCM/APNs).
// Só roda dentro do app nativo (iOS/Android). No navegador é no-op.
//
// Fluxo: pede permissão -> registra no APNs/FCM -> recebe o token ->
// manda pro backend (/notifications/device-token). Ao tocar numa
// notificação, navega pro destino conforme o `data.tipo`.
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Api } from './api';

let jaIniciado = false;

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

    // Token do aparelho -> backend
    await PushNotifications.addListener('registration', async (token) => {
      try {
        await Api.registerDevice(token.value, platform);
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
