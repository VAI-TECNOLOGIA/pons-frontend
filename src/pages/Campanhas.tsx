import { useEffect, useMemo, useState } from 'react';
import { Api } from '../lib/api';
import { NovoTemplateModal } from '../components/NovoTemplateModal';
import './campanhas.css';
import { useWhatsappNumeros } from '../lib/whatsappNumeros';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
const STATUS_LEAD = ['NOVO', 'NAO_RESPONDE', 'LISTA_VIP', 'EM_ATENDIMENTO', 'FLUXO', 'PAROU_RESPONDER', 'POS_FLUXO', 'VISITA', 'NEGOCIANDO', 'FECHADO', 'PERDIDO'];
const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', AGENDADA: 'Agendada', ENVIANDO: 'Enviando', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
};

// Normaliza um número solto para E.164 BR (+55 + DDD + 8/9 dígitos) ou null.
// Mesma lógica do backend (lib/phone.toE164) — só p/ contar/validar ao vivo.
function normNumeroBR(raw: string): string | null {
  let d = (raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d;
  if (d.length === 13 && d.startsWith('55')) {
    const ddd = parseInt(d.slice(2, 4), 10);
    if (ddd > 31 && d[4] === '9') d = d.slice(0, 4) + d.slice(5); // remove 9º dígito
  }
  if (d.length < 12 || d.length > 13) return null;
  return '+' + d;
}
// Quebra o texto colado (1 por linha / vírgula / ;) em números únicos válidos.
function parseListaNumeros(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of (text || '').split(/[\n,;\t]+/)) {
    const n = normNumeroBR(tok);
    if (n && !seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

// Traduz o erro cru do Meta ("131026: Message undeliverable") num texto claro
// pro corretor. Se o código não estiver mapeado, mostra o texto original.
function motivoAmigavel(erro?: string | null): string {
  if (!erro) return '';
  const code = (String(erro).match(/^(\d+)/) || [])[1];
  const MAP: Record<string, string> = {
    '131026': '📵 Número sem WhatsApp (ou não recebe a mensagem)',
    '131049': '🚦 Meta segurou — excesso de marketing pra esse número (tenta mais tarde)',
    '130472': '🧪 Número em teste interno do Meta (bloqueia marketing)',
    '131000': '❌ Número inválido / não é WhatsApp',
    '131047': '⏰ Janela de 24h fechada — precisa de template pra reabrir',
    '131051': '⚠️ Tipo de mensagem não suportado',
    '132000': '⚠️ Problema no template (parâmetros)',
    '132001': '⚠️ Template não existe ou foi reprovado',
    '470': '⏰ Janela de 24h fechada',
  };
  return (code && MAP[code]) || String(erro);
}

export default function Campanhas() {
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [wizard, setWizard] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [disparandoId, setDisparandoId] = useState<number | null>(null);
  const [confirmAcao, setConfirmAcao] = useState<{ id: number; nome: string; tipo: 'disparar' | 'excluir' } | null>(null);
  const [relatorio, setRelatorio] = useState<any | null>(null);
  const [carregandoRel, setCarregandoRel] = useState(false);

  function load() {
    setLoading(true);
    Api.campanhas()
      .then((r) => { setCampanhas(r.campanhas || []); setKpis(r.kpis || {}); setErro(''); })
      .catch((e) => setErro(e?.message || 'Falha ao carregar campanhas.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function excluir(id: number) {
    await Api.campanhaDelete(id).catch(() => {});
    load();
  }

  // Dispara um RASCUNHO salvo direto da lista (o "Disparar agora" só existia no
  // wizard de criação). Loop em lote até concluir — a rota /enviar materializa a
  // audiência no 1º disparo.
  async function dispararRascunho(id: number) {
    setDisparandoId(id);
    try {
      let guard = 0;
      while (guard++ < 500) {
        const r: any = await Api.campanhaEnviar(id);
        if (r?.concluida) break;
        await new Promise((res) => setTimeout(res, 400));
      }
      load();
    } catch (e: any) {
      alert('Falha ao disparar: ' + (e?.message || 'erro'));
    } finally {
      setDisparandoId(null);
    }
  }

  // Confirma a ação escolhida (aviãozinho = disparar, lixeira = excluir).
  async function confirmarAcao() {
    if (!confirmAcao) return;
    const { id, tipo } = confirmAcao;
    setConfirmAcao(null);
    if (tipo === 'excluir') await excluir(id);
    else await dispararRascunho(id);
  }

  async function abrirRelatorio(id: number) {
    setCarregandoRel(true);
    try {
      setRelatorio(await Api.campanhaRelatorio(id));
    } catch (e: any) {
      alert('Falha ao abrir relatório: ' + (e?.message || 'erro'));
    } finally {
      setCarregandoRel(false);
    }
  }

  return (
    <div className="main__content campanhas">
      <header className="page-head">
        <div>
          <h1 className="page-title">Campanhas</h1>
          <p className="page-sub">Disparo em massa via WhatsApp oficial — audiência, template aprovado e acompanhamento.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn--ghost" onClick={() => setTemplateModal(true)}>+ Novo template</button>
          <button className="btn btn--primary" onClick={() => setWizard(true)}>+ Nova Campanha</button>
        </div>
      </header>

      <div className="kpi-grid camp-kpis">
        <div className="kpi"><div className="kpi__label">Total de Campanhas</div><div className="kpi__value">{kpis.total ?? 0}</div></div>
        <div className="kpi"><div className="kpi__label">Em Execução</div><div className="kpi__value">{kpis.emExecucao ?? 0}</div></div>
        <div className="kpi"><div className="kpi__label">Mensagens Enviadas</div><div className="kpi__value">{kpis.mensagensEnviadas ?? 0}</div></div>
        <div className="kpi"><div className="kpi__label">Concluídas</div><div className="kpi__value">{kpis.concluidas ?? 0}</div></div>
      </div>

      {erro && <div className="card camp-erro">{erro}</div>}

      <div className="card">
        {loading ? (
          <div className="camp-empty">Carregando campanhas…</div>
        ) : campanhas.length === 0 ? (
          <div className="camp-empty">
            <div className="camp-empty__icon">📣</div>
            <h3>Nenhuma campanha ainda</h3>
            <p>Crie sua primeira campanha para enviar mensagens em massa via WhatsApp.</p>
            <button className="btn btn--primary" onClick={() => setWizard(true)}>+ Nova Campanha</button>
          </div>
        ) : (
          <table className="camp-table">
            <thead>
              <tr><th>Campanha</th><th>Status</th><th>Progresso</th><th>Contatos</th><th>Criada</th><th></th></tr>
            </thead>
            <tbody>
              {campanhas.map((c) => {
                const total = c.totalDestinatarios || 0;
                const feito = (c.enviados || 0) + (c.falhas || 0);
                const pct = total ? Math.round((feito / total) * 100) : 0;
                const ehRascunho = c.status === 'RASCUNHO' || c.status === 'AGENDADA';
                return (
                  <tr
                    key={c.id}
                    onClick={() => ehRascunho && setConfirmAcao({ id: c.id, nome: c.nome, tipo: 'disparar' })}
                    style={ehRascunho ? { cursor: 'pointer' } : undefined}
                    title={ehRascunho ? 'Clique para revisar e disparar' : undefined}
                  >
                    <td><strong>{c.nome}</strong>{c.templateName && <div className="camp-muted">{c.templateName}</div>}</td>
                    <td><span className={`camp-badge camp-badge--${(c.status || '').toLowerCase()}`}>{STATUS_LABEL[c.status] || c.status}</span></td>
                    <td>
                      <div className="camp-bar"><div className="camp-bar__fill" style={{ width: `${pct}%` }} /></div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 5, fontSize: 11, fontWeight: 600 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{c.enviados || 0} enviadas</span>
                        <span style={{ color: '#0E9F6E' }}>{c.entregues || 0} entregues</span>
                        <span style={{ color: '#3B82F6' }}>{c.lidos || 0} lidas</span>
                        <span style={{ color: '#8B5CF6' }}>{c.respondidos || 0} respostas</span>
                        {(c.falhas || 0) > 0 && <span style={{ color: 'var(--color-danger-fg)' }}>{c.falhas} falhas</span>}
                      </div>
                    </td>
                    <td>{total}</td>
                    <td className="camp-muted">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                        {(c.status === 'RASCUNHO' || c.status === 'AGENDADA') && (
                          <button
                            className="btn btn--ghost btn--sm"
                            title="Disparar campanha"
                            disabled={disparandoId === c.id}
                            onClick={(e) => { e.stopPropagation(); setConfirmAcao({ id: c.id, nome: c.nome, tipo: 'disparar' }); }}
                            style={{ padding: 6, display: 'inline-flex', color: 'var(--blue-500, #2563eb)' }}
                          >
                            <Icon name="send" size={16} />
                          </button>
                        )}
                        {c.status !== 'RASCUNHO' && (
                          <button
                            className="btn btn--ghost btn--sm"
                            title="Ver relatório (envios, entregas, erros)"
                            disabled={carregandoRel}
                            onClick={(e) => { e.stopPropagation(); abrirRelatorio(c.id); }}
                            style={{ padding: 6, display: 'inline-flex', color: 'var(--text-secondary)' }}
                          >
                            <Icon name="chart" size={16} />
                          </button>
                        )}
                        <button
                          className="btn btn--ghost btn--sm"
                          title="Excluir campanha"
                          onClick={(e) => { e.stopPropagation(); setConfirmAcao({ id: c.id, nome: c.nome, tipo: 'excluir' }); }}
                          style={{ padding: 6, display: 'inline-flex', color: 'var(--color-danger, #dc2626)' }}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {wizard && <Wizard onClose={() => { setWizard(false); load(); }} />}
      {templateModal && <NovoTemplateModal onClose={() => setTemplateModal(false)} />}

      {confirmAcao && (() => {
        const camp = campanhas.find((x) => x.id === confirmAcao.id);
        const isDisp = confirmAcao.tipo === 'disparar';
        return (
          <Modal open onClose={() => setConfirmAcao(null)} title={isDisp ? 'Disparar campanha' : 'Excluir campanha'} subtitle={confirmAcao.nome}>
            <div style={{ fontSize: 14, lineHeight: 1.55 }}>
              {isDisp ? (
                <>
                  <p style={{ marginTop: 0 }}>Confira antes de disparar:</p>
                  <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
                    <li>Template: <strong>{camp?.templateName || '—'}</strong></li>
                    <li>Envia para <strong>toda a audiência</strong> da campanha.</li>
                    <li>Quem responder cai na fila <strong>sem IA</strong> (vai direto pro corretor).</li>
                  </ul>
                  <p style={{ color: 'var(--color-danger, #dc2626)', fontWeight: 600, margin: '8px 0 0' }}>Não dá pra desfazer.</p>
                </>
              ) : (
                <p style={{ marginTop: 0 }}>Os destinatários e o histórico serão removidos. <strong>Não dá pra desfazer.</strong></p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn--secondary" onClick={() => setConfirmAcao(null)}>Cancelar</button>
              <button
                className="btn btn--primary"
                style={!isDisp ? { background: 'var(--color-danger, #dc2626)', borderColor: 'var(--color-danger, #dc2626)' } : undefined}
                onClick={confirmarAcao}
              >
                {isDisp ? 'Disparar agora' : 'Excluir'}
              </button>
            </div>
          </Modal>
        );
      })()}

      {relatorio && (
        <Modal open onClose={() => setRelatorio(null)} title={`Relatório — ${relatorio.campanha?.nome || ''}`} subtitle={`Template: ${relatorio.campanha?.templateName || '—'}`} size="lg">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {([['Total', relatorio.campanha?.total, ''], ['Enviados', relatorio.campanha?.enviados, ''], ['Entregues', relatorio.campanha?.entregues, '#0E9F6E'], ['Lidos', relatorio.campanha?.lidos, '#3B82F6'], ['Respostas', relatorio.campanha?.respondidos, '#8B5CF6'], ['Falhas', relatorio.campanha?.falhas, '#dc2626']] as [string, number, string][]).map(([label, v, color]) => (
              <div key={label} style={{ minWidth: 84, padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: color || undefined }}>{v ?? 0}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {(relatorio.destinatarios || []).length} contatos · as <strong>falhas</strong> aparecem com o motivo (número sem WhatsApp, inválido, etc.).
          </div>
          <div style={{ maxHeight: 380, overflow: 'auto', border: '1px solid var(--border-light)', borderRadius: 8 }}>
            <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 10px' }}>Telefone</th>
                  <th style={{ padding: '6px 10px' }}>Status</th>
                  <th style={{ padding: '6px 10px' }}>Motivo da falha</th>
                </tr>
              </thead>
              <tbody>
                {(relatorio.destinatarios || []).map((d: any, i: number) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '5px 10px' }}>{d.telefone}</td>
                    <td style={{ padding: '5px 10px', fontWeight: 600, color: d.status === 'FALHOU' ? '#dc2626' : d.status === 'RESPONDIDO' ? '#8B5CF6' : 'var(--text-secondary)' }}>{d.status}</td>
                    <td style={{ padding: '5px 10px', color: '#dc2626' }} title={d.erro || undefined}>{d.status === 'FALHOU' ? (motivoAmigavel(d.erro) || 'motivo não registrado') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Modal: criar/submeter template à Meta ──────────────────────────────────
// Vem pré-preenchido com o aviso de liberação do app (pedido do cliente).
// O backend (POST /whatsapp/templates) submete à Meta; entra PENDING e é
// aprovado em minutos/horas. Só então fica disponível para disparo.

// ════════════════════════════════════════════════════════════════════════════
//  WIZARD — Config → Público → Mensagem → Envio
// ════════════════════════════════════════════════════════════════════════════
function Wizard({ onClose }: { onClose: () => void }) {
  const NUMEROS = useWhatsappNumeros();
  const [step, setStep] = useState(0); // 0=Config 1=Público 2=Mensagem 3=Envio
  const [nome, setNome] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  // audiência
  const [audienciaTipo, setAudienciaTipo] = useState<'TODOS' | 'FILTRO' | 'LISTA'>('FILTRO');
  const [listaRaw, setListaRaw] = useState(''); // números colados (LISTA)
  const [fStatus, setFStatus] = useState('');
  const [fOrigem, setFOrigem] = useState('');
  const [fCorretorId, setFCorretorId] = useState('');
  const [fSemResposta, setFSemResposta] = useState(false);
  const [corretores, setCorretores] = useState<any[]>([]);
  const [audCount, setAudCount] = useState<number | null>(null);
  const [audAmostra, setAudAmostra] = useState<string[]>([]);
  // mensagem
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [vars, setVars] = useState<string[]>([]);
  // fila de disparo (distribui quem responder)
  const [roletaId, setRoletaId] = useState<number | ''>('');
  const [filasDisparo, setFilasDisparo] = useState<any[]>([]);
  // envio
  const [enviando, setEnviando] = useState(false);
  const [prog, setProg] = useState<{ enviados: number; falhas: number; restantes: number } | null>(null);
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Api.corretores().then((r) => setCorretores((r || []).filter((c: any) => c.user?.name))).catch(() => {});
    Api.whatsappTemplates().then((r) => setTemplates(r.items || [])).catch(() => {});
    Api.roletas('DISPARO').then((r) => setFilasDisparo(r || [])).catch(() => {});
  }, []);

  const filtro = useMemo(() => ({
    status: fStatus || undefined,
    origem: fOrigem || undefined,
    corretorId: fCorretorId || undefined,
    semResposta: fSemResposta || undefined,
  }), [fStatus, fOrigem, fCorretorId, fSemResposta]);

  // Números válidos/únicos extraídos da lista colada (LISTA).
  const listaNumeros = useMemo(() => parseListaNumeros(listaRaw), [listaRaw]);

  // Prévia da audiência (debounced) ao mudar filtro / tipo.
  useEffect(() => {
    // LISTA: conta direto do que foi colado, sem ir ao servidor.
    if (audienciaTipo === 'LISTA') {
      setAudCount(listaNumeros.length);
      setAudAmostra(listaNumeros.slice(0, 3));
      return;
    }
    const t = setTimeout(() => {
      Api.campanhaAudienciaPreview({ audienciaTipo, audienciaFiltro: filtro })
        .then((r) => { setAudCount(r.total); setAudAmostra(r.amostra || []); })
        .catch(() => setAudCount(null));
    }, 350);
    return () => clearTimeout(t);
  }, [audienciaTipo, filtro, listaNumeros]);

  const tpl = templates.find((t) => t.name === templateName);
  const varCount = tpl?.varCount || 0;
  useEffect(() => { setVars((v) => Array.from({ length: varCount }, (_, i) => v[i] ?? '')); }, [varCount]);

  // Preview renderizado do corpo do template com as variáveis preenchidas.
  const previewBody = useMemo(() => {
    let body: string = tpl?.bodyText || '';
    vars.forEach((val, i) => {
      const sub = val?.startsWith('{{') ? `[${val.replace(/[{}]/g, '')}]` : (val || `{{${i + 1}}}`);
      body = body.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), sub);
    });
    return body;
  }, [tpl, vars]);

  const podeAvancar =
    (step === 0 && nome.trim().length >= 2) ||
    (step === 1 && (audCount ?? 0) > 0) ||
    (step === 2 && !!templateName && vars.every((v) => v.trim().length > 0)) ||
    step === 3;

  async function dispararAgora() {
    setErro(''); setEnviando(true); setProg({ enviados: 0, falhas: 0, restantes: audCount || 0 });
    try {
      const c = await Api.campanhaCreate({
        nome: nome.trim(),
        phoneNumberId: phoneNumberId || null,
        numeroExibicao: NUMEROS.find((n) => n.id === phoneNumberId)?.label || null,
        templateName,
        templateLang: tpl?.language || 'pt_BR',
        templateVars: vars,
        audienciaTipo,
        audienciaFiltro: filtro,
        audienciaLista: audienciaTipo === 'LISTA' ? listaNumeros : undefined,
        roletaId: roletaId || null,
      });
      // loop de disparo em lote até zerar
      let guard = 0;
      // eslint-disable-next-line no-constant-condition
      while (guard++ < 500) {
        const r = await Api.campanhaEnviar(c.id);
        setProg({ enviados: r.totalEnviados, falhas: r.totalFalhas, restantes: r.restantes });
        if (r.concluida) break;
        await new Promise((res) => setTimeout(res, 400));
      }
      setFeito(true);
    } catch (e: any) {
      setErro(e?.message || 'Falha ao disparar a campanha.');
    } finally {
      setEnviando(false);
    }
  }

  async function salvarRascunho() {
    setErro('');
    try {
      await Api.campanhaCreate({
        nome: nome.trim(), phoneNumberId: phoneNumberId || null,
        numeroExibicao: NUMEROS.find((n) => n.id === phoneNumberId)?.label || null,
        templateName: templateName || null, templateLang: tpl?.language || 'pt_BR', templateVars: vars,
        audienciaTipo, audienciaFiltro: filtro, audienciaLista: audienciaTipo === 'LISTA' ? listaNumeros : undefined,
        roletaId: roletaId || null,
      });
      onClose();
    } catch (e: any) { setErro(e?.message || 'Falha ao salvar.'); }
  }

  const STEPS = ['Config', 'Público', 'Mensagem', 'Envio'];

  return (
    <div className="camp-modal__backdrop">
      <div className="camp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="camp-modal__head">
          <h2>Nova Campanha</h2>
          <button className="camp-modal__close" onClick={onClose} disabled={enviando}>✕</button>
        </div>

        <div className="camp-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={'camp-step' + (i === step ? ' is-active' : '') + (i < step ? ' is-done' : '')}>
              <span className="camp-step__num">{i < step ? '✓' : i + 1}</span>{s}
            </div>
          ))}
        </div>

        <div className="camp-modal__body">
          <div className="camp-form">
            {step === 0 && (
              <>
                <div className="field">
                  <label className="field__label">Nome da campanha *</label>
                  <input className="field__input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Lançamento Palazzo — base trafego" />
                </div>
                <div className="field">
                  <label className="field__label">Número de envio (origem)</label>
                  <select className="field__select" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)}>
                    {NUMEROS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                  </select>
                  <small className="camp-hint">No WhatsApp Business o envio é por template aprovado.</small>
                </div>
                <div className="field">
                  <label className="field__label">Fila de disparo (distribuição de quem responder)</label>
                  <select className="field__select" value={roletaId} onChange={(e) => setRoletaId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Nenhuma (não distribui automaticamente)</option>
                    {filasDisparo.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                  <small className="camp-hint">Quando o lead responder (levantar a mão), cai pro próximo corretor da fila escolhida. Crie as filas em “Filas de Disparo”.</small>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="field">
                  <label className="field__label">Audiência</label>
                  <div className="camp-radios">
                    <label className={'camp-radio' + (audienciaTipo === 'FILTRO' ? ' is-on' : '')}>
                      <input type="radio" checked={audienciaTipo === 'FILTRO'} onChange={() => setAudienciaTipo('FILTRO')} /> Por filtro
                    </label>
                    <label className={'camp-radio' + (audienciaTipo === 'TODOS' ? ' is-on' : '')}>
                      <input type="radio" checked={audienciaTipo === 'TODOS'} onChange={() => setAudienciaTipo('TODOS')} /> Todos os leads
                    </label>
                    <label className={'camp-radio' + (audienciaTipo === 'LISTA' ? ' is-on' : '')}>
                      <input type="radio" checked={audienciaTipo === 'LISTA'} onChange={() => setAudienciaTipo('LISTA')} /> Colar lista / nº
                    </label>
                  </div>
                </div>
                {audienciaTipo === 'FILTRO' && (
                  <div className="form-grid">
                    <div className="field">
                      <label className="field__label">Status do lead</label>
                      <select className="field__select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                        <option value="">Qualquer</option>
                        {STATUS_LEAD.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field__label">Origem / campanha contém</label>
                      <input className="field__input" value={fOrigem} onChange={(e) => setFOrigem(e.target.value)} placeholder="Ex.: META, trafego pons, parceiro" />
                    </div>
                    <div className="field">
                      <label className="field__label">Corretor</label>
                      <select className="field__select" value={fCorretorId} onChange={(e) => setFCorretorId(e.target.value)}>
                        <option value="">Todos</option>
                        {corretores.map((c) => <option key={c.id} value={c.id}>{c.user?.name}</option>)}
                      </select>
                    </div>
                    <div className="field camp-check">
                      <label><input type="checkbox" checked={fSemResposta} onChange={(e) => setFSemResposta(e.target.checked)} /> Só quem <strong>não respondeu</strong> (funil remarketing)</label>
                    </div>
                  </div>
                )}
                {audienciaTipo === 'LISTA' && (
                  <div className="field">
                    <label className="field__label">Números — um por linha (ou separados por vírgula)</label>
                    <textarea
                      className="field__input camp-lista"
                      value={listaRaw}
                      onChange={(e) => setListaRaw(e.target.value)}
                      rows={7}
                      placeholder={'Cole aqui. Ex.:\n47 99159-8050\n(47) 9201-7377\n5547918590029'}
                    />
                    <small className="camp-hint">
                      Aceita um único número ou uma lista colada. DDD/DDI detectados automaticamente (BR).
                      {listaRaw.trim() && (() => {
                        const brutas = listaRaw.split(/[\n,;\t]+/).filter((s) => s.trim()).length;
                        const inval = brutas - listaNumeros.length;
                        return (
                          <> {' · '}<strong>{listaNumeros.length}</strong> válido(s)
                            {inval > 0 && <span className="camp-muted"> · {inval} ignorado(s)/duplicado(s)</span>}
                          </>
                        );
                      })()}
                    </small>
                  </div>
                )}
                <div className="camp-aud-count">
                  <strong>{audCount === null ? '…' : audCount}</strong> {audienciaTipo === 'LISTA' ? 'número(s) nesta campanha' : 'leads nesta audiência'}
                  {audAmostra.length > 0 && <span className="camp-muted"> — ex.: {audAmostra.slice(0, 3).join(', ')}…</span>}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="field">
                  <label className="field__label">Template aprovado (WhatsApp Business) *</label>
                  <select className="field__select" value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
                    <option value="">Selecione…</option>
                    {templates.map((t) => <option key={t.name} value={t.name}>{t.name} · {t.category}</option>)}
                  </select>
                  {templates.length === 0 && <small className="camp-hint">Nenhum template aprovado encontrado na WABA.</small>}
                </div>
                {varCount > 0 && (
                  <div className="field">
                    <label className="field__label">Variáveis do corpo</label>
                    {Array.from({ length: varCount }).map((_, i) => (
                      <div key={i} className="camp-var">
                        <span className="camp-var__tag">{`{{${i + 1}}}`}</span>
                        <input className="field__input" value={vars[i] || ''} onChange={(e) => setVars((v) => v.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Texto fixo ou {{nome}}" />
                      </div>
                    ))}
                    <small className="camp-hint">Use <code>{'{{nome}}'}</code> para o primeiro nome do lead; ou digite um texto fixo.</small>
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <div className="camp-resumo">
                {!feito ? (
                  <>
                    <h3>Pronto para disparar</h3>
                    <ul>
                      <li><span>Campanha</span><strong>{nome}</strong></li>
                      <li><span>Número</span><strong>{NUMEROS.find((n) => n.id === phoneNumberId)?.label}</strong></li>
                      <li><span>Template</span><strong>{templateName || '—'}</strong></li>
                      <li><span>Audiência</span><strong>{audCount ?? 0} leads</strong></li>
                    </ul>
                    {prog && <div className="camp-progress"><div className="camp-bar"><div className="camp-bar__fill" style={{ width: `${audCount ? Math.round(((prog.enviados + prog.falhas) / audCount) * 100) : 0}%` }} /></div><div className="camp-muted">{prog.enviados} enviadas · {prog.falhas} falhas · {prog.restantes} restantes</div></div>}
                    {erro && <div className="camp-erro">{erro}</div>}
                  </>
                ) : (
                  <div className="camp-done">
                    <div className="camp-done__icon">✅</div>
                    <h3>Campanha disparada!</h3>
                    <p>{prog?.enviados} mensagens enviadas{prog?.falhas ? ` · ${prog.falhas} falhas` : ''}.</p>
                    <button className="btn btn--primary" onClick={onClose}>Concluir</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview WhatsApp */}
          <aside className="camp-preview">
            <div className="camp-phone">
              <div className="camp-phone__head"><span className="camp-phone__avatar">P</span><div><strong>Pons Imobiliário</strong><small>online</small></div></div>
              <div className="camp-phone__body">
                <div className="camp-bubble">{previewBody ? previewBody : 'Selecione um template para ver a prévia.'}</div>
              </div>
            </div>
            <div className="camp-preview__meta">{audCount ?? 0} contatos</div>
          </aside>
        </div>

        {!feito && (
          <div className="camp-modal__foot">
            <button className="btn btn--ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))} disabled={enviando}>
              {step === 0 ? 'Cancelar' : 'Voltar'}
            </button>
            <div className="camp-foot__right">
              {step === 3 ? (
                <>
                  <button className="btn btn--secondary" onClick={salvarRascunho} disabled={enviando}>Salvar rascunho</button>
                  <button className="btn btn--primary" onClick={dispararAgora} disabled={enviando || !templateName || (audCount ?? 0) === 0}>
                    {enviando ? 'Disparando…' : 'Disparar agora'}
                  </button>
                </>
              ) : (
                <button className="btn btn--primary" onClick={() => setStep(step + 1)} disabled={!podeAvancar}>Próximo</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
