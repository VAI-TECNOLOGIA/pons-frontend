// Administrativo de Vendas — a fila de auditoria da Glaucia (reunião 05/07).
// Fluxo: venda registrada (PRE_ANALISE) → ela confere dados+documentos →
// "Confirmar venda" → baixa o PROTOCOLO (PDF sem comissão) e envia à
// construtora → acompanha as fases do contrato até assinado/pago.
// Sem NADA de comissão/rateio nesta tela (visão administrativa).
import { useEffect, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
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
      <CardProtocoloWhatsapp />

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

      {/* Detalhe da venda (sem comissão/rateio) — auditoria organizada */}
      {sel && (
        <Modal open onClose={() => setSelId(null)} title={`Auditoria — Venda #${sel.codigo}`} subtitle="Confira dados e documentos antes de avançar a fase" size="lg">
          {/* Hero: cliente + valor + situação */}
          <div style={{ background: 'linear-gradient(135deg, #1E2A44, #263654)', borderRadius: 14, padding: '18px 22px', color: '#fff', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 800, lineHeight: 1.15 }}>{sel.clienteNome}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                  {sel.empreendimento} · {sel.unidade} · {sel.construtora || 'construtora —'}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <span className={'badge badge--' + (STATUS_MAP[sel.status]?.[0] || 'neutral')}>{STATUS_MAP[sel.status]?.[1] || sel.status}</span>
                  {sel.aguardandoAprovacao && <span className="badge badge--cancelled">Aguardando aprovação do Paulo</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>Valor da venda</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: '#88C559', lineHeight: 1.1 }}>
                  {formatCurrencyShort(sel.valorVenda)}
                </div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Registrada em {new Date(sel.createdAt).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
          </div>

          {/* Dados essenciais em cards lado a lado */}
          <div className="dash-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div className="stat-glow" style={{ padding: 12 }}>
              <div className="stat-glow__label">Corretor</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{sel.corretor?.nome || '—'}</div>
            </div>
            <div className="stat-glow" style={{ padding: 12 }}>
              <div className="stat-glow__label">Empreendimento</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{sel.empreendimento}</div>
            </div>
            <div className="stat-glow" style={{ padding: 12 }}>
              <div className="stat-glow__label">Unidade</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{sel.unidade}</div>
            </div>
            <div className="stat-glow" style={{ padding: 12, ['--sg-accent' as any]: '#88C559' }}>
              <div className="stat-glow__label">Parcelas da entrada</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{sel.entradaParcelas}x</div>
            </div>
          </div>

          {/* Formulário GPI completo (protocolo) — sem comissão/rateio */}
          <FormularioGpi f={sel.formulario} />

          {/* Documentos anexados pelo corretor + anexar contrato da construtora */}
          <VendaDocumentos vendaId={sel.id} podeRemover />

          <div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
            <div className="flex gap-2">
              <button className="btn btn--secondary" onClick={() => baixarProtocolo(sel)}>
                <Icon name="doc" size={14} /> Protocolo (PDF)
              </button>
              <button className="btn btn--ghost" onClick={() => window.print()} title="Imprimir esta tela">
                Imprimir
              </button>
            </div>
            {PROXIMA_FASE[sel.status] && (
              <button className="btn btn--primary" onClick={() => avancar(sel)}>
                <Icon name="check" size={14} /> {PROXIMA_FASE[sel.status].rotulo}
              </button>
            )}
          </div>
        </Modal>
      )}
    </Shell>
  );
}

// WhatsApp que recebe o protocolo (templates + PDF) quando a venda é aprovada.
// Vazio = desativado: o protocolo vai pro corretor titular, como sempre foi.
function CardProtocoloWhatsapp() {
  const [numero, setNumero] = useState('');
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();

  useEffect(() => {
    Api.protocoloWhatsapp().then((r) => { setNumero(r.numero || ''); setCarregado(true); }).catch(() => setCarregado(true));
  }, []);

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await Api.protocoloWhatsappSave(numero.trim());
      setNumero(r.numero);
      toast.success(r.numero ? `Protocolo de venda vai pro WhatsApp ${r.numero}` : 'Desativado — protocolo volta a ir pro corretor');
    } catch (e: any) {
      toast.error('Erro: ' + (e?.details?.message || e.message || 'falha'));
    } finally {
      setSalvando(false);
    }
  };

  if (!carregado) return null;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="uppercase-tag" style={{ marginBottom: 8 }}>WhatsApp do protocolo de venda</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="field__input"
          style={{ flex: '1 1 220px', maxWidth: 300, height: 36 }}
          placeholder="DDD + número (ex.: 47 98488-9824)"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
        />
        <button className="btn btn--primary btn--sm" disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      <div className="field__hint" style={{ marginTop: 6 }}>
        Quando uma venda é aprovada, o protocolo (mensagens + PDF) vai pra este número — quem confecciona o contrato.
        Deixe vazio pra desativar: aí o protocolo vai pro corretor titular da venda.
      </div>
    </div>
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
