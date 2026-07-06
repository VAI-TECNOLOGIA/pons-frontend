import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { LeadCamposCustom } from '../components/LeadCamposCustom';
import { Api } from '../lib/api';
import { FichaLeadModal } from '../components/FichaLeadModal';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { initials, timeAgo } from '../lib/format';

const STATUS_MAP: Record<string, [string, string]> = {
  NOVO: ['neutral', 'Novo'],
  SDR: ['analysis', 'SDR'],
  QUALIFICANDO: ['analysis', 'Qualificando'],
  NEGOCIANDO: ['launch', 'Negociando'],
  VISITA: ['launch', 'Visita'],
  PROPOSTA: ['signed', 'Proposta'],
  FECHADO: ['signed', 'Fechado'],
  PERDIDO: ['cancelled', 'Perdido'],
};
const FILTROS = ['Todos', 'NOVO', 'NEGOCIANDO', 'PROPOSTA'];

export default function MeusLeads() {
  const { data, loading, error } = useApi<any[]>(() => Api.leads());
  const [filtro, setFiltro] = useState('Todos');
  const [campoLead, setCampoLead] = useState<any>(null);

  if (loading) return <Shell><LoadingBlock /></Shell>;
  if (error) return <Shell><ErrorBlock error={error} /></Shell>;

  const leads = (data || []).filter((l) => filtro === 'Todos' || l.status === filtro);

  return (
    <Shell>
      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        {FILTROS.map((f) => {
          const n = f === 'Todos' ? (data || []).length : (data || []).filter((l) => l.status === f).length;
          return (
            <button key={f} className={'btn btn--sm ' + (filtro === f ? 'btn--primary' : 'btn--secondary')} onClick={() => setFiltro(f)}>
              {f === 'Todos' ? 'Todos' : (STATUS_MAP[f]?.[1] || f)} ({n})
            </button>
          );
        })}
      </div>

      <div className="card fade-in" style={{ padding: 0 }}>
        <table className="table row-hover">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Origem</th>
              <th>Empreendimento</th>
              <th>Status</th>
              <th>Recebido</th>
              <th>WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Nenhum lead direcionado pra você ainda</td></tr>
            ) : leads.map((l) => {
              const [k, lab] = STATUS_MAP[l.status] || ['neutral', l.status];
              const digits = String(l.telefone || '').replace(/\D/g, '');
              const podeAbrir = !l.telefoneOculto && digits.length >= 10;
              return (
                <tr key={l.id}>
                  <td>
                    <div className="flex gap-3" style={{ alignItems: 'center' }}>
                      <div className="avatar avatar--sm">{initials(l.nome)}</div>
                      <div>
                        <div className="font-semibold" style={{ cursor: 'pointer' }} onClick={() => setCampoLead(l)} title="Ver campos personalizados">
                          {l.nome}{l.vip && <span className="badge badge--launch" style={{ fontSize: 9, padding: '2px 6px', marginLeft: 6 }}>VIP</span>}
                        </div>
                        <div className="text-xs text-secondary">{l.telefone || l.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge--neutral">{l.origem}</span></td>
                  <td className="text-xs">{l.interesse || '—'}</td>
                  <td><span className={`badge badge--${k}`}>{lab}</span></td>
                  <td className="text-xs text-secondary">{timeAgo(l.distribuidoEm || l.createdAt)}</td>
                  <td>
                    {podeAbrir ? (
                      <a className="wa-btn" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" title="Abrir conversa no WhatsApp" aria-label="WhatsApp">
                        <Icon name="whatsapp" size={17} />
                      </a>
                    ) : (
                      <span className="wa-lock" title="Libere o contato pra ver o número"><Icon name="lock" size={14} /></span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {campoLead && <FichaLeadModal leadId={campoLead.id} onClose={() => setCampoLead(null)} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar title="Meus Leads" />
      <div className="main__content page-enter">
        <PageHeader breadcrumb="Comercial · Atendimento" title="Meus Leads" subtitle="Leads direcionados pra você — clique no WhatsApp pra iniciar o atendimento" />
        {children}
      </div>
    </>
  );
}
