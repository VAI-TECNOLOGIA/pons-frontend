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
import { formatCurrencyExact } from '../lib/format';
import { Auth } from '../lib/auth';
import { STATUS_MAP, FormularioGpi, VendaDocumentos, VendaParcelas, VendaHistorico, EditarDadosVendaModal, EditarNegociacaoModal } from './Vendas';
import { EmptyState } from '../components/EmptyState';
import { useConfirm } from '../lib/confirm';

// Fases na ordem do processo — a fila mostra por fase.
// Fluxo novo (Glaucia 29/07): confecção → conferência → alteração → jurídica →
// assinatura → assinado → pago. PRE_ANALISE é a entrada ("Contrato em confecção").
const FASES: { key: string; label: string; hint: string }[] = [
  { key: 'PRE_ANALISE', label: 'Contrato em confecção', hint: 'Venda registrada — conferir dados e documentos.' },
  { key: 'CONTRATO_EM_CONFERENCIA', label: 'Contrato em conferência', hint: 'Conferir minuta (Glaucia ↔ corretor ↔ cliente).' },
  { key: 'CONTRATO_EM_ALTERACAO', label: 'Contrato em alteração', hint: 'Ajustes solicitados na minuta.' },
  { key: 'EM_ASSINATURA', label: 'Em assinatura', hint: 'Na plataforma de assinatura da construtora.' },
  { key: 'ASSINADO', label: 'Assinado', hint: 'Cadeia de assinaturas concluída.' },
  { key: 'ASSINADO_AGUARDANDO_PAGAMENTO', label: 'Aguardando pagamento', hint: 'Assinado — parcelas da entrada em aberto. Marque cada parcela paga na auditoria.' },
  { key: 'VENCIDO', label: 'Vencido', hint: 'Parcela vencida sem pagamento (automático). Ao quitar, volta ao fluxo.' },
  { key: 'AGUARDANDO_REPASSE', label: 'Aguardando repasse da construtora', hint: 'Entrada paga — aguardando a construtora repassar a comissão.' },
  { key: 'PAGO', label: 'Pago', hint: 'Entrada paga — processo concluído.' },
];
const PROXIMA_FASE: Record<string, { para: string; rotulo: string }> = {
  PRE_ANALISE: { para: 'CONTRATO_EM_CONFERENCIA', rotulo: 'Confirmar venda → conferência' },
  CONTRATO_EM_CONFERENCIA: { para: 'EM_ASSINATURA', rotulo: 'Conferido → enviar pra assinatura' },
  CONTRATO_EM_ALTERACAO: { para: 'EM_ASSINATURA', rotulo: 'Alterações feitas → enviar pra assinatura' },
  EM_ASSINATURA: { para: 'ASSINADO', rotulo: 'Marcar assinado (todas as partes)' },
  ASSINADO: { para: 'ASSINADO_AGUARDANDO_PAGAMENTO', rotulo: 'Assinado → aguardando pagamento' },
  ASSINADO_AGUARDANDO_PAGAMENTO: { para: 'AGUARDANDO_REPASSE', rotulo: 'Entrada quitada → aguardando repasse' },
  VENCIDO: { para: 'ASSINADO_AGUARDANDO_PAGAMENTO', rotulo: 'Cobrança resolvida → aguardando pagamento' },
  AGUARDANDO_REPASSE: { para: 'PAGO', rotulo: 'Comissão recebida → marcar pago' },
};

export default function AdminVendas() {
  const { data: vendas, loading, error, reload } = useApi<any[]>(() => Api.vendas());
  const [fase, setFase] = useState('PRE_ANALISE');
  // Busca por contrato (Marcelo 08/09): código, cliente, unidade ou empreendimento — dentro da fase.
  const [busca, setBusca] = useState('');
  const [selId, setSelId] = useState<number | null>(null);
  // Editar dados / negociação + histórico (toda edição fica registrada na venda).
  const [editDados, setEditDados] = useState<number | null>(null);
  const [editNeg, setEditNeg] = useState<any>(null);
  const [histVersao, setHistVersao] = useState(0);
  const podeEditarVenda = ['ADMINISTRATIVO', 'CEO', 'DIRETOR_FINANCEIRO', 'DIRETOR_COMERCIAL', 'GERENTE_EQUIPE', 'SOCIO_UNIDADE', 'GESTOR'].includes(Auth.user?.role || '');
  // Trava o botão "Confirmar venda" enquanto envia (protocolo leva alguns segundos).
  // PRECISA ficar aqui, ANTES dos returns condicionais abaixo — senão o nº de hooks
  // muda entre renders (loading vs carregado) e o React quebra a tela toda com
  // "Rendered more hooks than during the previous render" (crash da aba, 30/09).
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [abrindoWa, setAbrindoWa] = useState<number | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  // Cancelar venda (o "excluir" do sistema: vai pra Cancelado, fica no histórico e
  // pode ser reaberta). Quem audita (Administrativo) também cancela — 15/10.
  const podeCancelarVenda = ['ADMINISTRATIVO', 'CEO', 'DIRETOR_COMERCIAL'].includes(Auth.user?.role || '');
  const cancelarVenda = async (v: any) => {
    const ok = await confirm({ title: `Cancelar a venda de ${v.clienteNome || 'cliente'}?`, message: 'A venda vai para "Cancelado" e sai do fluxo. Fica no histórico e pode ser reaberta depois.', tone: 'danger', confirmText: 'Cancelar venda', cancelText: 'Voltar' });
    if (!ok) return;
    try {
      await Api.vendaCancelar(v.id);
      toast.success(`Venda ${v.codigo} cancelada.`);
      setSelId(null);
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    }
  };

  if (loading) return <Shell><LoadingBlock /></Shell>;
  if (error) return <Shell><ErrorBlock error={error} /></Shell>;

  const bn = busca.trim().toLowerCase();
  // Busca por contrato é INDEPENDENTE da fase (Marcelo 14/09): ao digitar na busca,
  // procura em TODAS as fases (ignora a aba selecionada). Sem busca, mostra só a
  // fase selecionada. Assim "1702" acha o contrato esteja ele em confecção ou pago.
  const lista = (vendas || []).filter((v) => {
    if (bn) return [v.codigo, v.clienteNome, v.unidade, v.empreendimento, v.construtora].filter(Boolean).join(' ').toLowerCase().includes(bn);
    return v.status === fase;
  });
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

  // Confirmar venda: envia o protocolo no WhatsApp e MANTÉM em "Contrato em confecção"
  // (não avança pra conferência). Pedido do cliente 17/08.
  // Trava o botão enquanto envia: o protocolo leva alguns segundos (PDF + WhatsApp)
  // e, sem retorno visual, o Adm clicava de novo e duplicava o envio (29/09).
  const confirmarVenda = async (v: any) => {
    if (confirmando) return;
    setConfirmando(v.id);
    toast.info('Enviando o protocolo no WhatsApp…');
    try {
      const r = await Api.vendaConfirmar(v.id);
      const w = r?.whatsapp;
      if (w && w.enviado === false) {
        // Motivo real (antes a tela sempre mandava conferir o número em Configurações).
        // 131042 = conta da Meta sem forma de pagamento — só a Pons resolve na Meta.
        const semPagamento = w.metaCode === 131042 || /payment|billing|pagamento/i.test(w.erro || '');
        const semDestino = w.motivo === 'sem_destino_configurado_e_corretor_sem_telefone';
        toast.error(semDestino
          ? 'Venda confirmada, mas falta o número que recebe o protocolo (cadastre no quadro acima).'
          : semPagamento
            ? 'Venda confirmada. O envio automático foi recusado pela Meta: a conta oficial do WhatsApp da Pons está sem forma de pagamento. Use "Enviar pelo meu WhatsApp".'
            : `Venda confirmada, mas a Meta recusou o envio automático${w.erro ? ` (${w.erro})` : ''}. Use "Enviar pelo meu WhatsApp".`);
        reload(); // mantém a venda aberta para enviar pelo WhatsApp do Adm
        return;
      }
      toast.success(w?.canal === 'qr'
        ? `Venda ${v.codigo} confirmada — protocolo e documentos enviados num PDF só pelo WhatsApp da Pons. Mantida em "Contrato em confecção".`
        : `Venda ${v.codigo} confirmada — protocolo e documentos enviados no WhatsApp. Mantida em "Contrato em confecção".`);
      setSelId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message === 'envio_em_andamento' ? 'O protocolo desta venda já está sendo enviado — aguarde.' : 'Erro: ' + (e.message || 'falha'));
    } finally {
      setConfirmando(null);
    }
  };

  // Protocolo pelo WhatsApp do próprio Adm, sem a API da Meta: o servidor gera o
  // PDF e devolve o texto com o link; abre o WhatsApp já com a mensagem pronta.
  // A janela abre no clique (antes do await) para o navegador não bloquear.
  const enviarPeloMeuWhatsapp = async (v: any) => {
    if (abrindoWa) return;
    setAbrindoWa(v.id);
    const janela = window.open('', '_blank');
    try {
      const r = await Api.vendaProtocoloLink(v.id);
      const url = `https://wa.me/${r.numero || ''}?text=${encodeURIComponent(r.texto)}`;
      if (janela) janela.location.href = url; else window.location.href = url;
      toast.success('WhatsApp aberto com o protocolo. Confira e toque em enviar.');
    } catch (e: any) {
      janela?.close();
      toast.error('Não foi possível gerar o protocolo: ' + (e.message || 'falha'));
    } finally {
      setAbrindoWa(null);
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

      <div style={{ marginBottom: 10 }}>
        <input className="field__input" type="search" placeholder="Buscar contrato em qualquer fase: código, cliente, unidade ou empreendimento" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 520 }} />
        {bn && <div className="text-xs text-secondary" style={{ marginTop: 6 }}>Buscando em todas as fases · {lista.length} contrato(s) encontrado(s)</div>}
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table row-hover">
          <thead>
            <tr><th>Código</th><th>Cliente</th><th>Empreendimento</th><th>Corretor</th><th className="numeric">Valor</th><th>Registrada</th><th></th></tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={7}><EmptyState size="sm" title={`${bn ? 'Nenhum contrato encontrado com essa busca' : 'Nenhuma venda nesta fase'}`} /></td></tr>
            ) : lista.map((v) => (
              <tr key={v.id}>
                <td className="font-semibold">#{v.codigo}</td>
                <td>{v.clienteNome}</td>
                <td className="text-xs">{v.empreendimento} · {v.unidade}{bn ? ` · ${(STATUS_MAP[v.status]?.[1] || v.status)}` : ''}</td>
                <td className="text-xs">{v.corretor?.nome || '—'}</td>
                <td className="numeric money">{formatCurrencyExact(v.valorVenda)}</td>
                <td className="text-xs text-secondary">{new Date(v.createdAt).toLocaleDateString('pt-BR')}</td>
                <td>
                  {v.aguardandoAprovacao ? (
                    Auth.user?.role === 'CEO' ? (
                      // O próprio Paulo aprova DAQUI — antes o CEO via o mesmo
                      // cadeado inerte da adm e não tinha onde clicar (07/08).
                      <button
                        className="btn btn--primary btn--sm"
                        title="Aprovar o parcelamento acima de 4x — libera a venda pra auditoria da adm"
                        onClick={async () => {
                          try {
                            await Api.vendaAprovar(v.id);
                            toast.success(`Parcelamento da ${v.codigo} aprovado — venda liberada pra auditoria.`);
                            reload();
                          } catch (e: any) {
                            toast.error('Erro: ' + (e?.message || 'falha'));
                          }
                        }}
                      >
                        <Icon name="check" size={13} /> Aprovar (Paulo)
                      </button>
                    ) : (
                      // Aprovação continua só com o Paulo; quem edita venda pode
                      // corrigir os VALORES enquanto espera (pedido 15/10).
                      <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn--secondary btn--sm"
                          disabled
                          title="Parcelamento acima de 4x — aguardando aprovação do Paulo. O botão libera assim que ele aprovar."
                          style={{ opacity: 0.5, cursor: 'not-allowed' }}
                        >
                          <Icon name="lock" size={13} /> Aguardando Paulo
                        </button>
                        {podeEditarVenda && v.status !== 'CANCELADO' && (
                          <button
                            className="btn btn--secondary btn--sm"
                            onClick={() => setEditNeg(v)}
                            title="Corrigir valor da venda, entrada e parcelas enquanto aguarda o Paulo (fica no histórico). A aprovação continua com ele."
                          >
                            <Icon name="pencil" size={13} /> Editar valores
                          </button>
                        )}
                        {podeCancelarVenda && v.status !== 'CANCELADO' && (
                          <button className="btn btn--ghost btn--sm" style={{ color: 'var(--color-danger, #e5484d)' }} onClick={() => cancelarVenda(v)} title="Vai para Cancelado, fica no histórico e pode ser reaberta">
                            Cancelar
                          </button>
                        )}
                      </div>
                    )
                  ) : (
                    <button className="btn btn--secondary btn--sm" onClick={() => setSelId(v.id)}>
                      <Icon name="doc" size={13} /> Auditar
                    </button>
                  )}
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
          <div style={{ background: 'linear-gradient(135deg, #1E2A44, var(--navy-700))', borderRadius: 14, padding: '18px 22px', color: '#fff', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>{sel.clienteNome}</div>
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
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#88C559', lineHeight: 1.1 }}>
                  {formatCurrencyExact(sel.valorVenda)}
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
          {/* Comissão parcelada: auditar parcela a parcela — "marcar pago" por parcela (Marcelo 08/09). */}
          <VendaParcelas vendaId={sel.id} podeConfirmar={['CEO', 'DIRETOR_FINANCEIRO', 'ADMINISTRATIVO'].includes(Auth.user?.role || '')} rateioCompleto={false} />
          <VendaHistorico key={sel.id + ':' + histVersao} vendaId={sel.id} />

          <div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
            <div className="flex gap-2">
              <button className="btn btn--secondary" onClick={() => baixarProtocolo(sel)}>
                <Icon name="doc" size={14} /> Protocolo (PDF)
              </button>
              <button className="btn btn--secondary" onClick={() => enviarPeloMeuWhatsapp(sel)} disabled={abrindoWa === sel.id} title="Abre o WhatsApp com o protocolo e o link do PDF, para enviar do seu número (não depende da Meta)">
                <Icon name="whatsapp" size={14} /> {abrindoWa === sel.id ? 'Gerando…' : 'Enviar pelo meu WhatsApp'}
              </button>
              <button className="btn btn--ghost" onClick={() => window.print()} title="Imprimir esta tela">
                Imprimir
              </button>
              {podeEditarVenda && (
                <button className="btn btn--secondary" onClick={() => setEditDados(sel.id)} title="Cliente, unidade, empreendimento, cônjuge… (fica no histórico)">
                  <Icon name="pencil" size={14} /> Editar dados
                </button>
              )}
              {podeEditarVenda && sel.status !== 'CANCELADO' && (
                <button className="btn btn--secondary" onClick={() => setEditNeg(sel)} title="Valor da venda, entrada, parcelas (fica no histórico)">
                  Editar negociação
                </button>
              )}
              {podeCancelarVenda && sel.status !== 'CANCELADO' && (
                <button className="btn btn--ghost" style={{ color: 'var(--color-danger, #e5484d)' }} onClick={() => cancelarVenda(sel)} title="Vai para Cancelado, fica no histórico e pode ser reaberta">
                  Cancelar venda
                </button>
              )}
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {sel.status === 'PRE_ANALISE' && (
                <button className="btn btn--primary" onClick={() => confirmarVenda(sel)} disabled={confirmando === sel.id} title="Envia o protocolo + documentos no WhatsApp do Adm e mantém em Contrato em confecção">
                  <Icon name="check" size={14} /> {confirmando === sel.id ? 'Enviando protocolo…' : 'Confirmar venda (envia protocolo)'}
                </button>
              )}
              {PROXIMA_FASE[sel.status] && (
                <button className={'btn ' + (sel.status === 'PRE_ANALISE' ? 'btn--secondary' : 'btn--primary')} onClick={() => avancar(sel)}>
                  {sel.status !== 'PRE_ANALISE' && <Icon name="check" size={14} />} {sel.status === 'PRE_ANALISE' ? 'Enviar pra conferência →' : PROXIMA_FASE[sel.status].rotulo}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
      {editDados && (
        <EditarDadosVendaModal vendaId={editDados} onClose={() => setEditDados(null)} onSaved={() => { setEditDados(null); setHistVersao((v) => v + 1); reload(); }} />
      )}
      {editNeg && (
        <EditarNegociacaoModal venda={editNeg} onClose={() => setEditNeg(null)} onSaved={() => { setEditNeg(null); setHistVersao((v) => v + 1); reload(); }} />
      )}
    </Shell>
  );
}

// WhatsApp que recebe o protocolo (templates + PDF) quando a venda é aprovada.
// Vazio = desativado: o protocolo vai pro corretor titular, como sempre foi.
function CardProtocoloWhatsapp() {
  const [numero, setNumero] = useState('');
  const [qr, setQr] = useState<{ conectado: boolean; numero: string } | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();

  useEffect(() => {
    Api.protocoloWhatsapp().then((r) => { setNumero(r.numero || ''); setQr(r.qr || null); setCarregado(true); }).catch(() => setCarregado(true));
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
        Ao confirmar a venda, o protocolo e os documentos anexados vão num PDF só para este número — para confecção do contrato.
        Deixe vazio pra desativar: aí o protocolo vai pro corretor titular da venda.
      </div>
      {qr && (
        <div className="field__hint" style={{ marginTop: 4 }}>
          {qr.conectado
            ? `Envio pelo WhatsApp da Pons conectado por QR Code${qr.numero ? ` (${qr.numero})` : ''}.`
            : 'Envio pela API oficial do WhatsApp (Meta). O WhatsApp da Pons por QR Code está desconectado.'}
        </div>
      )}
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
