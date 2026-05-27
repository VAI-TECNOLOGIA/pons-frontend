import { useState, useEffect } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Link } from 'react-router-dom';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useKanbanDnd } from '../lib/useKanbanDnd';
import { useToast } from '../lib/toast';

const COLS = [
 { status: 'NOVO', titulo: 'Novo Lead', klass: '' },
 { status: 'SDR', titulo: 'SDR / IA', klass: 'kanban__col--accent' },
 { status: 'NEGOCIANDO', titulo: 'Negociando', klass: '' },
 { status: 'PROPOSTA', titulo: 'Proposta Enviada', klass: '' },
 { status: 'FECHADO', titulo: 'Fechado', klass: 'kanban__col--success' },
];

export default function Pipeline() {
 // Hooks DEVEM vir antes de qualquer return condicional (Rules of Hooks).
 // Errado antes: useToast/useKanbanDnd vinham depois do "if (loading) return ...",
 // disparando React #310 quando o estado loading mudava.
 const { data, loading, error } = useApi<any[]>(() => Api.leads());
 const [leads, setLeads] = useState<any[]>([]);
 const toast = useToast();
 useEffect(() => { if (data) setLeads(data); }, [data]);

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
 subtitle={`${fechados} fechados · conversão ${conv}% · arraste mentalmente, mude o status no card`}
 />

 <div className="kanban">
 {COLS.map((col) => {
 const items = leads.filter((l) => l.status === col.status);
 const isDropTarget = dnd.hoverCol === col.status;
 return (
 <div
 className={`kanban__col ${col.klass} ${isDropTarget ? 'kanban__col--drop-target' : ''}`}
 key={col.status}
 onDragOver={dnd.onDragOver(col.status)}
 onDragLeave={dnd.onDragLeave(col.status)}
 onDrop={dnd.onDrop(col.status)}
 >
 <div className="kanban__col-header">
 <span className="kanban__col-title">{col.titulo}</span>
 <span className="kanban__col-count">{items.length}</span>
 </div>
 <div className="kanban__cards">
 {items.length === 0 ? (
 <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
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
 <div className="flex gap-2" style={{ alignItems: 'center' }}>
 <div className="avatar avatar--sm">{l.corretor.initials}</div>
 <span className="text-xs">{l.corretor.nome.split(' ')[0]}</span>
 </div>
 ) : (
 <span className="text-xs text-secondary">Sem corretor</span>
 )}
 <select
 value={l.status}
 onChange={(e) => moveLead(l.id, e.target.value)}
 onMouseDown={(e) => e.stopPropagation()}
 style={{
 fontSize: 11,
 padding: '2px 6px',
 border: '1px solid var(--border-light)',
 borderRadius: 4,
 }}
 >
 {COLS.map((c) => (
 <option key={c.status} value={c.status}>
 {c.titulo}
 </option>
 ))}
 <option value="PERDIDO">Perdido</option>
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
