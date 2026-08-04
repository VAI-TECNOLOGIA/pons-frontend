// "Liberações pendentes" (gestor): lista as solicitações de liberação de contato
// feitas pelos corretores da equipe e permite aprovar ou reprovar cada uma. O
// corretor é avisado do resultado no app e no WhatsApp. Chegou aqui pela notificação.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';

export default function LiberacoesPendentes() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => Api.liberacoesPendentes(), []);
  const [deciding, setDeciding] = useState<number | null>(null);

  const decidir = async (id: number, aprovar: boolean) => {
    setDeciding(id);
    try {
      await Api.liberacaoDecidir(id, aprovar);
      toast.success(aprovar ? 'Liberação aprovada — corretor avisado.' : 'Liberação reprovada — corretor avisado.');
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'falha'));
    } finally {
      setDeciding(null);
    }
  };

  const pendentes = data?.pendentes || [];

  return (
    <>
      <Topbar title="Liberações pendentes" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Equipe · Liberações"
          title="Liberações de contato pendentes"
          subtitle="Solicitações dos corretores pra ver o telefone de um lead. Aprove ou reprove — o corretor é avisado no app e no WhatsApp."
        />
        {loading && <LoadingBlock />}
        {error && <ErrorBlock error={error} />}
        {!loading && !error && pendentes.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            Nenhuma solicitação pendente no momento.
          </div>
        )}
        {!loading && !error && pendentes.length > 0 && (
          <div className="card" style={{ padding: 0 }}>
            {pendentes.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 600 }}>{p.leadNome || 'Lead'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    <Icon name="users" size={12} /> {p.solicitante}
                    {p.motivo ? <> · {p.motivo}</> : null}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '100%', minWidth: 0 }}>
                  <Link
                    className="btn btn--ghost btn--sm"
                    to={`/chat?lead=${p.id}`}
                    title="Abrir a conversa do lead pra analisar antes de decidir"
                  >
                    <Icon name="chat" size={12} /> Abrir conversa
                  </Link>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => decidir(p.id, false)}
                    disabled={deciding === p.id}
                  >
                    <Icon name="x" size={12} /> Reprovar
                  </button>
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => decidir(p.id, true)}
                    disabled={deciding === p.id}
                  >
                    <Icon name="check" size={12} /> {deciding === p.id ? 'Salvando…' : 'Aprovar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
