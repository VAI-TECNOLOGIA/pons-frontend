// "Bolsão" (corretor): mostra os bolsões que o corretor participa (acesso a ele
// + os abertos a todos). Ao abrir um bolsão, lista os leads disponíveis (telefone
// mascarado) e permite CAPTURAR (claim atômico — o 1º que pega leva).
import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar title="Bolsão" />
      <div className="main__content">
        <PageHeader breadcrumb="Atendimento · Bolsão" title="Bolsão" subtitle="Leads disponíveis pra captura — o primeiro que pega, leva." />
        {children}
      </div>
    </>
  );
}

function LeadsDoBolsao({ bolsaoId, onCaptured }: { bolsaoId: number; onCaptured: () => void }) {
  const { data, loading, error, reload } = useApi<any[]>(() => Api.bolsaoMeusLeads(bolsaoId), [bolsaoId]);
  const [capturandoId, setCapturandoId] = useState<number | null>(null);
  const toast = useToast();

  const capturar = async (leadId: number) => {
    setCapturandoId(leadId);
    try {
      await Api.bolsaoCapturar(bolsaoId, leadId);
      toast.success('Lead capturado — já está no seu atendimento.');
      reload();
      onCaptured();
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível capturar (outro corretor pode ter pego).');
      reload();
    } finally {
      setCapturandoId(null);
    }
  };

  if (loading && !data) return <div style={{ padding: 12 }}><LoadingBlock /></div>;
  if (error && !data) return <ErrorBlock error={error} label="Erro ao carregar leads" />;
  const leads = data || [];
  if (leads.length === 0) return <div className="text-sm text-secondary" style={{ padding: 12 }}>Nenhum lead disponível neste bolsão agora.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      {leads.map((l) => (
        <div key={l.id} className="flex-between" style={{ alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{l.nome || 'Lead'}</div>
            <div className="text-xs text-secondary">{l.telefone || '—'}{l.origem ? ` · ${String(l.origem).replace(/_/g, ' ').toLowerCase()}` : ''}</div>
            {l.tabulacao && (
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.35, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '3px 7px', color: '#B45309' }}>
                ↩ Tabulado: <strong>{l.tabulacao.label}</strong>
                {l.tabulacao.observacao ? <span style={{ color: 'var(--text-secondary)' }}> — {l.tabulacao.observacao}</span> : null}
              </div>
            )}
          </div>
          <button className="btn btn--primary btn--sm" onClick={() => capturar(l.id)} disabled={capturandoId === l.id}>
            {capturandoId === l.id ? '...' : <><Icon name="check" size={12} /> Capturar</>}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function MeuBolsao() {
  const { data, loading, error, reload } = useApi<any[]>(() => Api.bolsoesMeus());
  const [aberto, setAberto] = useState<number | null>(null);

  if (loading && !data) return <Shell><LoadingBlock /></Shell>;
  if (error && !data) return <Shell><ErrorBlock error={error} label="Erro ao carregar bolsões" /></Shell>;
  const bolsoes = data || [];

  return (
    <Shell>
      {bolsoes.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Icon name="database" size={32} />
          <div style={{ marginTop: 12, fontWeight: 600 }}>Nenhum bolsão disponível pra você.</div>
          <div className="text-xs text-secondary" style={{ marginTop: 4 }}>Quando você tiver acesso a um bolsão, ele aparece aqui com os leads pra capturar.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bolsoes.map((b) => (
            <div key={b.id} className="card" style={{ padding: 16 }}>
              <div className="flex-between" style={{ alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setAberto(aberto === b.id ? null : b.id)}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{b.nome}</div>
                  {b.descricao && <div className="text-xs text-secondary">{b.descricao}</div>}
                  {(b.horaInicio && b.horaFim) && <div className="text-xs text-secondary">Funciona das {b.horaInicio} às {b.horaFim}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="badge badge--analysis">{b.leadsDisponiveis} lead{b.leadsDisponiveis === 1 ? '' : 's'}</span>
                  <Icon name="chevron-down" size={16} style={{ transform: aberto === b.id ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                </div>
              </div>
              {aberto === b.id && <LeadsDoBolsao bolsaoId={b.id} onCaptured={reload} />}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
