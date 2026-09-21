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

// Token obtido no aparelho mas ainda NÃO aceito pelo backend (ex.: cadastro
// pendente na hora, sem rede, servidor fora). Fica guardado e é reenviado ao
// voltar pro primeiro plano e a cada 60s. Sem isso, quem se cadastrou pelo app
// só entrava na lista de destinatários se fechasse e reabrisse o app — e a
// aprovação do acesso saía pra "ninguém".
let tokenPendente: { fcm: string; platform: 'ios' | 'android' } | null = null;
let reenvioArmado = false;

async function enviarTokenAoBackend(fcm: string, platform: 'ios' | 'android') {
  try {
    await Api.registerDevice(fcm, platform);
    tokenPendente = null;
    Api.pushLog({ ok: true, platform }).catch(() => {});
  } catch {
    tokenPendente = { fcm, platform };
    Api.pushLog({ ok: false, platform, error: 'falha ao enviar token ao backend (vai reenviar)' }).catch(() => {});
    armarReenvio();
  }
}

function armarReenvio() {
  if (reenvioArmado) return;
  reenvioArmado = true;
  const tentar = () => { if (tokenPendente) enviarTokenAoBackend(tokenPendente.fcm, tokenPendente.platform); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tentar(); });
  import('@capacitor/app')
    .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => { if (isActive) tentar(); }))
    .catch(() => { /* sem plugin: fica o visibilitychange + timer */ });
  setInterval(tentar, 60_000);
}

export async function initPush(navigate?: (path: string) => void) {
  if (jaIniciado) return;
  if (!Capacitor.isNativePlatform()) return; // web: não há push nativo
  jaIniciado = true;

  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';

  try {
    // Android 8+: toda notificação precisa de um CANAL. Sem um canal de importância
    // ALTA, o aviso não aparece como pop-up (heads-up). Criamos 'leads_high' aqui;
    // o backend manda o push nesse canal. Idempotente (recriar não duplica).
    if (platform === 'android') {
      try {
        await PushNotifications.createChannel({
          id: 'leads_high',
          name: 'Leads e avisos importantes',
          description: 'Novos leads, transferências e avisos urgentes.',
          importance: 5, // IMPORTANCE_HIGH -> heads-up (pop-up) + som + vibração
          visibility: 1, // PUBLIC (aparece na tela de bloqueio)
          // SEM `sound`: no @capacitor/push-notifications o campo `sound` é o nome de
          // um arquivo em res/raw (NÃO a palavra "default"). Passar 'default' apontaria
          // pra res/raw/default (inexistente) e o canal ficaria MUDO — e canal é
          // imutável após criado. Sem o campo, o canal usa o som padrão do sistema.
          vibration: true,
          lights: true,
        });
      } catch { /* canal já existe ou sem suporte: ignora */ }
    }

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      // Visibilidade: antes isso era um `return` silencioso. Agora o backend registra
      // que este corretor está SEM push por permissão negada.
      Api.pushLog({ ok: false, platform, error: `permissao negada (${perm.receive})` }).catch(() => {});
      return;
    }

    // Token do aparelho -> backend. Android: o `registration` já é o FCM token.
    // iOS: é o APNs token; o que o backend precisa (FCM) vem do bridge nativo.
    await PushNotifications.addListener('registration', async (token) => {
      const fcm = platform === 'ios' ? await aguardarFcmToken() : token.value;
      if (!fcm) {
        Api.pushLog({ ok: false, platform, error: 'registrou mas nao veio o fcm token' }).catch(() => {});
        return;
      }
      // Falhou (pendente/sem rede/servidor)? Guarda e reenvia sozinho — ver acima.
      await enviarTokenAoBackend(fcm, platform);
    });

    // Antes era silencioso — por isso ninguém via quando o registro falhava.
    await PushNotifications.addListener('registrationError', (err: unknown) => {
      const msg = (err as { error?: string; message?: string })?.error
        || (err as { message?: string })?.message
        || 'registrationError';
      Api.pushLog({ ok: false, platform, error: String(msg) }).catch(() => {});
    });

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
