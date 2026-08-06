import { useState } from 'react';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { timeUntil, timeAgo } from '../lib/format';
import { Icon } from './Icon';

const STATUS_BADGES: Record<string, string> = {
  ATIVA: 'badge--info',
  PROCESSANDO: 'badge--launch',
  CONCLUIDA: 'badge--signature',
  CANCELADA: 'badge--cancelled',
};
const STATUS_OPCOES = ['ATIVA', 'PROCESSANDO', 'CONCLUIDA', 'CANCELADA'];

interface ReguaExecucoesListProps {
  reguaId: number;
}

export function ReguaExecucoesList({ reguaId }: ReguaExecucoesListProps) {
  const [status, setStatus] = useState('ATIVA');
  const { data, loading, error, reload } = useApi(
    () => Api.reguaExecucoes(reguaId, { status, limit: 100 }),
    [reguaId, status],
  );
  const toast = useToast();
  const confirm = useConfirm();

  const cancelar = async (execId: number) => {
    const ok = await confirm({
      title: 'Cancelar execução?',
      message: 'O lead para de receber as próximas mensagens dessa régua.',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await Api.reguaCancelarExecucao(execId);
      toast.success('Execução cancelada');
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const itens = data?.itens || [];

  return (
    <div>
      <div className="flex" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {STATUS_OPCOES.map((s) => (
          <button
            key={s}
            type="button"
            className={`btn btn--sm ${status === s ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

      {!loading && !error && itens.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>
          Nenhuma execução {status.toLowerCase()}
        </div>
      )}

      {itens.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Passo</th>
                <th>{status === 'ATIVA' ? 'Próximo disparo' : 'Encerrada'}</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((e: any) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.lead?.nome || `Lead #${e.leadId}`}</div>
                    <div className="text-xs text-secondary">{e.lead?.telefone}</div>
                  </td>
                  <td>{e.passoAtual + 1}/{Array.isArray(e.passosSnapshot) ? e.passosSnapshot.length : '—'}</td>
                  <td>{e.status === 'ATIVA' ? timeUntil(e.proximoDisparoEm) : (e.finalizadaEm ? timeAgo(e.finalizadaEm) : '—')}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGES[e.status] || 'badge--neutral'}`}>{e.status}</span>
                    {e.motivoFinalizacao && <div className="text-xs text-secondary" style={{ marginTop: 2 }}>{e.motivoFinalizacao}</div>}
                  </td>
                  <td>
                    {e.status === 'ATIVA' && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => cancelar(e.id)}>
                        <Icon name="x" size={12} /> Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
