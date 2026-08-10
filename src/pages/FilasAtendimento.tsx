import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

// ═══════════════════════════════════════════════════════════════════════════
// Filas de Atendimento (estilo Imobilead, tema escuro do sistema)
// Roteia leads do formulário do Facebook para os corretores certos, na ordem.
// Reaproveita 100% o backend de Roletas (uma "fila" = uma Roleta).
// ═══════════════════════════════════════════════════════════════════════════

const MODOS = [
  { v: 'ROUND_ROBIN', label: 'Roleta (rodízio igualitário)' },
  { v: 'PERFORMANCE', label: 'Por performance' },
  { v: 'PONDERADA', label: 'Ponderada (por peso)' },
  { v: 'MANUAL', label: 'Manual (gestor aprova)' },
];
const DIAS: [string, string][] = [['0', 'Dom'], ['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb']];
const HORAS = Array.from({ length: 24 }, (_, h) => h);

// ordem de rodízio: quem recebeu há mais tempo (ou nunca) vem primeiro
const ordemRR = (a: any, b: any) => {
  const ta = a.ultimaAtribuicao ? new Date(a.ultimaAtribuicao).getTime() : 0;
  const tb = b.ultimaAtribuicao ? new Date(b.ultimaAtribuicao).getTime() : 0;
  if (ta !== tb) return ta - tb;
  return (a.totalRecebidos || 0) - (b.totalRecebidos || 0);
};

const fmtData = (d?: string) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function FilasAtendimento({ tipo = 'ATENDIMENTO' }: { tipo?: 'ATENDIMENTO' | 'DISPARO' } = {}) {
  const ehDisparo = tipo === 'DISPARO';
  const { data: filas, loading, error, reload } = useApi<any[]>(() => Api.roletas(tipo), [tipo]);
  const { data: corretores } = useApi<any[]>(() => Api.corretores());
  const { data: formularios } = useApi<{ nome: string; leads: number }[]>(() => Api.roletaFormularios());
  const [filaAtivaId, setFilaAtivaId] = useState<number | null>(null);
  const [modal, setModal] = useState<null | 'nova' | any>(null);
  const [histAberto, setHistAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const toast = useToast();
  const confirm = useConfirm();

  const toggleAtiva = async (f: any) => {
    try {
      await Api.roletaUpdate(f.id, { ativa: !f.ativa });
      reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const remover = async (f: any) => {
    const ok = await confirm({ title: 'Excluir fila?', message: `"${f.nome}" será removida. Os leads dela voltam pro bolsão.`, tone: 'danger' });
    if (!ok) return;
    try { await Api.roletaDelete(f.id); toast.success('Fila removida'); reload(); }
    catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  if (loading) return <Shell onNova={() => setModal('nova')} ehDisparo={ehDisparo}><LoadingBlock /></Shell>;
  if (error) return <Shell onNova={() => setModal('nova')} ehDisparo={ehDisparo}><ErrorBlock error={error} /></Shell>;

  const lista = filas || [];
  const ativa = lista.find((f) => f.id === filaAtivaId) || lista.find((f) => f.ativa) || lista[0];
  // Ordem = só quem REALMENTE pode receber (mesmo filtro da distribuição no
  // backend): pausado por recebendoLeads ou conta inativa aparece à parte,
  // senão o gestor vê "1º" alguém que a fila pula e a ordem parece furada.
  const ordem = ativa
    ? [...(ativa.participantes || [])].filter((p: any) => p.ativo && p.recebendoLeads !== false && p.contaAtiva !== false).sort(ordemRR)
    : [];
  const foraDaOrdem = ativa
    ? (ativa.participantes || []).filter((p: any) => p.ativo && (p.recebendoLeads === false || p.contaAtiva === false))
    : [];
  const filtradas = lista.filter((f) => f.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <Shell onNova={() => setModal('nova')} ehDisparo={ehDisparo}>
      {/* ═══════════ FILAS ATIVAS ═══════════ */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex-between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Filas ativas</h3>
            <div className="text-xs text-secondary">Ordem de atendimento dos corretores na fila selecionada</div>
          </div>
          <select className="field__select" style={{ width: 'auto', minWidth: 200 }} value={ativa?.id ?? ''} onChange={(e) => setFilaAtivaId(Number(e.target.value))}>
            {lista.map((f) => <option key={f.id} value={f.id}>{f.nome}{f.ativa ? '' : ' (inativa)'}</option>)}
          </select>
        </div>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Ordem</th>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th style={{ width: 90, textAlign: 'center' }}>Checkin</th>
              </tr>
            </thead>
            <tbody>
              {ordem.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--text-secondary)' }}>Nenhum corretor nesta fila. Edite a fila e adicione corretores na aba "Corretores".</td></tr>
              ) : ordem.map((p: any, i: number) => (
                <tr key={p.id}>
                  <td>
                    <div className="avatar avatar--sm" style={{ position: 'relative' }}>
                      {p.initials}
                      <span style={{ position: 'absolute', bottom: -4, right: -4, background: 'var(--pons-cyan, #52f7fe)', color: '#08090F', borderRadius: 999, minWidth: 16, height: 16, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{i + 1}</span>
                    </div>
                  </td>
                  <td className="font-semibold">{p.nome}</td>
                  <td className="text-sm text-secondary">{p.email || '—'}</td>
                  <td className="text-sm text-secondary">{p.telefone || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {p.online
                      ? <Icon name="check" size={16} style={{ color: 'var(--color-success)' }} />
                      : <span title="Offline" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>—</span>}
                  </td>
                </tr>
              ))}
              {foraDaOrdem.map((p: any) => (
                <tr key={p.id} style={{ opacity: 0.45 }}>
                  <td><div className="avatar avatar--sm">{p.initials}</div></td>
                  <td className="font-semibold">
                    {p.nome}
                    <span className="text-xs text-secondary" style={{ marginLeft: 8 }}>
                      {p.contaAtiva === false ? 'conta inativa — fora da fila' : 'pausado (não recebendo) — fora da fila'}
                    </span>
                  </td>
                  <td className="text-sm text-secondary">{p.email || '—'}</td>
                  <td className="text-sm text-secondary">{p.telefone || '—'}</td>
                  <td style={{ textAlign: 'center' }}><span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>—</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════ GERENCIAR FILAS ═══════════ */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Gerenciar filas</h3>
          <div className="flex" style={{ gap: 8 }}>
            <input className="field__input" style={{ width: 200, height: 34 }} placeholder="Pesquisar fila…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <button className="btn btn--secondary btn--sm" onClick={() => setHistAberto(true)}><Icon name="history" size={13} /> Histórico de alterações</button>
            <button className="btn btn--primary btn--sm" onClick={() => setModal('nova')}>+ Adicionar fila</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Título</th>
                <th className="numeric">Tempo (SLA)</th>
                <th>Origens (formulários)</th>
                <th className="numeric">Corretores</th>
                <th>Criado em</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Transf. auto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--text-secondary)' }}>Nenhuma fila. Clique em "+ Adicionar fila".</td></tr>
              ) : filtradas.map((f) => {
                const forms = String(f.formularioFiltro || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                const nPart = (f.participantes || []).filter((p: any) => p.ativo).length;
                return (
                  <tr key={f.id}>
                    <td className="font-semibold">{f.nome}</td>
                    <td className="numeric text-sm">{f.slaHoras ?? '—'}min</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {forms.length === 0 && !f.origemFiltro && !f.campanhaFiltro && <span className="text-xs text-secondary">qualquer</span>}
                        {forms.map((nm: string) => <span key={nm} className="badge badge--analysis" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="doc" size={11} /> {nm}</span>)}
                        {f.origemFiltro && <span className="badge badge--neutral" style={{ fontSize: 11 }}>{f.origemFiltro}</span>}
                        {f.campanhaFiltro && <span className="badge badge--launch" style={{ fontSize: 11 }}>campanha: {f.campanhaFiltro}</span>}
                      </div>
                    </td>
                    <td className="numeric text-sm">{nPart}</td>
                    <td className="text-sm text-secondary">{fmtData(f.criadoEm)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className={'badge ' + (f.ativa ? 'badge--signed' : 'badge--cancelled')} style={{ cursor: 'pointer', border: 'none' }} onClick={() => toggleAtiva(f)} title="Clique pra ativar/desativar">
                        {f.ativa ? 'ATIVA' : 'INATIVA'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {nPart > 0
                        ? <Icon name="check" size={15} style={{ color: 'var(--color-success)' }} />
                        : <span title="Sem corretor — não distribui" style={{ color: 'var(--color-danger, #e5484d)', display: 'inline-flex' }}><Icon name="warn" size={15} /></span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => setModal(f)}>Editar</button>
                      <button className="btn btn--ghost btn--sm" style={{ color: 'var(--color-danger, #e5484d)' }} onClick={() => remover(f)}>Excluir</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <FilaModal
          fila={modal === 'nova' ? null : modal}
          corretores={corretores || []}
          formularios={formularios || []}
          ehDisparo={ehDisparo}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); reload(); }}
        />
      )}
      {histAberto && <HistoricoModal onClose={() => setHistAberto(false)} />}
    </Shell>
  );
}

// ─────────────────────── Histórico de alterações (auditoria antes/depois) ───────────────────────
const ACAO_LABEL: Record<string, string> = {
  CRIADA: 'criada', EDITADA: 'modificada', REMOVIDA: 'removida',
  CORRETOR_ADD: 'corretor adicionado', CORRETOR_REM: 'corretor removido',
};

function HistoricoModal({ onClose }: { onClose: () => void }) {
  const { data, loading, error } = useApi<any[]>(() => Api.roletaHistorico(), []);
  const [aberto, setAberto] = useState<number | null>(null);
  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const itens = data || [];
  return (
    <Modal open onClose={onClose} title="Histórico de alterações" subtitle="Auditoria das filas — quem mudou, quando e o quê" size="xl">
      {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : itens.length === 0 ? (
        <div className="text-secondary" style={{ padding: 24, textAlign: 'center' }}>Nenhuma alteração registrada ainda. As mudanças nas filas passam a aparecer aqui.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {itens.map((h) => {
            const on = aberto === h.id;
            return (
              <div key={h.id} style={{ border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
                <button onClick={() => setAberto(on ? null : h.id)} className="flex" style={{ width: '100%', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <Icon name={on ? 'arrow_down' : 'arrow_right'} size={14} />
                  <div style={{ flex: 1 }}>
                    <div>
                      <span className="font-semibold">Fila "{h.roletaNome}"</span>{' '}
                      <span className="badge badge--neutral" style={{ fontSize: 10 }}>{ACAO_LABEL[h.acao] || h.acao}</span>
                    </div>
                    <div className="text-xs text-secondary">por {h.userNome || '—'} · {fmt(h.createdAt)}</div>
                  </div>
                </button>
                {on && <DiffView antes={h.antes} depois={h.depois} />}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function DiffView({ antes, depois }: { antes: any; depois: any }) {
  const keys = Array.from(new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]));
  const changed = (k: string) => JSON.stringify(antes?.[k]) !== JSON.stringify(depois?.[k]);
  const Col = ({ titulo, cor, snap }: { titulo: string; cor: string; snap: any }) => (
    <div style={{ padding: 12 }}>
      <div className="text-xs" style={{ fontWeight: 700, marginBottom: 8, color: cor, letterSpacing: '0.06em' }}>{titulo}</div>
      {!snap ? (
        <div className="text-xs text-secondary">{titulo === 'ANTES' ? '— (fila nova)' : '— (fila removida)'}</div>
      ) : keys.map((k) => {
        const mud = changed(k);
        return (
          <div key={k} style={{ fontSize: 12, padding: '3px 0', opacity: mud ? 1 : 0.5 }}>
            <span className="text-secondary">{k}: </span>
            <span style={{ fontWeight: mud ? 700 : 400, color: mud ? 'var(--pons-cyan, #52f7fe)' : undefined }}>{String(snap?.[k] ?? '—')}</span>
          </div>
        );
      })}
    </div>
  );
  return (
    <div style={{ borderTop: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
      <div style={{ borderRight: '1px solid var(--border-light)' }}><Col titulo="ANTES" cor="var(--text-secondary)" snap={antes} /></div>
      <Col titulo="DEPOIS" cor="var(--color-success)" snap={depois} />
    </div>
  );
}

function Shell({ children, onNova, ehDisparo }: { children: React.ReactNode; onNova: () => void; ehDisparo?: boolean }) {
  return (
    <>
      <Topbar title={ehDisparo ? 'Filas de Disparo' : 'Filas de Atendimento'} />
      <div className="main__content">
        <PageHeader
          breadcrumb={ehDisparo ? 'Marketing · Campanhas de WhatsApp' : 'Comercial · Distribuição de leads'}
          title={ehDisparo ? 'Filas de Disparo' : 'Filas de Atendimento'}
          subtitle={ehDisparo
            ? 'Cada fila define a ordem dos corretores que atendem quem RESPONDER à campanha de WhatsApp (o lead levanta a mão e cai pro próximo).'
            : 'Cada fila leva os leads de um formulário do Facebook para os corretores certos, na ordem definida.'}
        />
        {children}
      </div>
    </>
  );
}

// ─────────────────────── Modal Cadastrar/Editar fila (3 abas) ───────────────────────
function FilaModal({ fila, corretores, formularios, ehDisparo, onClose, onSaved }: {
  fila: any | null; corretores: any[]; formularios: { nome: string; leads: number }[]; ehDisparo?: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const editando = !!fila;
  const toast = useToast();
  const [aba, setAba] = useState<'config' | 'corretores' | 'transferencia'>('config');
  const [saving, setSaving] = useState(false);

  // ── estado do formulário ──
  const [nome, setNome] = useState(fila?.nome || '');
  const [modo, setModo] = useState(fila?.modo || 'ROUND_ROBIN');
  const [origemFiltro, setOrigemFiltro] = useState(fila?.origemFiltro || '');
  const [campanhaFiltro, setCampanhaFiltro] = useState(fila?.campanhaFiltro || '');
  const [ativa, setAtiva] = useState(fila?.ativa ?? true);
  const [formsSel, setFormsSel] = useState<string[]>(String(fila?.formularioFiltro || '').split(',').map((s) => s.trim()).filter(Boolean));
  const [buscaForm, setBuscaForm] = useState(''); // filtro por nome dos formulários
  const [naFila, setNaFila] = useState<number[]>((fila?.participantes || []).map((p: any) => p.corretorId));
  // transferência automática
  const [slaHoras, setSlaHoras] = useState<number>(fila?.slaHoras ?? 4);
  const [maxTransf, setMaxTransf] = useState<number>(fila?.maxTransferencias ?? 10);
  const [dias, setDias] = useState<string[]>(String(fila?.expedienteDias || '1,2,3,4,5').split(',').map((s) => s.trim()).filter(Boolean));
  const [iniHora, setIniHora] = useState<number>(fila?.expedienteInicioHora ?? 8);
  const [fimHora, setFimHora] = useState<number>(fila?.expedienteFimHora ?? 18);
  // Modo de pulo no SLA: PROXIMO (próximo corretor da fila) ou BOLSAO (bolsão de recaptura)
  const [modoPulo, setModoPulo] = useState<'PROXIMO' | 'BOLSAO' | 'NAO_PULAR'>((fila?.modoPulo as any) || 'PROXIMO');
  const [bolsaoDestinoId, setBolsaoDestinoId] = useState<string>(fila?.bolsaoDestinoId ? String(fila.bolsaoDestinoId) : '');
  const [ocultarPosicao, setOcultarPosicao] = useState<boolean>(fila?.ocultarPosicao ?? false);
  const [autoTemplate, setAutoTemplate] = useState<string>(fila?.autoTemplate || ''); // template disparado ao lead cair na fila (CTWA)
  const [direcionarAtendendo, setDirecionarAtendendo] = useState<boolean>(fila?.direcionarAtendendo ?? false); // vai direto pro Atendendo (sem IA)
  const { data: templatesResp } = useApi<{ items: any[] }>(() => Api.whatsappTemplates());
  const templatesAprovados = (templatesResp?.items || []).filter((t: any) => t.status === 'APPROVED');
  const { data: bolsoes } = useApi<any[]>(() => Api.bolsoes());
  const { data: campanhasVistas } = useApi<{ nome: string; id: string | null; leads: number }[]>(() => Api.roletaCampanhas());
  // Anúncios ATIVOS do Meta — pra configurar a fila ANTES de entrar lead (com nome da campanha).
  const { data: anunciosMeta } = useApi<{ anuncios: { id: string; anuncio: string; campanha: string | null }[]; erro?: string }>(() => Api.anunciosMeta());
  const [buscaCampanha, setBuscaCampanha] = useState('');

  const forasDaFila = corretores.filter((c) => c.ativo && !naFila.includes(c.id));
  const nesta = corretores.filter((c) => naFila.includes(c.id));

  const toggleForm = (nm: string) => setFormsSel((cur) => cur.includes(nm) ? cur.filter((x) => x !== nm) : [...cur, nm]);
  const toggleDia = (d: string) => setDias((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]);

  const salvar = async () => {
    if (!nome.trim()) { toast.error('Dê um título à fila'); setAba('config'); return; }
    if (modoPulo === 'BOLSAO' && !bolsaoDestinoId) { toast.error('Selecione o bolsão de destino'); setAba('transferencia'); return; }
    setSaving(true);
    const base: any = {
      ...(ehDisparo ? { tipo: 'DISPARO' } : {}),
      nome: nome.trim(), modo, ativa,
      origemFiltro: origemFiltro || null,
      campanhaFiltro: campanhaFiltro.trim() || null,
      formularioFiltro: formsSel.join(',') || null,
      slaHoras: Number(slaHoras) || 4,
      maxTransferencias: Number(maxTransf) || 10,
      expedienteDias: dias.join(',') || '1,2,3,4,5',
      expedienteInicioHora: Number(iniHora),
      expedienteFimHora: Number(fimHora),
      modoPulo,
      bolsaoDestinoId: modoPulo === 'BOLSAO' && bolsaoDestinoId ? Number(bolsaoDestinoId) : null,
      ocultarPosicao,
      autoTemplate: autoTemplate.trim() || null,
      direcionarAtendendo,
    };
    try {
      if (editando) {
        // PATCH sincroniza config + corretores de uma vez (1 entrada de histórico)
        await Api.roletaUpdate(fila.id, { ...base, participantesCorretorIds: naFila });
      } else {
        await Api.roletaCreate({ ...base, prioridade: formsSel.length ? 10 : 5, participantesCorretorIds: naFila });
      }
      toast.success(editando ? 'Fila atualizada' : 'Fila criada');
      onSaved();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  const TabBtn = ({ id, icon, label }: { id: typeof aba; icon: string; label: string }) => (
    <button className={'btn btn--sm ' + (aba === id ? 'btn--primary' : 'btn--ghost')} onClick={() => setAba(id)}>
      <Icon name={icon} size={13} /> {label}
    </button>
  );

  return (
    <Modal open onClose={onClose} title={editando ? `Editar fila — ${fila.nome}` : 'Cadastrar fila de atendimento'} size="xl">
      <div className="flex" style={{ gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-light)', paddingBottom: 12, flexWrap: 'wrap' }}>
        <TabBtn id="config" icon="settings" label="Configurações da fila" />
        <TabBtn id="corretores" icon="users" label={`Corretores (${naFila.length})`} />
        <TabBtn id="transferencia" icon="clock" label="Transferência Automática" />
      </div>

      {/* ─── ABA 1: CONFIGURAÇÕES ─── */}
      {aba === 'config' && (
        <div className="form-grid form-grid--single" style={{ maxWidth: 560 }}>
          <div className="field">
            <label className="field__label">Título <span style={{ color: 'var(--color-danger, #e5484d)' }}>*</span></label>
            <input className="field__input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Fila Chimarrão · Segunda Avenida" />
          </div>
          <div className="field">
            <label className="field__label">Produtos (formulários do Facebook)</label>
            {formularios.length === 0 ? (
              <div className="field__hint">Nenhum formulário capturado ainda — aparecem aqui quando chegam leads do Meta.</div>
            ) : (() => {
              const todos = [...formularios.map((f) => f.nome), ...formsSel.filter((s) => !formularios.some((f) => f.nome === s))];
              const q = buscaForm.trim().toLowerCase();
              const visiveis = q ? todos.filter((nm) => nm.toLowerCase().includes(q)) : todos;
              return (
                <>
                  <input
                    className="field__input"
                    style={{ marginBottom: 8 }}
                    placeholder="Buscar formulário por nome…"
                    value={buscaForm}
                    onChange={(e) => setBuscaForm(e.target.value)}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 8, padding: 10 }}>
                    {visiveis.map((nm) => {
                      const cnt = formularios.find((f) => f.nome === nm)?.leads ?? 0;
                      const on = formsSel.includes(nm);
                      return (
                        <button key={nm} type="button" onClick={() => toggleForm(nm)}
                          className={'badge ' + (on ? 'badge--analysis' : 'badge--neutral')}
                          style={{ cursor: 'pointer', border: on ? '1px solid var(--pons-cyan, #52f7fe)' : '1px solid transparent', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {on && <Icon name="check" size={11} />}<Icon name="doc" size={11} /> {nm} <span style={{ opacity: 0.6 }}>({cnt})</span>
                        </button>
                      );
                    })}
                    {visiveis.length === 0 && <span className="text-xs text-secondary">Nenhum formulário com "{buscaForm}".</span>}
                  </div>
                </>
              );
            })()}
            <div className="field__hint">Lead do formulário marcado cai nesta fila. Vazio = aceita qualquer formulário.</div>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="field__label">Modo de distribuição</label>
              <select className="field__select" value={modo} onChange={(e) => setModo(e.target.value)}>
                {MODOS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Filtro de origem</label>
              <select className="field__select" value={origemFiltro} onChange={(e) => setOrigemFiltro(e.target.value)}>
                <option value="">Todas as origens</option>
                <option value="META_ADS">Meta Ads (Facebook)</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label className="field__label">Anúncios da campanha (WhatsApp)</label>
            {(() => {
              const termos = campanhaFiltro.split(',').map((s: string) => s.trim()).filter(Boolean);
              const addTermo = (t: string) => {
                const v = t.trim();
                if (!v || termos.includes(v)) return;
                setCampanhaFiltro([...termos, v].join(', '));
                if (!origemFiltro) setOrigemFiltro('META_ADS');
                setBuscaCampanha('');
              };
              const removeTermo = (t: string) => setCampanhaFiltro(termos.filter((x: string) => x !== t).join(', '));
              const q = buscaCampanha.trim().toLowerCase();
              // Agrupa por CAMPANHA (uma opção por campanha, não cada criativo/anúncio).
              // O termo adicionado é o NOME DA CAMPANHA — casa todos os anúncios dela.
              const porCampanha = new Map<string, { campanha: string; anuncios: number; leads: number }>();
              const add = (nome: string | null, anuncios: number, leads: number) => {
                const n = String(nome || '').trim();
                if (!n) return;
                const cur = porCampanha.get(n) || { campanha: n, anuncios: 0, leads: 0 };
                cur.anuncios += anuncios; cur.leads += leads;
                porCampanha.set(n, cur);
              };
              for (const a of anunciosMeta?.anuncios || []) add(a.campanha, 1, 0);
              for (const c of campanhasVistas || []) add(c.nome, 0, c.leads);
              const sugestoes = [...porCampanha.values()]
                .filter((s) => !q || s.campanha.toLowerCase().includes(q))
                .sort((a, b) => b.leads - a.leads || a.campanha.localeCompare(b.campanha))
                .slice(0, 12);
              return (
                <>
                  {/* Chips das campanhas adicionadas */}
                  {termos.length > 0 && (
                    <div className="flex" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {termos.map((t: string) => (
                        <span key={t} style={{ fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: 300, background: 'var(--pons-blue)', color: '#fff', borderRadius: 14, padding: '4px 6px 4px 10px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</span>
                          <button type="button" onClick={() => removeTermo(t)} title="Remover" style={{ background: 'rgba(255,255,255,0.25)', border: 'none', cursor: 'pointer', color: '#fff', width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}><Icon name="x" size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    className="field__input"
                    value={buscaCampanha}
                    placeholder="Buscar campanha… (Enter adiciona)"
                    onChange={(e) => setBuscaCampanha(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTermo(buscaCampanha); } }}
                  />
                  {q && (
                    <div style={{ marginTop: 4, border: '1px solid var(--border-light)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', maxHeight: 260, overflowY: 'auto' }}>
                      {sugestoes.length === 0 ? (
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); addTermo(buscaCampanha); }}
                          style={{ width: '100%', textAlign: 'left', display: 'block', padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--pons-blue)', fontSize: 13 }}>
                          + Adicionar “{buscaCampanha.trim()}” (digitado)
                        </button>
                      ) : sugestoes.map((s) => {
                        const jaSelecionada = termos.includes(s.campanha);
                        return (
                          <button key={s.campanha} type="button"
                            onMouseDown={(e) => { e.preventDefault(); jaSelecionada ? removeTermo(s.campanha) : addTermo(s.campanha); }}
                            title={jaSelecionada ? 'Já adicionada — clique pra remover' : 'Clique pra adicionar'}
                            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: jaSelecionada ? 'rgba(37,99,235,0.12)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                            {jaSelecionada && <span style={{ flexShrink: 0, color: 'var(--pons-blue)', display: 'inline-flex' }}><Icon name="check" size={14} /></span>}
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: jaSelecionada ? 'var(--pons-blue)' : undefined }}>{s.campanha}</div>
                              <div className="text-xs text-secondary">{jaSelecionada ? 'Adicionada' : ''}{jaSelecionada && (s.anuncios > 0 || s.leads > 0) ? ' · ' : ''}{s.anuncios > 0 ? `${s.anuncios} anúncio(s) ativo(s)` : ''}{s.anuncios > 0 && s.leads > 0 ? ' · ' : ''}{s.leads > 0 ? `${s.leads} lead(s)` : ''}</div>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
            <div className="field__hint">Configure ANTES de rodar a campanha — as campanhas <strong>ativas</strong> do Meta já aparecem na busca. Escolha uma ou várias (cada uma pega todos os anúncios dela). Vazio = qualquer anúncio de WhatsApp.{anunciosMeta?.erro ? ' (não consegui puxar do Meta agora — digite o nome manualmente)' : ''}</div>
          </div>
          <div className="field">
            <label className="field__label">Template automático (mensagem que dispara no 1º contato)</label>
            <select className="field__select" value={autoTemplate} onChange={(e) => setAutoTemplate(e.target.value)}>
              <option value="">— Nenhum (a IA responde) —</option>
              {templatesAprovados.map((t: any) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
            <div className="field__hint">Quando o lead cai nesta fila (ex.: clica no anúncio da campanha), dispara este template aprovado na hora — {'{{'}1{'}}'} recebe o nome. Ex.: <strong>conecta_towers_lead_novo</strong> (com o card). Deixe "Nenhum" pra a IA responder normalmente. O template escolhido deve ter só {'{{'}1{'}}'} = nome.</div>
          </div>
          <label className="flex" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={direcionarAtendendo} onChange={(e) => setDirecionarAtendendo(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              <span style={{ fontWeight: 600 }}>Ir direto pro Atendendo (sem IA)</span>
              <span className="field__hint" style={{ display: 'block' }}>Pós-template, o lead já cai reservado ao corretor (aba Atendendo) e a <strong>IA fica desligada</strong> — o corretor assume a conversa. Desmarcado = fica Pendente e a IA responde.</span>
            </span>
          </label>
          <label className="flex" style={{ gap: 8, alignItems: 'center', cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            <span style={{ fontWeight: 600 }}>Fila ativa</span>
          </label>
          <label className="flex" style={{ gap: 8, alignItems: 'center', cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={ocultarPosicao} onChange={(e) => setOcultarPosicao(e.target.checked)} />
            <span style={{ fontWeight: 600 }}>Ocultar posição do corretor</span>
          </label>
        </div>
      )}

      {/* ─── ABA 2: CORRETORES (transfer list) ─── */}
      {aba === 'corretores' && (
        <div>
          <div className="text-sm text-secondary" style={{ marginBottom: 10 }}>Selecione os corretores que atenderão nesta fila.</div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TransferCol titulo={`Fora da fila (${forasDaFila.length})`} cor="var(--text-secondary)" corretores={forasDaFila} acao="add" onAcao={(cid) => setNaFila((c) => [...c, cid])} />
            <TransferCol titulo={`Nesta fila (${nesta.length})`} cor="var(--color-success)" corretores={nesta} acao="rem" onAcao={(cid) => setNaFila((c) => c.filter((x) => x !== cid))} />
          </div>
          <div className="flex" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn btn--secondary btn--sm" onClick={() => setNaFila(corretores.filter((c) => c.ativo).map((c) => c.id))}>Adicionar todos ativos</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setNaFila([])}>Limpar</button>
          </div>
        </div>
      )}

      {/* ─── ABA 3: TRANSFERÊNCIA AUTOMÁTICA ─── */}
      {aba === 'transferencia' && (
        <div className="form-grid form-grid--single" style={{ maxWidth: 560 }}>
          <div className="field">
            <label className="field__label">Expediente — dias da semana</label>
            <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
              {DIAS.map(([v, l]) => (
                <button key={v} type="button" onClick={() => toggleDia(v)}
                  className={'badge ' + (dias.includes(v) ? 'badge--signed' : 'badge--neutral')}
                  style={{ cursor: 'pointer', minWidth: 44 }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="field__label">Início do expediente</label>
              <select className="field__select" value={iniHora} onChange={(e) => setIniHora(Number(e.target.value))}>
                {HORAS.map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Fim do expediente</label>
              <select className="field__select" value={fimHora} onChange={(e) => setFimHora(Number(e.target.value))}>
                {HORAS.map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="field__label">Tempo de pulo (SLA, minutos)</label>
              <input type="number" min={1} className="field__input" value={slaHoras} onChange={(e) => setSlaHoras(Number(e.target.value))} />
              <div className="field__hint">Minutos pro corretor enviar o template. Sem template nesse tempo, o lead sai dele (vai pro modo de pulo).</div>
            </div>
            <div className="field">
              <label className="field__label">Máx. de transferências</label>
              <input type="number" min={1} className="field__input" value={maxTransf} onChange={(e) => setMaxTransf(Number(e.target.value))} disabled={modoPulo === 'BOLSAO'} />
              <div className="field__hint">{modoPulo === 'BOLSAO' ? 'No modo bolsão, o lead vai direto — sem transferências.' : 'Depois desse nº de pulos, para e cai no bolsão.'}</div>
            </div>
          </div>

          {/* Modo de pulo: o que fazer quando o corretor não responde no SLA */}
          <div className="field">
            <label className="field__label">Modo de pulo — quando o corretor não responde</label>
            <select className="field__select" value={modoPulo} onChange={(e) => setModoPulo(e.target.value as 'PROXIMO' | 'BOLSAO' | 'NAO_PULAR')}>
              <option value="PROXIMO">Ir pro próximo corretor da fila</option>
              <option value="BOLSAO">Enviar pro bolsão de recaptura</option>
              <option value="NAO_PULAR">Não pular — o lead fica com o corretor</option>
            </select>
            <div className="field__hint">
              {modoPulo === 'PROXIMO'
                ? 'O lead roda entre os corretores da fila; ao atingir o máx. de transferências, cai no bolsão.'
                : modoPulo === 'BOLSAO'
                ? 'O lead vai direto pro bolsão escolhido abaixo, sem rodar a fila.'
                : 'O lead NÃO pula: fica com o corretor que recebeu, mesmo sem resposta. O "Tempo de pulo" acima é ignorado.'}
            </div>
          </div>

          {modoPulo === 'BOLSAO' && (
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field__label">Tipo de destino</label>
                <select className="field__select" value="BOLSAO" disabled>
                  <option value="BOLSAO">Enviar para um bolsão de recaptura</option>
                </select>
              </div>
              <div className="field">
                <label className="field__label">Selecione o bolsão <span className="field__required">*</span></label>
                <select className="field__select" value={bolsaoDestinoId} onChange={(e) => setBolsaoDestinoId(e.target.value)}>
                  <option value="">— Selecionar —</option>
                  {(bolsoes || []).map((b: any) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
        <button className="btn btn--secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn btn--primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : (editando ? 'Salvar fila' : 'Cadastrar fila')}</button>
      </div>
    </Modal>
  );
}

function TransferCol({ titulo, cor, corretores, acao, onAcao }: {
  titulo: string; cor: string; corretores: any[]; acao: 'add' | 'rem'; onAcao: (cid: number) => void;
}) {
  const [q, setQ] = useState('');
  const filtrados = corretores.filter((c) => (c.nome || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)', fontSize: 12, fontWeight: 700, color: cor }}>{titulo}</div>
      <div style={{ padding: 8 }}>
        <input className="field__input" style={{ height: 32, marginBottom: 6 }} placeholder="Procurar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtrados.length === 0 ? (
            <div className="text-xs text-secondary" style={{ padding: 10, textAlign: 'center' }}>Ninguém aqui</div>
          ) : filtrados.map((c) => (
            <button key={c.id} type="button" onClick={() => onAcao(c.id)}
              className="flex" style={{ gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <div className="avatar avatar--sm">{c.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.nome}</div>
                <div className="text-xs text-secondary" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>
              </div>
              <span style={{ display: 'inline-flex', color: acao === 'add' ? 'var(--color-success)' : 'var(--color-danger, #e5484d)' }}><Icon name={acao === 'add' ? 'plus' : 'x'} size={15} /></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
