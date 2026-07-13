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
  // A assessoria atende somente o Paulo (id 1) — sem seletor, abre a agenda dele direto.
  const verAgendaDe: number | '' = user.role === 'ASSESSORA' || user.role === 'ASSESSORA_MARKETING' ? 1 : '';

  // Bump pra forçar o AgendaKpisBar a recontar após mutações (criar/editar/excluir).
  const [kpiVersion, setKpiVersion] = useState(0);
  const { data: eventos, loading, error, reload: reloadEv } = useApi<any[]>(
    () => Api.agenda(verAgendaDe ? { userId: verAgendaDe } : {}),
    [verAgendaDe],
  );
  // Recarrega calendário E KPIs juntos (usar após qualquer mutação na agenda).
  const reloadAgenda = () => {
    reloadEv();
    setKpiVersion((v) => v + 1);
  };
  const { data: tarefas } = useApi<any[]>(() => Api.tarefas());
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
      reloadAgenda();
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
      reloadAgenda();
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
            reloadAgenda();
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
      // Assessoria lança sempre pro Paulo (verAgendaDe); os demais, pra si mesmos.
      paraUserId: verAgendaDe || undefined,
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
      reloadAgenda();
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
      reloadAgenda();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  // Conexão do Google Calendar é POR USUÁRIO (tabela UserGoogleToken), exposta
  // em /api/integracoes/google/status — não na Setting global. Buscar de lá.
  const [googleConectado, setGoogleConectado] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadGoogleStatus = async () => {
    try {
      const s: any = await Api.googleCalendarStatus();
      setGoogleConectado(!!s?.conectado);
      setGoogleEmail(s?.email || null);
    } catch {
      setGoogleConectado(false);
    }
  };
  useEffect(() => {
    if (GOOGLE_CALENDAR_ENABLED) loadGoogleStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sincronizarGoogle = async () => {
    setSyncing(true);
    try {
      const r: any = await Api.googleCalendarSync();
      const imp = r?.importados ?? 0;
      toast.success(`Sincronizado · ${imp} evento(s) importado(s)`);
      reloadAgenda();
    } catch (e: any) {
      toast.error('Erro ao sincronizar: ' + (e.message || 'falha'));
    } finally {
      setSyncing(false);
    }
  };

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
        // O callback do OAuth roda numa janela separada e grava o token por
        // usuário (UserGoogleToken). Em vez de confiar só no fechamento do
        // popup, pollamos /google/status até detectar conexão (ou desistir).
        const inicio = Date.now();
        const check = setInterval(async () => {
          let conectou = false;
          try {
            const s: any = await Api.googleCalendarStatus();
            if (s?.conectado) {
              conectou = true;
              setGoogleConectado(true);
              setGoogleEmail(s?.email || null);
            }
          } catch {
            /* ignora erros transitórios durante o fluxo */
          }
          const expirou = Date.now() - inicio > 120_000;
          if (conectou || win.closed || expirou) {
            clearInterval(check);
            if (conectou) {
              toast.success('Google Calendar conectado!');
              reloadAgenda();
            } else {
              // popup fechado/timeout sem confirmar — revalida pra refletir estado
              loadGoogleStatus();
            }
          }
        }, 1500);
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
              googleConectado ? (
                <span className="gcal-connected" title={googleEmail ? `Conectado como ${googleEmail}` : 'Google Calendar conectado'}>
                  <span className="gcal-connected__check" aria-hidden>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <GoogleCalendarIcon size={15} />
                  Google Calendar conectado
                  <button
                    type="button"
                    className="gcal-connected__sync"
                    onClick={sincronizarGoogle}
                    disabled={syncing}
                    title="Sincronizar agora (envia seus eventos pro Google e importa de lá)"
                    aria-label="Sincronizar com Google Calendar"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={syncing ? 'gcal-spin' : undefined}>
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                </span>
              ) : (
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={conectarGoogle}
                  title="Conectar com Google Calendar"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <GoogleCalendarIcon size={16} />
                  Google Calendar
                </button>
              )
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
          </>
        }
      />

      <div className="main__content">
        <PageHeader
          breadcrumb="Sócios · Agenda"
          title={`Bom dia, ${user.name.split(' ')[0]}.`}
          subtitle={dateLabel}
        />

        <AgendaKpisBar userId={verAgendaDe || undefined} refreshKey={kpiVersion} />

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
        <form key={`${openEv ? 'o' : 'c'}-${editing?.id ?? 'novo'}-${verAgendaDe}`} onSubmit={submitEvento}>
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
