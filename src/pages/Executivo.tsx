import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { GoogleCalendarIcon } from '../components/GoogleCalendarIcon';
import { GOOGLE_CALENDAR_ENABLED } from '../lib/featureFlags';
import { CalendarView, type CalendarEvent } from '../components/CalendarView';
import { AgendaKpisBar } from '../components/AgendaKpisBar';
import { Auth } from '../lib/auth';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

import './executivo.css';

export default function Executivo() {
  const user = Auth.user!;
  const today = new Date();
  const dateLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const [openEv, setOpenEv] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);

  const { data: eventos, loading, error, reload: reloadEv } = useApi<any[]>(() => Api.agenda());
  const { data: tarefas } = useApi<any[]>(() => Api.tarefas());
  const { data: executivos } = useApi<any[]>(() => Api.agendaExecutivos().catch(() => []));
  const { data: settings, reload: reloadSettings } = useApi<Record<string, string>>(() => Api.settings());
  const toast = useToast();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const calEvents: CalendarEvent[] = (eventos || []).map((ev: any) => ({
    id: ev.id,
    titulo: ev.titulo,
    inicio: ev.inicio || ev.data,
    fim: ev.fim,
    tipo: ev.tipo,
    local: ev.local,
    executivo: typeof ev.executivo === 'string' ? ev.executivo : ev.executivo?.name || ev.executivo?.nome,
    notas: ev.notas,
    concluido: ev.concluido === true,
  }));

  // Config de auto-limpar (Settings)
  const autoCleanup = {
    modo: (settings?.['agenda.autoLimpar.modo'] as 'manual' | 'semanal' | 'periodico') || 'manual',
    dias: Number(settings?.['agenda.autoLimpar.dias']) || 7,
  };

  const toggleConcluido = async (ev: CalendarEvent, concluido: boolean) => {
    try {
      await Api.agendaUpdate(Number(ev.id), { concluido } as any);
      reloadEv();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const limparConcluidas = async () => {
    const ok = await confirm({
      title: 'Limpar compromissos concluídos?',
      message: 'Todos os compromissos marcados como concluídos serão removidos da agenda. Se você conectou o Google Calendar, eles também serão apagados de lá.',
      confirmText: 'Limpar agora',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const r = await Api.agendaLimparConcluidos();
      toast.success(`${r.removidos} compromisso(s) removido(s)`);
      reloadEv();
      reloadSettings();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const salvarAutoCleanup = async (cfg: { modo: 'manual' | 'semanal' | 'periodico'; dias: number }) => {
    try {
      await Api.settingsSave({
        'agenda.autoLimpar.modo': cfg.modo,
        'agenda.autoLimpar.dias': String(cfg.dias),
      });
      reloadSettings();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  // Verificação de auto-limpeza ao carregar
  useEffect(() => {
    if (!settings) return;
    const modo = settings['agenda.autoLimpar.modo'];
    if (!modo || modo === 'manual') return;
    const ultimaIso = settings[`agenda.autoLimpar.ultima.${user.id}`];
    const ultima = ultimaIso ? new Date(ultimaIso) : null;
    const now = new Date();
    let deveLimpar = false;
    if (modo === 'semanal') {
      // Domingo passado às 00h
      const inicioSemana = new Date(now);
      inicioSemana.setHours(0, 0, 0, 0);
      inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
      deveLimpar = !ultima || ultima < inicioSemana;
    } else if (modo === 'periodico') {
      const dias = Number(settings['agenda.autoLimpar.dias']) || 7;
      const proxima = ultima ? new Date(ultima.getTime() + dias * 86400_000) : new Date(0);
      deveLimpar = now >= proxima;
    }
    if (deveLimpar && (eventos || []).some((e: any) => e.concluido)) {
      Api.agendaLimparConcluidos()
        .then((r) => {
          if (r.removidos > 0) {
            toast.info(`Auto-limpeza: ${r.removidos} concluída(s) removida(s)`);
            reloadEv();
            reloadSettings();
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, eventos]);

  const abrirNovo = (date?: Date) => {
    setDefaultDate(date || null);
    setEditing(null);
    setOpenEv(true);
  };

  const abrirEdicao = (ev: CalendarEvent) => {
    setEditing(ev);
    setDefaultDate(null);
    setOpenEv(true);
  };

  const fechar = () => {
    setOpenEv(false);
    setEditing(null);
    setDefaultDate(null);
  };

  const submitEvento = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // datetime-local devolve horário de parede sem fuso ("2026-06-17T13:30").
    // O backend roda em UTC, então new Date(string) lá interpretaria como UTC e
    // gravaria 3h adiantado. Convertemos pra ISO completo (com offset local) aqui.
    const toIso = (v: FormDataEntryValue | null) => (v ? new Date(String(v)).toISOString() : undefined);
    const payload = {
      titulo: String(fd.get('titulo') || ''),
      tipo: String(fd.get('tipo') || 'REUNIAO'),
      inicio: toIso(fd.get('inicio')) || '',
      fim: toIso(fd.get('fim')),
      local: fd.get('local') ? String(fd.get('local')) : undefined,
      executivoId: fd.get('executivoId') ? Number(fd.get('executivoId')) : undefined,
      notas: fd.get('notas') ? String(fd.get('notas')) : undefined,
    };
    try {
      if (editing) {
        await Api.agendaUpdate(Number(editing.id), payload);
        toast.success('Compromisso atualizado');
      } else {
        await Api.agendaCreate(payload);
        toast.success('Compromisso agendado');
      }
      fechar();
      reloadEv();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const excluir = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: 'Excluir compromisso?',
      message: `O compromisso "${editing.titulo}" será removido permanentemente da agenda.`,
      confirmText: 'Excluir',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await Api.agendaDelete(Number(editing.id));
      toast.success('Compromisso excluído');
      fechar();
      reloadEv();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const googleConectado = settings?.['google.calendar.connected'] === 'true';

  const conectarGoogle = async () => {
    try {
      const r: any = await Api.googleCalendarStart();
      if (r?.authUrl) {
        // Abre janela OAuth do Google. Quando o user autorizar e retornar,
        // o backend salva o refresh_token em Settings e podemos recarregar.
        const win = window.open(r.authUrl, 'google-oauth', 'width=520,height=640');
        if (!win) {
          toast.error('Bloqueie o popup blocker e tente de novo.');
          return;
        }
        const check = setInterval(() => {
          if (win.closed) {
            clearInterval(check);
            reloadSettings();
            reloadEv();
          }
        }, 800);
      } else if (r?.faltaConfig) {
        // Sem credenciais → manda direto pra aba certa de Configurações
        toast.info('Configure Client ID e Secret do Google primeiro.');
        navigate('/configuracoes?secao=integracoes');
      } else {
        toast.error('Não foi possível iniciar OAuth.');
      }
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  // Só mostra shell de loading na carga inicial (não em reloads subsequentes)
  if (loading && !eventos)
    return (
      <Shell user={user} dateLabel={dateLabel} onNew={() => abrirNovo()}>
        <LoadingBlock />
      </Shell>
    );
  if (error)
    return (
      <Shell user={user} dateLabel={dateLabel} onNew={() => abrirNovo()}>
        <ErrorBlock error={error} />
      </Shell>
    );

  const tks = tarefas || [];

  // datetime-local espera horário de parede LOCAL. toISOString() devolve UTC, o
  // que mostraria 3h a menos ao editar — descontamos o offset pra exibir o local.
  const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const initialInicio = editing
    ? toLocalInput(new Date(editing.inicio))
    : defaultDate
    ? toLocalInput(defaultDate)
    : '';

  return (
    <>
      <Topbar
        title="Agenda Executiva"
        right={
          <>
            {GOOGLE_CALENDAR_ENABLED ? (
              <button
                className={'btn btn--sm ' + (googleConectado ? 'btn--secondary' : 'btn--secondary')}
                onClick={conectarGoogle}
                title={googleConectado ? 'Google Calendar conectado · clique pra reconectar' : 'Conectar com Google Calendar'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <GoogleCalendarIcon size={16} />
                {googleConectado ? 'Sincronizado' : 'Google Calendar'}
              </button>
            ) : (
              <span
                className="badge badge--neutral"
                title="Aguardando aprovação do app no Google — em breve"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.65, cursor: 'not-allowed' }}
              >
                <GoogleCalendarIcon size={14} />
                Google Calendar · em breve
              </span>
            )}
            <button className="btn btn--primary btn--sm" onClick={() => abrirNovo()}>
              + Compromisso
            </button>
          </>
        }
      />

      <div className="main__content">
        <PageHeader
          breadcrumb="Sócios · Agenda"
          title={`Bom dia, ${user.name.split(' ')[0]}.`}
          subtitle={dateLabel}
        />

        <AgendaKpisBar />

        {GOOGLE_CALENDAR_ENABLED && !googleConectado && (
          <div className="card google-cta">
            <div className="google-cta__icon">
              <GoogleCalendarIcon size={26} />
            </div>
            <div className="google-cta__body">
              <div className="google-cta__title">Conecte com o Google Calendar</div>
              <div className="google-cta__sub">
                Sincronize seus compromissos automaticamente. O que você criar aqui aparece lá, e vice-versa.
              </div>
            </div>
            <button className="btn btn--secondary btn--sm" onClick={conectarGoogle}>
              Conectar
            </button>
          </div>
        )}

        <CalendarView
          events={calEvents}
          onEventClick={abrirEdicao}
          onNew={abrirNovo}
          onToggleDone={toggleConcluido}
          onClearDone={limparConcluidas}
          autoCleanup={autoCleanup}
          onAutoCleanupChange={salvarAutoCleanup}
        />
      </div>

      <Modal
        open={openEv}
        onClose={fechar}
        title={editing ? 'Editar compromisso' : 'Novo compromisso'}
        subtitle="Agenda dos sócios e diretores"
        footer={
          editing && (
            <button className="btn btn--ghost btn--sm" onClick={excluir} style={{ color: 'var(--color-danger)' }}>
              Excluir
            </button>
          )
        }
      >
        <form onSubmit={submitEvento}>
          <div className="form-grid">
            <div className="field field--span-2">
              <label className="field__label">
                Título <span className="field__required">*</span>
              </label>
              <input
                name="titulo"
                className="field__input"
                required
                defaultValue={editing?.titulo || ''}
              />
            </div>
            <div className="field">
              <label className="field__label">
                Início <span className="field__required">*</span>
              </label>
              <input
                name="inicio"
                type="datetime-local"
                className="field__input"
                required
                defaultValue={initialInicio}
              />
            </div>
            <div className="field">
              <label className="field__label">Fim</label>
              <input
                name="fim"
                type="datetime-local"
                className="field__input"
                defaultValue={editing?.fim ? toLocalInput(new Date(editing.fim)) : ''}
              />
            </div>
            <div className="field">
              <label className="field__label">Tipo</label>
              <select name="tipo" className="field__select" defaultValue={editing?.tipo || 'REUNIAO'}>
                <option value="REUNIAO">Reunião</option>
                <option value="VISITA">Visita</option>
                <option value="EVENTO">Evento</option>
                <option value="LIGACAO">Ligação</option>
                <option value="PESSOAL">Pessoal</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">Local</label>
              <input
                name="local"
                className="field__input"
                placeholder="Sede Itajaí, Online…"
                defaultValue={editing?.local || ''}
              />
            </div>
            <div className="field field--span-2">
              <label className="field__label">Executivo</label>
              <select name="executivoId" className="field__select" defaultValue="">
                <option value="">— Eu mesmo —</option>
                {(executivos || []).map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--span-2">
              <label className="field__label">Notas</label>
              <textarea
                name="notas"
                className="field__textarea"
                rows={2}
                defaultValue={editing?.notas || ''}
              />
            </div>
          </div>
          <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn--secondary" onClick={fechar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary">
              {editing ? 'Salvar' : 'Agendar'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Shell({
  user,
  dateLabel,
  children,
  onNew,
}: {
  user: { name: string };
  dateLabel: string;
  children: React.ReactNode;
  onNew?: () => void;
}) {
  return (
    <>
      <Topbar
        title="Agenda Executiva"
        right={
          <button className="btn btn--primary btn--sm" onClick={onNew}>
            + Compromisso
          </button>
        }
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Sócios · Agenda"
          title={`Bom dia, ${user.name.split(' ')[0]}.`}
          subtitle={dateLabel}
        />
        {children}
      </div>
    </>
  );
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function withinWeek(d: Date, ref: Date) {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return d >= start && d < end;
}
