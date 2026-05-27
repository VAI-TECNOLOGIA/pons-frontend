import { Topbar, PageHeader } from '../components/PageHeader';
import { Link } from 'react-router-dom';
import { formatCurrencyShort } from '../lib/format';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';

export default function Trafego() {
 const { data, loading, error } = useApi<any>(() => Api.tracking());
 const { data: settings, reload: reloadSettings } = useApi<Record<string, string>>(() => Api.settings());
 const toast = useToast();

 const salvarIntegracoes = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 try {
 await Api.settingsSave({
 'webhook.token': String(fd.get('webhook.token') || ''),
 'meta.token': String(fd.get('meta.token') || ''),
 'whatsapp.phoneId': String(fd.get('whatsapp.phoneId') || ''),
 'whatsapp.token': String(fd.get('whatsapp.token') || ''),
 'whatsapp.verify': String(fd.get('whatsapp.verify') || ''),
 });
 toast.success('Integrações salvas');
 reloadSettings();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 if (loading) return <Shell><LoadingBlock /></Shell>;
 if (error) return <Shell><ErrorBlock error={error} /></Shell>;
 if (!data) return null;

 const totalLeads = data.totalLeads || 0;
 const porOrigem = data.porOrigem || [];
 const porCampanha = (data.porCampanha || []).filter((g: any) => g.chave !== '(sem)');
 const totalFechados = porOrigem.reduce((s: number, o: any) => s + (o.fechados || 0), 0);
 const totalVolume = porOrigem.reduce((s: number, o: any) => s + (o.volume || 0), 0);
 const convGeral = totalLeads ? Math.round((totalFechados / totalLeads) * 100) : 0;
 const waOn = !!(settings?.['whatsapp.phoneId'] && settings?.['whatsapp.token']);

 return (
 <>
 <Topbar
 title="Tráfego & Meta"
 right={<Link to="/formularios" className="btn btn--secondary btn--sm">Webhooks / Formulários</Link>}
 />
 <div className="main__content">
 <PageHeader
 breadcrumb="Marketing · Tráfego pago"
 title={`${totalLeads} leads rastreados`}
 subtitle="Rastreamento de campanhas, criativos e atribuição até a venda (Meta Ads, Instagram, Google, site)"
 />

 <div className="card mb-6" style={{ border: '1px solid var(--blue-100)' }}>
 <div className="card__header">
 <div>
 <h3 className="card__title"> Integrações — receber leads e atender automático</h3>
 <p className="card__subtitle">Conecte o Meta Lead Ads e a API oficial do WhatsApp para o primeiro envio automático</p>
 </div>
 <span className={'badge ' + (waOn ? 'badge--signed' : 'badge--neutral')}>
 {waOn ? 'WhatsApp conectado' : ' WhatsApp não configurado'}
 </span>
 </div>
 <form onSubmit={salvarIntegracoes}>
 <div className="grid-2">
 <div>
 <div className="section-title" style={{ marginTop: 0 }}>Meta Lead Ads / Formulários</div>
 <div className="field">
 <label className="field__label">URL do Webhook (cole no Meta/Zapier)</label>
 <input className="field__input" readOnly value={`${window.location.origin}/api/webhooks/lead?token=${settings?.['webhook.token'] || ''}`} />
 </div>
 <div className="field">
 <label className="field__label">Token do webhook</label>
 <input name="webhook.token" className="field__input" defaultValue={settings?.['webhook.token'] || ''} />
 </div>
 <div className="field">
 <label className="field__label">Meta App / Page Access Token (opcional)</label>
 <input name="meta.token" className="field__input" placeholder="EAAB..." defaultValue={settings?.['meta.token'] || ''} />
 </div>
 </div>
 <div>
 <div className="section-title" style={{ marginTop: 0 }}>WhatsApp Cloud API (envio oficial)</div>
 <div className="field">
 <label className="field__label">Phone Number ID</label>
 <input name="whatsapp.phoneId" className="field__input" placeholder="1029384756..." defaultValue={settings?.['whatsapp.phoneId'] || ''} />
 </div>
 <div className="field">
 <label className="field__label">Access Token</label>
 <input name="whatsapp.token" className="field__input" placeholder="EAAG..." defaultValue={settings?.['whatsapp.token'] || ''} />
 </div>
 <div className="field">
 <label className="field__label">Verify Token (webhook)</label>
 <input name="whatsapp.verify" className="field__input" placeholder="pons-verify" defaultValue={settings?.['whatsapp.verify'] || ''} />
 </div>
 </div>
 </div>
 <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
 <button type="submit" className="btn btn--primary">Salvar integrações</button>
 </div>
 </form>
 </div>

 <div className="kpi-grid">
 <div className="kpi">
 <div className="kpi__label">Leads via Meta Ads</div>
 <div className="kpi__value">{porOrigem.find((o: any) => o.chave === 'META_ADS')?.leads || 0}</div>
 </div>
 <div className="kpi">
 <div className="kpi__label">Vendas atribuídas</div>
 <div className="kpi__value">{totalFechados}</div>
 </div>
 <div className="kpi">
 <div className="kpi__label">Volume atribuído</div>
 <div className="kpi__value">{formatCurrencyShort(totalVolume)}</div>
 </div>
 <div className="kpi">
 <div className="kpi__label">Conversão geral</div>
 <div className="kpi__value">{convGeral}%</div>
 </div>
 </div>

 <div className="card" style={{ padding: 0 }}>
 <div className="card__header" style={{ padding: '24px 24px 0' }}>
 <h3 className="card__title">Atribuição por Campanha — do lead à venda</h3>
 </div>
 <table className="table" style={{ marginTop: 16 }}>
 <thead>
 <tr>
 <th>Campanha</th>
 <th className="numeric">Leads</th>
 <th className="numeric">Qualificados</th>
 <th className="numeric">Vendas</th>
 <th className="numeric">Volume</th>
 <th className="numeric">Conversão</th>
 </tr>
 </thead>
 <tbody>
 {porCampanha.length === 0 ? (
 <tr>
 <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
 Nenhuma campanha rastreada. Envie leads com o campo "campanha" pelo webhook.
 </td>
 </tr>
 ) : (
 porCampanha.map((c: any) => (
 <tr key={c.chave}>
 <td className="font-semibold">{c.chave}</td>
 <td className="numeric">{c.leads || 0}</td>
 <td className="numeric">{c.qualificados || 0}</td>
 <td className="numeric font-semibold">{c.vendas || 0}</td>
 <td className="numeric money">{formatCurrencyShort(c.volume)}</td>
 <td className="numeric">
 <span className={'badge ' + ((c.conversao || 0) >= 10 ? 'badge--signed' : 'badge--neutral')}>
 {c.conversao || 0}%
 </span>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </div>
 </>
 );
}

function Shell({ children }: { children: React.ReactNode }) {
 return (
 <>
 <Topbar title="Tráfego & Meta" right={<Link to="/formularios" className="btn btn--secondary btn--sm">Webhooks / Formulários</Link>} />
 <div className="main__content">
 <PageHeader breadcrumb="Marketing · Tráfego pago" title="Tráfego" />
 {children}
 </div>
 </>
 );
}
