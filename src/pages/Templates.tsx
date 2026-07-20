import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { NovoTemplateModal } from '../components/NovoTemplateModal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import './templates.css';

const STATUS_META: Record<string, { label: string; cls: string }> = {
 APPROVED: { label: 'Aprovado', cls: 'tpl-status--ok' },
 PENDING: { label: 'Em análise', cls: 'tpl-status--wait' },
 REJECTED: { label: 'Rejeitado', cls: 'tpl-status--bad' },
 PAUSED: { label: 'Pausado', cls: 'tpl-status--wait' },
};
const CAT_LABEL: Record<string, string> = {
 UTILITY: 'Utilidade', MARKETING: 'Marketing', AUTHENTICATION: 'Autenticação',
};

// Substitui {{n}} por valores de exemplo pra prévia ficar legível.
function renderPreview(body: string) {
 return (body || '').replace(/\{\{(\d+)\}\}/g, (_, n) => `[${n}]`);
}

export default function Templates() {
 const { data, loading, error, reload } = useApi<{ items: any[]; reason?: string }>(() => Api.whatsappTemplatesAll());
 const [novo, setNovo] = useState(false);
 const [busca, setBusca] = useState('');
 const [filtro, setFiltro] = useState('');
 const [atualizando, setAtualizando] = useState(false);
 const [teste, setTeste] = useState<any | null>(null);
 const [testeFone, setTesteFone] = useState('');
 const [testeParams, setTesteParams] = useState<string[]>([]);
 const [testeBusy, setTesteBusy] = useState(false);
 const toast = useToast();
 const confirm = useConfirm();

 const excluir = async (t: any) => {
 const ok = await confirm({
 title: 'Excluir template?',
 message: `O template "${t.name}" será removido da Meta em todos os idiomas. Campanhas e disparos que usam ele param de funcionar. Não dá pra desfazer.`,
 confirmText: 'Excluir',
 tone: 'danger',
 });
 if (!ok) return;
 try {
 await Api.whatsappTemplateDelete(t.name);
 toast.success(`Template ${t.name} excluído`);
 reload();
 } catch (e: any) {
 toast.error('Erro: ' + (e.message || 'falha'));
 }
 };

 const abrirTeste = (t: any) => {
 setTeste(t);
 setTesteFone('');
 setTesteParams(Array.from({ length: t.varCount || 0 }, () => ''));
 };

 const enviarTeste = async () => {
 if (!teste || !testeFone.trim()) return;
 setTesteBusy(true);
 try {
 const params = testeParams.map((v, i) => v.trim() || `Exemplo ${i + 1}`);
 const temDoc = (teste.components || []).some((c: any) => c.type === 'HEADER' && c.format === 'DOCUMENT');
 await Api.whatsappTemplateTestSend({
 name: teste.name,
 telefone: testeFone.trim(),
 bodyParams: params,
 headerDocumentUrl: temDoc ? 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' : undefined,
 });
 toast.success('Teste enviado — confere o WhatsApp.');
 setTeste(null); setTesteFone('');
 } catch (e: any) {
 toast.error('Erro: ' + (e.message || 'falha no envio'));
 } finally {
 setTesteBusy(false);
 }
 };

 if (loading) return <Shell onNovo={() => setNovo(true)}><LoadingBlock /></Shell>;
 if (error) return <Shell onNovo={() => setNovo(true)}><ErrorBlock error={error} /></Shell>;
 const items = data?.items || [];
 const contagem = (s: string) => items.filter((t: any) => t.status === s).length;
 const filtrados = items.filter((t: any) => {
 if (filtro && t.status !== filtro) return false;
 if (busca.trim() && !t.name.includes(busca.trim().toLowerCase())) return false;
 return true;
 });
 const atualizar = async () => {
 setAtualizando(true);
 try { await reload(); } finally { setAtualizando(false); }
 };

 return (
 <Shell onNovo={() => setNovo(true)}>
 {data?.reason === 'whatsapp_nao_configurado' && (
 <div className="card" style={{ marginBottom: 14 }}>
 <p className="text-secondary">WhatsApp não configurado — conecte a WABA nas Integrações pra gerenciar templates.</p>
 </div>
 )}

 <div className="tpl-toolbar">
 <div className="tpl-busca">
 <Icon name="search" size={14} />
 <input placeholder="Buscar por nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
 </div>
 <div className="tpl-filtros">
 <button className={'tpl-filtro' + (!filtro ? ' tpl-filtro--on' : '')} onClick={() => setFiltro('')}>
 Todos <span className="tpl-filtro__n">{items.length}</span>
 </button>
 <button className={'tpl-filtro tpl-filtro--ok' + (filtro === 'APPROVED' ? ' tpl-filtro--on' : '')} onClick={() => setFiltro(filtro === 'APPROVED' ? '' : 'APPROVED')}>
 Aprovados <span className="tpl-filtro__n">{contagem('APPROVED')}</span>
 </button>
 <button className={'tpl-filtro tpl-filtro--wait' + (filtro === 'PENDING' ? ' tpl-filtro--on' : '')} onClick={() => setFiltro(filtro === 'PENDING' ? '' : 'PENDING')}>
 Em análise <span className="tpl-filtro__n">{contagem('PENDING')}</span>
 </button>
 {contagem('REJECTED') > 0 && (
 <button className={'tpl-filtro tpl-filtro--bad' + (filtro === 'REJECTED' ? ' tpl-filtro--on' : '')} onClick={() => setFiltro(filtro === 'REJECTED' ? '' : 'REJECTED')}>
 Rejeitados <span className="tpl-filtro__n">{contagem('REJECTED')}</span>
 </button>
 )}
 </div>
 <button className="btn btn--secondary btn--sm" onClick={atualizar} disabled={atualizando} title="Buscar status atualizado na Meta">
 <Icon name="refresh" size={13} /> {atualizando ? 'Atualizando…' : 'Atualizar status'}
 </button>
 </div>

 <div className="tpl-grid">
 {filtrados.map((t: any) => {
 const st = STATUS_META[t.status] || { label: t.status, cls: '' };
 const temDoc = (t.components || []).some((c: any) => c.type === 'HEADER' && c.format === 'DOCUMENT');
 const temImg = (t.components || []).some((c: any) => c.type === 'HEADER' && c.format === 'IMAGE');
 const temBotao = (t.components || []).some((c: any) => c.type === 'BUTTONS');
 return (
 <div key={t.name + t.language} className="tpl-card">
 <div className="tpl-card__head">
 <span className="tpl-card__icone"><Icon name="whatsapp" size={16} /></span>
 <div className="tpl-card__id">
 <span className="tpl-card__name">{t.name}</span>
 <div className="tpl-card__tags">
 <span className="tpl-tag">{CAT_LABEL[t.category] || t.category}</span>
 <span className="tpl-tag">{t.varCount} var</span>
 {temDoc && <span className="tpl-tag tpl-tag--doc">PDF</span>}
 {temImg && <span className="tpl-tag">Logo</span>}
 {temBotao && <span className="tpl-tag">Botão</span>}
 </div>
 </div>
 <span className={'tpl-status ' + st.cls}><i />{st.label}</span>
 </div>
 <div className="tpl-preview">
 {temDoc && (
 <div className="tpl-preview__doc">
 <span className="tpl-preview__pdf">PDF</span>
 <span>documento.pdf</span>
 </div>
 )}
 {temImg && <div className="tpl-preview__img">GRUPO PONS</div>}
 <div className="tpl-preview__body">{renderPreview(t.bodyText) || '(sem corpo)'}</div>
 </div>
 <div className="tpl-card__acoes">
 {t.status === 'PENDING' && <span className="tpl-card__nota">Aguardando aprovação da Meta</span>}
 <button className="btn btn--secondary btn--sm" disabled={t.status !== 'APPROVED'} title={t.status !== 'APPROVED' ? 'Só templates aprovados podem ser testados' : undefined} onClick={() => abrirTeste(t)}>
 <Icon name="send" size={12} /> Testar envio
 </button>
 <button className="btn btn--ghost btn--sm" onClick={() => excluir(t)} title="Excluir template na Meta">
 <Icon name="trash" size={12} />
 </button>
 </div>
 </div>
 );
 })}
 {!filtrados.length && !data?.reason && (
 <div className="card tpl-vazio">
 <p className="text-secondary">{items.length ? 'Nenhum template bate com a busca ou o filtro.' : 'Nenhum template ainda — crie o primeiro.'}</p>
 </div>
 )}
 </div>

 {novo && <NovoTemplateModal onClose={() => { setNovo(false); reload(); }} />}

 <Modal open={!!teste} onClose={() => setTeste(null)} title={teste ? `Testar ${teste.name}` : ''} subtitle="Preencha as variáveis e o número de destino">
 {teste && (
 <div>
 <div className="field">
 <label className="field__label">WhatsApp de destino (com DDD)</label>
 <input className="field__input" value={testeFone} onChange={(e) => setTesteFone(e.target.value)} placeholder="47 99999-9999" autoFocus />
 </div>
 {testeParams.length > 0 && (
 <div className="field" style={{ marginTop: 10 }}>
 <label className="field__label">Variáveis do template ({testeParams.length})</label>
 <div className="tpl-teste-vars">
 {testeParams.map((v, i) => (
 <div key={i} className="tpl-teste-var">
 <span className="tpl-teste-var__tag">{`{{${i + 1}}}`}</span>
 <input
 className="field__input"
 value={v}
 onChange={(e) => setTesteParams((cur) => { const nx = [...cur]; nx[i] = e.target.value; return nx; })}
 placeholder={`Exemplo ${i + 1}`}
 />
 </div>
 ))}
 </div>
 <p className="field__hint" style={{ marginTop: 6 }}>Campo vazio sai como "Exemplo N".</p>
 </div>
 )}
 <p className="field__hint" style={{ marginTop: 6 }}>
 {(teste.components || []).some((c: any) => c.type === 'HEADER' && c.format === 'DOCUMENT') ? 'O PDF vai como documento de amostra. ' : ''}
 Sai pelo número padrão do CRM.
 </p>
 <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
 <button className="btn btn--secondary" onClick={() => setTeste(null)}>Cancelar</button>
 <button className="btn btn--primary" disabled={testeBusy || !testeFone.trim()} onClick={enviarTeste}>
 {testeBusy ? 'Enviando…' : 'Enviar teste'}
 </button>
 </div>
 </div>
 )}
 </Modal>
 </Shell>
 );
}

function Shell({ children, onNovo }: { children: React.ReactNode; onNovo: () => void }) {
 return (
 <>
 <Topbar
 title="Templates"
 right={<button className="btn btn--primary btn--sm" onClick={onNovo}>+ Novo template</button>}
 />
 <div className="main__content">
 <PageHeader
 breadcrumb="Marketing · WhatsApp"
 title="Templates de WhatsApp"
 subtitle="Modelos aprovados pela Meta — usados no protocolo de venda, campanhas e disparos do Atendimento"
 />
 {children}
 </div>
 </>
 );
}
