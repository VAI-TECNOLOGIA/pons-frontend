import { useState, useMemo } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { LeadCamposCustom } from '../components/LeadCamposCustom';
import { Api } from '../lib/api';
import { FichaLeadModal } from '../components/FichaLeadModal';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useWhatsappNumeros } from '../lib/whatsappNumeros';
import { Icon } from '../components/Icon';
import { useConfirm } from '../lib/confirm';

const ORIGENS = ['META_ADS', 'GOOGLE', 'SITE', 'INDICACAO', 'WHATSAPP', 'IMPORTACAO_MANUAL', 'IMPORTACAO'];
const STATUS = ['NOVO', 'NAO_RESPONDE', 'LISTA_VIP', 'EM_ATENDIMENTO', 'FLUXO', 'PAROU_RESPONDER', 'POS_FLUXO', 'VISITA', 'NEGOCIANDO'];

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

        <BolsoesConfigurados />

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


// ── Bolsões configurados (demanda 23/07): nome, status, janela de horário,
// limite de capturas/dia e acesso (todos ou restrito). Modelo PULL: os leads
// destes bolsões ficam em disputa — o primeiro corretor que capturar leva.
function BolsoesConfigurados() {
  const { data: bolsoes, reload } = useApi<any[]>(() => Api.bolsoes());
  const { data: corretores } = useApi<any[]>(() => Api.corretores());
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [abaModal, setAbaModal] = useState<'config' | 'corretores'>('config');
  // ── Aba 1: configuração ──
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [limiteOn, setLimiteOn] = useState(false);
  const [limite, setLimite] = useState(2);
  const [dicaLimite, setDicaLimite] = useState(false);
  // ── Aba 2: corretores ──
  const [acesso, setAcesso] = useState<'TODOS' | 'RESTRITO'>('TODOS');
  const [selCor, setSelCor] = useState<Set<number>>(new Set());
  const [buscaCor, setBuscaCor] = useState('');
  const [salvando, setSalvando] = useState(false);

  const abrir = (b?: any) => {
    setEditing(b || null);
    setAbaModal('config');
    setNome(b?.nome || '');
    setAtivo(b ? b.ativo !== false : true);
    setHoraInicio(b?.horaInicio || '');
    setHoraFim(b?.horaFim || '');
    setLimiteOn(!!b?.limiteCapturasDia);
    setLimite(b?.limiteCapturasDia || 2);
    setAcesso(b?.acesso === 'RESTRITO' ? 'RESTRITO' : 'TODOS');
    setSelCor(new Set(b?.corretorIds || []));
    setBuscaCor('');
    setDicaLimite(false);
    setOpen(true);
  };

  const salvar = async () => {
    if (!nome.trim()) { toast.error('Dê um nome pro bolsão.'); return; }
    if ((horaInicio && !horaFim) || (!horaInicio && horaFim)) { toast.error('Preencha o horário inicial E o final (ou deixe os dois vazios).'); return; }
    if (acesso === 'RESTRITO' && selCor.size === 0) { toast.error('Acesso restrito: selecione ao menos um corretor.'); return; }
    setSalvando(true);
    try {
      const body = {
        nome: nome.trim(),
        ativo,
        horaInicio: horaInicio || null,
        horaFim: horaFim || null,
        limiteCapturasDia: limiteOn ? Number(limite) : null,
        acesso,
        corretorIds: acesso === 'RESTRITO' ? [...selCor] : [],
      };
      if (editing) await Api.bolsaoUpdate(editing.id, body);
      else await Api.bolsaoCreate(body);
      toast.success(editing ? 'Bolsão atualizado.' : 'Bolsão criado.');
      setOpen(false);
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (b: any) => {
    const ok = await confirm({ title: `Excluir o bolsão "${b.nome}"?`, message: 'Os leads dele NÃO são apagados — voltam pro bolsão geral.', confirmText: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try { await Api.bolsaoDelete(b.id); toast.success('Bolsão excluído.'); reload(); }
    catch (err: any) { toast.error('Erro: ' + (err?.message || 'falha')); }
  };

  const norm = (x: string) => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const listaCor = (corretores || [])
    .filter((c: any) => c.ativo !== false)
    .filter((c: any) => !buscaCor.trim() || norm(c.nome || '').includes(norm(buscaCor)) || norm(c.equipe?.nome || '').includes(norm(buscaCor)));

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: (bolsoes || []).length ? 12 : 0 }}>
        <div>
          <div className="uppercase-tag">Bolsões configurados</div>
          <div className="text-xs text-secondary" style={{ marginTop: 2 }}>Leads nestes bolsões ficam em disputa: o primeiro corretor que capturar leva.</div>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => abrir()}>+ Criar bolsão</button>
      </div>
      {(bolsoes || []).length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
          {(bolsoes || []).map((b: any) => (
            <div key={b.id} style={{ border: '1px solid var(--border-light)', borderRadius: 10, padding: '12px 14px' }}>
              <div className="flex-between" style={{ gap: 8 }}>
                <span style={{ fontWeight: 800 }}>{b.nome}</span>
                <span className={'badge ' + (b.ativo ? 'badge--signed' : 'badge--cancelled')} style={{ fontSize: 10 }}>{b.ativo ? 'ATIVO' : 'INATIVO'}</span>
              </div>
              <div className="text-xs text-secondary" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>{b.leadsDisponiveis ?? 0} lead(s) disponíveis</span>
                <span>{b.horaInicio ? `Funciona das ${b.horaInicio} às ${b.horaFim}` : 'Sem janela de horário'}</span>
                <span>{b.limiteCapturasDia ? `Limite: ${b.limiteCapturasDia} captura(s)/dia por corretor` : 'Capturas ilimitadas'}</span>
                <span>{b.acesso === 'RESTRITO' ? `Restrito a ${(b.corretorIds || []).length} corretor(es)` : 'Aberto a todos os corretores'}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button className="btn btn--secondary btn--sm" onClick={() => abrir(b)}><Icon name="pencil" size={12} /> Editar</button>
                <button className="btn btn--ghost btn--sm" style={{ color: 'var(--color-danger, #e5484d)' }} onClick={() => excluir(b)}><Icon name="trash" size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => !salvando && setOpen(false)}
        title={editing ? `Editar bolsão · ${editing.nome}` : 'Criar bolsão'}
        subtitle="Leads deste bolsão ficam em disputa: o primeiro corretor que capturar leva"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 }}>
            <span className="text-xs text-secondary">
              {abaModal === 'config' ? '1 de 2 · Configuração' : `2 de 2 · Corretores${acesso === 'RESTRITO' ? ` — ${selCor.size} selecionado(s)` : ''}`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--ghost" onClick={() => setOpen(false)} disabled={salvando}>Cancelar</button>
              {abaModal === 'config' ? (
                <button className="btn btn--primary" onClick={() => setAbaModal('corretores')}>
                  Corretores <Icon name="arrow_right" size={13} />
                </button>
              ) : (
                <button className="btn btn--primary" onClick={salvar} disabled={salvando}>
                  <Icon name="check" size={14} /> {salvando ? 'Salvando…' : editing ? 'Salvar bolsão' : 'Criar bolsão'}
                </button>
              )}
            </div>
          </div>
        }
      >
        {/* Abas em pílula */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card-hover)', borderRadius: 12, padding: 4, marginBottom: 18 }}>
          {([['config', 'settings', 'Configuração do bolsão'], ['corretores', 'users', 'Corretores']] as const).map(([k, ic, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setAbaModal(k)}
              style={{
                flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: 'none', borderRadius: 9, padding: '10px 12px', cursor: 'pointer', font: 'inherit',
                fontSize: 13.5, fontWeight: 700,
                background: abaModal === k ? 'var(--pons-blue)' : 'transparent',
                color: abaModal === k ? '#fff' : 'var(--text-secondary)',
                transition: 'background 120ms ease, color 120ms ease',
              }}
            >
              <Icon name={ic} size={14} /> {l}
            </button>
          ))}
        </div>

        {abaModal === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
              <div className="field">
                <label className="field__label">Nome do bolsão</label>
                <input className="field__input" style={{ height: 44, fontSize: 15, fontWeight: 600 }} value={nome} onChange={(e) => setNome(e.target.value)} placeholder='Ex.: "Bolsão Geral", "Bolsão Balneário"' autoFocus />
              </div>
              <div className="field">
                <label className="field__label">Status</label>
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card-hover)', borderRadius: 10, padding: 3 }}>
                  {([[true, 'Ativo'], [false, 'Inativo']] as const).map(([v, l]) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setAtivo(v)}
                      style={{
                        border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700,
                        background: ativo === v ? (v ? '#0E9F6E' : 'var(--color-danger, #e5484d)') : 'transparent',
                        color: ativo === v ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: '14px 16px' }}>
              <div className="uppercase-tag" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Icon name="clock" size={13} /> Janela de funcionamento
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="time" className="field__input" style={{ width: 130, height: 42, fontSize: 15 }} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                <span className="text-secondary" style={{ fontWeight: 700 }}>até</span>
                <input type="time" className="field__input" style={{ width: 130, height: 42, fontSize: 15 }} value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
                {(horaInicio || horaFim) && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setHoraInicio(''); setHoraFim(''); }}>Limpar</button>
                )}
              </div>
              <div className="field__hint" style={{ marginTop: 8 }}>Fora deste horário ninguém captura leads do bolsão. Vazio = funciona 24h.</div>
            </div>

            <div style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: '14px 16px', position: 'relative' }}>
              <div className="flex-between" style={{ gap: 10 }}>
                <div className="uppercase-tag" style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                  <Icon name="target" size={13} /> Limite de capturas diariamente
                  <button
                    type="button"
                    onClick={() => setDicaLimite((v) => !v)}
                    onBlur={() => setTimeout(() => setDicaLimite(false), 150)}
                    title="O que é isso?"
                    style={{ width: 18, height: 18, borderRadius: '50%', border: dicaLimite ? '1px solid var(--pons-blue)' : '1px solid var(--border-light)', background: dicaLimite ? 'var(--pons-blue)' : 'var(--bg-card-hover)', color: dicaLimite ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'inline-grid', placeItems: 'center', padding: 0, textTransform: 'none' }}
                  >
                    ?
                  </button>
                  {dicaLimite && (
                    <div
                      style={{
                        position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 30, width: 300,
                        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
                        boxShadow: 'var(--shadow-lg)', padding: '10px 12px', fontSize: 12.5, lineHeight: 1.55,
                        color: 'var(--text-secondary)', textTransform: 'none', letterSpacing: 'normal', fontWeight: 400,
                      }}
                    >
                      Limita quantos leads <strong>cada corretor</strong> pode capturar deste bolsão <strong>por dia</strong>. Ex.: limite 2 → cada corretor pega no máximo 2 leads/dia; no dia seguinte o contador zera. Bom pra distribuir oportunidade de forma justa.
                    </div>
                  )}
                </div>
                <label className="switch">
                  <input type="checkbox" checked={limiteOn} onChange={(e) => setLimiteOn(e.target.checked)} />
                  <span className="switch__track" />
                </label>
              </div>
              {limiteOn && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => setLimite((v) => Math.max(1, v - 1))} style={{ width: 36 }}>−</button>
                  <span style={{ fontSize: 22, fontWeight: 800, minWidth: 36, textAlign: 'center' }}>{limite}</span>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => setLimite((v) => Math.min(999, v + 1))} style={{ width: 36 }}>+</button>
                  <span className="text-xs text-secondary">captura(s) por corretor por dia</span>
                </div>
              )}
            </div>
          </div>
        )}

        {abaModal === 'corretores' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className={'opcao-card' + (acesso === 'TODOS' ? ' opcao-card--on' : '')} onClick={() => setAcesso('TODOS')}>
                <span className="opcao-card__titulo"><Icon name="users" size={15} /> Atribuído para todos {acesso === 'TODOS' && <Icon name="check" size={14} />}</span>
                <span className="opcao-card__desc">Qualquer corretor ativo do sistema pode capturar leads deste bolsão.</span>
              </button>
              <button type="button" className={'opcao-card' + (acesso === 'RESTRITO' ? ' opcao-card--on' : '')} onClick={() => setAcesso('RESTRITO')}>
                <span className="opcao-card__titulo"><Icon name="lock" size={15} /> Acesso restrito {acesso === 'RESTRITO' && <Icon name="check" size={14} />}</span>
                <span className="opcao-card__desc">Só os corretores que você selecionar abaixo podem capturar.</span>
              </button>
            </div>

            {acesso === 'RESTRITO' && (
              <div style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 12 }}>
                <div className="flex-between" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <input
                    className="field__input"
                    style={{ height: 42, fontSize: 14, flex: '1 1 220px' }}
                    placeholder="Buscar corretor por nome ou equipe…"
                    value={buscaCor}
                    onChange={(e) => setBuscaCor(e.target.value)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge badge--info" style={{ fontWeight: 800 }}>{selCor.size} selecionado(s)</span>
                    {selCor.size > 0 && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelCor(new Set())}>Limpar</button>
                    )}
                  </div>
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {listaCor.length === 0 ? (
                    <div className="text-xs text-secondary" style={{ padding: '14px 12px', textAlign: 'center' }}>Nenhum corretor encontrado.</div>
                  ) : listaCor.map((c: any) => {
                    const on = selCor.has(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelCor((cur) => { const n = new Set(cur); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px',
                          border: on ? '1px solid var(--pons-blue)' : '1px solid transparent',
                          borderRadius: 10, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left',
                          background: on ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        }}
                      >
                        <div className="avatar avatar--sm">{c.initials || (c.nome || '?').slice(0, 2).toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                          <div className="text-xs text-secondary">{c.equipe?.nome || 'Sem equipe'}</div>
                        </div>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', border: on ? 'none' : '2px solid var(--border-light)', background: on ? 'var(--pons-blue)' : 'transparent', color: '#fff' }}>
                          {on && <Icon name="check" size={12} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
