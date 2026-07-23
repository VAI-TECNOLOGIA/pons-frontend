import { useEffect, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { initials } from '../lib/format';
import { FichaLeadModal } from '../components/FichaLeadModal';
import { CorretorPicker } from '../components/CorretorPicker';

// Histórico de transferências de leads — visão SIMPLIFICADA por operação
// (estilo Imobilead, pedido do Vine 23/07): quem enviou, quem recebeu,
// quantos leads, observação (opcional) e data/hora. "Detalhes" expande os
// leads do lote.
const MOTIVO_LABEL: Record<string, string> = {
  SLA_AUTOMATICO: 'SLA automático',
  SLA_AUTOMATICO_HISTORICO_LIMPO: 'SLA automático',
  MANUAL_GESTOR: 'Manual (gestor)',
  MANUAL_CORRETOR: 'Manual (corretor)',
  FALLBACK_ROLETA: 'Fallback roleta',
  DISTRIBUICAO_AGENDADA: 'Distribuição agendada',
  DIRECIONAMENTO_GESTOR: 'Direcionado',
  CAPTURA_BOLSAO: 'Captura do bolsão',
  REVERSAO: 'Reversão',
};

const FILTROS: [string, string][] = [
  ['', 'Todos'],
  ['DIRECIONAMENTO_GESTOR', 'Direcionado'],
  ['DISTRIBUICAO_AGENDADA', 'Agendada'],
  ['SLA_AUTOMATICO', 'SLA'],
  ['MANUAL_GESTOR', 'Gestor'],
  ['MANUAL_CORRETOR', 'Corretor'],
  ['FALLBACK_ROLETA', 'Fallback'],
];

type Grupo = {
  id: number;
  enviadoPorNome: string;
  paraCorretorNome: string;
  motivo: string;
  observacao: string | null;
  qtd: number;
  createdAt: string;
  leads: { leadId: number; leadNome: string | null }[];
};

export default function Transferencias() {
  const [motivo, setMotivo] = useState<string[]>([]); // multi: combina motivos
  const [verLeadId, setVerLeadId] = useState<number | null>(null);
  const [aberto, setAberto] = useState<number | null>(null); // grupo expandido
  // Filtros extras: busca por lead/corretor, período e corretor de destino
  const [busca, setBusca] = useState('');
  const [buscaDeb, setBuscaDeb] = useState('');
  const [desde, setDesde] = useState('');
  const [ate, setAte] = useState('');
  const [paraCorretor, setParaCorretor] = useState<number | ''>('');
  useEffect(() => { const t = setTimeout(() => setBuscaDeb(busca.trim()), 400); return () => clearTimeout(t); }, [busca]);
  const { data: corretores } = useApi<any[]>(() => Api.corretores());
  const params: any = { agrupado: 1, limit: 500 };
  if (motivo.length) params.motivo = motivo.join(',');
  if (buscaDeb) params.q = buscaDeb;
  if (desde) params.desde = desde;
  if (ate) params.ate = ate;
  if (paraCorretor) params.paraCorretorId = paraCorretor;
  const toast = useToast();
  const confirm = useConfirm();
  const [revertendo, setRevertendo] = useState<number | null>(null);
  const { data, loading, error, reload } = useApi<Grupo[]>(
    () => Api.transferenciasList(params),
    [motivo.join(','), buscaDeb, desde, ate, paraCorretor],
  );
  const temFiltro = !!(motivo.length || buscaDeb || desde || ate || paraCorretor);

  const reverter = async (g: Grupo) => {
    const ok = await confirm({
      title: `Reverter esta transferência?`,
      message: `${g.qtd} lead(s) voltam pra onde estavam antes de "${g.enviadoPorNome}" enviar pra ${g.paraCorretorNome}. Leads que já foram movidos de novo depois disso são preservados.`,
      confirmText: 'Reverter',
      tone: 'danger',
    });
    if (!ok) return;
    setRevertendo(g.id);
    try {
      const r = await Api.transferenciaReverterGrupo(g.id);
      toast.success(`${r.revertidos} lead(s) revertido(s)${r.pulados ? ` · ${r.pulados} preservado(s) (já tinham sido movidos de novo)` : ''}.`);
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setRevertendo(null);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <Topbar title="Transferências" />
      <div className="main__content page-enter">
        <PageHeader
          breadcrumb="Administração · Auditoria"
          title="Histórico de Transferências"
          subtitle="Quem enviou, quem recebeu, quantos leads e quando"
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="text-sm text-secondary">Motivo</span>
            {FILTROS.map(([v, l]) => (
              <button
                key={v}
                className={`btn btn--sm ${v === '' ? (!motivo.length ? 'btn--primary' : 'btn--ghost') : motivo.includes(v) ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setMotivo(v === '' ? [] : (motivo.includes(v) ? motivo.filter((x) => x !== v) : [...motivo, v]))}
                title="Clique pra marcar/desmarcar (pode combinar vários)"
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <input
              className="field__input"
              style={{ height: 34, fontSize: 13, flex: '1 1 220px', minWidth: 180 }}
              placeholder="Buscar por lead ou corretor…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <input type="date" className="field__input" style={{ height: 34, fontSize: 13, width: 'auto' }} value={desde} onChange={(e) => setDesde(e.target.value)} title="De" />
            <span className="text-xs text-secondary">–</span>
            <input type="date" className="field__input" style={{ height: 34, fontSize: 13, width: 'auto' }} value={ate} onChange={(e) => setAte(e.target.value)} title="Até" />
            <CorretorPicker corretores={corretores} value={paraCorretor} onChange={(id) => setParaCorretor(id === 'sem' ? '' : id)} placeholder="Recebido por (corretor)…" />
            {temFiltro && (
              <button className="btn btn--ghost btn--sm" onClick={() => { setMotivo([]); setBusca(''); setBuscaDeb(''); setDesde(''); setAte(''); setParaCorretor(''); }}>
                Limpar filtros
              </button>
            )}
            {data && <span className="text-xs text-secondary" style={{ marginLeft: 'auto' }}>{data.length} operaç{data.length === 1 ? 'ão' : 'ões'}</span>}
          </div>
        </div>

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        {data && (
          <div className="card fade-in" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table row-hover tabela-compacta">
              <thead>
                <tr>
                  <th>Quem enviou</th>
                  <th>Quem recebeu</th>
                  <th>Leads</th>
                  <th>Observação</th>
                  <th>Data/hora</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>Sem transferências no filtro selecionado</td></tr>
                ) : data.map((g) => (
                  <>
                    <tr key={g.id}>
                      <td>
                        <div className="flex gap-2" style={{ alignItems: 'center' }}>
                          <div className="avatar avatar--sm">{initials(g.enviadoPorNome || 'S')}</div>
                          <div>
                            <div className="font-semibold" style={{ fontSize: 13 }}>{g.enviadoPorNome}</div>
                            <div className="text-xs text-secondary" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{MOTIVO_LABEL[g.motivo] || g.motivo.replace(/_/g, ' ').toLowerCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-2" style={{ alignItems: 'center', fontSize: 13, fontWeight: 600 }}>
                          {g.paraCorretorNome === 'Bolsão' ? (
                            <Icon name="database" size={13} />
                          ) : (
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-4 4" /><path d="M21 7H7" /><path d="M7 21l-4-4 4-4" /><path d="M3 17h14" /></svg>
                          )}
                          {g.paraCorretorNome}
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--color-success, #0E9F6E)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="check" size={12} /> {g.qtd}
                        </span>
                        <span className="text-secondary" style={{ fontSize: 12 }}> / {g.qtd}</span>
                      </td>
                      <td className="text-xs text-secondary" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.observacao || undefined}>
                        {g.observacao || '—'}
                      </td>
                      <td className="text-xs text-secondary" style={{ whiteSpace: 'nowrap' }}>{fmt(g.createdAt)}</td>
                      <td>
                        <span className="pill-ok"><Icon name="check" size={11} /> Concluído</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn--secondary btn--sm"
                            onClick={() => setAberto(aberto === g.id ? null : g.id)}
                            title={aberto === g.id ? 'Fechar detalhes' : 'Ver os leads desta operação'}
                          >
                            <Icon name="eye" size={13} />
                          </button>
                          {g.motivo !== 'REVERSAO' && (
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={() => reverter(g)}
                              disabled={revertendo === g.id}
                              title="Reverter: os leads voltam pra onde estavam"
                            >
                              <Icon name="refresh" size={13} /> {revertendo === g.id ? '…' : 'Reverter'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {aberto === g.id && (
                      <tr key={`${g.id}-det`}>
                        <td colSpan={7} style={{ background: 'var(--bg-elevated)', padding: '10px 16px' }}>
                          <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                            {g.leads.map((l) => (
                              <button
                                key={l.leadId}
                                className="btn btn--secondary btn--sm"
                                onClick={() => setVerLeadId(l.leadId)}
                                title={`Abrir ficha do lead #${l.leadId}`}
                              >
                                {l.leadNome || `Lead #${l.leadId}`}
                              </button>
                            ))}
                            {g.qtd > g.leads.length && (
                              <span className="text-xs text-secondary" style={{ alignSelf: 'center' }}>+ {g.qtd - g.leads.length} lead(s)</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {verLeadId != null && <FichaLeadModal leadId={verLeadId} onClose={() => setVerLeadId(null)} />}
    </>
  );
}
