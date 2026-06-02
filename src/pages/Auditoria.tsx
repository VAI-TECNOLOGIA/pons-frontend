import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';

// Sprint 2 M19 — Logs de exclusão (auditoria)
export default function Auditoria() {
  const [entidade, setEntidade] = useState<string>('');
  const { data: entidades } = useApi<any[]>(() => Api.auditoriaEntidades());
  const { data, loading, error } = useApi<any[]>(
    () => Api.auditoriaExclusoes(entidade ? { entidade } : {}),
    [entidade],
  );

  return (
    <>
      <Topbar title="Auditoria · Exclusões" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Sistema · Auditoria"
          title="Logs de Exclusão"
          subtitle="Quem excluiu o quê, quando e por quê"
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="text-sm">Entidade:</span>
            <button className={`btn btn--sm ${entidade === '' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setEntidade('')}>Todas</button>
            {(entidades || []).map((e: any) => (
              <button key={e.entidade} className={`btn btn--sm ${entidade === e.entidade ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setEntidade(e.entidade)}>
                {e.entidade} <span className="text-xs">({e.total})</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        {data && (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Entidade</th>
                  <th>ID</th>
                  <th>Excluído por</th>
                  <th>Motivo</th>
                  <th>Quando</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>Sem exclusões registradas</td></tr>
                ) : data.map((l) => (
                  <tr key={l.id}>
                    <td><span className="badge badge--neutral">{l.entidade}</span></td>
                    <td>#{l.entidadeId}</td>
                    <td>{l.deletadoPorNome || <em>Sistema</em>}</td>
                    <td className="text-xs text-secondary">{l.motivo || '—'}</td>
                    <td className="text-xs text-secondary">{new Date(l.deletadoEm).toLocaleString('pt-BR')}</td>
                    <td className="text-xs"><details><summary>ver</summary><pre style={{ fontSize: 11, maxWidth: 400, overflow: 'auto' }}>{JSON.stringify(l.payload, null, 2)}</pre></details></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
