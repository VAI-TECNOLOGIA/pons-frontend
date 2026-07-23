import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { MultiFiltro } from './MultiFiltro';
import { CorretorPicker } from './CorretorPicker';

// Painel de filtros de leads (estilo Imobilead): Período · Jornada · Segmentação
// · Equipe. Usado na tela de Leads e na Distribuição (bolsão).
// Campanha, Formulário, Origem, Produto e Equipe são MULTI-seleção com chips.
// NADA é aplicado a cada clique: o usuário monta o filtro à vontade e clica em
// "Filtrar" — só aí a busca roda (pedido 2026-07-23).
export interface FiltrosLead {
 dataInicial: string;
 dataFinal: string;
 origem: string[];
 status: string;
 campanha: string[];
 formulario: string[]; // nomes do Lead Form (aparece como "Interesse" na ficha)
 empreendimentoId: string[];
 corretorId: string; // '' = todos · 'sem' = bolsão · id
 equipeId: string[]; // ids das equipes (leads dos corretores delas)
}

export const FILTROS_LEAD_VAZIO: FiltrosLead = {
 dataInicial: '', dataFinal: '', origem: [], status: '', campanha: [], formulario: [], empreendimentoId: [], corretorId: '', equipeId: [],
};

// Converte os filtros nos params do GET /leads (multi-valores viram CSV).
export function filtrosLeadParams(f: FiltrosLead): Record<string, string> {
 const p: Record<string, string> = {};
 if (f.status) p.status = f.status;
 if (f.origem.length) p.origem = f.origem.join(',');
 if (f.campanha.length) p.campanha = f.campanha.join(',');
 if (f.formulario.length) p.formulario = f.formulario.join(',');
 if (f.empreendimentoId.length) p.empreendimentoId = f.empreendimentoId.join(',');
 if (f.corretorId === 'sem') p.semCorretor = 'true';
 else if (f.corretorId) p.corretorId = f.corretorId;
 if (f.equipeId.length) p.equipeId = f.equipeId.join(',');
 if (f.dataInicial) p.dataInicial = f.dataInicial;
 if (f.dataFinal) p.dataFinal = f.dataFinal;
 return p;
}

interface Props {
 v: FiltrosLead; // filtros APLICADOS (o painel edita um rascunho interno)
 onAplicar: (f: FiltrosLead) => void;
 statuses: { key: string; label: string }[];
 opcoes?: { origens?: string[]; campanhas?: string[]; formularios?: string[] } | null;
 corretores?: any[] | null;
 empreendimentos?: any[] | null;
 equipes?: any[] | null;
}

export function LeadsFiltrosPanel({ v, onAplicar, statuses, opcoes, corretores, empreendimentos, equipes }: Props) {
 const [draft, setDraft] = useState<FiltrosLead>(v);
 // Re-sincroniza o rascunho quando os filtros aplicados mudam por fora (ex.: "limpar filtros" da página)
 const vKey = JSON.stringify(v);
 useEffect(() => { setDraft(v); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vKey]);
 const set = (patch: Partial<FiltrosLead>) => setDraft((d) => ({ ...d, ...patch }));
 const asOpts = (arr?: string[] | null) => (arr || []).map((x) => ({ value: x, label: x }));
 const mudou = JSON.stringify(draft) !== vKey;

 return (
 <div className="card fade-in" style={{ padding: '16px 18px', marginBottom: 14 }}>
 <div className="leads-filtros">
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="calendar" size={13} /> Período</div>
 <div className="leads-filtros__linha">
 <input type="date" className="field__input" value={draft.dataInicial} onChange={(e) => set({ dataInicial: e.target.value })} />
 <span className="text-xs text-secondary leads-filtros__sep">–</span>
 <input type="date" className="field__input" value={draft.dataFinal} onChange={(e) => set({ dataFinal: e.target.value })} />
 </div>
 <div className="field__hint" style={{ marginTop: 4 }}>Data de entrada do lead no sistema.</div>
 </div>
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="target" size={13} /> Jornada do lead</div>
 <div className="leads-filtros__linha">
 <MultiFiltro label="Origem" opcoes={asOpts(opcoes?.origens)} values={draft.origem} onChange={(vals) => set({ origem: vals })} />
 <select className="field__select" value={draft.status} onChange={(e) => set({ status: e.target.value })}>
 <option value="">Status</option>
 {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
 </select>
 </div>
 </div>
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="layers" size={13} /> Segmentação (marque vários)</div>
 <div className="leads-filtros__linha">
 <MultiFiltro
 label="Produto"
 opcoes={(empreendimentos || []).map((e2: any) => ({ value: String(e2.id), label: e2.nome }))}
 values={draft.empreendimentoId}
 onChange={(vals) => set({ empreendimentoId: vals })}
 />
 <MultiFiltro label="Campanha" opcoes={asOpts(opcoes?.campanhas)} values={draft.campanha} onChange={(vals) => set({ campanha: vals })} />
 <MultiFiltro label="Formulário" opcoes={asOpts(opcoes?.formularios)} values={draft.formulario} onChange={(vals) => set({ formulario: vals })} />
 </div>
 </div>
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="users" size={13} /> Equipe</div>
 <div className="leads-filtros__linha">
 {(equipes || []).length > 0 && (
 <MultiFiltro
 label="Equipe"
 opcoes={(equipes || []).map((e2: any) => ({ value: String(e2.id), label: e2.nome }))}
 values={draft.equipeId}
 onChange={(vals) => set({ equipeId: vals })}
 />
 )}
 <CorretorPicker
 corretores={corretores}
 bolsao
 placeholder="Corretor (busque por nome)…"
 value={draft.corretorId === '' ? '' : draft.corretorId === 'sem' ? 'sem' : Number(draft.corretorId)}
 onChange={(id) => set({ corretorId: id === '' ? '' : String(id) })}
 />
 </div>
 </div>
 </div>
 <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 14, borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
 {mudou && <span className="text-xs text-secondary">Alterações não aplicadas</span>}
 <button
 className="btn btn--ghost btn--sm"
 onClick={() => { setDraft(FILTROS_LEAD_VAZIO); onAplicar(FILTROS_LEAD_VAZIO); }}
 >
 Limpar
 </button>
 <button className="btn btn--primary" onClick={() => onAplicar(draft)}>
 <Icon name="search" size={14} /> Filtrar
 </button>
 </div>
 </div>
 );
}
