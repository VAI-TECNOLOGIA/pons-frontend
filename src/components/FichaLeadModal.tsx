// Ficha completa do lead — abre ao clicar num lead em QUALQUER tela do sistema.
// Layout no modelo aprovado pelo cliente: header azul com contatos, "Detalhes
// da conversão" (notas do formulário + dados do anúncio) e "Status de
// atendimento" (funil, última interação, responsável).
import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { Api } from '../lib/api';
import { useToast } from '../lib/toast';
import { timeAgo } from '../lib/format';

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo', SDR: 'SDR', QUALIFICANDO: 'Qualificando', NEGOCIANDO: 'Negociando',
  VISITA: 'Visita', PROPOSTA: 'Proposta', FECHADO: 'Fechado', PERDIDO: 'Perdido',
};

const MOTIVO_LABEL: Record<string, string> = {
  SLA_AUTOMATICO: 'Redistribuição por SLA',
  SLA_AUTOMATICO_HISTORICO_LIMPO: 'Redistribuição por SLA (histórico limpo)',
  MANUAL_GESTOR: 'Transferência do gestor',
  MANUAL_CORRETOR: 'Transferência do corretor',
  FALLBACK_ROLETA: 'Fallback da roleta',
  DIRECIONAMENTO_GESTOR: 'Direcionado pelo gestor',
};

const dataExtensa = (s: string) =>
  new Date(s).toLocaleString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .replace(',', ' às');

export function FichaLeadModal({ leadId, onClose }: { leadId: number; onClose: () => void }) {
  const [lead, setLead] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [transfs, setTransfs] = useState<any[]>([]);
  const [verTransfs, setVerTransfs] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let vivo = true;
    setLead(null); setErro(''); setVerTransfs(false); setTransfs([]);
    Api.lead(leadId)
      .then((l) => { if (vivo) setLead(l); })
      .catch((e) => { if (vivo) setErro(e?.message || 'Falha ao carregar o lead'); });
    Api.transferenciasLead(leadId)
      .then((t) => { if (vivo) setTransfs(t || []); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [leadId]);

  const digits = String(lead?.telefone || '').replace(/\D/g, '');
  const podeWhats = lead && !lead.telefoneOculto && digits.length >= 10;

  const copiar = (texto: string, rotulo: string) => {
    navigator.clipboard?.writeText(texto).then(() => toast.success(`${rotulo} copiado`)).catch(() => {});
  };
  // As opções de resposta do Meta chegam com underscore (ex.: "no_máximo_2_meses").
  // Sem espaço no valor = opção pré-definida → deixa legível só na exibição.
  const exibeValor = (v: any) => {
    const s = String(v ?? '');
    return /_/.test(s) && !/\s/.test(s) ? s.replace(/_/g, ' ') : s;
  };
  const copiarNota = () => {
    if (!lead) return;
    const linhas = [
      ...(lead.respostasFormulario || []).map((r: any) => `${r.campo}: ${r.valor}`),
      `Full name: ${lead.nome}`,
      lead.telefone ? `Phone number: ${lead.telefone}` : null,
      lead.email ? `Email: ${lead.email}` : null,
    ].filter(Boolean);
    copiar(linhas.join('\n'), 'Nota');
  };

  const rotuloSec = { fontSize: 10, fontWeight: 700 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-secondary)' };
  const linhaNota = { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 };

  // Header sempre com o azul do design system (nada de cor do print de referência)
  const headerBg = 'var(--blue-500)';

  return (
    <Modal open onClose={onClose} title="Ficha do lead" size="lg">
      {erro && <div className="text-sm" style={{ color: 'var(--color-danger)' }}>{erro}</div>}
      {!lead && !erro && <div className="text-sm text-secondary">Carregando…</div>}
      {lead && (
        <>
          {/* ── Header azul: identidade + contatos ── */}
          <div style={{ background: headerBg, borderRadius: 12, padding: '18px 20px', color: '#fff', marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15 }}>
              {lead.nome}
              {lead.vip && <span className="badge badge--launch" style={{ fontSize: 9, marginLeft: 8, verticalAlign: 'middle' }}>VIP</span>}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
              Criado em: {dataExtensa(lead.createdAt)}
              {lead.ultimaInteracao && <><br />Última interação: {dataExtensa(lead.ultimaInteracao)}</>}
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              {lead.telefone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="whatsapp" size={18} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{lead.telefone}</span>
                  {!lead.telefoneOculto && (
                    <>
                      <button onClick={() => copiar(lead.telefone, 'Telefone')} title="Copiar" style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 26, height: 26, color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="copy" size={12} />
                      </button>
                      {podeWhats && (
                        <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp" style={{ background: 'rgba(255,255,255,.15)', borderRadius: '50%', width: 26, height: 26, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="send" size={12} />
                        </a>
                      )}
                    </>
                  )}
                </div>
              )}
              {lead.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="chat" size={18} />
                  <span style={{ fontSize: 13 }}>{lead.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Duas colunas: conversão × atendimento ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 }}>
            {/* Detalhes da conversão */}
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Detalhes da conversão</h3>
              <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
                <div>
                  <div style={rotuloSec}>Origem</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{lead.origem || '—'}</div>
                </div>
                <div>
                  <div style={rotuloSec}>Produto (formulário)</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-info-fg)' }}>{lead.formularioNome || lead.interesse || lead.bm?.nome || '—'}</div>
                </div>
              </div>

              {/* Notas: o que o cliente preencheu no formulário */}
              <div className="card" style={{ padding: '12px 16px', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Notas</div>
                {(lead.respostasFormulario || []).map((r: any) => (
                  <div key={r.campo} style={linhaNota}>
                    <span className="text-secondary" style={{ maxWidth: '55%' }}>{r.campo}</span>
                    <strong style={{ textAlign: 'right' }}>{exibeValor(r.valor)}</strong>
                  </div>
                ))}
                <div style={linhaNota}><span className="text-secondary">Full name</span><strong>{lead.nome}</strong></div>
                {lead.telefone && <div style={linhaNota}><span className="text-secondary">Phone number</span><strong>{lead.telefone}</strong></div>}
                {lead.email && <div style={{ ...linhaNota, borderBottom: 'none' }}><span className="text-secondary">Email</span><strong style={{ wordBreak: 'break-all', textAlign: 'right' }}>{lead.email}</strong></div>}
                <div className="text-xs text-secondary" style={{ margin: '8px 0 6px' }}>Integração: Grupo Pons{lead.bm ? ` · ${lead.bm.nome}` : ''}</div>
                <button className="btn btn--secondary btn--sm" onClick={copiarNota}>Copiar nota original</button>
              </div>

              {/* Dados da conversão (anúncio) */}
              {(lead.campanha || lead.conjuntoAnuncio || lead.criativo) && (
                <div className="card" style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Dados da conversão</div>
                  {lead.campanha && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={rotuloSec}>Campanha</div>
                      <div style={{ fontSize: 13 }}>{lead.campanha}</div>
                    </div>
                  )}
                  {lead.conjuntoAnuncio && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={rotuloSec}>Grupo de anúncio</div>
                      <div style={{ fontSize: 13 }}>{lead.conjuntoAnuncio}</div>
                    </div>
                  )}
                  {lead.criativo && (
                    <div>
                      <div style={rotuloSec}>Peça</div>
                      <div style={{ fontSize: 13 }}>{lead.criativo}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status de atendimento */}
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Status de atendimento</h3>
              <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>Etapa do funil:</strong>
                  <span className="badge badge--info">{STATUS_LABEL[lead.status] || lead.status}</span>
                  {lead.ultimaInteracao && <span className="text-xs text-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={12} /> {timeAgo(lead.ultimaInteracao)}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="clock" size={14} />
                  <strong>Última interação:</strong> {lead.ultimaInteracao ? timeAgo(lead.ultimaInteracao) : 'sem interação registrada'}
                </div>
                <div>
                  <strong>Responsável:</strong> {lead.corretor ? lead.corretor.nome : 'não distribuído'}
                </div>
                {lead.distribuidoEm && (
                  <div className="text-xs text-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="clock" size={12} /> Distribuído {timeAgo(lead.distribuidoEm)}
                  </div>
                )}
                {lead.cidade && <div><strong>Cidade:</strong> {lead.cidade}</div>}
                {lead.notas && <div className="text-xs"><strong>Notas internas:</strong> <span className="text-secondary">{lead.notas}</span></div>}
              </div>

              {/* Histórico de transferências — de quem veio, pra quem foi, por quê */}
              <div style={{ marginTop: 14 }}>
                <button className="btn btn--ghost btn--sm" onClick={() => setVerTransfs((v) => !v)}>
                  <Icon name="history" size={13} /> {verTransfs ? 'Ocultar histórico de transferências' : `Histórico de transferências${transfs.length ? ` (${transfs.length})` : ''}`}
                </button>
                {verTransfs && (
                  <div className="card" style={{ padding: '12px 16px', marginTop: 8 }}>
                    {transfs.length === 0 ? (
                      <div className="text-xs text-secondary">Sem transferências registradas.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {transfs.slice(0, 10).map((t: any) => (
                          <div key={t.id} style={{ borderLeft: '3px solid var(--border-light)', paddingLeft: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                              {t.deCorretorNome || 'Sistema'} <Icon name="arrow_right" size={11} /> {t.paraCorretorNome || '—'}
                            </div>
                            <div className="text-xs text-secondary">{MOTIVO_LABEL[t.motivo] || t.motivo} · {timeAgo(t.createdAt)}</div>
                          </div>
                        ))}
                        {transfs.length > 10 && <div className="text-xs text-secondary">+ {transfs.length - 10} mais antigas</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
