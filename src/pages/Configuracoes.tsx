import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { GoogleCalendarCard } from '../components/GoogleCalendarCard';
import { GuidedTour, useTourTrigger } from '../components/GuidedTour';
import { IntegracoesHelp } from '../components/IntegracoesHelp';
import { IAHelp } from '../components/IAHelp';
import { PasswordConfirmModal } from '../components/PasswordConfirmModal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { timeAgo } from '../lib/format';
import { parseFunil, FUNIL_SETTING_KEY, type Fase } from '../lib/funil';

import './configuracoes.css';

type Tab = 'ia' | 'integracoes' | 'acessos' | 'equipes' | 'filiais' | 'corretores' | 'construtoras' | 'empreendimentos' | 'politicas' | 'funil';

const GROUPS: { label: string; items: { value: Tab; label: string; icon: string; sub: string }[] }[] = [
 {
 label: 'IA & Atendimento',
 items: [
 { value: 'ia', label: 'IA & Assistentes', icon: 'bot', sub: 'Robô do sistema + SDR de leads' },
 { value: 'integracoes', label: 'Integrações', icon: 'link', sub: 'WhatsApp, Meta Ads, Sicredi' },
 ],
 },
 {
 label: 'Comercial',
 items: [
 { value: 'funil', label: 'Funil de vendas', icon: 'pipeline', sub: 'Renomear as fases do funil' },
 { value: 'equipes', label: 'Equipes', icon: 'shield', sub: 'Escuderias e cores' },
 { value: 'filiais', label: 'Filiais & CNPJ', icon: 'building', sub: 'Vincular cada sala ao CNPJ' },
 { value: 'corretores', label: 'Corretores', icon: 'users', sub: 'Acessos e CRECIs' },
 { value: 'politicas', label: 'Políticas de comissão', icon: 'dollar', sub: 'Rateios, splits' },
 ],
 },
 {
 label: 'Catálogo',
 items: [
 { value: 'construtoras', label: 'Construtoras', icon: 'building', sub: 'Parceiros' },
 { value: 'empreendimentos', label: 'Empreendimentos', icon: 'building', sub: 'Produtos no portfólio' },
 ],
 },
 {
 label: 'Sistema',
 items: [
 { value: 'acessos', label: 'Auditoria de acessos', icon: 'lock', sub: 'Log de entradas' },
 ],
 },
];

export default function Configuracoes() {
 const [searchParams, setSearchParams] = useSearchParams();
 const seçao = searchParams.get('secao') as Tab | null;
 const [tab, setTab] = useState<Tab>(seçao || 'ia');

 useEffect(() => {
 if (seçao) {
 setTab(seçao);
 // limpa a query string pra não preservar o redirect ao mudar de tab
 setSearchParams({}, { replace: true });
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [seçao]);

 const currentMeta = GROUPS.flatMap((g) => g.items).find((i) => i.value === tab);

 return (
 <>
 <Topbar title="Configurações" />
 <div className="main__content">
 <PageHeader
 breadcrumb="Administração"
 title="Central de Configurações"
 subtitle="Crie e gerencie equipes, corretores, construtoras, empreendimentos, políticas e a IA de atendimento"
 />

 <div className="cfg-layout">
 <aside className="cfg-nav">
 {GROUPS.map((group) => (
 <div className="cfg-nav__group" key={group.label}>
 <div className="cfg-nav__group-title">{group.label}</div>
 {group.items.map((item) => (
 <button
 key={item.value}
 className={'cfg-nav__item ' + (tab === item.value ? 'cfg-nav__item--active' : '')}
 onClick={() => setTab(item.value)}
 >
 <span className="cfg-nav__icon">
 <Icon name={item.icon} size={16} />
 </span>
 <span className="cfg-nav__text">
 <span className="cfg-nav__label">{item.label}</span>
 <span className="cfg-nav__sub">{item.sub}</span>
 </span>
 </button>
 ))}
 </div>
 ))}
 </aside>

 <section className="cfg-content">
 {currentMeta && (
 <header className="cfg-content__head">
 <h2 className="cfg-content__title">{currentMeta.label}</h2>
 <p className="cfg-content__sub">{currentMeta.sub}</p>
 </header>
 )}

 {tab === 'ia' && <PanelIA />}
 {tab === 'integracoes' && <PanelIntegracoes />}
 {tab === 'acessos' && <PanelAcessos />}
 {tab === 'equipes' && <PanelEquipes />}
 {tab === 'filiais' && <PanelFiliais />}
 {tab === 'corretores' && (
 <div className="card">
 <p className="text-secondary">Use a página principal <strong>/corretores</strong> para gerenciar (criar, editar, desativar).</p>
 </div>
 )}
 {tab === 'construtoras' && <PanelConstrutoras />}
 {tab === 'empreendimentos' && <PanelEmpreendimentos />}
 {tab === 'politicas' && <PanelPoliticas />}
 {tab === 'funil' && <PanelFunil />}
 </section>
 </div>
 </div>
 </>
 );
}

function PanelIA() {
 const { data: settings, loading, reload } = useApi<Record<string, string>>(() => Api.settings());
 if (loading) return <LoadingBlock />;
 return (
 <>
   <div className="flex-between" style={{ marginBottom: 12, alignItems: 'center' }}>
     <div className="text-sm text-secondary">
       Provedor de IA (Anthropic ou OpenAI), modelo e prompt do SDR.
     </div>
     <IAHelp />
   </div>
   <ProviderIACard settings={settings || {}} onSaved={reload} />
   <SdrIACard settings={settings || {}} />
 </>
 );
}

/**
 * Configuração do provedor de IA (chave do Claude/OpenAI).
 * Ação de Salvar é protegida por confirmação de senha (step-up auth).
 */
function ProviderIACard({ settings, onSaved }: { settings: Record<string, string>; onSaved: () => void }) {
 const toast = useToast();
 const [provider, setProvider] = useState(settings['ia.provider'] || 'anthropic');
 const [apiKey, setApiKey] = useState(settings['ia.apiKey'] || '');
 const [model, setModel] = useState(settings['ia.model'] || '');
 const [showKey, setShowKey] = useState(false);
 const [showPwd, setShowPwd] = useState(false);
 const [status, setStatus] = useState<{ configurado: boolean; provider?: string; model?: string } | null>(null);
 const [testing, setTesting] = useState(false);

 const refreshStatus = async () => {
   try {
     const s = await Api.iaStatus();
     setStatus(s);
   } catch {}
 };

 useEffect(() => { refreshStatus(); }, []);

 const persist = async () => {
   await Api.settingsSave({
     'ia.provider': provider,
     'ia.apiKey': apiKey,
     'ia.model': model,
   });
   toast.success('Configurações de IA salvas com sucesso.');
   onSaved();
   refreshStatus();
 };

 const testar = async () => {
   setTesting(true);
   try {
     const r: any = await Api.iaAssistente('Diz "ok" se você está pronto pra ajudar.');
     if (r?.fonte === 'ia') toast.success('IA conectada e respondendo.');
     else toast.info('IA respondeu em modo demo. Verifique a chave / saldo.');
   } catch (err: any) {
     toast.error('Falha: ' + (err?.message || 'erro'));
   } finally {
     setTesting(false);
   }
 };

 const placeholderKey = provider === 'anthropic' ? 'sk-ant-api03-...' : 'sk-...';
 const placeholderModel = provider === 'anthropic' ? 'claude-haiku-4-5-20251001 (padrão)' : 'gpt-4o-mini (padrão)';

 return (
 <>
 <form className="card" onSubmit={(e) => { e.preventDefault(); setShowPwd(true); }} style={{ marginBottom: 16 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
 <div>
 <h3 className="card__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
 <Icon name="bot" size={16} /> Robô Assistente do Sistema
 </h3>
 <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
 Configura o robô flutuante que aparece no canto inferior direito de todas as telas.
 Ele ajuda corretores, sócios e administração com dúvidas sobre uso do sistema,
 empreendimentos, vendas e financeiro — usando os dados reais da operação como contexto.
 Aqui você liga a chave do Claude (Anthropic) ou GPT (OpenAI).
 </p>
 </div>
 <div style={{ textAlign: 'right' }}>
 {status?.configurado ? (
 <span className="badge badge--signed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
 <Icon name="checkCircle" size={12} /> Conectado
 </span>
 ) : (
 <span className="badge badge--analysis">Não configurado</span>
 )}
 <button
 type="button"
 className="btn btn--ghost btn--sm"
 style={{ marginTop: 8, display: 'block' }}
 onClick={testar}
 disabled={testing || !status?.configurado}
 >
 {testing ? 'Testando…' : 'Testar IA'}
 </button>
 </div>
 </div>

 <div className="form-grid">
 <div className="field">
 <label className="field__label">Provedor</label>
 <select
 className="field__select"
 value={provider}
 onChange={(e) => setProvider(e.target.value)}
 >
 <option value="anthropic">Anthropic (Claude)</option>
 <option value="openai">OpenAI (GPT)</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Modelo (opcional)</label>
 <input
 type="text"
 className="field__input"
 placeholder={placeholderModel}
 value={model}
 onChange={(e) => setModel(e.target.value)}
 />
 <div className="field__hint">Em branco usa o modelo padrão recomendado (barato e atual).</div>
 </div>
 <div className="field field--span-2">
 <label className="field__label">API Key</label>
 <div style={{ display: 'flex', gap: 8 }}>
 <input
 type={showKey ? 'text' : 'password'}
 className="field__input"
 placeholder={placeholderKey}
 value={apiKey}
 onChange={(e) => setApiKey(e.target.value)}
 style={{ flex: 1 }}
 />
 <button
 type="button"
 className="btn btn--ghost btn--sm"
 onClick={() => setShowKey((v) => !v)}
 title={showKey ? 'Ocultar' : 'Mostrar'}
 >
 <Icon name={showKey ? 'lock' : 'search'} size={14} />
 </button>
 </div>
 <div className="field__hint">
 {provider === 'anthropic' ? (
 <>Crie em <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener" style={{ color: 'var(--text-link)' }}>platform.claude.com → Settings → API Keys</a>. Modelo padrão (Haiku 4.5) custa ~US$ 1 por 1M tokens.</>
 ) : (
 <>Crie em <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" style={{ color: 'var(--text-link)' }}>platform.openai.com → API Keys</a>.</>
 )}
 </div>
 </div>
 </div>

 <div
 className="card"
 style={{
 marginTop: 16,
 background: 'var(--color-warning-bg)',
 borderColor: 'var(--color-warning-border)',
 color: 'var(--color-warning-fg)',
 padding: 12,
 }}
 >
 <div style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
 <Icon name="lock" size={14} style={{ marginTop: 2, flexShrink: 0 }} />
 <span>
 <strong>Etapa de segurança extra:</strong> alterações aqui exigem que você re-digite sua
 senha de login antes de aplicar. A chave nunca aparece em logs do sistema.
 </span>
 </div>
 </div>

 <button type="submit" className="btn btn--primary" style={{ marginTop: 16 }} disabled={!apiKey.trim() && !settings['ia.apiKey']}>
 Salvar configurações de IA
 </button>
 </form>

 <PasswordConfirmModal
 open={showPwd}
 title="Confirmar alteração de IA"
 message="Por segurança, digite sua senha de login para aplicar a nova configuração de IA."
 confirmLabel="Aplicar"
 onClose={() => setShowPwd(false)}
 onConfirm={persist}
 />
 </>
 );
}

/**
 * Configuração do Assistente Virtual de leads (SDR IA — outro fluxo, não-protegido).
 */
function SdrIACard({ settings }: { settings: Record<string, string> }) {
 const toast = useToast();
 const submit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 try {
 await Api.settingsSave({
 'ia.ativa': String(fd.get('ativa') || 'true'),
 'ia.nome': String(fd.get('nome') || 'Pons'),
 'ia.tom': String(fd.get('tom') || 'cordial'),
 'ia.saudacao': String(fd.get('saudacao') || ''),
 });
 toast.success('Configurações do SDR IA salvas');
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };
 return (
 <div className="grid-2" style={{ alignItems: 'start' }}>
 <form className="card" onSubmit={submit}>
 <h3 className="card__title mb-4">Assistente Virtual de Leads (SDR IA)</h3>
 <p className="text-sm text-secondary" style={{ marginTop: -8, marginBottom: 16 }}>
 Configurações do bot SDR que atende leads novos automaticamente no Atendimento.
 </p>
 <div className="form-grid form-grid--single">
 <div className="field">
 <label className="field__label">SDR IA ativo?</label>
 <select name="ativa" className="field__select" defaultValue={settings?.['ia.ativa'] !== 'false' ? 'true' : 'false'}>
 <option value="true">Sim — atende automaticamente</option>
 <option value="false">Não</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Nome do assistente</label>
 <input name="nome" className="field__input" defaultValue={settings?.['ia.nome'] || 'Pons'} />
 </div>
 <div className="field">
 <label className="field__label">Tom de voz</label>
 <select name="tom" className="field__select" defaultValue={settings?.['ia.tom'] || 'cordial'}>
 <option value="cordial">Cordial</option>
 <option value="direto">Direto</option>
 <option value="consultivo">Consultivo</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Saudação inicial</label>
 <textarea
 name="saudacao"
 className="field__textarea"
 rows={3}
 defaultValue={settings?.['ia.saudacao'] || 'Olá! Sou a {assistente}, assistente virtual do Grupo Pons Imobiliário'}
 />
 <div className="field__hint">Use {'{assistente}'} para inserir o nome.</div>
 </div>
 </div>
 <button type="submit" className="btn btn--primary" style={{ marginTop: 16 }}>
 Salvar SDR IA
 </button>
 </form>
 <div className="card" style={{ background: 'var(--color-info-bg)', borderColor: 'var(--color-info-border)' }}>
 <h3 className="card__title mb-2" style={{ color: 'var(--color-info-fg)' }}>Como o SDR IA atende</h3>
 <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-info-fg)', lineHeight: 1.8 }}>
 <li>
 Todo lead novo recebe a <strong>saudação automática</strong> ao entrar pelo formulário
 </li>
 <li>Qualifica por intenção: preço, planta, localização, pagamento, visita, investimento</li>
 <li>Usa dados reais do empreendimento (valor, cidade)</li>
 <li>
 Marca o lead como <strong>qualificado</strong> e sugere handoff ao corretor
 </li>
 <li>Conversa fica registrada no CRM (anti-perda de lead)</li>
 </ul>
 </div>
 </div>
 );
}

function PanelIntegracoes() {
 const { data: s, loading, reload } = useApi<Record<string, string>>(() => Api.settings());
 const toast = useToast();
 const tour = useTourTrigger('integracoes-v1');
 if (loading) return <LoadingBlock />;
 const submit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 const payload: Record<string, string> = {};
 // google.clientId/Secret não estão mais aqui — modelo SaaS, creds no backend.
 [
   'webhook.token', 'meta.token',
   'sicredi.clientId', 'sicredi.clientSecret',
 ].forEach((key) => {
 const v = fd.get(key);
 if (v != null) payload[key] = String(v);
 });
 try {
 await Api.settingsSave(payload);
 toast.success('Integrações salvas');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };
 return (
 <>
 <div className="flex-between" style={{ marginBottom: 12, alignItems: 'center' }}>
 <div className="text-sm text-secondary">
 Configure as integrações abaixo. Cada card tem seu botão de salvar.
 </div>
 <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
 <button
 type="button"
 onClick={tour.open}
 className="btn btn--ghost btn--sm"
 title="Tour guiado"
 style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
 >
 <Icon name="lightbulb" size={14} /> Tour guiado
 </button>
 <IntegracoesHelp />
 </div>
 </div>
 <GuidedTour
 storageKey="integracoes-v1"
 forceOpen={tour.forceOpen}
 onDone={tour.onDone}
 steps={[
 {
 target: '[data-tour="google-card"]',
 title: 'Google Calendar',
 body: 'Sincronização com o Google Calendar fica disponível assim que o app for aprovado pelo Google. A agenda interna do sistema continua funcionando normalmente.',
 },
 {
 target: '[data-tour="meta-card"]',
 title: 'WhatsApp Cloud API (Meta)',
 body: 'Canal oficial Meta — envia/recebe mensagens diretamente. Cole Phone ID, Token, App Secret e Verify Token. Depois clique em "Testar conexão".',
 },
 {
 target: '[data-tour="vai-card"]',
 title: 'WhatsApp via VAI CRM',
 body: 'Canal alternativo via VAI CRM. Funciona como fallback se a janela de 24h do Meta estourar.',
 },
 {
 target: '[data-tour="facebook-card"]',
 title: 'Facebook Business Manager',
 body: 'Conecte páginas e contas de anúncios pra capturar leads do Facebook Ads em tempo real. Clique em "Gerenciar BMs" pra adicionar.',
 },
 {
 target: '[data-tour="outras-integracoes"]',
 title: 'Outras integrações',
 body: 'Tokens de webhook Meta Lead Ads, Sicredi e credenciais auxiliares ficam aqui.',
 },
 ]}
 />
 <div data-tour="google-card">
 <GoogleCalendarCard onChange={reload} />
 </div>
 <div data-tour="meta-card">
 <MetaWhatsappCard settings={s || {}} onSaved={reload} />
 </div>
 <div data-tour="vai-card">
 <VaiIntegrationCard settings={s || {}} onSaved={reload} />
 </div>
 <div data-tour="facebook-card">
 <FacebookBMCard />
 </div>
 <form className="card" onSubmit={submit} style={{ marginTop: 16 }} data-tour="outras-integracoes">
 <h3 className="card__title mb-4">Outras integrações externas</h3>
 <div className="form-grid">
 <div className="field">
 <label className="field__label">Token do Webhook (Meta Lead Ads)</label>
 <input name="webhook.token" className="field__input" defaultValue={s?.['webhook.token'] || ''} />
 </div>
 <div className="field">
 <label className="field__label">Meta Page Access Token (Lead Ads)</label>
 <input name="meta.token" className="field__input" placeholder="EAAB..." defaultValue={s?.['meta.token'] || ''} />
 </div>
 <div className="field">
 <label className="field__label">Sicredi Client ID</label>
 <input name="sicredi.clientId" className="field__input" placeholder="cliente-..." defaultValue={s?.['sicredi.clientId'] || ''} />
 </div>
 <div className="field">
 <label className="field__label">Sicredi Client Secret</label>
 <input name="sicredi.clientSecret" className="field__input" type="password" placeholder="••••••••" defaultValue={s?.['sicredi.clientSecret'] || ''} />
 </div>
 </div>
 <button type="submit" className="btn btn--primary" style={{ marginTop: 16 }}>
 Salvar integrações
 </button>
 </form>
 </>
 );
}

function MetaWhatsappCard({ settings, onSaved }: { settings: Record<string, string>; onSaved: () => void }) {
 const toast = useToast();
 const [saving, setSaving] = useState(false);
 const [checking, setChecking] = useState(false);
 const [health, setHealth] = useState<Awaited<ReturnType<typeof Api.metaHealth>> | null>(null);
 const [numbers, setNumbers] = useState<Awaited<ReturnType<typeof Api.metaNumbers>> | null>(null);
 const [loadingNumbers, setLoadingNumbers] = useState(false);
 const [registering, setRegistering] = useState<string | null>(null);

 const loadNumbers = async () => {
 setLoadingNumbers(true);
 try {
 const r = await Api.metaNumbers();
 setNumbers(r);
 if (!r.ok) toast.error('Não listou números: ' + (r.reason || 'erro'));
 } catch (err: any) {
 toast.error('Erro: ' + (err?.message || 'falha'));
 } finally {
 setLoadingNumbers(false);
 }
 };

 const registrarNumero = async (phoneId: string, displayNumber?: string) => {
 const pin = window.prompt(`PIN de 6 dígitos da verificação em duas etapas do número ${displayNumber || phoneId}.\nSe o número nunca teve PIN, defina um agora (anote-o):`);
 if (!pin) return;
 setRegistering(phoneId);
 try {
 const r = await Api.metaRegister(phoneId, pin.trim());
 if (r.ok) {
 toast.success('Número registrado na Cloud API. Já recebe inbound + IA.');
 loadNumbers();
 } else {
 toast.error('Falhou: ' + (r.error || 'erro') + (r.metaCode ? ` (${r.metaCode})` : ''));
 }
 } catch (err: any) {
 toast.error('Erro: ' + (err?.message || 'falha'));
 } finally {
 setRegistering(null);
 }
 };

 const checkHealth = async () => {
 setChecking(true);
 try {
 const h = await Api.metaHealth();
 setHealth(h);
 if (h.ok) toast.success(`Meta OK — ${h.displayNumber || h.phoneId}`);
 else if (!h.configured) toast.info('Preencha Phone ID e Token Meta para habilitar.');
 else toast.error('Meta falhou: ' + (h.reason || 'erro'));
 } catch (err: any) {
 toast.error('Erro: ' + (err?.message || 'falha'));
 } finally {
 setChecking(false);
 }
 };

 const submit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 const keys = ['whatsapp.phoneId', 'whatsapp.wabaId', 'whatsapp.token', 'whatsapp.appSecret', 'whatsapp.verifyToken'];
 const payload: Record<string, string> = {};
 for (const k of keys) {
 const v = fd.get(k);
 if (v != null) payload[k] = String(v);
 }
 // Pool de números (campanhas round-robin): textarea com 1 ID por linha/vírgula
 // → guardado como JSON array de phone_number_id (formato que getWhatsappPhoneIds lê).
 const poolRaw = fd.get('whatsapp.phoneIdPool');
 if (poolRaw != null) {
 const ids = String(poolRaw).split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
 payload['whatsapp.phoneIdPool'] = JSON.stringify(ids);
 }
 setSaving(true);
 try {
 await Api.settingsSave(payload);
 toast.success('Credenciais Meta salvas');
 onSaved();
 setTimeout(checkHealth, 500);
 } catch (err: any) {
 toast.error('Erro: ' + (err?.message || 'falha'));
 } finally {
 setSaving(false);
 }
 };

 const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/meta-whatsapp` : '';
 // Pool guardado como JSON array; mostra 1 ID por linha no textarea.
 const poolText = (() => {
 try {
 const arr = JSON.parse(settings['whatsapp.phoneIdPool'] || '[]');
 return Array.isArray(arr) ? arr.join('\n') : '';
 } catch {
 return String(settings['whatsapp.phoneIdPool'] || '');
 }
 })();

 return (
 <form className="card" onSubmit={submit} style={{ marginBottom: 16 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
 <div>
 <h3 className="card__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
 <Icon name="chat" size={16} /> WhatsApp Cloud API (Meta — oficial)
 </h3>
 <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
 Canal oficial Meta. Preferido para outbound dentro da janela 24h e callbacks de leitura.
 O sistema usa Meta primeiro; se a janela expirar (erro 131047) cai pra VAI quando disponível.
 </p>
 </div>
 <div style={{ textAlign: 'right' }}>
 {health?.ok && (
 <span className="badge badge--signed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
 <Icon name="checkCircle" size={12} /> {health.displayNumber || 'Conectado'}
 </span>
 )}
 {health && !health.ok && (
 <span className="badge badge--analysis">{health.configured ? 'Falha' : 'Não configurado'}</span>
 )}
 <button
 type="button"
 className="btn btn--ghost btn--sm"
 style={{ marginTop: 8, display: 'block' }}
 onClick={checkHealth}
 disabled={checking}
 >
 {checking ? 'Verificando…' : 'Testar conexão'}
 </button>
 </div>
 </div>

 <div className="form-grid">
 <div className="field">
 <label className="field__label">Phone Number ID</label>
 <input
 name="whatsapp.phoneId"
 className="field__input"
 placeholder="102938..."
 defaultValue={settings['whatsapp.phoneId'] || ''}
 />
 <div className="field__hint">Achado em WhatsApp → API Setup do app de Dev.</div>
 </div>
 <div className="field">
 <label className="field__label">WhatsApp Business Account ID (WABA)</label>
 <input
 name="whatsapp.wabaId"
 className="field__input"
 placeholder="apenas pra introspecção"
 defaultValue={settings['whatsapp.wabaId'] || ''}
 />
 </div>
 <div className="field field--span-2">
 <label className="field__label">Access Token (System User ou Temporário 24h)</label>
 <input
 name="whatsapp.token"
 className="field__input"
 type="password"
 placeholder="EAAG..."
 defaultValue={settings['whatsapp.token'] || ''}
 />
 <div className="field__hint">Token permanente: developers.facebook.com → seu app → Configurações de negócio → Usuários do Sistema → Gerar token com permissões whatsapp_business_messaging + whatsapp_business_management.</div>
 </div>
 <div className="field">
 <label className="field__label">App Secret (chave secreta do app)</label>
 <input
 name="whatsapp.appSecret"
 className="field__input"
 type="password"
 placeholder="hex 32 chars"
 defaultValue={settings['whatsapp.appSecret'] || ''}
 />
 <div className="field__hint">Usado pra validar HMAC SHA-256 do header X-Hub-Signature-256.</div>
 </div>
 <div className="field">
 <label className="field__label">Verify Token (você inventa)</label>
 <input
 name="whatsapp.verifyToken"
 className="field__input"
 placeholder="pons-meta-2026-xxxx"
 defaultValue={settings['whatsapp.verifyToken'] || ''}
 />
 <div className="field__hint">Cole o MESMO valor no painel Meta ao configurar o webhook.</div>
 </div>
 <div className="field field--span-2">
 <label className="field__label">Pool de números (campanhas)</label>
 <textarea
 name="whatsapp.phoneIdPool"
 className="field__input"
 rows={5}
 placeholder={'1 phone_number_id por linha, ex.:\n1090726274134958\n1236172369571015'}
 defaultValue={poolText}
 />
 <div className="field__hint">phone_number_ids da MESMA WABA usados nas campanhas (round-robin). Vazio = usa só o Phone Number ID acima. O atendimento responde sempre pelo número que recebeu o lead, independente desta lista.</div>
 </div>
 </div>

 <div className="card" style={{ marginTop: 16 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
 <h4 className="card__title">Números da WABA — status na Cloud API</h4>
 <button type="button" className="btn btn--ghost btn--sm" onClick={loadNumbers} disabled={loadingNumbers}>
 {loadingNumbers ? 'Carregando…' : 'Listar números'}
 </button>
 </div>
 <div className="field__hint" style={{ marginBottom: 8 }}>
 Só números com plataforma <strong>CLOUD_API</strong> recebem mensagem no Atendimento e a IA responde. Se aparecer outro status, o número está na WABA mas <strong>não registrado</strong> na Cloud API — clique em "Registrar".
 </div>
 {numbers?.numbers && numbers.numbers.length > 0 ? (
 <div style={{ display: 'grid', gap: 6 }}>
 {numbers.numbers.map((n) => (
 <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
 <div>
 <div style={{ fontWeight: 600 }}>
 {n.displayNumber || n.id}
 {n.ehDefault && <span className="badge badge--info" style={{ marginLeft: 6 }}>padrão</span>}
 </div>
 <div className="text-xs text-secondary">ID {n.id} · {n.verifiedName || 's/ nome'} · qualidade {n.qualityRating || '—'}</div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <span className={`badge ${n.cloudApi ? 'badge--signed' : 'badge--analysis'}`}>
 {n.cloudApi ? 'CLOUD_API' : (n.platformType || 'não registrado')}
 </span>
 {!n.cloudApi && (
 <button type="button" className="btn btn--primary btn--sm" disabled={registering === n.id} onClick={() => registrarNumero(n.id, n.displayNumber)}>
 {registering === n.id ? 'Registrando…' : 'Registrar'}
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 ) : numbers && numbers.numbers?.length === 0 ? (
 <div className="text-sm text-secondary">Nenhum número retornado. Confira o WABA ID e o token.</div>
 ) : null}
 </div>

 <div className="card" style={{ marginTop: 16, background: 'var(--blue-50)', borderColor: 'var(--blue-100)' }}>
 <h4 className="card__title mb-2" style={{ color: 'var(--blue-700)' }}>Configurar webhook no painel Meta</h4>
 <div style={{ fontSize: 12, color: 'var(--blue-700)', lineHeight: 1.8 }}>
 <div><strong>Callback URL:</strong> <code>{webhookUrl}</code></div>
 <div><strong>Verify Token:</strong> o mesmo valor que você colocou no campo acima</div>
 <div><strong>Subscrever em:</strong> <code>messages</code> (mínimo). Opcional: <code>message_template_status_update</code>, <code>account_update</code></div>
 <div><strong>Passos:</strong> developers.facebook.com → seu app → WhatsApp → Configuração → "Adicionar URL de retorno de chamada"</div>
 </div>
 </div>

 <button type="submit" className="btn btn--primary" style={{ marginTop: 16 }} disabled={saving}>
 {saving ? 'Salvando…' : 'Salvar credenciais Meta'}
 </button>
 </form>
 );
}

// Card Facebook Business Manager — OAuth completo na própria página.
// Click em "Conectar Nova Conta" → popup OAuth FB → seletor de página/conta → cria BM no banco.
function FacebookBMCard() {
  const { data: bms, reload } = useApi<any[]>(() => Api.bmList().catch(() => []));
  const { data: health } = useApi<{ configured: boolean }>(() => Api.fbHealth().catch(() => ({ configured: false })));
  const conectadas = bms?.length || 0;
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pages, setPages] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedPage, setSelectedPage] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [bmName, setBmName] = useState('Facebook Leads 1');

  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    // O popup do FB pode voltar num domínio diferente (redirect_uri fixo em
    // pons-frontend.vercel.app), então aceita os origins conhecidos do app —
    // não só o atual. Sem isso a mensagem é rejeitada e a tela trava em "Conectando".
    const allowedOrigins = new Set([
      window.location.origin,
      'https://app.grupopons.com.br',
      'https://pons-frontend.vercel.app',
      'https://www.grupopons.com.br',
      'http://localhost:5173',
    ]);
    function onMsg(ev: MessageEvent) {
      if (!allowedOrigins.has(ev.origin)) return;
      const m = ev.data;
      if (!m || typeof m !== 'object') return;
      if (m.kind === 'fb-oauth-success' && m.code) {
        (async () => {
          try {
            const r: any = await Api.fbCallback(m.code);
            setPages(r.pages || []);
            setAccounts(r.accounts || []);
            (window as any).__fbUserToken = r.userToken;
            setPickerOpen(true);
            setConnecting(false);
          } catch (err: any) {
            toast.error('Falha ao trocar code: ' + (err?.message || ''));
            setConnecting(false);
          }
        })();
      } else if (m.kind === 'fb-oauth-error') {
        toast.error('OAuth cancelado: ' + (m.error || ''));
        setConnecting(false);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [toast]);

  const conectar = async () => {
    if (!health?.configured) {
      toast.error('Meta App não configurado no backend (META_APP_ID/SECRET).');
      return;
    }
    setConnecting(true);
    try {
      const r = await Api.fbAuthUrl();
      const w = 600, h = 700;
      const left = window.screenX + (window.innerWidth - w) / 2;
      const top = window.screenY + (window.innerHeight - h) / 2;
      const win = window.open(r.url, 'fb-oauth', `width=${w},height=${h},left=${left},top=${top}`);
      popupRef.current = win;
      if (!win) {
        toast.error('Popup bloqueado pelo navegador. Libere popups pra este site e tente de novo.');
        setConnecting(false);
        return;
      }
      // Se o usuário fechar o popup sem concluir, destrava a UI em vez de ficar
      // "Conectando…" pra sempre. O handler de mensagem zera connecting no sucesso.
      const poll = setInterval(() => {
        if (win.closed) {
          clearInterval(poll);
          setConnecting((c) => {
            if (c && !pickerOpen) toast.info('Conexão com o Facebook cancelada.');
            return false;
          });
        }
      }, 700);
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
      setConnecting(false);
    }
  };

  const salvar = async () => {
    if (!selectedPage) {
      toast.error('Selecione uma página do Facebook');
      return;
    }
    const page = pages.find((p) => p.id === selectedPage);
    if (!page) return;
    try {
      // 1. Cria a BM no banco
      const bm = await Api.bmCreate({
        nome: bmName,
        paginaFbId: page.id,
        contaAnuncioId: selectedAccount || null,
      });
      // 2. Linka token de página
      await Api.fbLinkBM({
        bmId: bm.id,
        pageFbId: page.id,
        paginaName: page.name,
        pageAccessToken: page.access_token,
        contaAnuncioId: selectedAccount || undefined,
      });
      toast.success(`Conta "${page.name}" conectada`);
      setPickerOpen(false);
      setSelectedPage('');
      setSelectedAccount('');
      setBmName('Facebook Leads 1');
      reload();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || ''));
    }
  };

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                background: '#1877F2',
                color: '#fff',
                width: 36,
                height: 36,
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="facebook" size={20} />
            </div>
            <div>
              <h3 className="card__title" style={{ margin: 0 }}>Facebook Business Manager</h3>
              <p className="text-sm text-secondary" style={{ marginTop: 2 }}>
                Comece a receber leads do Facebook Ads em tempo real e distribua automaticamente nas suas filas de atendimento.
              </p>
            </div>
          </div>
          {conectadas > 0 ? (
            <span className="badge badge--signed">{conectadas} BM{conectadas > 1 ? 's' : ''} conectada{conectadas > 1 ? 's' : ''}</span>
          ) : (
            <span className="badge badge--analysis">Nenhuma BM conectada</span>
          )}
        </div>

        {/* Lista resumida das BMs conectadas */}
        {conectadas > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(bms || []).slice(0, 5).map((bm) => (
              <div
                key={bm.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <Icon name="facebook" size={14} style={{ color: '#1877F2' }} />
                <span style={{ fontWeight: 600 }}>{bm.nome || bm.paginaName || bm.paginaFbId}</span>
                <span className="text-xs text-secondary">{bm.leadsCaptados || 0} leads</span>
                <a href="/bm" className="text-xs" style={{ marginLeft: 'auto', color: 'var(--text-link)' }}>
                  Gerenciar
                </a>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={conectar}
            disabled={connecting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="plus" size={14} />
            {connecting ? 'Aguardando...' : 'Conectar Nova Conta'}
          </button>
          <a href="/bm" className="btn btn--ghost btn--sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="settings" size={14} /> Gerenciar BMs
          </a>
          {!health?.configured && (
            <span className="text-xs text-secondary" style={{ alignSelf: 'center' }}>
              ⚠️ META_APP_ID/SECRET não configurado no backend
            </span>
          )}
        </div>
      </div>

      {/* Modal seletor de página + conta após OAuth */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Editar Integração Facebook"
        subtitle="Selecione a página e a conta de anúncios pra começar a receber leads."
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="field__label">Nome da integração</label>
            <input
              className="field__input"
              value={bmName}
              onChange={(e) => setBmName(e.target.value)}
              placeholder="Facebook Leads 1"
            />
          </div>

          <div className="field">
            <label className="field__label">Página do Facebook *</label>
            <select
              className="field__select"
              value={selectedPage}
              onChange={(e) => setSelectedPage(e.target.value)}
            >
              <option value="">Selecione uma página</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
            <p className="field__hint">{pages.length} página(s) disponível(eis) na sua conta.</p>
          </div>

          <div className="field">
            <label className="field__label">Conta de Anúncios (opcional)</label>
            <select
              className="field__select"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <option value="">Sem conta vinculada</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
            <p className="field__hint">Necessária se quiser ver métricas de custo no painel Tráfego.</p>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn--ghost" onClick={() => setPickerOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn--primary" onClick={salvar} disabled={!selectedPage}>
              Salvar e ativar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function VaiIntegrationCard({ settings, onSaved }: { settings: Record<string, string>; onSaved: () => void }) {
 const toast = useToast();
 const [saving, setSaving] = useState(false);
 const [health, setHealth] = useState<{ ok: boolean; configured: boolean; reason?: string; apiBaseUrl?: string } | null>(null);
 const [checking, setChecking] = useState(false);

 const checkHealth = async () => {
 setChecking(true);
 try {
 const h = await Api.vaiHealth();
 setHealth(h);
 if (h.ok) toast.success('VAI respondeu — login OK.');
 else if (!h.configured) toast.info('Preencha email e senha do VAI para habilitar.');
 else toast.error('VAI falhou: ' + (h.reason || 'erro'));
 } catch (err: any) {
 toast.error('Erro: ' + (err?.message || 'falha'));
 } finally {
 setChecking(false);
 }
 };

 const submit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 // Modelo SaaS: cliente só preenche login do painel VAI.
 // API base URL, channel ID, webhook/flow secrets ficam no backend (env vars
 // gerenciadas por VAI Tecnologia no Railway por instalação).
 const keys = ['vai.loginEmail', 'vai.loginPassword'];
 const payload: Record<string, string> = {};
 for (const k of keys) {
 const v = fd.get(k);
 if (v != null) payload[k] = String(v);
 }
 setSaving(true);
 try {
 await Api.settingsSave(payload);
 toast.success('Credenciais VAI salvas');
 onSaved();
 // tenta health-check imediato com as novas credenciais
 setTimeout(checkHealth, 500);
 } catch (err: any) {
 toast.error('Erro: ' + (err?.message || 'falha'));
 } finally {
 setSaving(false);
 }
 };

 return (
 <form className="card" onSubmit={submit}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
 <div>
 <h3 className="card__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
 <Icon name="chat" size={16} /> WhatsApp via VAI CRM
 </h3>
 <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
 Conecta um número WhatsApp Web ao Atendimento. Trafego inbound vem por webhook,
 outbound vai pelo cliente HTTP autenticado. Credenciais ficam no banco (sem redeploy).
 </p>
 </div>
 <div style={{ textAlign: 'right' }}>
 {health?.ok && (
 <span className="badge badge--signed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
 <Icon name="checkCircle" size={12} /> Conectado
 </span>
 )}
 {health && !health.ok && (
 <span className="badge badge--analysis">{health.configured ? 'Falha' : 'Não configurado'}</span>
 )}
 <button
 type="button"
 className="btn btn--ghost btn--sm"
 style={{ marginTop: 8, display: 'block' }}
 onClick={checkHealth}
 disabled={checking}
 >
 {checking ? 'Verificando…' : 'Testar conexão'}
 </button>
 </div>
 </div>

 <div className="form-grid">
 <div className="field">
 <label className="field__label">Email do painel VAI</label>
 <input
 name="vai.loginEmail"
 type="email"
 className="field__input"
 placeholder="usuario@empresa.com"
 defaultValue={settings['vai.loginEmail'] || ''}
 />
 </div>
 <div className="field">
 <label className="field__label">Senha do painel VAI</label>
 <input
 name="vai.loginPassword"
 type="password"
 className="field__input"
 placeholder="••••••••"
 defaultValue={settings['vai.loginPassword'] || ''}
 />
 </div>
 </div>

 <button type="submit" className="btn btn--primary" style={{ marginTop: 16 }} disabled={saving}>
 {saving ? 'Salvando…' : 'Salvar credenciais VAI'}
 </button>
 </form>
 );
}

function PanelAcessos() {
 const { data, loading, error } = useApi<any>(() => Api.acessosResumo());
 if (loading) return <LoadingBlock />;
 if (error) return <ErrorBlock error={error} />;
 const items = data?.ultimos || data || [];
 return (
 <div className="card" style={{ padding: 0 }}>
 <table className="table">
 <thead>
 <tr>
 <th>Usuário</th>
 <th>Tipo</th>
 <th>IP</th>
 <th>User Agent</th>
 <th>Quando</th>
 </tr>
 </thead>
 <tbody>
 {items.length === 0 ? (
 <tr>
 <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
 Nenhum acesso registrado
 </td>
 </tr>
 ) : (
 items.map((a: any, i: number) => (
 <tr key={i}>
 <td className="font-semibold">{a.usuario || a.user?.name || '—'}</td>
 <td>
 <span className="badge badge--neutral">{a.tipo}</span>
 </td>
 <td className="text-xs">{a.ip || '—'}</td>
 <td className="text-sm text-secondary">{a.userAgent || '—'}</td>
 <td className="text-sm">{timeAgo(a.createdAt || a.quando)}</td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 );
}

function PanelEquipes() {
 const { data, loading, error, reload } = useApi<any[]>(() => Api.equipes());
 const [editing, setEditing] = useState<any | null>(null);
 const toast = useToast();
 const confirm = useConfirm();

 const salvar = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 if (!editing) return;
 const fd = new FormData(e.currentTarget);
 try {
 await Api.equipeUpdate(editing.id, {
 nome: String(fd.get('nome') || ''),
 descricao: fd.get('descricao') ? String(fd.get('descricao')) : undefined,
 cor: String(fd.get('cor') || editing.cor),
 });
 toast.success('Equipe atualizada');
 setEditing(null);
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 const excluir = async (eq: any) => {
 const ok = await confirm({
   title: 'Excluir equipe?',
   message: `A equipe "${eq.nome}" será removida. Isto só funciona se a equipe não tiver corretores ativos. Caso contrário, mova os corretores primeiro ou desative a equipe.`,
   confirmText: 'Excluir',
   tone: 'danger',
 });
 if (!ok) return;
 try {
 await Api.equipeDelete(eq.id);
 toast.success('Equipe removida');
 reload();
 } catch (err: any) {
 const msg = err?.message || 'falha';
 toast.error('Não foi possível excluir: ' + msg);
 }
 };

 if (loading) return <LoadingBlock />;
 if (error) return <ErrorBlock error={error} />;
 const equipes = data || [];
 return (
 <>
 <div className="card" style={{ padding: 0 }}>
 <table className="table">
 <thead>
 <tr>
 <th>Nome</th>
 <th>Líder</th>
 <th className="numeric">Corretores</th>
 <th>Cor</th>
 <th></th>
 </tr>
 </thead>
 <tbody>
 {equipes.map((e: any) => (
 <tr key={e.id}>
 <td className="font-semibold">{e.nome}</td>
 <td>{typeof e.lider === 'string' ? e.lider : e.lider?.nome || '—'}</td>
 <td className="numeric">{e.totalCorretores ?? e.corretores ?? (e.membros?.length || 0)}</td>
 <td>
 <span style={{ display: 'inline-block', width: 16, height: 16, background: e.cor, borderRadius: 4 }} />
 </td>
 <td>
 <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
   <button className="btn btn--secondary btn--sm" onClick={() => setEditing(e)}>Editar</button>
   <button className="btn btn--ghost btn--sm" onClick={() => excluir(e)} title="Excluir equipe">
     <Icon name="trash" size={12} />
   </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar equipe">
 {editing && (
 <form onSubmit={salvar}>
 <div className="form-grid form-grid--single">
 <div className="field">
 <label className="field__label">Nome <span className="field__required">*</span></label>
 <input name="nome" className="field__input" required defaultValue={editing.nome} />
 </div>
 <div className="field">
 <label className="field__label">Descrição</label>
 <input name="descricao" className="field__input" defaultValue={editing.descricao || ''} />
 </div>
 <div className="field">
 <label className="field__label">Cor</label>
 <input name="cor" type="color" className="field__input" defaultValue={editing.cor || '#0E7C9B'} style={{ height: 44, padding: 4 }} />
 </div>
 </div>
 <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
 <button type="button" className="btn btn--secondary" onClick={() => setEditing(null)}>Cancelar</button>
 <button type="submit" className="btn btn--primary">Salvar</button>
 </div>
 </form>
 )}
 </Modal>
 </>
 );
}

// Vincula cada filial (Unidade) a um dos CNPJs do grupo. O CNPJ define qual
// contrato (cabeçalho) o colaborador lotado na filial assina no onboarding.
function PanelFiliais() {
 const { data, loading, error, reload } = useApi<any[]>(() => Api.unidadesList());
 const { data: empresas } = useApi<{ key: string; razaoSocial: string; cnpj: string }[]>(() => Api.unidadeEmpresas());
 const [saving, setSaving] = useState<number | null>(null);
 const toast = useToast();

 const vincular = async (unidade: any, empresaKey: string) => {
 setSaving(unidade.id);
 try {
 await Api.unidadeUpdate(unidade.id, { empresaKey: empresaKey || null });
 toast.success('Filial vinculada ao CNPJ');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 } finally {
 setSaving(null);
 }
 };

 if (loading) return <LoadingBlock />;
 if (error) return <ErrorBlock error={error} />;
 const unidades = data || [];
 const opts = empresas || [];
 const semVinculo = unidades.filter((u: any) => !u.empresaKey).length;

 return (
 <>
 <div className="card" style={{ marginBottom: 12 }}>
 <p className="text-sm text-secondary" style={{ margin: 0 }}>
 Conecte cada sala/filial ao CNPJ que assina os contratos. É esse vínculo
 que libera o contrato certo (estágio ou corretor, com o cabeçalho da
 empresa correta) no onboarding de novos colaboradores.
 {semVinculo > 0 && (
 <> <strong>{semVinculo}</strong> {semVinculo === 1 ? 'filial ainda sem CNPJ' : 'filiais ainda sem CNPJ'} — nesses casos o Financeiro escolhe a empresa manualmente.</>
 )}
 </p>
 </div>

 <div className="card" style={{ padding: 0 }}>
 <table className="table">
 <thead>
 <tr>
 <th>Filial</th>
 <th>Cidade</th>
 <th className="numeric">Corretores</th>
 <th style={{ minWidth: 240 }}>CNPJ (empresa do contrato)</th>
 </tr>
 </thead>
 <tbody>
 {unidades.map((u: any) => (
 <tr key={u.id}>
 <td className="font-semibold">{u.nome}{!u.ativo && <span className="text-secondary"> (inativa)</span>}</td>
 <td>{u.cidade || '—'}</td>
 <td className="numeric">{u.corretores ?? 0}</td>
 <td>
 <select
 className="field__input"
 value={u.empresaKey || ''}
 disabled={saving === u.id}
 onChange={(ev) => vincular(u, ev.target.value)}
 >
 <option value="">— Sem vínculo (Financeiro decide) —</option>
 {opts.map((emp) => (
 <option key={emp.key} value={emp.key}>{emp.razaoSocial} · {emp.cnpj}</option>
 ))}
 </select>
 </td>
 </tr>
 ))}
 {unidades.length === 0 && (
 <tr><td colSpan={4} className="text-secondary" style={{ padding: 16 }}>Nenhuma filial cadastrada.</td></tr>
 )}
 </tbody>
 </table>
 </div>
 </>
 );
}

function PanelConstrutoras() {
 const { data, loading, error } = useApi<any[]>(() => Api.construtoras());
 const { data: emps } = useApi<any[]>(() => Api.empreendimentos());
 if (loading) return <LoadingBlock />;
 if (error) return <ErrorBlock error={error} />;
 const construtoras = data || [];
 return (
 <div className="card">
 <h3 className="card__title mb-4">Construtoras cadastradas</h3>
 <div className="list">
 {construtoras.length === 0 ? (
 <div className="text-secondary" style={{ padding: 16 }}>Nenhuma construtora cadastrada.</div>
 ) : (
 construtoras.map((c: any) => (
 <div className="list__item" key={c.id || c.nome}>
 <div className="list__main">
 <div className="list__title">{c.nome}</div>
 <div className="list__meta">
 {(emps || []).filter((e: any) => e.construtora?.nome === c.nome || e.construtora === c.nome).length} empreendimentos
 </div>
 </div>
 <button className="btn btn--secondary btn--sm">Editar</button>
 </div>
 ))
 )}
 </div>
 </div>
 );
}

function PanelEmpreendimentos() {
 const { data, loading, error } = useApi<any[]>(() => Api.empreendimentos());
 if (loading) return <LoadingBlock />;
 if (error) return <ErrorBlock error={error} />;
 const emps = data || [];
 return (
 <div className="card" style={{ padding: 0 }}>
 <table className="table">
 <thead>
 <tr>
 <th>Nome</th>
 <th>Cidade</th>
 <th>Construtora</th>
 <th>Status</th>
 <th className="numeric">Unidades</th>
 </tr>
 </thead>
 <tbody>
 {emps.map((e: any) => (
 <tr key={e.id}>
 <td className="font-semibold">{e.nome}</td>
 <td>
 {e.cidade}/{e.estado}
 </td>
 <td>{e.construtora?.nome || e.construtora}</td>
 <td>
 <span className="badge badge--launch">{e.status}</span>
 </td>
 <td className="numeric">
 {e.unidadesVendidas}/{e.unidadesTotal}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

function PanelPoliticas() {
 const { data, loading, error } = useApi<any[]>(() => Api.politicas());
 if (loading) return <LoadingBlock />;
 if (error) return <ErrorBlock error={error} />;
 const politicas = data || [];
 return (
 <div className="card" style={{ padding: 0 }}>
 <table className="table">
 <thead>
 <tr>
 <th>Política</th>
 <th className="numeric">% Comissão</th>
 <th className="numeric">% Corretor</th>
 <th className="numeric">% Gerente</th>
 <th className="numeric">% Casa</th>
 </tr>
 </thead>
 <tbody>
 {politicas.length === 0 ? (
 <tr>
 <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
 Nenhuma política cadastrada
 </td>
 </tr>
 ) : (
 politicas.map((p: any) => (
 <tr key={p.id}>
 <td className="font-semibold">{p.nome}</td>
 <td className="numeric">{p.percentualComissao}%</td>
 <td className="numeric">{p.splitCorretor}%</td>
 <td className="numeric">{p.splitGerente}%</td>
 <td className="numeric">{p.splitCasa}%</td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 );
}

function PanelFunil() {
  const { data: settings, loading, reload } = useApi<Record<string, string>>(() => Api.settings());
  const [fases, setFases] = useState<Fase[]>([]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => { setFases(parseFunil(settings)); }, [settings]);

  const setLabel = (key: string, label: string) =>
    setFases((cur) => cur.map((f) => (f.key === key ? { ...f, label } : f)));

  const salvar = async () => {
    setSaving(true);
    try {
      const payload = fases.map((f) => ({ key: f.key, label: f.label }));
      await Api.settingsSave({ [FUNIL_SETTING_KEY]: JSON.stringify(payload) });
      toast.success('Fases do funil atualizadas');
      reload();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Fases do funil</h3>
      <p className="text-secondary" style={{ marginTop: 0, fontSize: 13 }}>
        Renomeie como cada fase aparece no funil e nos cards. Os nomes internos e a lógica não mudam.
      </p>
      <div className="form-grid form-grid--single" style={{ maxWidth: 420, marginTop: 12 }}>
        {fases.map((f) => (
          <div className="field" key={f.key}>
            <label className="field__label" style={{ opacity: 0.6, fontSize: 11 }}>{f.key}</label>
            <input className="field__input" value={f.label} onChange={(e) => setLabel(f.key, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="flex gap-2" style={{ marginTop: 16 }}>
        <button className="btn btn--primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar fases'}</button>
        <button className="btn btn--secondary" onClick={() => setFases(parseFunil(settings))} disabled={saving}>Descartar</button>
      </div>
    </div>
  );
}
