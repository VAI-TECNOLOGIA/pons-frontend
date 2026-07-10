import { useState, useEffect } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Link } from 'react-router-dom';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useKanbanDnd } from '../lib/useKanbanDnd';
import { useToast } from '../lib/toast';
import { parseFunil, faseDoStatus } from '../lib/funil';

export default function Pipeline() {
  // Hooks DEVEM vir antes de qualquer return condicional (Rules of Hooks).
  const { data, loading, error } = useApi<any[]>(() => Api.leads());
  const { data: settings } = useApi<Record<string, string>>(() => Api.settings());
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

  if (loading) return <Shell><LoadingBlock /></Shell>;
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
