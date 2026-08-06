import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { Icon } from '../components/Icon';
import { ReguaCadenciaTab } from './remarketing/ReguaCadenciaTab';

type Tab = 'campanhas' | 'regua';

const CANAIS = ['WHATSAPP', 'EMAIL', 'SMS', 'PUSH'];
const STATUS_BADGES: Record<string, string> = {
  RASCUNHO: 'badge--neutral',
  AGENDADA: 'badge--info',
  ENVIANDO: 'badge--launch',
  ENVIADA: 'badge--signature',
  CANCELADA: 'badge--cancelled',
};

export default function Remarketing() {
  const [tab, setTab] = useState<Tab>('campanhas');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.remarketingList());
  const toast = useToast();
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      nome: String(fd.get('nome') || ''),
      canal: String(fd.get('canal') || 'WHATSAPP'),
      mensagem: String(fd.get('mensagem') || ''),
      assunto: String(fd.get('assunto') || '') || null,
      segmentoVisitouImovel: fd.get('segmentoVisitouImovel') === 'on',
      segmentoNaoComprou: fd.get('segmentoNaoComprou') === 'on',
      segmentoLeadAntigo: fd.get('segmentoLeadAntigo') === 'on',
      segmentoInvestidor: fd.get('segmentoInvestidor') === 'on',
      segmentoCidade: String(fd.get('segmentoCidade') || '') || null,
      segmentoFaixaMin: fd.get('segmentoFaixaMin') ? Number(fd.get('segmentoFaixaMin')) : null,
      segmentoFaixaMax: fd.get('segmentoFaixaMax') ? Number(fd.get('segmentoFaixaMax')) : null,
    };
    try {
      if (editing) await Api.remarketingUpdate(editing.id, payload);
      else await Api.remarketingCreate(payload);
      toast.success('Campanha salva');
      setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const agendar = async (c: any) => {
    const ok = await confirm({ title: 'Disparar agora?', message: `Iniciar envio de "${c.nome}" agora?` });
    if (!ok) return;
    await Api.remarketingAgendar(c.id);
    toast.success('Campanha agendada — worker dispara em até 30s');
    reload();
  };

  const cancelar = async (c: any) => {
    const ok = await confirm({ title: 'Cancelar?', message: `Cancelar "${c.nome}"?`, tone: 'danger' });
    if (!ok) return;
    await Api.remarketingCancelar(c.id); toast.success('Cancelada'); reload();
  };

  const verPreview = async (c: any) => {
    try {
      const r = await Api.remarketingPreview(c.id);
      toast.success(`${r.total} destinatários · custo estimado R$ ${r.custoEstimado.toFixed(2)}`);
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  return (
    <>
      <Topbar
        title="Remarketing"
        right={tab === 'campanhas' ? (
          <button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Nova campanha</button>
        ) : undefined}
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Marketing · Remarketing"
          title="Central de Remarketing"
          subtitle="Nutrir base segmentada via WhatsApp, Email, SMS ou Push"
        />

        <div className="tabs">
          {([
            ['campanhas', 'Campanhas'],
            ['regua', 'Régua de Cadência'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={'tab ' + (tab === key ? 'tab--active' : '')}
              onClick={() => setTab(key as Tab)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'campanhas' && (
          <>
            {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {(data || []).map((c) => (
                <div key={c.id} className="card">
                  <div className="flex-between" style={{ marginBottom: 6 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{c.nome}</h3>
                    <span className={`badge ${STATUS_BADGES[c.status] || 'badge--neutral'}`}>{c.status}</span>
                  </div>
                  <div className="text-xs text-secondary">{c.canal} · {c.totalEnviados}/{c.totalDestinatarios} enviados</div>
                  <p style={{ fontSize: 13, marginTop: 8, color: 'var(--gray-700)', maxHeight: 60, overflow: 'hidden' }}>{c.mensagem}</p>
                  <div className="flex" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => verPreview(c)}>
                      <Icon name="eye" size={12} /> Preview
                    </button>
                    {c.status === 'RASCUNHO' && (
                      <button className="btn btn--primary btn--sm" onClick={() => agendar(c)}>
                        <Icon name="play" size={12} /> Disparar
                      </button>
                    )}
                    {c.status === 'RASCUNHO' && <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(c); setOpen(true); }}>Editar</button>}
                    {['AGENDADA','ENVIANDO'].includes(c.status) && <button className="btn btn--ghost btn--sm" onClick={() => cancelar(c)}>Cancelar</button>}
                  </div>
                  <div className="text-xs text-secondary" style={{ marginTop: 8 }}>
                    Custo: R$ {(c.custoReal || 0).toFixed(2)} · estimado R$ {(c.custoEstimado || 0).toFixed(2)}
                  </div>
                </div>
              ))}
              {data?.length === 0 && <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>Nenhuma campanha criada</div>}
            </div>
          </>
        )}

        {tab === 'regua' && <ReguaCadenciaTab />}
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? 'Editar campanha' : 'Nova campanha de remarketing'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
            <button type="submit" form="rmk-form" className="btn btn--primary">Salvar rascunho</button>
          </>
        }
      >
        <form id="rmk-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} /></div>
            <div className="field">
              <label className="field__label">Canal *</label>
              <select name="canal" className="field__select" defaultValue={editing?.canal || 'WHATSAPP'}>
                {CANAIS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Assunto (só email)</label>
              <input name="assunto" className="field__input" defaultValue={editing?.assunto || ''} />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Mensagem * <span className="text-xs text-secondary">— use {`{{nome}}`} pra personalizar</span></label>
              <textarea name="mensagem" className="field__textarea" rows={4} required defaultValue={editing?.mensagem} placeholder="Ex: Olá {{nome}}! Lembramos que..." />
            </div>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Segmentação</label>
              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                {[
                  ['segmentoVisitouImovel', 'Visitou imóvel (tem interesse marcado)'],
                  ['segmentoNaoComprou', 'Não comprou (status diferente de FECHADO)'],
                  ['segmentoLeadAntigo', 'Lead antigo (criado há +90 dias)'],
                  ['segmentoInvestidor', 'Investidor (tag investidor)'],
                ].map(([k, l]) => (
                  <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" name={k} defaultChecked={editing?.[k]} />{l}
                  </label>
                ))}
              </div>
            </div>
            <div className="field"><label className="field__label">Cidade</label><input name="segmentoCidade" className="field__input" defaultValue={editing?.segmentoCidade || ''} /></div>
            <div className="field"><label className="field__label">Faixa min (R$)</label><input type="number" name="segmentoFaixaMin" className="field__input" defaultValue={editing?.segmentoFaixaMin || ''} /></div>
            <div className="field"><label className="field__label">Faixa max (R$)</label><input type="number" name="segmentoFaixaMax" className="field__input" defaultValue={editing?.segmentoFaixaMax || ''} /></div>
          </div>
        </form>
      </Modal>
    </>
  );
}
