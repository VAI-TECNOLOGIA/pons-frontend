import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { FichaLeadModal } from '../components/FichaLeadModal';
import { Icon } from '../components/Icon';
import { LeadsFiltrosPanel, FILTROS_LEAD_VAZIO, filtrosLeadParams, type FiltrosLead } from '../components/LeadsFiltrosPanel';

// Mesmos rótulos de status da tela de Leads (funil da Ju)
const STATUS_OPCOES = [
  { key: 'NOVO', label: 'Tentando Contato' }, { key: 'NAO_RESPONDE', label: 'Não responde' },
  { key: 'LISTA_VIP', label: 'Lista VIP' }, { key: 'EM_ATENDIMENTO', label: 'Em atendimento' },
  { key: 'FLUXO', label: 'Fluxo' }, { key: 'POS_FLUXO', label: 'Pós Fluxo' },
  { key: 'VISITA', label: 'Vídeo/Visita' }, { key: 'NEGOCIANDO', label: 'Em Negociação' },
  { key: 'FECHADO', label: 'Venda' }, { key: 'PERDIDO', label: 'Perdido' },
];

const PRESETS: { label: string; expr: string }[] = [
  { label: 'Segunda 9h',       expr: '0 9 * * 1' },
  { label: 'Quinta 18h',       expr: '0 18 * * 4' },
  { label: 'Sexta 10h',        expr: '0 10 * * 5' },
  { label: 'Sexta 17h',        expr: '0 17 * * 5' },
  { label: 'Todo dia útil 8h', expr: '0 8 * * 1-5' },
  { label: 'Toda manhã 10h',   expr: '0 10 * * *' },
];

// Nomes dos dias na ordem do cron (0=domingo … 6=sábado)
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Converte uma expressão cron simples (agenda semanal/diária "m h * * dow") nos
// seus componentes. Retorna null quando a expressão é avançada demais pro
// seletor amigável (steps, dias do mês, etc.) — aí cai no modo avançado.
function parseCron(expr: string): { minute: number; hour: number; days: number[] } | null {
  const parts = (expr || '').trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, mon, dow] = parts;
  if (dom !== '*' || mon !== '*') return null;
  const minute = Number(m), hour = Number(h);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  let days: number[] = [];
  if (dow !== '*') {
    for (const tok of dow.split(',')) {
      const rng = tok.match(/^(\d)-(\d)$/);
      if (rng) { for (let i = +rng[1]; i <= +rng[2]; i++) days.push(i % 7); }
      else if (/^\d$/.test(tok)) days.push(Number(tok) % 7);
      else return null;
    }
    days = [...new Set(days)].sort((a, b) => a - b);
  }
  return { minute, hour, days };
}

function buildCron(minute: number, hour: number, days: number[]): string {
  const dow = days.length === 0 ? '*' : [...days].sort((a, b) => a - b).join(',');
  return `${minute} ${hour} * * ${dow}`;
}

// Texto legível pra humanos: "Seg, Qui às 09:00", "Dias úteis às 08:00", etc.
function cronToHuman(expr: string): string {
  const p = parseCron(expr);
  if (!p) return expr;
  const hora = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  const set = new Set(p.days);
  if (p.days.length === 0 || set.size === 7) return `Todo dia às ${hora}`;
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return `Dias úteis às ${hora}`;
  return `${[...p.days].sort((a, b) => a - b).map((d) => DOW[d]).join(', ')} às ${hora}`;
}

export default function Distribuicao() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [fichaLeadId, setFichaLeadId] = useState<number | null>(null);
  // Escopo: 'sistema' (sem filtro de equipe) | 'equipes' (filtra pelas equipes selecionadas)
  const [escopo, setEscopo] = useState<'sistema' | 'equipes'>('sistema');
  const [equipesSel, setEquipesSel] = useState<number[]>([]);
  const [cronExpr, setCronExpr] = useState('0 9 * * 1');
  const [showAdv, setShowAdv] = useState(false);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.distribuicaoList());
  const { data: equipes } = useApi<any[]>(() => Api.equipes());
  // Bolsão: leads aguardando distribuição. Mostra a "jornada" antes das regras.
  // Filtros iguais aos da tela de Leads (pedido do marketing 21/07) — server-side
  // no GET /leads; por padrão mostra o bolsão (sem corretor).
  const [bolsaoLimit, setBolsaoLimit] = useState(50);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosLead>({ ...FILTROS_LEAD_VAZIO, corretorId: 'sem' });
  const filtroParams = filtrosLeadParams({ ...filtros, corretorId: filtros.corretorId || 'sem' });
  const filtrosKey = JSON.stringify(filtroParams) + bolsaoLimit;
  const { data: bolsao, reload: reloadBolsao } = useApi<{ total: number; leads: any[] }>(
    () => Api.leadsPaginado({ page: 1, limit: bolsaoLimit, ...filtroParams }),
    [filtrosKey],
  );
  const temFiltroExtra = JSON.stringify({ ...filtros, corretorId: '' }) !== JSON.stringify({ ...FILTROS_LEAD_VAZIO, corretorId: '' }) || (filtros.corretorId && filtros.corretorId !== 'sem');
  const { data: opcoesFiltro } = useApi<{ origens: string[]; campanhas: string[] }>(() => Api.leadFiltrosOpcoes());
  const { data: empreendimentosFiltro } = useApi<any[]>(() => Api.empreendimentos());
  const { data: corretores } = useApi<any[]>(() => Api.corretores());
  // Seleção em massa + transferência manual (pedido do cliente)
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [alvoTransf, setAlvoTransf] = useState<number | ''>('');
  const [transferindo, setTransferindo] = useState(false);
  const [buscaBolsao, setBuscaBolsao] = useState(''); // busca por nome/telefone no bolsão (antes de transferir)
  const toggleSel = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTodos = (leads: any[]) => setSel((s) => s.size >= leads.length ? new Set() : new Set(leads.map((l) => l.id)));
  const transferirSelecionados = async () => {
    if (!sel.size || !alvoTransf) return;
    setTransferindo(true);
    try {
      const r = await Api.roletaTransferirMassa([...sel], Number(alvoTransf));
      toast.success(`${r.transferidos} lead(s) transferido(s) para ${r.corretor}.`);
      setSel(new Set()); setAlvoTransf('');
      reloadBolsao();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setTransferindo(false);
    }
  };
  const [arquivando, setArquivando] = useState(false);
  const arquivarSelecionados = async () => {
    if (!sel.size) return;
    const ok = await confirm({ title: `Arquivar ${sel.size} lead(s)?`, message: 'Eles somem do bolsão e das telas (útil pra duplicatas/testes), mas ficam preservados no banco.', tone: 'danger' });
    if (!ok) return;
    setArquivando(true);
    try {
      const r = await Api.leadsArquivar([...sel]);
      toast.success(`${r.arquivados} lead(s) arquivado(s).`);
      setSel(new Set());
      reloadBolsao();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setArquivando(false);
    }
  };
  // Alvo opcional: mandar os leads SÓ pra este corretor (ignora escopo/equipe/cidade)
  const [corretorId, setCorretorId] = useState<number | ''>('');
  const toast = useToast();
  const confirm = useConfirm();

  // Abre o modal já com o escopo correto baseado na regra sendo editada
  const abrirCriar = () => {
    setEditing(null);
    setEscopo('sistema');
    setEquipesSel([]);
    setCorretorId('');
    setCronExpr('0 9 * * 1');
    setShowAdv(false);
    setOpen(true);
  };
  const abrirEditar = (d: any) => {
    setEditing(d);
    const ids: number[] = Array.isArray(d.equipeIds) ? d.equipeIds : (d.equipeId ? [d.equipeId] : []);
    setEscopo(ids.length > 0 ? 'equipes' : 'sistema');
    setEquipesSel(ids);
    setCorretorId(d.corretorId || '');
    const expr = d.cronExpr || '0 9 * * 1';
    setCronExpr(expr);
    setShowAdv(parseCron(expr) === null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!corretorId && escopo === 'equipes' && equipesSel.length === 0) {
      toast.error('Selecione pelo menos 1 equipe — ou troque o escopo pra "Sistema todo".');
      return;
    }
    if (!cronExpr.trim()) {
      toast.error('Defina quando a regra deve rodar.');
      return;
    }
    const fd = new FormData(e.currentTarget);
    const alvoEspecifico = corretorId ? Number(corretorId) : null;
    const payload: any = {
      nome: String(fd.get('nome') || ''),
      cronExpr: cronExpr.trim(),
      qtdPorCorretor: Number(fd.get('qtdPorCorretor') || 10),
      cidade: String(fd.get('cidade') || '') || null,
      origemLead: String(fd.get('origemLead') || '') || null,
      statusLead: String(fd.get('statusLead') || '') || null,
      ativa: editing?.ativa ?? true,
      // Alvo específico tem prioridade — manda só pra esse corretor (ignora escopo)
      corretorId: alvoEspecifico,
      // Escopo: sistema → equipeIds null + equipeId null. Equipes → equipeIds = sel
      equipeIds: alvoEspecifico ? null : (escopo === 'equipes' ? equipesSel : null),
      equipeId: null, // sempre limpa legado quando salvamos pelo modal novo
    };
    try {
      if (editing) await Api.distribuicaoUpdate(editing.id, payload);
      else await Api.distribuicaoCreate(payload);
      toast.success('Salvo'); setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const toggleEquipe = (id: number) => {
    setEquipesSel((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  // Mostra o escopo da regra na tabela ("Sistema" ou "Equipes: A, B")
  const escopoLabel = (d: any) => {
    const ids: number[] = Array.isArray(d.equipeIds) ? d.equipeIds : (d.equipeId ? [d.equipeId] : []);
    if (ids.length === 0) return 'Sistema todo';
    const nomes = ids.map((id) => (equipes || []).find((e: any) => e.id === id)?.nome || `#${id}`);
    return nomes.join(', ');
  };

  const executar = async (d: any) => {
    const ok = await confirm({ title: 'Executar agora?', message: `Disparar "${d.nome}" agora?` });
    if (!ok) return;
    try {
      const r = await Api.distribuicaoExecutar(d.id);
      const res = r.resultado || {};
      if (!res.leadsDistribuidos) {
        toast.info(res.corretoresAtendidos
          ? 'Regra executada — nenhum lead do bolsão casou com os filtros dela.'
          : 'Regra executada — nenhum corretor elegível pra receber (confira equipe/filial da regra).');
      } else {
        toast.success(`Distribuídos ${res.leadsDistribuidos} leads pra ${res.corretoresAtendidos} corretores`);
      }
      reload(); reloadBolsao();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const excluir = async (d: any) => {
    const ok = await confirm({ title: 'Excluir?', message: `"${d.nome}" será removido.`, tone: 'danger' });
    if (!ok) return;
    await Api.distribuicaoDelete(d.id); toast.success('Removido'); reload();
  };

  const toggle = async (d: any) => {
    await Api.distribuicaoUpdate(d.id, { ativa: !d.ativa });
    reload();
  };

  // Filtro por nome/telefone sobre os leads já carregados do bolsão (localizar antes de transferir).
  const qBolsao = buscaBolsao.trim().toLowerCase();
  const leadsBolsao = (bolsao?.leads || []).filter((l: any) =>
    !qBolsao || (l.nome || '').toLowerCase().includes(qBolsao) || String(l.telefone || '').toLowerCase().includes(qBolsao)
  );

  return (
    <>
      <Topbar
        title="Distribuição Agendada"
        right={<button className="btn btn--primary btn--sm" onClick={abrirCriar}>+ Nova regra</button>}
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Sócios · Distribuição"
          title="Distribuição Automática"
          subtitle="Ex: toda segunda 9h, distribuir 20 leads pra cada corretor de Itapema"
        />

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        {/* ─── Bolsão: leads aguardando distribuição (a jornada) ─── */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div className="text-xs text-secondary">Leads no bolsão aguardando distribuição</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-warning)' }}>{bolsao?.total ?? '…'}</div>
            </div>
            <div className="flex" style={{ gap: 8 }}>
              <button className={'btn btn--sm ' + (mostrarFiltros ? 'btn--primary' : 'btn--secondary')} onClick={() => setMostrarFiltros((v) => !v)}>
                <Icon name="settings" size={13} /> {mostrarFiltros ? 'Fechar Filtros' : 'Filtros'}
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => reloadBolsao()}>↻ Atualizar</button>
            </div>
          </div>
          {mostrarFiltros && (
            <div style={{ marginTop: 12 }}>
              <LeadsFiltrosPanel
                v={filtros}
                onChange={(p) => setFiltros((f) => ({ ...f, ...p }))}
                statuses={STATUS_OPCOES}
                opcoes={opcoesFiltro}
                corretores={corretores}
                empreendimentos={empreendimentosFiltro}
              />
              {temFiltroExtra && (
                <div className="field__hint" style={{ marginTop: -8, marginBottom: 8 }}>
                  Filtro ativo — a lista pode incluir leads fora do bolsão (ex.: com corretor). <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setFiltros({ ...FILTROS_LEAD_VAZIO, corretorId: 'sem' })}>Limpar filtros</span>
                </div>
              )}
            </div>
          )}
          {bolsao && bolsao.total === 0 && (
            <div className="text-xs text-secondary" style={{ marginTop: 8 }}>
              {temFiltroExtra || filtros.dataInicial || filtros.origem || filtros.campanha || filtros.empreendimentoId || filtros.status
                ? 'Nenhum lead bate com os filtros atuais.'
                : <>Bolsão vazio. Importe leads em <strong>Importar Leads</strong> — eles caem aqui e podem ser distribuídos pelas regras abaixo (botão ▶ Executar).</>}
            </div>
          )}
          {bolsao && bolsao.leads.length > 0 && (
            <>
              {/* Busca por nome/telefone — localizar o lead antes de transferir */}
              <div style={{ marginTop: 12 }}>
                <input
                  className="field__input"
                  type="search"
                  placeholder="Buscar no bolsão por nome ou telefone…"
                  value={buscaBolsao}
                  onChange={(e) => setBuscaBolsao(e.target.value)}
                  style={{ maxWidth: 340 }}
                />
              </div>
              {/* Barra de ação — aparece quando há leads selecionados */}
              {sel.size > 0 && (
                <div className="flex" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--pons-cyan, #52f7fe)', borderRadius: 10 }}>
                  <strong style={{ fontSize: 14 }}>{sel.size} selecionado(s)</strong>
                  <button className="btn btn--ghost btn--sm" onClick={() => setSel(new Set())}>Limpar seleção</button>
                  <button className="btn btn--ghost btn--sm" style={{ color: 'var(--color-danger, #e5484d)' }} onClick={arquivarSelecionados} disabled={arquivando}>{arquivando ? 'Arquivando…' : 'Arquivar'}</button>
                  <span style={{ marginLeft: 'auto' }} className="text-xs text-secondary">Transferir para:</span>
                  <select className="field__select" style={{ width: 'auto', height: 34 }} value={alvoTransf} onChange={(e) => setAlvoTransf(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Escolher corretor…</option>
                    {(corretores || []).filter((c: any) => c.ativo).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.nome}{c.equipe ? ` · ${c.equipe.nome}` : ''}</option>
                    ))}
                  </select>
                  <button className="btn btn--primary btn--sm" onClick={transferirSelecionados} disabled={!alvoTransf || transferindo}>
                    {transferindo ? 'Transferindo…' : `Transferir ${sel.size}`}
                  </button>
                </div>
              )}
              <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}>
                        <input type="checkbox" checked={sel.size >= leadsBolsao.length && leadsBolsao.length > 0} onChange={() => toggleTodos(leadsBolsao)} title="Selecionar todos os filtrados" />
                      </th>
                      <th>Nome</th><th>Telefone</th><th>Origem</th><th>Campanha / conjunto</th><th>Interesse</th><th>Entrou</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsBolsao.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>Nenhum lead encontrado pra “{buscaBolsao}”.</td></tr>
                    ) : leadsBolsao.map((l: any) => (
                      <tr key={l.id} style={sel.has(l.id) ? { background: 'var(--bg-elevated)' } : undefined}>
                        <td><input type="checkbox" checked={sel.has(l.id)} onChange={() => toggleSel(l.id)} /></td>
                        <td><span style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }} onClick={() => setFichaLeadId(l.id)} title="Abrir ficha completa do lead">{l.nome}</span></td>
                        <td className="text-xs">{l.telefone || '—'}</td>
                        <td className="text-xs"><span className="badge badge--neutral" style={{ fontSize: 10 }}>{l.origem || '—'}</span></td>
                        <td className="text-xs">{l.campanha || '—'}{l.conjuntoAnuncio ? <span className="text-secondary"> · {l.conjuntoAnuncio}</span> : ''}</td>
                        <td className="text-xs">{l.interesse || '—'}</td>
                        <td className="text-xs text-secondary">{l.createdAt ? new Date(l.createdAt).toLocaleDateString('pt-BR') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex" style={{ gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  <span className="text-xs text-secondary">Mostrando {leadsBolsao.length} de {bolsao.total} no bolsão{qBolsao ? ' (filtro ativo)' : ''}.</span>
                  {bolsao.leads.length < bolsao.total && (
                    <button className="btn btn--ghost btn--sm" onClick={() => setBolsaoLimit((n) => n + 100)}>Carregar mais</button>
                  )}
                  <button className="btn btn--ghost btn--sm" onClick={() => toggleTodos(leadsBolsao)}>{sel.size >= leadsBolsao.length && leadsBolsao.length > 0 ? 'Desmarcar todos' : 'Selecionar todos os filtrados'}</button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Agenda</th><th>Qtd/corretor</th><th>Escopo</th><th>Filtros</th><th>Última exec.</th><th></th></tr>
            </thead>
            <tbody>
              {(data || []).map((d: any) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.nome}</strong>
                    <span className={`badge badge--sm ${d.ativa ? 'badge--launch' : 'badge--neutral'}`} style={{ marginLeft: 6 }}>{d.ativa ? 'ativa' : 'pausada'}</span>
                  </td>
                  <td><span title={d.cronExpr}>{cronToHuman(d.cronExpr)}</span></td>
                  <td>{d.qtdPorCorretor}</td>
                  <td className="text-xs">{escopoLabel(d)}</td>
                  <td className="text-xs">
                    {[d.cidade && `cidade=${d.cidade}`, d.origemLead && `origem=${d.origemLead}`, d.statusLead && `status=${d.statusLead}`].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="text-xs text-secondary">{d.ultimaExecucaoAt ? new Date(d.ultimaExecucaoAt).toLocaleString('pt-BR') : '—'}</td>
                  <td>
                    <div className="flex" style={{ gap: 4 }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => executar(d)}>▶ Executar</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => toggle(d)}>{d.ativa ? '⏸' : '▶'}</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => abrirEditar(d)}>Editar</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => excluir(d)}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma regra criada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? 'Editar regra' : 'Nova regra de distribuição'}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
            <button type="submit" form="dist-form" className="btn btn--primary">Salvar</button>
          </>
        }
      >
        <form id="dist-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} placeholder="Ex: Itapema toda segunda" /></div>

            {/* ─── Escopo (sistema todo vs equipes específicas) ─── */}
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Atribuir regra a *</label>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="escopo"
                    checked={escopo === 'sistema'}
                    onChange={() => { setEscopo('sistema'); setEquipesSel([]); }}
                  />
                  <span>Sistema todo <span className="text-xs text-secondary">(corretores de qualquer equipe)</span></span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="escopo"
                    checked={escopo === 'equipes'}
                    onChange={() => setEscopo('equipes')}
                  />
                  <span>Equipes específicas</span>
                </label>
              </div>

              {escopo === 'equipes' && (
                <div style={{
                  border: '1px solid var(--border-light)', borderRadius: 8, padding: 10,
                  display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 180, overflowY: 'auto',
                }}>
                  {(equipes || []).length === 0 && (
                    <span className="text-xs text-secondary">Nenhuma equipe cadastrada — crie em Equipes primeiro.</span>
                  )}
                  {(equipes || []).map((eq: any) => {
                    const sel = equipesSel.includes(eq.id);
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => toggleEquipe(eq.id)}
                        className="btn btn--sm"
                        style={{
                          background: sel ? eq.cor || '#0E7C9B' : 'transparent',
                          color: sel ? '#fff' : 'var(--text-primary)',
                          border: `1px solid ${sel ? (eq.cor || '#0E7C9B') : 'var(--border-light)'}`,
                        }}
                      >
                        {sel && '✓ '}{eq.nome}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── Alvo: corretor específico (opcional, sobrepõe o escopo) ─── */}
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Mandar pra um corretor específico (opcional)</label>
              <select
                className="field__select"
                value={corretorId}
                onChange={(e) => setCorretorId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— Espalhar entre os corretores (conforme escopo acima) —</option>
                {(corretores || []).filter((c: any) => c.ativo).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}{c.equipe ? ` · ${c.equipe.nome}` : ''}</option>
                ))}
              </select>
              {corretorId ? (
                <div className="field__hint">Os leads vão <strong>todos pra esse corretor</strong> (a quantidade é o "Qtd leads por corretor"). O escopo/equipe acima é ignorado.</div>
              ) : null}
            </div>

            <div className="field">
              <label className="field__label">Quando rodar *</label>
              {(() => {
                const p = parseCron(cronExpr);
                if (!p) {
                  return (
                    <div className="text-xs text-secondary" style={{ marginBottom: 6 }}>
                      Agenda personalizada: <strong>{cronToHuman(cronExpr)}</strong>
                    </div>
                  );
                }
                const timeVal = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
                const setTime = (v: string) => {
                  const [h, m] = v.split(':').map(Number);
                  setCronExpr(buildCron(m || 0, h || 0, p.days));
                };
                const toggleDay = (d: number) => {
                  const s = new Set(p.days);
                  s.has(d) ? s.delete(d) : s.add(d);
                  setCronExpr(buildCron(p.minute, p.hour, [...s]));
                };
                return (
                  <>
                    <div className="flex" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="time" className="field__input" style={{ width: 130 }} value={timeVal} onChange={(e) => setTime(e.target.value)} />
                      <div className="flex" style={{ gap: 4, flexWrap: 'wrap' }}>
                        {DOW.map((n, i) => {
                          const on = p.days.includes(i);
                          return (
                            <button key={i} type="button" className="btn btn--sm" onClick={() => toggleDay(i)}
                              style={{
                                background: on ? '#0E7C9B' : 'transparent',
                                color: on ? '#fff' : 'var(--text-primary)',
                                border: `1px solid ${on ? '#0E7C9B' : 'var(--border-light)'}`,
                                minWidth: 42,
                              }}>{n}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex" style={{ gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCronExpr(buildCron(p.minute, p.hour, [1, 2, 3, 4, 5]))}>Dias úteis</button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCronExpr(buildCron(p.minute, p.hour, []))}>Todo dia</button>
                      {PRESETS.map((pr) => (
                        <button key={pr.expr} type="button" className="btn btn--ghost btn--sm" onClick={() => setCronExpr(pr.expr)}>{pr.label}</button>
                      ))}
                    </div>
                    <div className="text-xs text-secondary" style={{ marginTop: 6 }}>{cronToHuman(cronExpr)}</div>
                  </>
                );
              })()}
              <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 6 }} onClick={() => setShowAdv((s) => !s)}>
                {showAdv ? 'Ocultar avançado' : 'Avançado (cron)'}
              </button>
              {showAdv && (
                <input className="field__input" style={{ marginTop: 6, fontFamily: 'monospace' }} value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} placeholder="0 9 * * 1" />
              )}
            </div>
            <div className="field"><label className="field__label">Qtd leads por corretor</label><input type="number" name="qtdPorCorretor" className="field__input" defaultValue={editing?.qtdPorCorretor || 10} min={1} /></div>
            <div className="field"><label className="field__label">Cidade (opcional)</label><input name="cidade" className="field__input" defaultValue={editing?.cidade || ''} placeholder="Itapema, Balneário Camboriú..." /></div>
            <div className="field">
              <label className="field__label">Origem (opcional)</label>
              <select name="origemLead" className="field__select" defaultValue={editing?.origemLead || ''}>
                <option value="">Qualquer</option>
                <option>META_ADS</option><option>GOOGLE</option><option>SITE</option><option>WHATSAPP</option><option>INDICACAO</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">Status do lead (opcional)</label>
              <select name="statusLead" className="field__select" defaultValue={editing?.statusLead || ''}>
                <option value="">Qualquer não fechado/perdido</option>
                <option>NOVO</option><option>SDR</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {fichaLeadId && <FichaLeadModal leadId={fichaLeadId} onClose={() => setFichaLeadId(null)} />}
    </>
  );
}
