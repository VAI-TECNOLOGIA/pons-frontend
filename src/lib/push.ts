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

// ---- Alerta EM PRIMEIRO PLANO (app aberto) ----
// O Android NÃO mostra a notificação do sistema quando o app está aberto: entrega
// pro app e pronto. Sem isto, o corretor com o app na mão não via nada. Faixa em
// destaque no topo + som + vibração; toque leva pro destino. Só no Android — no
// iOS o sistema já mostra o banner em primeiro plano (presentationOptions).
let alertaEstiloInjetado = false;
function injetarEstiloAlerta() {
  if (alertaEstiloInjetado) return;
  alertaEstiloInjetado = true;
  const s = document.createElement('style');
  s.textContent = `
    .push-alerta{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));left:10px;right:10px;z-index:99999;
      background:#0B0F1A;color:#fff;border:1px solid rgba(82,247,254,.6);border-left:5px solid #52f7fe;border-radius:14px;
      padding:12px 14px;box-shadow:0 12px 36px rgba(0,0,0,.55);display:flex;gap:12px;align-items:flex-start;cursor:pointer;
      animation:push-alerta-in .28s cubic-bezier(.2,.9,.3,1.1);font-family:inherit}
    .push-alerta--lead{animation:push-alerta-in .28s cubic-bezier(.2,.9,.3,1.1),push-alerta-pulse 1.2s ease-in-out 4}
    .push-alerta__icone{width:36px;height:36px;border-radius:10px;background:rgba(82,247,254,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#52f7fe}
    .push-alerta__titulo{font-weight:800;font-size:15px;letter-spacing:.2px}
    .push-alerta__texto{font-size:13px;opacity:.9;margin-top:2px}
    .push-alerta__fechar{margin-left:auto;background:transparent;border:none;color:rgba(255,255,255,.6);font-size:20px;line-height:1;cursor:pointer;padding:0 4px}
    @keyframes push-alerta-in{from{transform:translateY(-120%);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes push-alerta-pulse{0%,100%{box-shadow:0 12px 36px rgba(0,0,0,.55)}50%{box-shadow:0 12px 40px rgba(82,247,254,.45)}}
  `;
  document.head.appendChild(s);
}

const SOM_ALERTA = '/sons/lead-alerta.wav';
function tocarSomAlerta(intenso: boolean) {
  try {
    const a = new Audio(SOM_ALERTA);
    a.volume = 1;
    // Lead: toca duas vezes — é o aviso que não pode passar batido. A segunda só
    // começa quando a primeira TERMINA (o som do cliente tem ~3 s; não sobrepõe).
    if (intenso) a.addEventListener('ended', () => { new Audio(SOM_ALERTA).play().catch(() => {}); }, { once: true });
    a.play().catch(() => { /* WebView sem áudio liberado: fica a vibração */ });
  } catch { /* sem áudio */ }
  try { navigator.vibrate?.(intenso ? [350, 150, 350, 150, 500] : [200]); } catch { /* sem vibração */ }
}

function mostrarAlertaNaTela(titulo: string, texto: string, intenso: boolean, onTap?: () => void) {
  injetarEstiloAlerta();
  document.querySelectorAll('.push-alerta').forEach((el) => el.remove());
  const el = document.createElement('div');
  el.className = 'push-alerta' + (intenso ? ' push-alerta--lead' : '');
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <div class="push-alerta__icone"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg></div>
    <div><div class="push-alerta__titulo"></div><div class="push-alerta__texto"></div></div>
    <button type="button" class="push-alerta__fechar" aria-label="Fechar">&times;</button>`;
  // textContent (não innerHTML) pro conteúdo do push — nunca injeta HTML vindo de fora.
  (el.querySelector('.push-alerta__titulo') as HTMLElement).textContent = titulo;
  (el.querySelector('.push-alerta__texto') as HTMLElement).textContent = texto;
  const remover = () => el.remove();
  el.querySelector('.push-alerta__fechar')?.addEventListener('click', (e) => { e.stopPropagation(); remover(); });
  el.addEventListener('click', () => { remover(); onTap?.(); });
  document.body.appendChild(el);
  window.setTimeout(remover, intenso ? 15000 : 8000);
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
      // Canal base (som padrão do sistema) — existe em todo aparelho, é o fallback
      // declarado no manifest (default_notification_channel_id).
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

      // Canal com SOM PRÓPRIO (android/app/src/main/res/raw/lead_alerta.wav): só a
      // partir do build que EMBUTE o arquivo (versionCode >= 5 / 1.0.4). Criar antes
      // disso deixaria o canal mudo pra sempre neste aparelho (canal é imutável e o
      // som não existiria no APK). O backend passa a mandar neste canal quando a
      // 1.0.4 estiver na Play; aparelhos antigos caem no fallback 'leads_high'.
      try {
        const { App } = await import('@capacitor/app');
        const info = await App.getInfo();
        if ((parseInt(info.build, 10) || 0) >= 5) {
          await PushNotifications.createChannel({
            id: 'leads_alerta',
            name: 'Leads (alerta sonoro)',
            description: 'Chegada de lead com som de alerta próprio.',
            importance: 5,
            visibility: 1,
            sound: 'lead_alerta', // nome do arquivo em res/raw, sem extensão
            vibration: true,
            lights: true,
          });
        }
      } catch { /* sem plugin App ou canal já existe: ignora */ }
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

    // App ABERTO (Android): o sistema não mostra nada — mostramos nós: faixa em
    // destaque + som + vibração. Lead/fila = alerta intenso (toca 2x, pulsa 15s).
    if (platform === 'android') {
      await PushNotifications.addListener('pushNotificationReceived', (n) => {
        const data = (n?.data || {}) as Record<string, unknown>;
        const tipo = String(data?.tipo || '');
        const intenso = tipo === 'lead' || tipo === 'fila';
        tocarSomAlerta(intenso);
        mostrarAlertaNaTela(n?.title || 'Grupo Pons', n?.body || '', intenso, () => {
          const p = destinoPorTipo(data);
          if (p && navigate) navigate(p);
        });
      });
    }

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
