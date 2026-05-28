import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { Icon } from './Icon';
import { GoogleCalendarIcon } from './GoogleCalendarIcon';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

interface GoogleStatus {
  hasConfig?: boolean;
  conectado?: boolean;
  email?: string | null;
  calendarId?: string | null;
}

export function GoogleCalendarCard({ onChange }: { onChange?: () => void }) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const reload = async () => {
    try {
      const s: any = await Api.googleCalendarStatus();
      setStatus(s);
    } catch {
      setStatus({});
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const conectar = async () => {
    setBusy(true);
    try {
      const r: any = await Api.googleCalendarStart();
      if (r?.faltaConfig) {
        toast.error('Preencha Client ID + Client Secret abaixo antes de conectar.', 8000);
        return;
      }
      if (r?.authUrl) {
        // Abre popup com o consent screen Google
        window.open(r.authUrl, 'google-oauth', 'width=520,height=720');
        // Re-verifica a cada 3s por até 2min até ver `conectado: true`
        const start = Date.now();
        const poll = setInterval(async () => {
          if (Date.now() - start > 120_000) {
            clearInterval(poll);
            return;
          }
          try {
            const s: any = await Api.googleCalendarStatus();
            if (s?.conectado) {
              clearInterval(poll);
              setStatus(s);
              toast.success('Google Calendar conectado.');
              onChange?.();
            }
          } catch {}
        }, 3000);
      }
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || 'falha'));
    } finally {
      setBusy(false);
    }
  };

  const desconectar = async () => {
    const ok = await confirm({
      title: 'Desconectar Google Calendar?',
      message:
        'A integração será removida. Eventos já sincronizados permanecem no Google, mas novas alterações não serão espelhadas até reconectar.',
      confirmText: 'Desconectar',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await Api.googleCalendarDisconnect();
      await reload();
      toast.success('Google Calendar desconectado.');
      onChange?.();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || 'falha'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="flex-between" style={{ alignItems: 'center' }}>
        <h3 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <GoogleCalendarIcon size={20} /> Google Calendar
        </h3>
        {status?.conectado ? (
          <span className="badge badge--signed">Conectado</span>
        ) : (
          <span className="badge badge--analysis">Não conectado</span>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        {status?.conectado ? (
          <div className="field__hint" style={{ marginBottom: 12 }}>
            Conta vinculada: <strong>{status.email || '(verificando…)'}</strong>
            <br />
            Calendário: <code>{status.calendarId || 'primary'}</code>
          </div>
        ) : (
          <div className="field__hint" style={{ marginBottom: 12 }}>
            Clique em <strong>Conectar Google</strong> e autorize com sua conta Google.
            Seus compromissos vão sincronizar nos dois sentidos.
          </div>
        )}

        <div className="flex gap-2">
          {status?.conectado ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={desconectar}
              disabled={busy}
            >
              <Icon name="logout" size={14} /> Desconectar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={conectar}
              disabled={busy}
              title="Autorizar Google Calendar"
            >
              <GoogleCalendarIcon size={14} /> {busy ? 'Aguardando…' : 'Conectar Google'}
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={reload} disabled={busy}>
            Atualizar status
          </button>
        </div>
      </div>
    </div>
  );
}
