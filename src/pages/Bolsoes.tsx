import { useState, useMemo } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { LeadCamposCustom } from '../components/LeadCamposCustom';
import { Api } from '../lib/api';
import { FichaLeadModal } from '../components/FichaLeadModal';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useWhatsappNumeros } from '../lib/whatsappNumeros';

const ORIGENS = ['META_ADS', 'GOOGLE', 'SITE', 'INDICACAO', 'WHATSAPP', 'IMPORTACAO_MANUAL', 'IMPORTACAO'];
const STATUS = ['NOVO', 'SDR', 'QUALIFICANDO', 'NEGOCIANDO', 'VISITA', 'PROPOSTA'];

export default function Bolsoes() {
  const [filtros, setFiltros] = useState<any>({ cidade: '', origem: '', campanha: '', empreendimentoId: '', status: '' });
  const [aplicados, setAplicados] = useState<any>({});
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState(false);
  const [aba, setAba] = useState<'corretor' | 'api'>('corretor');
  const [alvoTipo, setAlvoTipo] = useState<'corretor' | 'equipe'>('corretor');
  const [alvoCorretor, setAlvoCorretor] = useState<number | ''>('');
  const [alvoEquipe, setAlvoEquipe] = useState<number | ''>('');
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();

  const params = useMemo(() => ({ ...aplicados, page, pageSize: 50 }), [aplicados, page]);
  const { data, loading, reload } = useApi<{ total: number; page: number; pageSize: number; leads: any[] }>(() => Api.bolsaoOportunidades(params), [JSON.stringify(params)]);
  const { data: corretores } = useApi<any[]>(() => Api.corretores());
  const { data: equipes } = useApi<any[]>(() => Api.equipes());
  const { data: empreendimentos } = useApi<any[]>(() => Api.empreendimentos());
  const { data: templatesResp } = useApi<{ items: any[] }>(() => Api.whatsappTemplates());
  const templates = templatesResp?.items || [];
  const numeros = useWhatsappNumeros();
  const [campanhaNome, setCampanhaNome] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [criandoCamp, setCriandoCamp] = useState(false);
  const [campoLead, setCampoLead] = useState<any>(null);

  const leads = data?.leads || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  const aplicar = () => {
    const a: any = {};
    for (const [k, v] of Object.entries(filtros)) if (v) a[k] = v;
    setAplicados(a); setPage(1); setSel(new Set());
  };
  const limpar = () => { setFiltros({ cidade: '', origem: '', campanha: '', empreendimentoId: '', status: '' }); setAplicados({}); setPage(1); setSel(new Set()); };

  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePagina = () => {
    const ids = leads.map((l) => l.id);
    const todosNaPagina = ids.length > 0 && ids.every((id) => sel.has(id));
    setSel((s) => { const n = new Set(s); ids.forEach((id) => todosNaPagina ? n.delete(id) : n.add(id)); return n; });
  };
  const selecionarTodosDoFiltro = async () => {
    try {
      const r = await Api.bolsaoOportunidadesIds(aplicados);
      setSel(new Set(r.ids));
      toast.success(`${r.ids.length} leads selecionados (todo o filtro)`);
    } catch (e: any) { toast.error('Erro: ' + (e.message || 'falha')); }
  };

  const direcionar = async () => {
    const leadIds = [...sel];
    if (!leadIds.length) { toast.error('Selecione ao menos 1 lead'); return; }
    const body: any = { leadIds };
    if (alvoTipo === 'corretor') {
      if (!alvoCorretor) { toast.error('Escolha o corretor'); return; }
      body.corretorId = Number(alvoCorretor);
    } else {
      if (!alvoEquipe) { toast.error('Escolha a equipe'); return; }
      body.equipeId = Number(alvoEquipe);
    }
    setEnviando(true);
    try {
      const r = await Api.bolsaoDirecionar(body);
      toast.success(`${r.direcionados} leads direcionados${r.jaAtribuidos ? ` · ${r.jaAtribuidos} já tinham corretor` : ''}`);
      setModal(false); setSel(new Set()); reload();
    } catch (e: any) { toast.error('Erro: ' + (e.message || 'falha')); }
    finally { setEnviando(false); }
  };

  const enviarCampanha = async () => {
    const leadIds = [...sel];
    if (!leadIds.length) { toast.error('Selecione ao menos 1 lead'); return; }
    if (!campanhaNome.trim()) { toast.error('Dê um nome à campanha'); return; }
    if (!templateName) { toast.error('Escolha um template aprovado'); return; }
    setCriandoCamp(true);
    try {
      const c = await Api.campanhaCreate({
        nome: campanhaNome.trim(), templateName, audienciaTipo: 'IDS', audienciaIds: leadIds,
        phoneNumberId: phoneNumberId || null,
        numeroExibicao: numeros.find((n) => n.id === phoneNumberId)?.label || null,
      });
      await Api.campanhaEnviar(c.id);
      toast.success(`Campanha "${campanhaNome}" criada e disparando pra ${leadIds.length} leads. Acompanhe em Campanhas.`);
      setModal(false); setSel(new Set()); setCampanhaNome(''); setTemplateName('');
    } catch (e: any) { toast.error('Erro: ' + (e.message || 'falha')); }
    finally { setCriandoCamp(false); }
  };

  return (
    <>
      <Topbar title="Bolsão de Oportunidades" right={
        <button className="btn btn--primary btn--sm" disabled={sel.size === 0} onClick={() => { setAba('corretor'); setModal(true); }}>
          Direcionar Lead{sel.size ? ` (${sel.size})` : ''}
        </button>
      } />
      <div className="main__content page-enter">
        <PageHeader breadcrumb="Comercial · Bolsão" title={`${total.toLocaleString('pt-BR')} leads disponíveis`} subtitle="Leads sem corretor — filtre, selecione e direcione pra corretor ou equipe" />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <input className="field__input" placeholder="Cidade" value={filtros.cidade} onChange={(e) => setFiltros({ ...filtros, cidade: e.target.value })} />
            <select className="field__select" value={filtros.origem} onChange={(e) => setFiltros({ ...filtros, origem: e.target.value })}>
              <option value="">Origem (todas)</option>{ORIGENS.map((o) => <option key={o}>{o}</option>)}
            </select>
            <input className="field__input" placeholder="Campanha" value={filtros.campanha} onChange={(e) => setFiltros({ ...filtros, campanha: e.target.value })} />
            <select className="field__select" value={filtros.empreendimentoId} onChange={(e) => setFiltros({ ...filtros, empreendimentoId: e.target.value })}>
              <option value="">Empreendimento (todos)</option>{(empreendimentos || []).map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <select className="field__select" value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}>
              <option value="">Status (todos)</option>{STATUS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn btn--primary btn--sm" onClick={aplicar}>Filtrar</button>
            <button className="btn btn--secondary btn--sm" onClick={limpar}>Limpar</button>
            <button className="btn btn--ghost btn--sm" onClick={selecionarTodosDoFiltro}>Selecionar todos do filtro ({total})</button>
            {sel.size > 0 && <span className="text-xs text-secondary" style={{ alignSelf: 'center' }}>{sel.size} selecionados</span>}
          </div>
        </div>

        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="table row-hover">
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" checked={leads.length > 0 && leads.every((l) => sel.has(l.id))} onChange={togglePagina} /></th>
                  <th>Nome</th><th>Telefone</th><th>Cidade</th><th>Origem</th><th>Campanha</th><th>Interesse</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando…</td></tr>}
                {!loading && leads.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum lead no bolsão com esse filtro</td></tr>}
                {leads.map((l) => (
                  <tr key={l.id} style={sel.has(l.id) ? { background: 'var(--bg-elevated)' } : {}}>
                    <td><input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} /></td>
                    <td><span style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }} onClick={() => setCampoLead(l)} title="Ver campos personalizados">{l.nome}</span></td>
                    <td className="text-xs">{l.telefone || '—'}</td>
                    <td className="text-xs">{l.cidade || '—'}</td>
                    <td className="text-xs">{l.origem || '—'}</td>
                    <td className="text-xs">{l.campanha || '—'}</td>
                    <td className="text-xs">{l.interesse || '—'}</td>
                    <td><span className="badge badge--neutral">{l.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-2" style={{ justifyContent: 'center', marginTop: 12, alignItems: 'center' }}>
              <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Anterior</button>
              <span className="text-xs text-secondary">Página {page} de {totalPages}</span>
              <button className="btn btn--ghost btn--sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima ›</button>
            </div>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={`Direcionar ${sel.size} lead(s)`} subtitle="Escolha o formato de direcionamento"
        footer={<>
          <button className="btn btn--secondary" onClick={() => setModal(false)}>Cancelar</button>
          {aba === 'corretor' && <button className="btn btn--primary" onClick={direcionar} disabled={enviando}>{enviando ? 'Direcionando…' : 'Direcionar'}</button>}
          {aba === 'api' && <button className="btn btn--primary" onClick={enviarCampanha} disabled={criandoCamp}>{criandoCamp ? 'Criando…' : 'Criar e enviar'}</button>}
        </>}>
        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          <button className={'btn btn--sm ' + (aba === 'corretor' ? 'btn--primary' : 'btn--secondary')} onClick={() => setAba('corretor')}>Enviar para Corretor</button>
          <button className={'btn btn--sm ' + (aba === 'api' ? 'btn--primary' : 'btn--secondary')} onClick={() => setAba('api')}>Enviar via API Oficial</button>
        </div>

        {aba === 'corretor' && (
          <div className="form-grid form-grid--single">
            <div className="flex gap-2" style={{ marginBottom: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="radio" checked={alvoTipo === 'corretor'} onChange={() => setAlvoTipo('corretor')} /> Um corretor</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="radio" checked={alvoTipo === 'equipe'} onChange={() => setAlvoTipo('equipe')} /> Uma equipe (rodízio)</label>
            </div>
            {alvoTipo === 'corretor' ? (
              <div className="field">
                <label className="field__label">Corretor</label>
                <select className="field__select" value={alvoCorretor} onChange={(e) => setAlvoCorretor(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Selecione…</option>
                  {(corretores || []).filter((c: any) => c.ativo).map((c: any) => <option key={c.id} value={c.id}>{c.nome}{c.equipe ? ` · ${c.equipe.nome}` : ''}</option>)}
                </select>
                <div className="field__hint">Os {sel.size} leads vão todos pra esse corretor.</div>
              </div>
            ) : (
              <div className="field">
                <label className="field__label">Equipe</label>
                <select className="field__select" value={alvoEquipe} onChange={(e) => setAlvoEquipe(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Selecione…</option>
                  {(equipes || []).map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                <div className="field__hint">Os {sel.size} leads são distribuídos em rodízio entre os corretores ativos da equipe.</div>
              </div>
            )}
          </div>
        )}

        {aba === 'api' && (
          <div className="form-grid form-grid--single">
            <div className="field">
              <label className="field__label">Nome da campanha</label>
              <input className="field__input" value={campanhaNome} onChange={(e) => setCampanhaNome(e.target.value)} placeholder="Ex: Reativação Itapema set/26" />
            </div>
            <div className="field">
              <label className="field__label">Template aprovado (Meta)</label>
              <select className="field__select" value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
                <option value="">Selecione…</option>
                {(templates || []).map((t: any) => <option key={t.name} value={t.name}>{t.name} ({t.language || 'pt_BR'})</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Número oficial de envio</label>
              <select className="field__select" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)}>
                {numeros.map((n) => <option key={n.id || 'default'} value={n.id}>{n.label}</option>)}
              </select>
              <div className="field__hint">Dispara o template oficial pros {sel.size} leads selecionados. Quando o lead responder, ele cai na fila e a IA atende.</div>
            </div>
          </div>
        )}
      </Modal>

      {campoLead && <FichaLeadModal leadId={campoLead.id} onClose={() => setCampoLead(null)} />}
    </>
  );
}
