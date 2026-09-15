// Timeline de transferências (trajeto do lead / do corretor). Estilo "linha do tempo":
// bolinha + chip do tipo + data em horário do Brasil + "de → para" + descrição.
// Usado na ficha do lead e no painel do corretor. Só gestão consome (o backend
// devolve vazio pro corretor).
import { Icon } from './Icon';

type Transf = {
  id: number;
  motivo: string;
  observacao?: string | null;
  createdAt: string;
  deCorretorNome?: string | null;
  paraCorretorNome?: string | null;
  leadNome?: string | null;
};

// Rótulo amigável + descrição por motivo.
const MOTIVO_INFO: Record<string, { label: string; desc: string }> = {
  SEM_TEMPLATE_SLA: { label: 'Transferência por timer', desc: 'Corretor não atendeu no prazo — o lead passou para o próximo da fila.' },
  SLA_AUTOMATICO: { label: 'Redistribuição por SLA', desc: 'Redistribuído automaticamente por inatividade.' },
  SLA_AUTOMATICO_HISTORICO_LIMPO: { label: 'Redistribuição por SLA', desc: 'Redistribuído por inatividade (histórico anterior limpo — o lead nunca respondeu).' },
  DISTRIBUICAO_FILA_RETRY: { label: 'Distribuído pela fila', desc: 'Encaminhado pela distribuição automática da fila.' },
  DIRECIONAMENTO_GESTOR: { label: 'Direcionado pelo gestor', desc: 'Movido manualmente pela gestão.' },
  CAPTURA_BOLSAO: { label: 'Capturado do bolsão', desc: 'O corretor pegou este lead do bolsão.' },
  FALLBACK_ROLETA: { label: 'Fallback da fila', desc: 'Atingiu o limite de transferências — foi para o destino de recaptura.' },
  CORRETOR_DESATIVADO: { label: 'Corretor desativado', desc: 'Lead devolvido porque o corretor foi desativado.' },
  CORRETOR_DESATIVADO_BASE_EQUIPE: { label: 'Corretor desativado', desc: 'Lead enviado à base da equipe porque o corretor foi desativado.' },
  QUARENTENA_EXPIRADA: { label: 'Quarentena', desc: 'Ficou sem interação no prazo e voltou para a base.' },
  BM_PESSOAL_ARQUIVADO: { label: 'BM pessoal arquivado', desc: 'Lead de BM pessoal arquivado ao desativar o corretor.' },
  MANUAL_CORRETOR: { label: 'Transferência do corretor', desc: 'Movido manualmente.' },
};

const dataBR = (s: string) =>
  new Date(s)
    .toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .replace(',', ' às');

export function TrajetoTransferencias({ transfs, showLead = false }: { transfs: Transf[]; showLead?: boolean }) {
  if (!transfs?.length) {
    return <div className="text-xs text-secondary">Sem transferências registradas.</div>;
  }
  return (
    <div style={{ position: 'relative', paddingLeft: 4 }}>
      {transfs.map((t, i) => {
        const info = MOTIVO_INFO[t.motivo] || { label: t.motivo, desc: t.observacao || '' };
        const desc = t.observacao && !MOTIVO_INFO[t.motivo] ? t.observacao : info.desc;
        const ultimo = i === transfs.length - 1;
        return (
          <div key={t.id} style={{ position: 'relative', paddingLeft: 22, paddingBottom: ultimo ? 0 : 16 }}>
            {/* linha vertical */}
            {!ultimo && <span style={{ position: 'absolute', left: 4, top: 12, bottom: 0, width: 2, background: 'var(--border-light, rgba(148,163,184,0.35))' }} />}
            {/* bolinha (a mais recente destacada) */}
            <span style={{ position: 'absolute', left: 0, top: 4, width: 10, height: 10, borderRadius: 999, background: i === 0 ? 'var(--pons-blue, #2563EB)' : 'var(--border, #CBD5E1)', boxShadow: i === 0 ? '0 0 0 3px rgba(37,99,235,0.18)' : 'none' }} />
            {/* linha 1: chip do tipo + data */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-elevated, rgba(148,163,184,0.16))' }}>{info.label}</span>
              <span className="text-xs text-secondary">· {dataBR(t.createdAt)}</span>
            </div>
            {/* lead (só na visão do corretor) */}
            {showLead && (
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{t.leadNome}</div>
            )}
            {/* linha 2: de → para */}
            <div style={{ fontSize: 12.5, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span className="text-secondary">de:</span> {t.deCorretorNome || 'Sistema'}
              <Icon name="arrow_right" size={11} />
              <span className="text-secondary">para:</span> {t.paraCorretorNome || '—'}
            </div>
            {/* descrição */}
            {desc && <div className="text-xs text-secondary" style={{ fontStyle: 'italic', marginTop: 2 }}>{desc}</div>}
          </div>
        );
      })}
    </div>
  );
}
