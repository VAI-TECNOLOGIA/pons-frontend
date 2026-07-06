// Ficha completa do lead — abre ao clicar num lead em QUALQUER tela do sistema.
// Mostra tudo que o cliente preencheu no formulário (Meta Lead Ads/site), os
// dados do anúncio, o corretor responsável e os campos personalizados editáveis.
import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { Api } from '../lib/api';
import { LeadCamposCustom } from './LeadCamposCustom';
import { initials } from '../lib/format';

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo', SDR: 'SDR', QUALIFICANDO: 'Qualificando', NEGOCIANDO: 'Negociando',
  VISITA: 'Visita', PROPOSTA: 'Proposta', FECHADO: 'Fechado', PERDIDO: 'Perdido',
};

export function FichaLeadModal({ leadId, onClose }: { leadId: number; onClose: () => void }) {
  const [lead, setLead] = useState<any>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    setLead(null); setErro('');
    Api.lead(leadId)
      .then((l) => { if (vivo) setLead(l); })
      .catch((e) => { if (vivo) setErro(e?.message || 'Falha ao carregar o lead'); });
    return () => { vivo = false; };
  }, [leadId]);

  const digits = String(lead?.telefone || '').replace(/\D/g, '');
  const podeWhats = lead && !lead.telefoneOculto && digits.length >= 10;

  return (
    <Modal open onClose={onClose} title={lead ? lead.nome : 'Ficha do lead'} size="lg">
      {erro && <div className="text-sm" style={{ color: 'var(--color-danger)' }}>{erro}</div>}
      {!lead && !erro && <div className="text-sm text-secondary">Carregando…</div>}
      {lead && (
        <>
          {/* Cabeçalho: identidade + status + ação */}
          <div className="flex" style={{ alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div className="avatar">{initials(lead.nome)}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="font-semibold" style={{ fontSize: 15 }}>
                {lead.nome}
                {lead.vip && <span className="badge badge--launch" style={{ fontSize: 9, marginLeft: 6 }}>VIP</span>}
              </div>
              <div className="text-xs text-secondary">
                {lead.telefone || '—'}{lead.email ? ` · ${lead.email}` : ''}{lead.cidade ? ` · ${lead.cidade}` : ''}
              </div>
            </div>
            <span className="badge badge--info">{STATUS_LABEL[lead.status] || lead.status}</span>
            {podeWhats && (
              <a className="btn btn--primary btn--sm" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
                <Icon name="whatsapp" size={14} /> WhatsApp
              </a>
            )}
          </div>

          {/* O que o cliente preencheu no formulário */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: 12, background: 'var(--bg-elevated)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="doc" size={13} /> Respostas do formulário
            </div>
            {(lead.respostasFormulario || []).length === 0 ? (
              <div className="text-xs text-secondary">
                Nenhuma resposta extra registrada — este lead chegou só com nome/contato
                (leads novos do Meta passam a gravar todas as perguntas do formulário automaticamente).
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px 16px' }}>
                {lead.respostasFormulario.map((r: any) => (
                  <div key={r.campo} style={{ fontSize: 12 }}>
                    <span className="text-secondary">{r.campo}:</span> <strong>{r.valor}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Origem / anúncio */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="target" size={13} /> Origem & anúncio
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px 16px', fontSize: 12 }}>
              <div><span className="text-secondary">Origem:</span> <strong>{lead.origem || '—'}</strong></div>
              {lead.campanha && <div><span className="text-secondary">Campanha:</span> <strong>{lead.campanha}</strong></div>}
              {lead.conjuntoAnuncio && <div><span className="text-secondary">Conjunto:</span> <strong>{lead.conjuntoAnuncio}</strong></div>}
              {lead.criativo && <div><span className="text-secondary">Criativo:</span> <strong>{lead.criativo}</strong></div>}
              {lead.bm && <div><span className="text-secondary">BM/Página:</span> <strong>{lead.bm.nome}</strong></div>}
              {lead.interesse && <div><span className="text-secondary">Interesse:</span> <strong>{lead.interesse}</strong></div>}
              <div><span className="text-secondary">Entrada:</span> <strong>{new Date(lead.createdAt).toLocaleString('pt-BR')}</strong></div>
              {lead.corretor && <div><span className="text-secondary">Corretor:</span> <strong>{lead.corretor.nome}</strong></div>}
            </div>
            {lead.notas && <div className="text-xs" style={{ marginTop: 8 }}><span className="text-secondary">Notas:</span> {lead.notas}</div>}
          </div>

          {/* Campos personalizados (editáveis) */}
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="layers" size={13} /> Campos personalizados
            </div>
            <LeadCamposCustom leadId={lead.id} />
          </div>
        </>
      )}
    </Modal>
  );
}
