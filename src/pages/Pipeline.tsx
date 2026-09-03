import { useState, useEffect } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useKanbanDnd } from '../lib/useKanbanDnd';
import { useToast } from '../lib/toast';
import { parseFunil, faseDoStatus } from '../lib/funil';
import { MultiFiltro } from '../components/MultiFiltro';

export default function Pipeline() {
  // Filtros do funil (campanha, filial/equipe, corretor, período, busca) — reusa
  // os params do GET /leads. Multi-seleção via MultiFiltro (busca + chips).
  const [fCampanha, setFCampanha] = useState<string[]>([]);
  const [fEquipe, setFEquipe] = useState<string[]>([]);
  const [fCorretor, setFCorretor] = useState<string[]>([]);
  const [fDataIni, setFDataIni] = useState('');
  const [fDataFim, setFDataFim] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaDeb, setBuscaDeb] = useState('');
  useEffect(() => { const t = setTimeout(() => setBuscaDeb(busca.trim()), 400); return () => clearTimeout(t); }, [busca]);
  const temFiltro = !!(fCampanha.length || fEquipe.length || fCorretor.length || fDataIni || fDataFim || buscaDeb);
  const limparFiltros = () => { setFCampanha([]); setFEquipe([]); setFCorretor([]); setFDataIni(''); setFDataFim(''); setBusca(''); setBuscaDeb(''); };

  // Hooks DEVEM vir antes de qualquer return condicional (Rules of Hooks).
  // Busca PAGINADA: GET /leads sem ?page corta em 100 — corretor com 100+ leads
  // via cards "sumindo" do funil (caso Luiz Bier, 02/09). Teto de 1000 cards
  // pra não travar o navegador de CEO/gestor (que enxergam a base inteira).
  const { data, loading, error } = useApi<any[]>(async () => {
    const base: any = {};
    if (fCampanha.length) base.campanha = fCampanha.join(',');
    if (fEquipe.length) base.equipeId = fEquipe.join(',');
    if (fCorretor.length) base.corretorId = fCorretor.join(',');
    if (fDataIni) base.dataInicial = fDataIni;
    if (fDataFim) base.dataFinal = fDataFim;
    if (buscaDeb) base.q = buscaDeb;
    const out: any[] = [];
    for (let page = 1; page <= 5; page++) {
      const r: any = await Api.leads({ ...base, page, limit: 200 });
      const lote = Array.isArray(r) ? r : (r.leads || []);
      out.push(...lote);
      const total = Array.isArray(r) ? lote.length : (r.total ?? lote.length);
      if (lote.length === 0 || out.length >= total) break;
    }
    return out;
  }, [fCampanha.join(','), fEquipe.join(','), fCorretor.join(','), fDataIni, fDataFim, buscaDeb]);
  const { data: settings } = useApi<Record<string, string>>(() => Api.settings());
  const { data: equipes } = useApi<any[]>(() => Api.equipes());
  const { data: corretores } = useApi<any[]>(() => Api.corretores());
  const { data: campanhas } = useApi<{ nome: string }[]>(() => Api.roletaCampanhas());
  const optCampanhas = (campanhas || []).map((c) => ({ value: c.nome, label: c.nome }));
  const optEquipes = (equipes || []).map((e: any) => ({ value: String(e.id), label: e.nome }));
  const optCorretores = (corretores || []).map((c: any) => ({ value: String(c.id), label: c.nome }));
  const [leads, setLeads] = useState<any[]>([]);
  const [showPerdidos, setShowPerdidos] = useState(false);
  const toast = useToast();
  useEffect(() => { if (data) setLeads(data); }, [data]);

  const fases = parseFunil(settings);          // rótulos editáveis pelo cliente
  const cols = fases.filter((f) => f.key !== 'PERDIDO'); // Perdido é terminal (fica no seletor)

  const moveLead = async (id: number, status: string) => {
    const prev = leads;
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await Api.leadUpdate(id, { status });
    } catch (err: any) {
      setLeads(prev);
      toast.error('Erro ao mover: ' + (err.message || 'falha'));
    }
  };

  const dnd = useKanbanDnd(moveLead);

  if (loading && !leads.length) return <Shell><LoadingBlock /></Shell>;
  if (error) return <Shell><ErrorBlock error={error} /></Shell>;

  const ativos = leads.filter((l: any) => l.status !== 'PERDIDO');
  const fechados = leads.filter((l: any) => l.status === 'FECHADO').length;
  const conv = ativos.length ? Math.round((fechados / ativos.length) * 100) : 0;

  // Perdido é terminal e sai do board — mas pode ser reaberto (volta à 1ª fase).
  const perdidos = leads.filter((l: any) => l.status === 'PERDIDO');
  const reabrir = (id: number) => moveLead(id, cols[0]?.key || 'NOVO');

  return (
    <>
      <Topbar
        title="Funil de Vendas"
        extra={<span className="badge badge--neutral">{ativos.length} ativos</span>}
        right={
          <>
            <Link to="/leads" className="btn btn--secondary btn--sm">Ver lista</Link>
            <Link to="/leads" className="btn btn--primary btn--sm">+ Novo Lead</Link>
          </>
        }
      />

      <div className="main__content">
        <PageHeader
          breadcrumb="Comercial · Funil"
          title={`${ativos.length} negócios no funil`}
          subtitle={`${fechados} fechados · conversão ${conv}% · arraste ou mude o status no card`}
        />

        {/* Filtros do funil: busca por nome + campanha/filial/corretor (chips) + período */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {/* Busca sozinha em cima — largura estável, não reflui ao digitar */}
          <input className="field__input" placeholder="Pesquisar nome/telefone…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: '100%' }} />
          {/* Filtros embaixo — quebram bem no mobile */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <MultiFiltro label="Campanha" opcoes={optCampanhas} values={fCampanha} onChange={setFCampanha} />
            <MultiFiltro label="Filial" opcoes={optEquipes} values={fEquipe} onChange={setFEquipe} />
            <MultiFiltro label="Corretor" opcoes={optCorretores} values={fCorretor} onChange={setFCorretor} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" className="field__input" value={fDataIni} onChange={(e) => setFDataIni(e.target.value)} title="Data inicial" style={{ width: 145 }} />
              <span className="text-xs text-secondary">até</span>
              <input type="date" className="field__input" value={fDataFim} onChange={(e) => setFDataFim(e.target.value)} title="Data final" style={{ width: 145 }} />
            </div>
            {temFiltro && <button className="btn btn--ghost btn--sm" onClick={limparFiltros}>Limpar filtros</button>}
          </div>
        </div>

        <div className="kanban">
          {cols.map((col) => {
            const items = leads.filter((l) => faseDoStatus(fases, l.status) === col.key);
            const isDropTarget = dnd.hoverCol === col.key;
            return (
              <div
                className={`kanban__col ${col.klass || ''} ${isDropTarget ? 'kanban__col--drop-target' : ''}`}
                key={col.key}
                data-kanban-col={col.key}
                onDragOver={dnd.onDragOver(col.key)}
                onDragLeave={dnd.onDragLeave(col.key)}
                onDrop={dnd.onDrop(col.key)}
              >
                <div className="kanban__col-header">
                  <span className="kanban__col-title">{col.label}</span>
                  <span className="kanban__col-count">{items.length}</span>
                </div>
                <div className="kanban__cards">
                  {items.length === 0 ? (
                    <div className="kanban__cards--empty-hint">
                      {isDropTarget ? 'Soltar aqui' : 'Vazio'}
                    </div>
                  ) : (
                    items.map((l: any) => (
                      <div
                        className={'kanban-card ' + (dnd.draggingId === l.id ? 'kanban-card--dragging' : '')}
                        key={l.id}
                        draggable
                        onDragStart={dnd.onDragStart(l.id)}
                        onDragEnd={dnd.onDragEnd}
                        onPointerDown={dnd.onPointerDown(l.id)}
                      >
                        <div className="kanban-card__header">
                          <div>
                            <div className="kanban-card__title">{l.nome}</div>
                            <div className="kanban-card__meta">{l.interesse || l.empreendimentoInteresse?.nome || l.origem}</div>
                          </div>
                          {l.vip && (
                            <span className="badge badge--launch" style={{ fontSize: 9, padding: '2px 6px' }}>VIP</span>
                          )}
                        </div>
                        <div className="kanban-card__footer">
                          {l.corretor ? (
                            <div className="u-flex u-gap-2 u-items-center">
                              <div className="avatar avatar--sm">{l.corretor.initials}</div>
                              <span className="text-xs">{l.corretor.nome.split(' ')[0]}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-secondary">Sem corretor</span>
                          )}
                          <select
                            className="kanban-card__select"
                            value={faseDoStatus(fases, l.status) || l.status}
                            onChange={(e) => moveLead(l.id, e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            {fases.map((f) => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </select>
                        </div>
                        <Link
                          to={`/chat?lead=${l.id}`}
                          className="btn btn--secondary btn--sm"
                          style={{ width: '100%', marginTop: 8, justifyContent: 'center', display: 'inline-flex' }}
                          draggable={false}
                          onMouseDown={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <Icon name="chat" size={12} /> Abrir conversa
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {perdidos.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setShowPerdidos((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
            >
              <span className="kanban__col-title">Perdidos ({perdidos.length})</span>
              <span className="text-xs text-secondary">{showPerdidos ? 'ocultar' : 'reabrir um lead marcado por engano'}</span>
            </button>
            {showPerdidos && (
              <div className="u-flex" style={{ flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {perdidos.map((l: any) => (
                  <div key={l.id} className="kanban-card" style={{ width: 220 }}>
                    <div className="kanban-card__header">
                      <div>
                        <div className="kanban-card__title">{l.nome}</div>
                        <div className="kanban-card__meta">{l.interesse || l.empreendimentoInteresse?.nome || l.origem}</div>
                      </div>
                    </div>
                    <div className="kanban-card__footer">
                      {l.corretor ? (
                        <span className="text-xs">{l.corretor.nome.split(' ')[0]}</span>
                      ) : (
                        <span className="text-xs text-secondary">Sem corretor</span>
                      )}
                      <button className="btn btn--ghost btn--sm" onClick={() => reabrir(l.id)}>Reabrir</button>
                    </div>
                    <Link
                      to={`/chat?lead=${l.id}`}
                      className="btn btn--secondary btn--sm"
                      style={{ width: '100%', marginTop: 8, justifyContent: 'center', display: 'inline-flex' }}
                    >
                      <Icon name="chat" size={12} /> Abrir conversa
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar title="Funil de Vendas" right={<Link to="/leads" className="btn btn--primary btn--sm">+ Novo Lead</Link>} />
      <div className="main__content">
        <PageHeader breadcrumb="Comercial · Funil" title="Funil" />
        {children}
      </div>
    </>
  );
}
