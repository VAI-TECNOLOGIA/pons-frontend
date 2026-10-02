import { useState } from 'react';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';

// Credenciais de PRODUÇÃO do Sicredi Multipag (pagamentos). O próprio cliente
// cola o Client-Id/Client-Secret do Portal do Desenvolvedor Sicredi: o segredo
// vai direto para o servidor e nunca é mostrado de volta (nem para o admin).
export function SicrediMultipagCard() {
 const toast = useToast();
 const { data: cfg, reload } = useApi(() => Api.multipagConfig());
 const [clientId, setClientId] = useState('');
 const [clientSecret, setClientSecret] = useState('');
 const [salvando, setSalvando] = useState(false);
 const [testando, setTestando] = useState(false);
 const { data: wh, reload: reloadWh } = useApi(() => Api.multipagWebhookStatus());
 const [registrando, setRegistrando] = useState(false);
 const [teste, setTeste] = useState<{ ok: boolean; mensagem: string } | null>(null);

 const salvar = async (e: React.FormEvent) => {
 e.preventDefault();
 if (salvando) return;
 if (!clientId.trim() || !clientSecret.trim()) { toast.error('Informe o Client-Id e o Client-Secret.'); return; }
 setSalvando(true);
 try {
 await Api.multipagSalvarCredenciais(clientId.trim(), clientSecret.trim());
 setClientId(''); setClientSecret(''); setTeste(null);
 toast.success('Credenciais salvas com segurança.');
 reload();
 } catch (err: any) {
 toast.error(err?.message || 'Não foi possível salvar. Tente de novo.');
 } finally {
 setSalvando(false);
 }
 };

 const testar = async () => {
 setTestando(true); setTeste(null);
 try {
 const r = await Api.multipagTestarConexao();
 setTeste({ ok: r.ok, mensagem: r.ok ? 'Conexão com o Sicredi funcionando: o banco aceitou as credenciais.' : 'O banco recusou a conexão. Confira se copiou as credenciais de PRODUÇÃO inteiras e salve de novo.' });
 } catch (err: any) {
 setTeste({ ok: false, mensagem: err?.message || 'Não foi possível testar agora.' });
 } finally {
 setTestando(false);
 }
 };

 const registrarWebhook = async () => {
 setRegistrando(true);
 try {
 await Api.multipagWebhookRegistrar();
 toast.success('Aviso automático do banco cadastrado.');
 reloadWh();
 } catch (err: any) {
 toast.error(err?.message || 'O banco não aceitou o cadastro. Tente de novo.');
 } finally {
 setRegistrando(false);
 }
 };

 return (
 <form className="card" onSubmit={salvar} style={{ marginTop: 16 }} autoComplete="off">
 <h3 className="card__title" style={{ marginBottom: 4 }}>Sicredi Multipag — credenciais de produção</h3>
 <p className="text-sm text-secondary" style={{ marginTop: 0 }}>
 Cole aqui o Client-Id e o Client-Secret de PRODUÇÃO do Portal do Desenvolvedor Sicredi. Depois de salvo, o
 Client-Secret não aparece mais para ninguém. Isso não liga pagamento automático: os lotes continuam indo para o sócio pagar no banco.
 </p>
 <div className="text-sm" style={{ margin: '8px 0 12px' }}>
 {cfg?.temCredenciais && cfg?.ambiente === 'prod'
 ? <span className="pill-ok">Credenciais de produção cadastradas{cfg.clientIdFinal ? ` (Client-Id ${cfg.clientIdFinal})` : ''}</span>
 : <span className="text-secondary">Nenhuma credencial de produção cadastrada.</span>}
 </div>
 <div className="form-grid">
 <div className="field">
 <label className="field__label" htmlFor="multipag-client-id">Client-Id</label>
 <input id="multipag-client-id" className="field__input" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" spellCheck={false} />
 </div>
 <div className="field">
 <label className="field__label" htmlFor="multipag-client-secret">Client-Secret</label>
 <input id="multipag-client-secret" className="field__input" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="new-password" spellCheck={false} />
 </div>
 </div>
 <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
 <button type="submit" className="btn btn--primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar credenciais'}</button>
 {cfg?.temCredenciais && (
 <button type="button" className="btn btn--secondary" onClick={testar} disabled={testando}>{testando ? 'Testando...' : 'Testar conexão'}</button>
 )}
 </div>
 {teste && (
 <div className="text-sm" role="status" style={{ marginTop: 10, color: teste.ok ? 'var(--color-success-fg)' : 'var(--color-danger-fg)' }}>{teste.mensagem}</div>
 )}
 {cfg?.temCredenciais && cfg?.ambiente === 'prod' && (
 <div className="text-sm" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border, #e5e5e5)' }}>
 <strong>Aviso automático do banco (webhook)</strong>
 <div style={{ margin: '6px 0' }}>
 {wh?.cadastrado && wh?.confere
 ? <span className="pill-ok">Cadastrado e conferido</span>
 : <span className="text-secondary">{wh?.erro ? 'Não foi possível consultar o banco agora.' : 'Ainda não cadastrado no banco.'}</span>}
 </div>
 <button type="button" className="btn btn--secondary" onClick={registrarWebhook} disabled={registrando}>{registrando ? 'Cadastrando...' : wh?.cadastrado ? 'Recadastrar webhook' : 'Cadastrar webhook'}</button>
 </div>
 )}
 </form>
 );
}

