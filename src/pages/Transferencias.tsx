import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { initials } from '../lib/format';
import { FichaLeadModal } from '../components/FichaLeadModal';

// Sprint 1 M15 — Histórico de transferências de leads (auditoria)
const MOTIVO_BADGES: Record<string, [string, string]> = {
  SLA_AUTOMATICO:        ['badge--warning',   'SLA automático'],
  MANUAL_GESTOR:         ['badge--info',      'Manual (gestor)'],
  MANUAL_CORRETOR:       ['badge--info',      'Manual (corretor)'],
  FALLBACK_ROLETA:       ['badge--cancelled', 'Fallback roleta'],
  DISTRIBUICAO_AGENDADA: ['badge--launch',    'Agendada'],
  DIRECIONAMENTO_GESTOR: ['badge--signed',    'Direcionado'],
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

export default function Transferencias() {
  const [motivo, setMotivo] = useState<string>('');
  const [verLeadId, setVerLeadId] = useState<number | null>(null);
  const { data, loading, error } = useApi<any[]>(
    () => Api.transferenciasList(motivo ? { motivo } : {}),
    [motivo],
  );

  return (
    <>
      <Topbar title="Transferências" />
      <div className="main__content page-enter">
        <PageHeader
          breadcrumb="Administração · Auditoria"
          title="Histórico de Transferências"
          subtitle="Quem passou cada lead pra quem, quando e por quê"
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="text-sm text-secondary">Motivo</span>
            {FILTROS.map(([v, l]) => (
              <button key={v} className={`btn btn--sm ${motivo === v ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setMotivo(v)}>{l}</button>
            ))}
          </div>
        </div>

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        {data && (
          <div className="card fade-in" style={{ padding: 0 }}>
            <table className="table row-hover">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Movimento</th>
                  <th>Motivo</th>
                  <th>Observação</th>
                  <th>Por</th>
                  <th>Quando</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>Sem transferências no filtro selecionado</td></tr>
                ) : data.map((t: any) => {
                  const [bk, lbl] = MOTIVO_BADGES[t.motivo] || ['badge--neutral', t.motivo];
                  return (
                    <tr key={t.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setVerLeadId(t.leadId)}
                          className="flex gap-2"
                          style={{ alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
                        >
                          <div className="avatar avatar--sm">{initials(t.leadNome || 'L')}</div>
                          <div>
                            <div className="font-semibold" style={{ fontSize: 13 }}>{t.leadNome || 'Lead'}</div>
                            <div className="text-xs text-secondary">#{t.leadId}</div>
                          </div>
                        </button>
                      </td>
                      <td>
                        <div className="flex gap-2" style={{ alignItems: 'center', fontSize: 13 }}>
                          <span className="text-secondary">{t.deCorretorNome || 'Sistema'}</span>
                          <Icon name="arrow_right" size={14} />
                          <span className="font-semibold">{t.paraCorretorNome || 'Bolsão'}</span>
                        </div>
                      </td>
                      <td><span className={`badge ${bk}`}>{lbl}</span></td>
                      <td className="text-xs text-secondary">{t.observacao || '—'}</td>
                      <td className="text-xs">{t.executadoPorNome || '—'}</td>
                      <td className="text-xs text-secondary">{new Date(t.createdAt).toLocaleString('pt-BR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {verLeadId != null && <FichaLeadModal leadId={verLeadId} onClose={() => setVerLeadId(null)} />}
    </>
  );
}
