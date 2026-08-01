// "Minhas Filas" (corretor): mostra as filas em que ele participa e que não estão
// com a posição oculta, com a posição dele em cada uma, + um botão pra ligar/
// desligar o recebimento de leads (útil pra quando ele estiver fora — banho,
// viagem, etc.). Some do menu de quem não é corretor.
import { useState, useEffect } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar title="Minhas Filas" />
      <div className="main__content">
        <PageHeader breadcrumb="Atendimento · Minhas Filas" title="Minhas Filas" subtitle="Sua posição nas filas de distribuição e o controle de recebimento de leads." />
        {children}
      </div>
    </>
  );
}

export default function MinhasFilas() {
  const { data, loading, error, reload } = useApi<{ filas: any[]; recebendoLeads: boolean }>(() => Api.roletasMinhas());
  const [recebendo, setRecebendo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();

  useEffect(() => { if (data) setRecebendo(!!data.recebendoLeads); }, [data]);

  const toggleRecebimento = async () => {
    const novo = !recebendo;
    setSalvando(true);
    try {
      await Api.roletaReceber(novo);
      setRecebendo(novo);
      toast.success(novo ? 'Você voltou a receber leads.' : 'Recebimento de leads pausado.');
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setSalvando(false);
    }
  };

  if (loading && !data) return <Shell><LoadingBlock /></Shell>;
  if (error && !data) return <Shell><ErrorBlock error={error} label="Erro ao carregar suas filas" /></Shell>;
  const filas = data?.filas || [];

  return (
    <Shell>
      {/* Controle de recebimento */}
      <div className="card" style={{ padding: '16px 18px', marginBottom: 16, borderLeft: `4px solid ${recebendo ? '#16A34A' : '#B45309'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name={recebendo ? 'check' : 'clock'} size={16} />
            {recebendo ? 'Recebendo leads' : 'Recebimento pausado'}
          </div>
          <div className="text-xs text-secondary" style={{ marginTop: 2 }}>
            {recebendo
              ? 'Você está ativo nas filas e entra na distribuição normalmente.'
              : 'Você não entra na distribuição — nenhum lead novo cai pra você até religar.'}
          </div>
        </div>
        <button
          className={'btn btn--sm ' + (recebendo ? 'btn--secondary' : 'btn--primary')}
          onClick={toggleRecebimento}
          disabled={salvando}
        >
          {salvando ? '...' : recebendo ? 'Pausar recebimento' : 'Voltar a receber'}
        </button>
      </div>

      {filas.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Icon name="layers" size={32} />
          <div style={{ marginTop: 12, fontWeight: 600 }}>Você ainda não está em nenhuma fila visível.</div>
          <div className="text-xs text-secondary" style={{ marginTop: 4 }}>Quando você for adicionado a uma fila de atendimento, ela aparece aqui com a sua posição.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {filas.map((f) => {
            const proximo = f.posicao === 1;
            const faltam = f.posicao ? f.posicao - 1 : null;
            return (
              <div key={f.id} className="card" style={{ padding: 16, opacity: f.pausado ? 0.7 : 1, borderLeft: !f.pausado && proximo ? '4px solid #16A34A' : undefined }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{f.nome}</div>
                {f.pausado ? (
                  <div className="text-sm" style={{ color: '#B45309', fontWeight: 600 }}>Pausado</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 34, fontWeight: 800, color: proximo ? '#16A34A' : 'var(--pons-blue, #0E7C9B)' }}>{f.posicao ?? '—'}º</span>
                      <span className="text-xs text-secondary">de {f.totalNaFila} na fila</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: proximo ? '#16A34A' : 'var(--text-primary)' }}>
                      {proximo
                        ? 'Você é o PRÓXIMO a receber!'
                        : faltam === 1
                          ? 'Falta 1 pessoa antes de você'
                          : `Faltam ${faltam} pessoas antes de você`}
                    </div>
                    <div className="text-xs text-secondary" style={{ marginTop: 4 }}>
                      A cada lead que entra, quem recebe vai pro fim e você sobe uma posição. Já recebeu {f.totalRecebidos} nesta fila.
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
