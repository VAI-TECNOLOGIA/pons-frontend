import { useEffect, useState } from 'react';
import { isNativeApp, currentPlatform } from '../lib/platform';

// Versão visível pra TODO MUNDO (rodapé do menu + tela de login).
// Mostra a versão do APP INSTALADO (nativo: versionName (versionCode), ex. "Android
// 1.0.3 (4)") e a versão WEB (public/versao.json, ex. "Web 2026.09.21").
// Motivo: suporte — "você está na 1.0.3?" vira uma olhada, sem adivinhar. Foi
// justamente o que faltou pra diagnosticar o push do Android (o corretor não
// tinha como saber se estava no app novo).
type Info = { app?: string; build?: string; web?: string };

// Cache de módulo: o Sidebar re-renderiza a cada rota; não refaz o fetch/getInfo.
let cache: Info | null = null;

export function VersaoApp({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const [info, setInfo] = useState<Info>(cache || {});

  useEffect(() => {
    if (cache) return;
    const next: Info = {};
    const tasks: Promise<void>[] = [];
    if (isNativeApp()) {
      // Mesmo padrão já usado em Chat.tsx (App.getInfo). Plugin @capacitor/app
      // já está no binário publicado — não exige AAB/IPA novo.
      tasks.push(
        import('@capacitor/app')
          .then(({ App }) => App.getInfo())
          .then((i) => { next.app = i.version; next.build = i.build; })
          .catch(() => { /* plugin ausente: fica só a versão web */ }),
      );
    }
    tasks.push(
      fetch(`/versao.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j?.versao) next.web = String(j.versao); })
        .catch(() => { /* offline: sem versão web */ }),
    );
    Promise.all(tasks).then(() => { cache = next; setInfo({ ...next }); });
  }, []);

  const plat = currentPlatform();
  const nativo = info.app ? `${plat === 'ios' ? 'iOS' : 'Android'} ${info.app} (${info.build || '?'})` : null;
  const web = info.web ? `Web ${info.web}` : null;
  if (!nativo && !web) return null;

  const full = [nativo, web].filter(Boolean).join(' · ');
  // Modo compacto (menu recolhido): só o número que importa — o do app instalado,
  // ou a versão web quando está no navegador.
  const short = info.app || info.web || '';
  return (
    <span className={('versao-app ' + className).trim()} title={full}>
      {compact ? short : full}
    </span>
  );
}
