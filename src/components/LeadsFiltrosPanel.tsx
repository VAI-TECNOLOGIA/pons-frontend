import { Icon } from './Icon';

// Painel de filtros de leads (estilo Imobilead): Período · Jornada · Segmentação
// · Equipe. Usado na tela de Leads e na Distribuição (bolsão) — mesmo visual,
// mesmos parâmetros server-side do GET /leads.
export interface FiltrosLead {
 dataInicial: string;
 dataFinal: string;
 origem: string;
 status: string;
 campanha: string;
 formulario: string; // nome do Lead Form (aparece como "Interesse" na ficha)
 empreendimentoId: string;
 corretorId: string; // '' = todos · 'sem' = bolsão · id
}

export const FILTROS_LEAD_VAZIO: FiltrosLead = {
 dataInicial: '', dataFinal: '', origem: '', status: '', campanha: '', formulario: '', empreendimentoId: '', corretorId: '',
};

// Converte os filtros nos params do GET /leads (mesma convenção da tela Leads).
export function filtrosLeadParams(f: FiltrosLead): Record<string, string> {
 const p: Record<string, string> = {};
 if (f.status) p.status = f.status;
 if (f.origem) p.origem = f.origem;
 if (f.campanha) p.campanha = f.campanha;
 if (f.formulario) p.formulario = f.formulario;
 if (f.empreendimentoId) p.empreendimentoId = f.empreendimentoId;
 if (f.corretorId === 'sem') p.semCorretor = 'true';
 else if (f.corretorId) p.corretorId = f.corretorId;
 if (f.dataInicial) p.dataInicial = f.dataInicial;
 if (f.dataFinal) p.dataFinal = f.dataFinal;
 return p;
}

interface Props {
 v: FiltrosLead;
 onChange: (patch: Partial<FiltrosLead>) => void;
 statuses: { key: string; label: string }[];
 opcoes?: { origens?: string[]; campanhas?: string[]; formularios?: string[] } | null;
 corretores?: any[] | null;
 empreendimentos?: any[] | null;
}

export function LeadsFiltrosPanel({ v, onChange, statuses, opcoes, corretores, empreendimentos }: Props) {
 return (
 <div className="card fade-in" style={{ padding: '16px 18px', marginBottom: 14 }}>
 <div className="leads-filtros">
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="calendar" size={13} /> Período</div>
 <div className="leads-filtros__linha">
 <input type="date" className="field__input" value={v.dataInicial} onChange={(e) => onChange({ dataInicial: e.target.value })} />
 <span className="text-xs text-secondary leads-filtros__sep">–</span>
 <input type="date" className="field__input" value={v.dataFinal} onChange={(e) => onChange({ dataFinal: e.target.value })} />
 </div>
 <div className="field__hint" style={{ marginTop: 4 }}>Data de entrada do lead no sistema.</div>
 </div>
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="target" size={13} /> Jornada do lead</div>
 <div className="leads-filtros__linha">
 <select className="field__select" value={v.origem} onChange={(e) => onChange({ origem: e.target.value })}>
 <option value="">Origem</option>
 {(opcoes?.origens || []).map((o) => <option key={o} value={o}>{o}</option>)}
 </select>
 <select className="field__select" value={v.status} onChange={(e) => onChange({ status: e.target.value })}>
 <option value="">Status</option>
 {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
 </select>
 </div>
 </div>
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="layers" size={13} /> Segmentação</div>
 <div className="leads-filtros__linha">
 <select className="field__select" value={v.empreendimentoId} onChange={(e) => onChange({ empreendimentoId: e.target.value })}>
 <option value="">Produto</option>
 {(empreendimentos || []).map((e2: any) => <option key={e2.id} value={e2.id}>{e2.nome}</option>)}
 </select>
 <select className="field__select" value={v.campanha} onChange={(e) => onChange({ campanha: e.target.value })}>
 <option value="">Campanha</option>
 {(opcoes?.campanhas || []).map((c) => <option key={c} value={c}>{c}</option>)}
 </select>
 <select className="field__select" value={v.formulario} onChange={(e) => onChange({ formulario: e.target.value })}>
 <option value="">Formulário</option>
 {(opcoes?.formularios || []).map((f) => <option key={f} value={f}>{f}</option>)}
 </select>
 </div>
 </div>
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="users" size={13} /> Equipe</div>
 <div className="leads-filtros__linha">
 <select className="field__select" value={v.corretorId} onChange={(e) => onChange({ corretorId: e.target.value })}>
 <option value="">Corretor</option>
 <option value="sem">Sem corretor (bolsão)</option>
 {(corretores || []).map((c: any) => <option key={c.id} value={c.id}>{c.nome || c.user?.name}</option>)}
 </select>
 </div>
 </div>
 </div>
 </div>
 );
}
