// Administrativo de Vendas — a fila de auditoria da Glaucia (reunião 05/07).
// Fluxo: venda registrada (PRE_ANALISE) → ela confere dados+documentos →
// "Confirmar venda" → baixa o PROTOCOLO (PDF sem comissão) e envia à
// construtora → acompanha as fases do contrato até assinado/pago.
// Sem NADA de comissão/rateio nesta tela (visão administrativa).
import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { formatCurrencyShort } from '../lib/format';
import { STATUS_MAP, FormularioGpi, VendaDocumentos } from './Vendas';

// Fases na ordem do processo — a fila mostra por fase.
const FASES: { key: string; label: string; hint: string }[] = [
  { key: 'PRE_ANALISE', label: 'Aguardando auditoria', hint: 'Venda registrada pelo corretor — conferir dados e documentos.' },
  { key: 'AGUARDANDO_CONSTRUTORA', label: 'Aguardando construtora', hint: 'Protocolo enviado — aguardando retorno.' },
  { key: 'CONTRATO_EM_CONFECCAO', label: 'Contrato em confecção', hint: 'Construtora confeccionando o contrato.' },
  { key: 'CONTRATO_EM_CONFERENCIA', label: 'Contrato em conferência', hint: 'Conferir minuta (Glaucia ↔ corretor ↔ cliente).' },
  { key: 'EM_ASSINATURA', label: 'Em assinatura', hint: 'Na plataforma de assinatura da construtora.' },
  { key: 'ASSINADO', label: 'Assinado', hint: 'Cadeia de assinaturas concluída.' },
  { key: 'PAGO', label: 'Pago', hint: 'Entrada paga — processo concluído.' },
];
const PROXIMA_FASE: Record<string, { para: string; rotulo: string }> = {
  PRE_ANALISE: { para: 'AGUARDANDO_CONSTRUTORA', rotulo: 'Confirmar venda → enviar à construtora' },
  AGUARDANDO_CONSTRUTORA: { para: 'CONTRATO_EM_CONFECCAO', rotulo: 'Construtora iniciou a confecção' },
  CONTRATO_EM_CONFECCAO: { para: 'CONTRATO_EM_CONFERENCIA', rotulo: 'Contrato recebido → conferência' },
  CONTRATO_EM_CONFERENCIA: { para: 'EM_ASSINATURA', rotulo: 'Conferido → enviar pra assinatura' },
  EM_ASSINATURA: { para: 'ASSINADO', rotulo: 'Marcar assinado (todas as partes)' },
  ASSINADO: { para: 'PAGO', rotulo: 'Marcar pago' },
};

export default function AdminVendas() {
  const { data: vendas, loading, error, reload } = useApi<any[]>(() => Api.vendas());
  const [fase, setFase] = useState('PRE_ANALISE');
  const [selId, setSelId] = useState<number | null>(null);
  const toast = useToast();

  if (loading) return <Shell><LoadingBlock /></Shell>;
  if (error) return <Shell><ErrorBlock error={error} /></Shell>;

  const lista = (vendas || []).filter((v) => v.status === fase);
  const sel = selId ? (vendas || []).find((v) => v.id === selId) : null;
  const contagem = (k: string) => (vendas || []).filter((v) => v.status === k).length;

  const avancar = async (v: any) => {
    const prox = PROXIMA_FASE[v.status];
    if (!prox) return;
    try {
      await Api.vendaUpdateStatus(v.id, prox.para);
      toast.success(`Venda ${v.codigo} → ${STATUS_MAP[prox.para]?.[1] || prox.para}. Corretor notificado.`);
      setSelId(null);
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || 'falha'));
    }
  };

  const baixarProtocolo = async (v: any) => {
    try {
      await Api.vendaProtocoloAbrir(v.id);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao gerar o protocolo');
    }
  };

  return (
    <Shell>
      {/* Fila por fase do processo */}
      <div className="filter-bar" style={{ marginBottom: 14 }}>
        {FASES.map((f) => (
          <span
            key={f.key}
            className={'filter-chip ' + (fase === f.key ? 'filter-chip--active' : '')}
            onClick={() => { setFase(f.key); setSelId(null); }}
            title={f.hint}
          >
            {f.label} ({contagem(f.key)})
          </span>
        ))}
      </div>

      <div className="text-xs text-secondary" style={{ marginBottom: 10 }}>
        {FASES.find((f) => f.key === fase)?.hint}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table row-hover">
          <thead>
            <tr><th>Código</th><th>Cliente</th><th>Empreendimento</th><th>Corretor</th><th className="numeric">Valor</th><th>Registrada</th><th></th></tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--text-secondary)' }}>Nenhuma venda nesta fase</td></tr>
            ) : lista.map((v) => (
              <tr key={v.id}>
                <td className="font-semibold">#{v.codigo}</td>
                <td>{v.clienteNome}</td>
                <td className="text-xs">{v.empreendimento} · {v.unidade}</td>
                <td className="text-xs">{v.corretor?.nome || '—'}</td>
                <td className="numeric money">{formatCurrencyShort(v.valorVenda)}</td>
                <td className="text-xs text-secondary">{new Date(v.createdAt).toLocaleDateString('pt-BR')}</td>
                <td>
                  <button className="btn btn--secondary btn--sm" onClick={() => setSelId(v.id)}>
                    <Icon name="doc" size={13} /> Auditar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalhe da venda (sem comissão/rateio) */}
      {sel && (
        <div className="user-drawer__overlay" onClick={() => setSelId(null)}>
          <div className="user-drawer" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <header className="user-drawer__header">
              <div className="user-drawer__icon"><Icon name="doc" size={22} /></div>
              <div style={{ flex: 1 }}>
                <h2 className="user-drawer__title" style={{ marginBottom: 2 }}>Venda #{sel.codigo}</h2>
                <span className={'badge badge--' + (STATUS_MAP[sel.status]?.[0] || 'neutral')}>{STATUS_MAP[sel.status]?.[1] || sel.status}</span>
                {sel.aguardandoAprovacao && <span className="badge badge--cancelled" style={{ marginLeft: 6 }}>AGUARDANDO APROVAÇÃO DO PAULO</span>}
              </div>
              <button className="user-drawer__close" onClick={() => setSelId(null)} aria-label="Fechar"><Icon name="x" size={18} /></button>
            </header>

            <div className="user-drawer__body">
              <div className="text-xs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px 16px', marginBottom: 8 }}>
                <div><span className="text-secondary">Cliente:</span> <strong>{sel.clienteNome}</strong></div>
                <div><span className="text-secondary">Empreendimento:</span> <strong>{sel.empreendimento}</strong></div>
                <div><span className="text-secondary">Unidade:</span> <strong>{sel.unidade}</strong></div>
                <div><span className="text-secondary">Corretor:</span> <strong>{sel.corretor?.nome || '—'}</strong></div>
                <div><span className="text-secondary">Valor:</span> <strong>R$ {Number(sel.valorVenda).toLocaleString('pt-BR')}</strong></div>
                <div><span className="text-secondary">Construtora:</span> <strong>{sel.construtora || '—'}</strong></div>
              </div>

              {/* Formulário GPI completo (protocolo) — sem comissão/rateio */}
              <FormularioGpi f={sel.formulario} />

              {/* Documentos anexados pelo corretor + anexar contrato da construtora */}
              <VendaDocumentos vendaId={sel.id} podeRemover />
            </div>

            <footer className="user-drawer__footer" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="btn btn--secondary" onClick={() => baixarProtocolo(sel)}>
                <Icon name="doc" size={14} /> Protocolo (PDF)
              </button>
              <button className="btn btn--ghost" onClick={() => window.print()} title="Imprimir esta tela">
                Imprimir
              </button>
              {PROXIMA_FASE[sel.status] && (
                <button className="btn-novo" style={{ marginLeft: 'auto' }} onClick={() => avancar(sel)}>
                  <Icon name="check" size={14} /> {PROXIMA_FASE[sel.status].rotulo}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar title="Administrativo de Vendas" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Financeiro · Administrativo"
          title="Administrativo de Vendas"
          subtitle="Auditoria dos contratos: confira a venda, gere o protocolo pra construtora e acompanhe cada fase até o pagamento"
        />
        {children}
      </div>
    </>
  );
}
