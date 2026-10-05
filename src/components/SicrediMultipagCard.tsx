import { useState } from 'react';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { Auth } from '../lib/auth';

// Conta de cada empresa do grupo no Sicredi Multipag (pagamentos). Cada CNPJ paga
// pela PRÓPRIA conta: o lançamento escolhe a "conta pagadora" e o sistema usa a
// conta daquela empresa. O próprio cliente cola o Client-Id/Client-Secret do
// Portal do Desenvolvedor Sicredi; o segredo vai direto para o servidor e nunca é
// mostrado de volta (nem para o admin).
const EMPRESAS = [
 { valor: 'MATRIZ', nome: 'Matriz' },
 { valor: 'SEGUNDA_AVENIDA', nome: 'Segunda Avenida' },
 { valor: 'DELAS', nome: 'GPI Delas' },
 { valor: 'CAPAO', nome: 'Capão da Canoa' },
];

export function SicrediMultipagCard() {
 const toast = useToast();
 const [empresa, setEmpresa] = useState('MATRIZ');
 const { data: empresas, reload: reloadEmpresas } = useApi(() => Api.multipagEmpresas().catch(() => []));
 const { data: cfg, reload } = useApi(() => Api.multipagConfig(empresa), [empresa]);
 const [clientId, setClientId] = useState('');
 const [clientSecret, setClientSecret] = useState('');
 const [cooperativa, setCooperativa] = useState('');
 const [conta, setConta] = useState('');
 const [salvando, setSalvando] = useState(false);
 const [testando, setTestando] = useState(false);
 const { data: wh, reload: reloadWh } = useApi(() => Api.multipagWebhookStatus(empresa).catch(() => null), [empresa]);
 const [registrando, setRegistrando] = useState(false);
 const [teste, setTeste] = useState<{ ok: boolean; mensagem: string } | null>(null);
 const ehMatriz = empresa === 'MATRIZ';
 const nomeEmpresa = EMPRESAS.find((e) => e.valor === empresa)?.nome || empresa;

 const trocarEmpresa = (e: string) => {
 setEmpresa(e); setClientId(''); setClientSecret(''); setCooperativa(''); setConta(''); setTeste(null);
 };

 const salvar = async (e: React.FormEvent) => {
 e.preventDefault();
 if (salvando) return;
 if (!clientId.trim() || !clientSecret.trim()) { toast.error('Informe o Client-Id e o Client-Secret.'); return; }
 if (!ehMatriz && !cfg?.temConta && (!cooperativa.trim() || !conta.trim())) { toast.error('Informe a cooperativa e a conta (com dígito) desta empresa.'); return; }
 setSalvando(true);
 try {
 await Api.multipagSalvarCredenciais({ empresa, clientId: clientId.trim(), clientSecret: clientSecret.trim(), ...(cooperativa.trim() ? { cooperativa: cooperativa.trim() } : {}), ...(conta.trim() ? { conta: conta.trim() } : {}) });
 setClientId(''); setClientSecret(''); setCooperativa(''); setConta(''); setTeste(null);
 toast.success(`Credenciais da ${nomeEmpresa} salvas com segurança.`);
 reload(); reloadEmpresas();
 } catch (err: any) {
 toast.error(err?.message || 'Não foi possível salvar. Tente de novo.');
 } finally {
 setSalvando(false);
 }
 };

 const testar = async () => {
 setTestando(true); setTeste(null);
 try {
 const r = await Api.multipagTestarConexao(empresa);
 setTeste({
 ok: r.ok,
 mensagem: r.ok
 ? `Conexão com o Sicredi funcionando: o banco aceitou as credenciais da ${nomeEmpresa}.`
 : r.etapa === 'config' ? r.mensagem : 'O banco recusou a conexão. Confira se copiou as credenciais de PRODUÇÃO desta empresa inteiras e salve de novo.',
 });
 } catch (err: any) {
 setTeste({ ok: false, mensagem: err?.message || 'Não foi possível testar agora.' });
 } finally {
 setTestando(false);
 }
 };

 const [alterandoModo, setAlterandoModo] = useState(false);
 const automatico = cfg?.modoLote === 'api';
 const alternarAutomatico = async () => {
 const ligar = !automatico;
 const msg = ligar
 ? 'Ligar o pagamento automático? A partir de agora, ao enviar um lote o SISTEMA paga as contas pelo Sicredi, sem o sócio pagar no banco.'
 : 'Desligar o pagamento automático? Os lotes voltam a ir para o sócio pagar no banco.';
 if (!window.confirm(msg)) return;
 setAlterandoModo(true);
 try {
 await Api.multipagModoAutomatico(ligar);
 toast.success(ligar ? 'Pagamento automático LIGADO.' : 'Pagamento automático desligado.');
 reload();
 } catch (err: any) {
 toast.error(err?.message || 'Não foi possível alterar agora.');
 } finally {
 setAlterandoModo(false);
 }
 };

 const registrarWebhook = async () => {
 setRegistrando(true);
 try {
 await Api.multipagWebhookRegistrar(empresa);
 toast.success('Aviso automático do banco cadastrado.');
 reloadWh();
 } catch (err: any) {
 toast.error(err?.message || 'O banco não aceitou o cadastro. Tente de novo.');
 } finally {
 setRegistrando(false);
 }
 };

 const statusDe = (e: any) => (e?.disponivel ? 'Ligada' : e?.temCredenciais && !e?.temCertificado ? 'Falta o certificado' : e?.temCredenciais ? 'Falta a conta' : 'Não ligada');

 return (
 <form className="card" onSubmit={salvar} style={{ marginTop: 16 }} autoComplete="off">
 <h3 className="card__title" style={{ marginBottom: 4 }}>Sicredi — contas que pagam pelo sistema</h3>
 <p className="text-sm text-secondary" style={{ marginTop: 0 }}>
 Cada empresa paga pela própria conta no Sicredi. No lançamento, a "conta pagadora" define de qual conta o dinheiro sai.
 Uma conta só paga pelo sistema depois de ligada aqui (credenciais, conta e certificado).
 </p>

 <div className="table-wrap" style={{ overflowX: 'auto', margin: '8px 0 16px' }}>
 <table className="table tabela-compacta">
 <thead><tr><th>Empresa</th><th>CNPJ</th><th>Situação</th></tr></thead>
 <tbody>
 {(empresas || []).map((e: any) => (
 <tr key={e.empresa} style={{ cursor: 'pointer', fontWeight: e.empresa === empresa ? 600 : undefined }} onClick={() => trocarEmpresa(e.empresa)}>
 <td>{e.nome}</td>
 <td className="text-secondary">{e.cnpj || ''}</td>
 <td>{e.disponivel ? <span className="pill-ok">Ligada</span> : <span className="text-secondary">{statusDe(e)}</span>}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <div className="field" style={{ maxWidth: 320 }}>
 <label className="field__label" htmlFor="multipag-empresa">Empresa</label>
 <select id="multipag-empresa" className="field__select" value={empresa} onChange={(e) => trocarEmpresa(e.target.value)}>
 {EMPRESAS.map((e) => <option key={e.valor} value={e.valor}>{e.nome}</option>)}
 </select>
 </div>

 <div className="text-sm" style={{ margin: '8px 0 12px' }}>
 {cfg?.temCredenciais && cfg?.ambiente === 'prod'
 ? <span className="pill-ok">Credenciais de produção cadastradas{cfg.clientIdFinal ? ` (Client-Id ${cfg.clientIdFinal})` : ''}</span>
 : <span className="text-secondary">Nenhuma credencial de produção cadastrada para a {nomeEmpresa}.</span>}
 {cfg && !cfg.temCertificado && (
 <div className="text-secondary" style={{ marginTop: 6 }}>Certificado digital desta empresa ainda não instalado no servidor (a VAI instala depois que o banco emitir).</div>
 )}
 </div>

 <div className="form-grid">
 {!ehMatriz && (
 <>
 <div className="field">
 <label className="field__label" htmlFor="multipag-coop">Cooperativa</label>
 <input id="multipag-coop" className="field__input" inputMode="numeric" value={cooperativa} onChange={(e) => setCooperativa(e.target.value)} placeholder={cfg?.cooperativa || '4 números'} autoComplete="off" />
 </div>
 <div className="field">
 <label className="field__label" htmlFor="multipag-conta">Conta (com dígito)</label>
 <input id="multipag-conta" className="field__input" inputMode="numeric" value={conta} onChange={(e) => setConta(e.target.value)} placeholder={cfg?.conta || 'Ex.: 12345-6'} autoComplete="off" />
 </div>
 </>
 )}
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
 <button type="submit" className="btn btn--primary" disabled={salvando}>{salvando ? 'Salvando...' : `Salvar credenciais da ${nomeEmpresa}`}</button>
 {cfg?.temCredenciais && (
 <button type="button" className="btn btn--secondary" onClick={testar} disabled={testando}>{testando ? 'Testando...' : 'Testar conexão'}</button>
 )}
 </div>
 {teste && (
 <div className="text-sm" role="status" style={{ marginTop: 10, color: teste.ok ? 'var(--color-success-fg)' : 'var(--color-danger-fg)' }}>{teste.mensagem}</div>
 )}
 {cfg?.disponivel && cfg?.ambiente === 'prod' && (
 <div className="text-sm" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border, #e5e5e5)' }}>
 <strong>Aviso automático do banco (webhook) — {nomeEmpresa}</strong>
 <div style={{ margin: '6px 0' }}>
 {wh?.cadastrado && wh?.confere
 ? <span className="pill-ok">Cadastrado e conferido</span>
 : <span className="text-secondary">{wh?.erro ? 'Não foi possível consultar o banco agora.' : 'Ainda não cadastrado no banco.'}</span>}
 </div>
 <button type="button" className="btn btn--secondary" onClick={registrarWebhook} disabled={registrando}>{registrando ? 'Cadastrando...' : wh?.cadastrado ? 'Recadastrar webhook' : 'Cadastrar webhook'}</button>
 </div>
 )}
 {ehMatriz && cfg?.temCredenciais && cfg?.ambiente === 'prod' && Auth.user?.role === 'CEO' && (
 <div className="text-sm" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border, #e5e5e5)' }}>
 <strong>Pagamento automático dos lotes</strong>
 <div style={{ margin: '6px 0' }}>
 {automatico ? <span className="pill-ok">LIGADO: o sistema paga pelo Sicredi</span> : <span className="text-secondary">Desligado: o sócio paga no banco.</span>}
 </div>
 <button type="button" className={automatico ? 'btn btn--secondary' : 'btn btn--primary'} onClick={alternarAutomatico} disabled={alterandoModo}>{alterandoModo ? 'Alterando...' : automatico ? 'Desligar pagamento automático' : 'Ligar pagamento automático'}</button>
 </div>
 )}
 </form>
 );
}
