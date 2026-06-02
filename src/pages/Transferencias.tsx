import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';

// Sprint 1 M15 — Histórico de transferências de leads (auditoria)
const MOTIVO_BADGES: Record<string, [string, string]> = {
  SLA_AUTOMATICO:    ['badge--warning',   'SLA automático'],
  MANUAL_GESTOR:     ['badge--info',      'Manual (gestor)'],
  MANUAL_CORRETOR:   ['badge--info',      'Manual (corretor)'],
  FALLBACK_ROLETA:   ['badge--cancelled', 'Fallback roleta'],
};

export default function Transferencias() {
  const [motivo, setMotivo] = useState<string>('');
  const { data, loading, error } = useApi<any[]>(
    () => Api.transferenciasList(motivo ? { motivo } : {}),
    [motivo],
  );

  return (
    <>
      <Topbar title="Transferências" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Administração · Auditoria"
          title="Histórico de Transferências"
          subtitle="Quem passou cada lead pra quem, quando e por quê"
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
            <span className="text-sm">Motivo:</span>
            <button className={`btn btn--sm ${motivo === '' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setMotivo('')}>Todos</button>
            <button className={`btn btn--sm ${motivo === 'SLA_AUTOMATICO' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setMotivo('SLA_AUTOMATICO')}>SLA</button>
            <button className={`btn btn--sm ${motivo === 'MANUAL_GESTOR' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setMotivo('MANUAL_GESTOR')}>Gestor</button>
            <button className={`btn btn--sm ${motivo === 'MANUAL_CORRETOR' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setMotivo('MANUAL_CORRETOR')}>Corretor</button>
            <button className={`btn btn--sm ${motivo === 'FALLBACK_ROLETA' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setMotivo('FALLBACK_ROLETA')}>Fallback</button>
          </div>
        </div>

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        {data && (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Lead #</th>
                  <th>De</th>
                  <th>Para</th>
                  <th>Motivo</th>
                  <th>Observação</th>
                  <th>Executado por</th>
                  <th>Quando</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>Sem transferências no filtro selecionado</td></tr>
                ) : data.map((t: any) => {
                  const [bk, lbl] = MOTIVO_BADGES[t.motivo] || ['badge--neutral', t.motivo];
                  return (
                    <tr key={t.id}>
                      <td><a href={`/leads/${t.leadId}`}>#{t.leadId}</a></td>
                      <td>{t.deCorretorNome || <em>Sistema</em>}</td>
                      <td>{t.paraCorretorNome || <em>Bolsão</em>}</td>
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
    </>
  );
}
