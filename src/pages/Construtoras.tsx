import { useEffect, useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import './construtoras.css';

type CListItem = {
  id: number; nome: string; ativa?: boolean; logoUrl?: string | null;
  anoFundacao?: number | null; entregasRealizadas?: number | null; empreendimentosCount?: number;
};

const TABS = ['Identidade', 'História', 'Financeiro', 'Lotes à venda'] as const;
type Tab = typeof TABS[number];

// Campos por aba que salvam direto na CONSTRUTORA (a aba Financeiro é por empreendimento).
const CAMPOS: Record<string, string[]> = {
  'Identidade': ['nome', 'cidadeSede', 'anoFundacao', 'entregasRealizadas', 'unidadesEntregues', 'site', 'instagram'],
  'História': ['historia'],
  'Lotes à venda': ['unidadesDisponiveis', 'faixaPrecoMin', 'faixaPrecoMax', 'lotesObs'],
};
const NUM = new Set(['anoFundacao', 'entregasRealizadas', 'unidadesEntregues', 'comissaoPct', 'vgv', 'entradaMinPct', 'parcelamentoMax', 'descontoMaxPct', 'unidadesDisponiveis', 'faixaPrecoMin', 'faixaPrecoMax']);
const BOOL = new Set(['aceitaFinanciamento', 'aceitaPermuta', 'aceitaFgts']);

const STATUS_LABEL: Record<string, string> = { PRE_LANCAMENTO: 'Pré-lançamento', OBRA: 'Em obra', ENTREGUE: 'Entregue' };

export default function Construtoras() {
  const { data, loading, error, reload } = useApi<CListItem[]>(() => Api.construtoras());
  const [editing, setEditing] = useState<CListItem | 'new' | null>(null);

  return (
    <>
      <Topbar
        title="Construtoras"
        right={
          <button className="btn btn--primary btn--sm" onClick={() => setEditing('new')}>
            <Icon name="plus" size={14} /> Nova construtora
          </button>
        }
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Gestão · Construtoras"
          title="Construtoras parceiras"
          subtitle="Identidade, história, negociação financeira, condições de venda e estoque — tudo o que a mesa precisa para vender os empreendimentos."
        />

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : !data ? null : data.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p className="text-secondary" style={{ marginBottom: 16 }}>Nenhuma construtora cadastrada ainda.</p>
            <button className="btn btn--primary btn--sm" onClick={() => setEditing('new')}><Icon name="plus" size={14} /> Cadastrar a primeira</button>
          </div>
        ) : (
          <div className="grid-3">
            {data.map((c) => (
              <button key={c.id} className="card construtora-card" onClick={() => setEditing(c)}>
                <div className="construtora-card__logo">
                  {c.logoUrl ? <img src={c.logoUrl} alt={c.nome} /> : <span>{(c.nome || '?').charAt(0)}</span>}
                </div>
                <div className="construtora-card__body">
                  <h3>{c.nome}</h3>
                  <p className="text-xs text-secondary">
                    {[
                      c.anoFundacao ? `desde ${c.anoFundacao}` : null,
                      c.entregasRealizadas ? `${c.entregasRealizadas} entregas` : null,
                      c.empreendimentosCount ? `${c.empreendimentosCount} no portfólio` : null,
                    ].filter(Boolean).join(' · ') || 'Ficha a preencher'}
                  </p>
                </div>
                <span className="construtora-card__edit"><Icon name="pencil" size={14} /></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <ConstrutoraEditor
          construtoraId={editing === 'new' ? null : editing.id}
          onClose={() => { setEditing(null); reload(); }}
        />
      )}
    </>
  );
}

function ConstrutoraEditor({ construtoraId, onClose }: { construtoraId: number | null; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const isNew = construtoraId == null;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [fotosBusy, setFotosBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('Identidade');
  const [c, setC] = useState<any>({ nome: '', aceitaFinanciamento: false, aceitaPermuta: false, aceitaFgts: false });
  const [savedId, setSavedId] = useState<number | null>(construtoraId);
  const [fotos, setFotos] = useState<any[]>([]);
  const [empEdit, setEmpEdit] = useState<number | 'new' | null>(null); // financeiro por empreendimento
  const logoRef = useRef<HTMLInputElement>(null);
  const fotosRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew || construtoraId == null) return;
    Api.construtora(construtoraId)
      .then((data) => { setC(data || {}); setFotos(data?.fotos || []); })
      .catch(() => toast.error('Falha ao carregar a construtora.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recarrega a construtora (usado após criar/editar o financeiro de um empreendimento)
  const recarregar = () => {
    if (!savedId) return;
    Api.construtora(savedId).then((data) => { setC((cur: any) => ({ ...cur, ...data })); setFotos(data?.fotos || []); }).catch(() => {});
  };

  const set = (k: string, v: any) => setC((cur: any) => ({ ...cur, [k]: v }));

  const buildPayload = (campos: string[]) => {
    const out: Record<string, any> = {};
    for (const k of campos) {
      let v = c[k];
      if (BOOL.has(k)) out[k] = !!v;
      else if (NUM.has(k)) out[k] = (v === '' || v == null) ? null : Number(v);
      else { const s = v == null ? '' : String(v).trim(); out[k] = s || null; }
    }
    return out;
  };

  const salvarAba = async (aba: Tab) => {
    const campos = CAMPOS[aba];
    // A aba Identidade cria a construtora quando ainda não existe.
    if (aba === 'Identidade') {
      const nome = String(c.nome || '').trim();
      if (nome.length < 2) { toast.error('Informe o nome da construtora.'); return; }
    }
    setSaving(true);
    try {
      if (savedId) {
        const payload = buildPayload(campos);
        const upd = await Api.construtoraUpdate(savedId, payload);
        setC((cur: any) => ({ ...cur, ...upd }));
        toast.success(`"${aba}" salvo.`);
      } else {
        // criar (só com os campos da Identidade)
        const payload = { ...buildPayload(campos), nome: String(c.nome).trim() };
        const criada = await Api.construtoraCreateFull(payload);
        setSavedId(criada.id);
        setC((cur: any) => ({ ...cur, ...criada }));
        toast.success('Construtora criada. Agora você pode preencher as outras abas, logo e fotos.');
      }
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  const enviarLogo = async (file: File) => {
    if (!savedId) { toast.info('Salve a Identidade antes de enviar o logo.'); return; }
    setLogoBusy(true);
    try {
      const r = await Api.construtoraLogoUpload(savedId, file);
      set('logoUrl', r.logoUrl || null);
      toast.success('Logo enviado.');
    } catch (err: any) { toast.error('Erro no logo: ' + (err?.message || 'falha')); }
    finally { setLogoBusy(false); if (logoRef.current) logoRef.current.value = ''; }
  };

  const enviarFotos = async (files: File[]) => {
    if (!savedId) { toast.info('Salve a Identidade antes de enviar fotos.'); return; }
    if (!files.length) return;
    setFotosBusy(true);
    try {
      const novas = await Api.construtoraFotosUpload(savedId, files);
      setFotos((cur) => [...cur, ...(Array.isArray(novas) ? novas : [])]);
      toast.success('Fotos enviadas.');
    } catch (err: any) { toast.error('Erro nas fotos: ' + (err?.message || 'falha')); }
    finally { setFotosBusy(false); if (fotosRef.current) fotosRef.current.value = ''; }
  };

  const removerFoto = async (fotoId: number) => {
    if (!savedId) return;
    if (!(await confirm({ title: 'Remover foto?', message: 'A foto será excluída.' }))) return;
    try {
      await Api.construtoraFotoDelete(savedId, fotoId);
      setFotos((cur) => cur.filter((f) => f.id !== fotoId));
    } catch (err: any) { toast.error('Erro ao remover: ' + (err?.message || 'falha')); }
  };

  const bloqueado = !savedId; // abas além da Identidade só liberam após criar

  return (
    <>
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Nova construtora' : (c.nome || 'Construtora')}
      subtitle="Cada aba é independente — salve uma agora e volte para as outras quando quiser."
      size="lg"
      footer={<button className="btn btn--ghost" onClick={onClose}>Fechar</button>}
    >
      {loading ? <LoadingBlock /> : (
        <div className="cons-editor">
          {/* Abas */}
          <div className="cons-tabs" role="tablist">
            {TABS.map((t) => {
              const dis = bloqueado && t !== 'Identidade';
              return (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={`cons-tab${tab === t ? ' on' : ''}${dis ? ' cons-tab--dis' : ''}`}
                  onClick={() => !dis && setTab(t)}
                  title={dis ? 'Salve a Identidade primeiro' : ''}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {bloqueado && tab !== 'Identidade' && (
            <p className="cons-hint">Salve a aba <b>Identidade</b> primeiro para habilitar esta seção.</p>
          )}

          {/* ---------- IDENTIDADE ---------- */}
          {tab === 'Identidade' && (
            <div className="cons-pane">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                <div className="cons-logo">
                  {c.logoUrl ? <img src={c.logoUrl} alt="logo" /> : <Icon name="building" size={26} />}
                </div>
                <div>
                  <input ref={logoRef} id="cons-logo-file" type="file" accept="image/*" style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarLogo(f); }} />
                  <label htmlFor="cons-logo-file" className="btn btn--secondary btn--sm" style={!savedId || logoBusy ? { pointerEvents: 'none', opacity: 0.55 } : undefined}>
                    {logoBusy ? 'Enviando…' : c.logoUrl ? 'Trocar logo' : 'Enviar logo'}
                  </label>
                  <p className="text-xs text-secondary" style={{ margin: '6px 0 0' }}>
                    {savedId ? 'PNG/JPG. Ideal fundo transparente.' : 'Salve a Identidade para habilitar o logo.'}
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field field--span-2"><label className="field__label">Nome da construtora *</label><input className="field__input" value={c.nome || ''} onChange={(e) => set('nome', e.target.value)} placeholder="Ex: MAXCES Incorporações" /></div>
                <div className="field"><label className="field__label">Cidade sede</label><input className="field__input" value={c.cidadeSede || ''} onChange={(e) => set('cidadeSede', e.target.value)} placeholder="Ex: Balneário Camboriú/SC" /></div>
                <div className="field"><label className="field__label">Ano de fundação</label><input className="field__input" type="number" value={c.anoFundacao ?? ''} onChange={(e) => set('anoFundacao', e.target.value)} placeholder="Ex: 2007" /></div>
                <div className="field"><label className="field__label">Entregas realizadas</label><input className="field__input" type="number" value={c.entregasRealizadas ?? ''} onChange={(e) => set('entregasRealizadas', e.target.value)} placeholder="Ex: 32" /></div>
                <div className="field"><label className="field__label">Unidades entregues</label><input className="field__input" type="number" value={c.unidadesEntregues ?? ''} onChange={(e) => set('unidadesEntregues', e.target.value)} placeholder="Ex: 2100" /></div>
                <div className="field"><label className="field__label">Site</label><input className="field__input" value={c.site || ''} onChange={(e) => set('site', e.target.value)} placeholder="www.construtora.com.br" /></div>
                <div className="field"><label className="field__label">Instagram</label><input className="field__input" value={c.instagram || ''} onChange={(e) => set('instagram', e.target.value)} placeholder="@construtora" /></div>
              </div>

              {/* Fotos */}
              <div style={{ marginTop: 18 }}>
                <label className="field__label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Fotos da construtora ({fotos.length})</span>
                  <span className="text-xs text-secondary">até 12 por vez</span>
                </label>
                <input ref={fotosRef} id="cons-fotos-file" type="file" accept="image/*" multiple style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) enviarFotos(fs); }} />
                <div className="cons-fotos">
                  {fotos.map((f) => (
                    <div key={f.id} className="cons-foto">
                      <img src={f.url} alt="" />
                      <button type="button" className="cons-foto__x" onClick={() => removerFoto(f.id)} aria-label="Remover"><Icon name="trash" size={12} /></button>
                    </div>
                  ))}
                  <label htmlFor="cons-fotos-file" className={`cons-foto cons-foto--add${!savedId || fotosBusy ? ' is-dis' : ''}`}>
                    <Icon name="plus" size={18} />
                    <span>{fotosBusy ? 'Enviando…' : 'Adicionar'}</span>
                  </label>
                </div>
              </div>

              <div className="cons-actions">
                <button className="btn btn--primary btn--sm" disabled={saving} onClick={() => salvarAba('Identidade')}>{saving ? 'Salvando…' : savedId ? 'Salvar Identidade' : 'Criar construtora'}</button>
              </div>
            </div>
          )}

          {/* ---------- HISTÓRIA ---------- */}
          {tab === 'História' && !bloqueado && (
            <div className="cons-pane">
              <div className="field"><label className="field__label">Breve história da construtora</label>
                <textarea className="field__textarea" rows={8} value={c.historia || ''} onChange={(e) => set('historia', e.target.value)} placeholder="Trajetória, tempo de mercado, diferenciais e reputação. Aparece no site em 'Conhecer a construtora'." />
              </div>
              <div className="cons-actions"><button className="btn btn--primary btn--sm" disabled={saving} onClick={() => salvarAba('História')}>{saving ? 'Salvando…' : 'Salvar História'}</button></div>
            </div>
          )}

          {/* ---------- FINANCEIRO (por empreendimento) ---------- */}
          {tab === 'Financeiro' && !bloqueado && (
            <div className="cons-pane">
              <div className="cons-emp__head">
                <p className="cons-sec" style={{ margin: 0 }}>O financeiro e o acordo comercial são <b>por empreendimento</b>. Adicione um empreendimento para definir comissão, condições e o acordo.</p>
                <button className="btn btn--primary btn--sm" style={{ flex: '0 0 auto' }} onClick={() => setEmpEdit('new')}><Icon name="plus" size={14} /> Adicionar empreendimento</button>
              </div>
              {(!c.empreendimentos || c.empreendimentos.length === 0) ? (
                <div className="card" style={{ padding: 26, textAlign: 'center' }}>
                  <p className="text-secondary" style={{ marginBottom: 14 }}>Nenhum empreendimento vinculado a esta construtora ainda.</p>
                  <button className="btn btn--secondary btn--sm" onClick={() => setEmpEdit('new')}><Icon name="plus" size={13} /> Adicionar empreendimento</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {c.empreendimentos.map((e: any) => (
                    <button key={e.id} className="card cons-emp" onClick={() => setEmpEdit(e.id)}>
                      <span className="cons-emp__ic"><Icon name="building" size={18} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{e.nome}</div>
                        <div className="text-xs text-secondary">{e.cidade}{e.status ? ' · ' + (STATUS_LABEL[e.status] || e.status) : ''}</div>
                      </div>
                      <span className={`badge badge--${e.comissaoPct ? 'launch' : 'neutral'}`}>{e.comissaoPct ? `Comissão ${e.comissaoPct}%` : 'A definir'}</span>
                      <Icon name="pencil" size={14} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------- LOTES À VENDA ---------- */}
          {tab === 'Lotes à venda' && !bloqueado && (
            <div className="cons-pane">
              <p className="cons-sec">Estoque à venda desta construtora</p>
              <div className="form-grid">
                <div className="field"><label className="field__label">Imóveis / unidades à venda</label><input className="field__input" type="number" value={c.unidadesDisponiveis ?? ''} onChange={(e) => set('unidadesDisponiveis', e.target.value)} placeholder="Ex: 48" /></div>
                <div className="field"><label className="field__label">Faixa de preço — mín. (R$)</label><input className="field__input" type="number" step="0.01" value={c.faixaPrecoMin ?? ''} onChange={(e) => set('faixaPrecoMin', e.target.value)} placeholder="Ex: 589000" /></div>
                <div className="field"><label className="field__label">Faixa de preço — máx. (R$)</label><input className="field__input" type="number" step="0.01" value={c.faixaPrecoMax ?? ''} onChange={(e) => set('faixaPrecoMax', e.target.value)} placeholder="Ex: 1500000" /></div>
                <div className="field field--span-2"><label className="field__label">Observações do estoque</label><textarea className="field__textarea" rows={3} value={c.lotesObs || ''} onChange={(e) => set('lotesObs', e.target.value)} placeholder="Torres, tipologias disponíveis, previsão de entrega, unidades reservadas, etc." /></div>
              </div>
              <div className="cons-actions"><button className="btn btn--primary btn--sm" disabled={saving} onClick={() => salvarAba('Lotes à venda')}>{saving ? 'Salvando…' : 'Salvar Lotes'}</button></div>
            </div>
          )}
        </div>
      )}
    </Modal>

    {empEdit != null && savedId != null && (
      <EmpFinanceiro
        construtoraId={savedId}
        empId={empEdit === 'new' ? null : empEdit}
        construtoraNome={c.nome || 'Construtora'}
        onClose={(mudou) => { setEmpEdit(null); if (mudou) recarregar(); }}
      />
    )}
    </>
  );
}

// ── Editor do FINANCEIRO de UM empreendimento (comissão + condições + acordo) ──
const E_NUM = new Set(['comissaoPct', 'vgv', 'entradaMinPct', 'parcelamentoMax', 'descontoMaxPct', 'valorInicial']);
const E_BOOL = new Set(['aceitaFinanciamento', 'aceitaPermuta', 'aceitaFgts']);

function EmpFinanceiro({ construtoraId, empId, construtoraNome, onClose }: {
  construtoraId: number; empId: number | null; construtoraNome: string; onClose: (mudou?: boolean) => void;
}) {
  const toast = useToast();
  const isNew = empId == null;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [e, setE] = useState<any>({ estado: 'SC', status: 'PRE_LANCAMENTO', aceitaFinanciamento: false, aceitaPermuta: false, aceitaFgts: false });
  const set = (k: string, v: any) => setE((cur: any) => ({ ...cur, [k]: v }));

  useEffect(() => {
    if (isNew || empId == null) return;
    Api.empreendimento(empId).then((d) => setE(d || {})).catch(() => toast.error('Falha ao carregar o empreendimento.')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salvar = async () => {
    const nome = String(e.nome || '').trim();
    if (isNew && nome.length < 2) { toast.error('Informe o nome do empreendimento.'); return; }
    if (isNew && !String(e.cidade || '').trim()) { toast.error('Informe a cidade.'); return; }
    const CAMPOS = ['comissaoPct', 'comissaoTipo', 'comissaoObs', 'formaPagamentoComissao', 'prazoRepasse', 'vgv', 'tabelaValores',
      'entradaMinPct', 'parcelamentoMax', 'aceitaFinanciamento', 'aceitaPermuta', 'aceitaFgts', 'descontoMaxPct', 'sinalMinimo', 'validadeReserva',
      'condicoesVendaTexto', 'documentacaoNecessaria', 'acordoComercial'];
    const payload: Record<string, any> = {};
    for (const k of CAMPOS) {
      const v = e[k];
      if (E_BOOL.has(k)) payload[k] = !!v;
      else if (E_NUM.has(k)) payload[k] = (v === '' || v == null) ? null : Number(v);
      else { const s = v == null ? '' : String(v).trim(); payload[k] = s || null; }
    }
    setSaving(true);
    try {
      if (isNew) {
        await Api.empreendimentoCreate({ nome, construtoraId, cidade: String(e.cidade).trim(), estado: String(e.estado || 'SC').toUpperCase(), status: String(e.status || 'PRE_LANCAMENTO'), valorInicial: e.valorInicial ? Number(e.valorInicial) : null, ...payload });
        toast.success('Empreendimento adicionado com o financeiro.');
      } else {
        await Api.empreendimentoUpdate(empId!, payload);
        toast.success('Financeiro do empreendimento salvo.');
      }
      onClose(true);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'falha'));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open
      onClose={() => onClose(false)}
      title={isNew ? 'Adicionar empreendimento' : (e.nome || 'Empreendimento')}
      subtitle={`Financeiro e acordo comercial · ${construtoraNome}`}
      size="lg"
      footer={<>
        <button className="btn btn--ghost" onClick={() => onClose(false)} disabled={saving}>Cancelar</button>
        <button className="btn btn--primary" disabled={saving} onClick={salvar}>{saving ? 'Salvando…' : isNew ? 'Adicionar empreendimento' : 'Salvar financeiro'}</button>
      </>}
    >
      {loading ? <LoadingBlock /> : (
        <div className="cons-pane">
          {isNew && (
            <>
              <p className="cons-sec">Empreendimento</p>
              <div className="form-grid">
                <div className="field field--span-2"><label className="field__label">Nome do empreendimento *</label><input className="field__input" value={e.nome || ''} onChange={(ev) => set('nome', ev.target.value)} placeholder="Ex: Conecta Residence" /></div>
                <div className="field"><label className="field__label">Cidade *</label><input className="field__input" value={e.cidade || ''} onChange={(ev) => set('cidade', ev.target.value)} placeholder="Ex: Porto Belo" /></div>
                <div className="field"><label className="field__label">UF</label><input className="field__input" maxLength={2} value={e.estado || 'SC'} onChange={(ev) => set('estado', ev.target.value)} /></div>
                <div className="field"><label className="field__label">Status</label><select className="field__select" value={e.status || 'PRE_LANCAMENTO'} onChange={(ev) => set('status', ev.target.value)}><option value="PRE_LANCAMENTO">Pré-lançamento</option><option value="OBRA">Em obra</option><option value="ENTREGUE">Entregue</option></select></div>
                <div className="field"><label className="field__label">Valor inicial (R$)</label><input className="field__input" type="number" value={e.valorInicial ?? ''} onChange={(ev) => set('valorInicial', ev.target.value)} placeholder="Ex: 589000" /></div>
              </div>
              <hr style={{ margin: '18px 0', borderColor: 'var(--border-light)' }} />
            </>
          )}

          <p className="cons-sec">Comissão da Pons neste empreendimento</p>
          <div className="form-grid">
            <div className="field"><label className="field__label">Comissão da Pons (%)</label><input className="field__input" type="number" step="0.01" value={e.comissaoPct ?? ''} onChange={(ev) => set('comissaoPct', ev.target.value)} placeholder="Ex: 6" /></div>
            <div className="field"><label className="field__label">Base do cálculo</label><input className="field__input" value={e.comissaoTipo || ''} onChange={(ev) => set('comissaoTipo', ev.target.value)} placeholder="sobre o valor de venda / VGV" /></div>
            <div className="field"><label className="field__label">Forma de pagamento</label><input className="field__input" value={e.formaPagamentoComissao || ''} onChange={(ev) => set('formaPagamentoComissao', ev.target.value)} placeholder="Ex: 50% assinatura, 50% repasse" /></div>
            <div className="field"><label className="field__label">Prazo de repasse</label><input className="field__input" value={e.prazoRepasse || ''} onChange={(ev) => set('prazoRepasse', ev.target.value)} placeholder="Ex: 30 dias após assinatura" /></div>
            <div className="field"><label className="field__label">VGV (R$)</label><input className="field__input" type="number" step="0.01" value={e.vgv ?? ''} onChange={(ev) => set('vgv', ev.target.value)} placeholder="opcional" /></div>
            <div className="field field--span-2"><label className="field__label">Observações da comissão</label><textarea className="field__textarea" rows={2} value={e.comissaoObs || ''} onChange={(ev) => set('comissaoObs', ev.target.value)} placeholder="Faixas, bônus por volume, campanhas." /></div>
            <div className="field field--span-2"><label className="field__label">Tabela / valores praticados</label><textarea className="field__textarea" rows={2} value={e.tabelaValores || ''} onChange={(ev) => set('tabelaValores', ev.target.value)} /></div>
          </div>

          <p className="cons-sec" style={{ marginTop: 20 }}>Condições de venda deste empreendimento</p>
          <div className="form-grid">
            <div className="field"><label className="field__label">Entrada mínima (%)</label><input className="field__input" type="number" step="0.01" value={e.entradaMinPct ?? ''} onChange={(ev) => set('entradaMinPct', ev.target.value)} placeholder="Ex: 10" /></div>
            <div className="field"><label className="field__label">Parcelamento máx. (meses)</label><input className="field__input" type="number" value={e.parcelamentoMax ?? ''} onChange={(ev) => set('parcelamentoMax', ev.target.value)} placeholder="Ex: 120" /></div>
            <div className="field"><label className="field__label">Desconto máx. (%)</label><input className="field__input" type="number" step="0.01" value={e.descontoMaxPct ?? ''} onChange={(ev) => set('descontoMaxPct', ev.target.value)} placeholder="Ex: 5" /></div>
            <div className="field"><label className="field__label">Sinal / ato mínimo</label><input className="field__input" value={e.sinalMinimo || ''} onChange={(ev) => set('sinalMinimo', ev.target.value)} placeholder="Ex: R$ 5.000" /></div>
            <div className="field"><label className="field__label">Validade da reserva</label><input className="field__input" value={e.validadeReserva || ''} onChange={(ev) => set('validadeReserva', ev.target.value)} placeholder="Ex: 48h" /></div>
            <div className="field field--span-2" style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={!!e.aceitaFinanciamento} onChange={(ev) => set('aceitaFinanciamento', ev.target.checked)} /> Aceita financiamento</label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={!!e.aceitaPermuta} onChange={(ev) => set('aceitaPermuta', ev.target.checked)} /> Aceita permuta</label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={!!e.aceitaFgts} onChange={(ev) => set('aceitaFgts', ev.target.checked)} /> Aceita FGTS</label>
            </div>
            <div className="field field--span-2"><label className="field__label">Condições completas (texto)</label><textarea className="field__textarea" rows={3} value={e.condicoesVendaTexto || ''} onChange={(ev) => set('condicoesVendaTexto', ev.target.value)} placeholder="Entrada, reforços, chaves, financiamento…" /></div>
            <div className="field field--span-2"><label className="field__label">Documentação necessária</label><textarea className="field__textarea" rows={2} value={e.documentacaoNecessaria || ''} onChange={(ev) => set('documentacaoNecessaria', ev.target.value)} /></div>
          </div>

          <p className="cons-sec" style={{ marginTop: 20 }}>Acordo comercial</p>
          <div className="field"><label className="field__label">Acordo comercial com a construtora</label><textarea className="field__textarea" rows={5} value={e.acordoComercial || ''} onChange={(ev) => set('acordoComercial', ev.target.value)} placeholder="Registre o acordo comercial completo deste empreendimento: comissionamento, exclusividade, metas, regras de reserva e repasse, condições especiais…" /></div>
        </div>
      )}
    </Modal>
  );
}
