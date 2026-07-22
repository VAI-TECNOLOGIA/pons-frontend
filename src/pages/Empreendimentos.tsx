import { useEffect, useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { formatCurrencyShort } from '../lib/format';
import { Api } from '../lib/api';
import { Auth } from '../lib/auth';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { CondicoesVendaModal } from '../components/CondicoesVendaModal';

import './empreendimentos.css';

type Construtora = { id: number; nome: string };
type Foto = { id: number; url: string; ordem: number };
type Doc = { id: number; nome: string; url: string; tamanho?: number | null };
type Empreendimento = {
  id: number;
  nome: string;
  slug: string;
  cidade: string;
  estado: string;
  status: 'PRE_LANCAMENTO' | 'OBRA' | 'ENTREGUE' | string;
  unidadesTotal: number;
  unidadesVendidas: number;
  valorInicial: number | null;
  descricao?: string | null;
  imagemUrl?: string | null;
  fotos: Foto[];
  documentos?: Doc[];
  construtora: { id: number; nome: string };
  vendasCount?: number;
  // Ficha completa (layout KÓRA no site)
  descritivo?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  localizacao?: string | null;
  distanciaMar?: string | null;
  areaLazerM2?: number | null;
  itensLazer?: string | null;
  tipologiasTexto?: string | null;
  areaMin?: number | null;
  areaMax?: number | null;
  acabamentos?: string | null;
  vagas?: number | null;
  inicioObras?: string | null;
  entregaPrevista?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  PRE_LANCAMENTO: 'PRÉ-LANÇAMENTO',
  OBRA: 'EM OBRA',
  ENTREGUE: 'ENTREGUE',
};

export default function Empreendimentos() {
  const { data: emps, loading, error, reload } = useApi<Empreendimento[]>(() => Api.empreendimentos());
  const { data: construtoras } = useApi<Construtora[]>(() => Api.construtoras());
  const [showNew, setShowNew] = useState(false);
  const [showConstrutoras, setShowConstrutoras] = useState(false);
  const [gallery, setGallery] = useState<Empreendimento | null>(null);
  const [docsEmp, setDocsEmp] = useState<Empreendimento | null>(null);
  const [unidadesEmp, setUnidadesEmp] = useState<Empreendimento | null>(null);
  // Condições de venda (política de rateio) — abre logo após cadastrar o empreendimento
  const [condicoesEmp, setCondicoesEmp] = useState<{ id: number; nome: string } | null>(null);

  const userRole = Auth.user?.role || '';
  const canEdit = ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING', 'ASSESSORA_MARKETING', 'GESTOR_TRAFEGO', 'GESTOR_MARKETING', 'SOCIO_UNIDADE'].includes(userRole);

  if (loading) return <Shell canEdit={canEdit}><LoadingBlock /></Shell>;
  if (error) return <Shell canEdit={canEdit}><ErrorBlock error={error} /></Shell>;
  if (!emps) return null;

  const vendidas = emps.reduce((s, e) => s + (e.unidadesVendidas || 0), 0);
  const totalConstrutoras = new Set(emps.map((e) => e.construtora?.nome).filter(Boolean)).size;

  return (
    <>
      <Topbar
        title="Empreendimentos"
        right={
          canEdit ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--secondary btn--sm" onClick={() => setShowConstrutoras(true)}>
                <Icon name="building" size={14} /> Construtoras
              </button>
              <button className="btn btn--primary btn--sm" onClick={() => setShowNew(true)}>
                <Icon name="plus" size={14} /> Cadastrar empreendimento
              </button>
            </div>
          ) : undefined
        }
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Gestão · Empreendimentos"
          title={`${emps.length} empreendimentos · ${totalConstrutoras} construtoras`}
          subtitle={`${vendidas} unidades vendidas`}
        />

        <div className="grid-3">
          {emps.map((e) => {
            const pct = e.unidadesTotal ? Math.round((e.unidadesVendidas / e.unidadesTotal) * 100) : 0;
            const cover = e.imagemUrl || e.fotos[0]?.url;
            const coverStyle: React.CSSProperties = cover
              ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : {
                  background: 'linear-gradient(135deg,#263654,#0E7C9B)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: 20,
                };
            return (
              <div className="property-card" key={e.id}>
                <div
                  className="property-card__cover"
                  style={{ ...coverStyle, cursor: canEdit ? 'pointer' : 'default', position: 'relative' }}
                  onClick={() => canEdit && setGallery(e)}
                  title={canEdit ? 'Clique pra gerenciar fotos' : undefined}
                >
                  {!cover && e.nome.toUpperCase()}
                  <span className="badge badge--launch property-card__tag">
                    {STATUS_LABEL[e.status] || e.status}
                  </span>
                  {canEdit && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        background: 'rgba(0,0,0,0.55)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: 999,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Icon name="pencil" size={11} /> {e.fotos.length} fotos
                    </div>
                  )}
                </div>
                <div className="property-card__body">
                  <h3 className="property-card__title">{e.nome}</h3>
                  <div className="property-card__location">
                    {e.cidade}/{e.estado} · {e.construtora?.nome || '—'}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div className="flex-between text-sm mb-2">
                      <span className="text-secondary">
                        Vendidas: {e.unidadesVendidas} de {e.unidadesTotal}
                      </span>
                      <span className="font-semibold">{pct}%</span>
                    </div>
                    <div className="progress">
                      <div className="progress__fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="property-card__stats">
                    <div className="property-card__stat">
                      <div className="property-card__stat-value">{e.unidadesTotal ?? 0}</div>
                      <div className="property-card__stat-label">total</div>
                    </div>
                    <div className="property-card__stat">
                      <div className="property-card__stat-value">{e.vendasCount ?? e.unidadesVendidas ?? 0}</div>
                      <div className="property-card__stat-label">contratos</div>
                    </div>
                    <div className="property-card__stat">
                      <div className="property-card__stat-value">{formatCurrencyShort(e.valorInicial || 0)}</div>
                      <div className="property-card__stat-label">a partir</div>
                    </div>
                  </div>
                  <button
                    className="btn btn--secondary btn--sm"
                    style={{ width: '100%', marginTop: 12 }}
                    onClick={() => setUnidadesEmp(e)}
                  >
                    <Icon name="building" size={13} /> Unidades / disponibilidade
                  </button>
                  <button
                    className="btn btn--secondary btn--sm"
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={() => setDocsEmp(e)}
                  >
                    <Icon name="doc" size={13} /> Documentos{e.documentos?.length ? ` (${e.documentos.length})` : ''}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showNew && construtoras && (
        <NovoEmpreendimentoModal
          construtoras={construtoras}
          onClose={() => setShowNew(false)}
          onCreated={(created) => {
            setShowNew(false);
            reload();
            // Encadeia as condições de venda (financeiro) do empreendimento recém-criado
            if (created?.id) setCondicoesEmp({ id: created.id, nome: created.nome });
          }}
        />
      )}

      {condicoesEmp && (
        <CondicoesVendaModal
          open
          empreendimento={condicoesEmp}
          onClose={() => setCondicoesEmp(null)}
          onSaved={() => { setCondicoesEmp(null); reload(); }}
        />
      )}

      {docsEmp && (
        <DocsEmpreendimentoModal
          empreendimento={docsEmp}
          canEdit={canEdit}
          onClose={() => setDocsEmp(null)}
          onChanged={reload}
        />
      )}

      {gallery && (
        <GaleriaFotosModal
          empreendimento={gallery}
          onClose={() => setGallery(null)}
          onChanged={() => {
            reload();
          }}
        />
      )}

      {unidadesEmp && (
        <UnidadesModal
          empreendimento={unidadesEmp}
          canEdit={canEdit}
          onClose={() => setUnidadesEmp(null)}
          onChanged={() => reload()}
        />
      )}

      {showConstrutoras && (
        <ConstrutorasModal onClose={() => setShowConstrutoras(false)} />
      )}
    </>
  );
}

// ── Modal: gestão de unidades (inventário) ───────────────────────────────
const UNIDADE_STATUS_BADGE: Record<string, [string, string]> = {
  DISPONIVEL: ['launch', 'Disponível'],
  RESERVADO: ['analysis', 'Reservado'],
  VENDIDO: ['paid', 'Vendido'],
  BLOQUEADO: ['cancelled', 'Bloqueado'],
};
const UNIDADE_STATUS_LIST = ['DISPONIVEL', 'RESERVADO', 'VENDIDO', 'BLOQUEADO'];

function UnidadesModal({
  empreendimento,
  canEdit,
  onClose,
  onChanged,
}: {
  empreendimento: Empreendimento;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const refetch = async () => {
    setLoading(true);
    try {
      setData(await Api.empreendimentoUnidades(empreendimento.id));
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao carregar unidades');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreendimento.id]);

  const mudarStatus = async (u: any, status: string) => {
    setBusy(true);
    try {
      await Api.empreendimentoUnidadeUpdate(empreendimento.id, u.id, { status });
      await refetch();
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar');
    } finally {
      setBusy(false);
    }
  };

  const remover = async (u: any) => {
    const ok = await confirm({ title: 'Remover unidade', message: `Remover "${u.identificacao}"?`, confirmText: 'Remover', tone: 'danger' });
    if (!ok) return;
    setBusy(true);
    try {
      await Api.empreendimentoUnidadeDelete(empreendimento.id, u.id);
      await refetch();
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao remover');
    } finally {
      setBusy(false);
    }
  };

  const addUnidade = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => { const v = fd.get(k); return v ? Number(v) : null; };
    setBusy(true);
    try {
      await Api.empreendimentoUnidadeCreate(empreendimento.id, {
        identificacao: String(fd.get('identificacao') || '').trim(),
        torre: String(fd.get('torre') || '') || null,
        andar: num('andar'),
        tipologia: String(fd.get('tipologia') || '') || null,
        areaPrivativa: num('areaPrivativa'),
        quartos: num('quartos'),
        vagas: num('vagas'),
        valor: num('valor'),
        status: String(fd.get('status') || 'DISPONIVEL'),
      });
      setAddOpen(false);
      await refetch();
      onChanged();
      toast.success('Unidade adicionada');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao adicionar');
    } finally {
      setBusy(false);
    }
  };

  const addBulk = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => { const v = fd.get(k); return v ? Number(v) : null; };
    setBusy(true);
    try {
      const r: any = await Api.empreendimentoUnidadesBulk(empreendimento.id, {
        torre: String(fd.get('torre') || '') || null,
        andarInicio: Number(fd.get('andarInicio')),
        andarFim: Number(fd.get('andarFim')),
        unidadesPorAndar: Number(fd.get('unidadesPorAndar')),
        prefixo: String(fd.get('prefixo') || '') || null,
        tipologia: String(fd.get('tipologia') || '') || null,
        valor: num('valor'),
      });
      setBulkOpen(false);
      await refetch();
      onChanged();
      toast.success(`${r.criadas} unidades geradas`);
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao gerar lote');
    } finally {
      setBusy(false);
    }
  };

  const resumo = data?.resumo || {};

  return (
    <Modal open onClose={onClose} title={`Unidades · ${empreendimento.nome}`} subtitle="Inventário, andares e disponibilidade" size="lg">
      <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {UNIDADE_STATUS_LIST.map((s) => (
          <span key={s} className={`badge badge--${UNIDADE_STATUS_BADGE[s][0]}`}>
            {UNIDADE_STATUS_BADGE[s][1]}: {resumo[s] || 0}
          </span>
        ))}
        <span className="text-secondary text-sm" style={{ marginLeft: 'auto' }}>Total: {data?.total || 0}</span>
      </div>

      {canEdit && !addOpen && !bulkOpen && (
        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          <button className="btn btn--primary btn--sm" onClick={() => setAddOpen(true)}><Icon name="plus" size={13} /> Adicionar unidade</button>
          <button className="btn btn--secondary btn--sm" onClick={() => setBulkOpen(true)}><Icon name="building" size={13} /> Gerar em lote</button>
        </div>
      )}

      {addOpen && (
        <form onSubmit={addUnidade} className="card" style={{ marginBottom: 16 }}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Identificação *</label><input name="identificacao" className="field__input" required placeholder="Apt 1207" /></div>
            <div className="field"><label className="field__label">Torre/Bloco</label><input name="torre" className="field__input" placeholder="A" /></div>
            <div className="field"><label className="field__label">Andar</label><input name="andar" type="number" className="field__input" /></div>
            <div className="field"><label className="field__label">Tipologia</label><input name="tipologia" className="field__input" placeholder="3 quartos" /></div>
            <div className="field"><label className="field__label">Área (m²)</label><input name="areaPrivativa" type="number" step="0.01" className="field__input" /></div>
            <div className="field"><label className="field__label">Quartos</label><input name="quartos" type="number" className="field__input" /></div>
            <div className="field"><label className="field__label">Vagas</label><input name="vagas" type="number" className="field__input" /></div>
            <div className="field"><label className="field__label">Valor (R$)</label><input name="valor" type="number" step="0.01" className="field__input" /></div>
            <div className="field"><label className="field__label">Status</label><select name="status" className="field__select" defaultValue="DISPONIVEL">{UNIDADE_STATUS_LIST.map((s) => <option key={s} value={s}>{UNIDADE_STATUS_BADGE[s][1]}</option>)}</select></div>
          </div>
          <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAddOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>Salvar</button>
          </div>
        </form>
      )}

      {bulkOpen && (
        <form onSubmit={addBulk} className="card" style={{ marginBottom: 16 }}>
          <p className="text-secondary text-sm" style={{ marginBottom: 8 }}>Gera unidades por faixa de andares. Identificação = prefixo + andar + nº (ex: andar 12, unidade 1 → 1201).</p>
          <div className="form-grid">
            <div className="field"><label className="field__label">Torre/Bloco</label><input name="torre" className="field__input" placeholder="A" /></div>
            <div className="field"><label className="field__label">Prefixo</label><input name="prefixo" className="field__input" placeholder="(opcional)" /></div>
            <div className="field"><label className="field__label">Andar inicial *</label><input name="andarInicio" type="number" className="field__input" required defaultValue={1} /></div>
            <div className="field"><label className="field__label">Andar final *</label><input name="andarFim" type="number" className="field__input" required defaultValue={10} /></div>
            <div className="field"><label className="field__label">Unidades por andar *</label><input name="unidadesPorAndar" type="number" className="field__input" required defaultValue={4} /></div>
            <div className="field"><label className="field__label">Tipologia</label><input name="tipologia" className="field__input" placeholder="2 quartos" /></div>
            <div className="field"><label className="field__label">Valor base (R$)</label><input name="valor" type="number" step="0.01" className="field__input" /></div>
          </div>
          <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setBulkOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>Gerar</button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingBlock />
      ) : !data?.unidades?.length ? (
        <p className="text-secondary text-sm" style={{ textAlign: 'center', padding: 24 }}>Nenhuma unidade cadastrada.</p>
      ) : (
        <table className="table">
          <thead><tr><th>Unidade</th><th>Torre</th><th>Andar</th><th>Tipologia</th><th className="text-right">Valor</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {data.unidades.map((u: any) => (
              <tr key={u.id}>
                <td>{u.identificacao}</td>
                <td className="text-sm">{u.torre || '—'}</td>
                <td className="text-sm">{u.andar ?? '—'}</td>
                <td className="text-sm">{u.tipologia || '—'}</td>
                <td className="text-right money">{u.valor ? formatCurrencyShort(u.valor) : '—'}</td>
                <td>
                  {canEdit ? (
                    <select className="field__select field__select--sm" value={u.status} disabled={busy} onChange={(ev) => mudarStatus(u, ev.target.value)}>
                      {UNIDADE_STATUS_LIST.map((s) => <option key={s} value={s}>{UNIDADE_STATUS_BADGE[s][1]}</option>)}
                    </select>
                  ) : (
                    <span className={`badge badge--${UNIDADE_STATUS_BADGE[u.status]?.[0] || 'neutral'}`}>{UNIDADE_STATUS_BADGE[u.status]?.[1] || u.status}</span>
                  )}
                </td>
                {canEdit && (
                  <td className="text-right">
                    <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => remover(u)} title="Remover"><Icon name="trash" size={13} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function Shell({ children, canEdit }: { children: React.ReactNode; canEdit?: boolean }) {
  return (
    <>
      <Topbar
        title="Empreendimentos"
        right={
          canEdit ? (
            <button className="btn btn--primary btn--sm" disabled>
              <Icon name="plus" size={14} /> Cadastrar empreendimento
            </button>
          ) : undefined
        }
      />
      <div className="main__content">
        <PageHeader breadcrumb="Gestão · Empreendimentos" title="Empreendimentos" />
        {children}
      </div>
    </>
  );
}

// ── Modal: novo empreendimento ────────────────────────────────────────
function NovoEmpreendimentoModal({
  construtoras,
  onClose,
  onCreated,
}: {
  construtoras: Construtora[];
  onClose: () => void;
  onCreated: (e: Empreendimento) => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingDocs, setPendingDocs] = useState<File[]>([]);
  const inputFileRef = useRef<HTMLInputElement>(null);
  const inputDocRef = useRef<HTMLInputElement>(null);

  // Construtora: lista local (permite adicionar uma nova sem recarregar) +
  // seleção controlada (pra já selecionar a recém-criada) + cadastro inline.
  const [lista, setLista] = useState<Construtora[]>(construtoras);
  const [construtoraSel, setConstrutoraSel] = useState<string>('');
  const [novaConstrutora, setNovaConstrutora] = useState(false);
  const [novaNome, setNovaNome] = useState('');
  const [addingConstrutora, setAddingConstrutora] = useState(false);

  const adicionarConstrutora = async () => {
    const nome = novaNome.trim();
    if (nome.length < 2) { toast.error('Digite o nome da construtora.'); return; }
    setAddingConstrutora(true);
    try {
      const c = await Api.construtoraQuickCreate(nome);
      setLista((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, { id: c.id, nome: c.nome }].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))));
      setConstrutoraSel(String(c.id));
      setNovaConstrutora(false);
      setNovaNome('');
      toast.success(c.criada === false ? `"${c.nome}" já existia — selecionada.` : `Construtora "${c.nome}" cadastrada.`);
    } catch (err: any) {
      toast.error('Erro ao cadastrar construtora: ' + (err?.message || 'falha'));
    } finally {
      setAddingConstrutora(false);
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const txt = (k: string) => { const v = fd.get(k); const s = v ? String(v).trim() : ''; return s || null; };
    const num = (k: string) => { const v = fd.get(k); return v ? Number(v) : null; };
    const payload = {
      nome: String(fd.get('nome') || '').trim(),
      construtoraId: Number(fd.get('construtoraId') || 0),
      cidade: String(fd.get('cidade') || '').trim(),
      estado: String(fd.get('estado') || 'SC').toUpperCase(),
      status: String(fd.get('status') || 'PRE_LANCAMENTO'),
      unidadesTotal: Number(fd.get('unidadesTotal') || 0),
      unidadesVendidas: Number(fd.get('unidadesVendidas') || 0),
      valorInicial: fd.get('valorInicial') ? Number(fd.get('valorInicial')) : null,
      descricao: (fd.get('descricao') ? String(fd.get('descricao')) : null) || null,
      publicado: fd.get('publicado') === 'on',
      // Ficha completa (layout KÓRA no site)
      descritivo: txt('descritivo'),
      endereco: txt('endereco'),
      bairro: txt('bairro'),
      localizacao: txt('localizacao'),
      distanciaMar: txt('distanciaMar'),
      areaLazerM2: num('areaLazerM2'),
      itensLazer: txt('itensLazer'),
      tipologiasTexto: txt('tipologiasTexto'),
      areaMin: num('areaMin'),
      areaMax: num('areaMax'),
      acabamentos: txt('acabamentos'),
      vagas: num('vagas'),
      inicioObras: txt('inicioObras'),
      entregaPrevista: txt('entregaPrevista'),
    };
    if (!payload.nome || !payload.construtoraId || !payload.cidade) {
      toast.error('Nome, construtora e cidade são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      const created: any = await Api.empreendimentoCreate(payload);
      // Upload das fotos selecionadas (se houver) — usa endpoint dedicado
      if (pendingFiles.length) {
        try {
          await Api.empreendimentoFotoUpload(created.id, pendingFiles);
        } catch {
          toast.info('Empreendimento criado, mas algumas fotos falharam ao enviar.');
        }
      }
      if (pendingDocs.length) {
        try {
          await Api.empreendimentoDocUpload(created.id, pendingDocs);
        } catch {
          toast.info('Empreendimento criado, mas algum documento falhou ao enviar.');
        }
      }
      toast.success('Empreendimento cadastrado.');
      onCreated(created);
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Novo empreendimento"
      subtitle="Cadastre o produto que entra no portfólio e use as fotos pro material de venda."
      size="lg"
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button form="form-novo-emp" className="btn btn--primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Cadastrar empreendimento'}
          </button>
        </>
      }
    >
      <form id="form-novo-emp" onSubmit={submit}>
        <div className="form-grid">
          <div className="field field--span-2">
            <label className="field__label">Nome do empreendimento *</label>
            <input name="nome" className="field__input" required placeholder="Ex: Park View Itapema" />
          </div>
          <div className="field">
            <div className="field__labelrow">
              <label className="field__label">Construtora *</label>
              <button type="button" className="field__addlink" onClick={() => { setNovaConstrutora((v) => !v); setNovaNome(''); }}>
                {novaConstrutora ? 'Cancelar' : '+ nova construtora'}
              </button>
            </div>
            {novaConstrutora ? (
              <div className="field__inline">
                <input
                  className="field__input"
                  placeholder="Nome da construtora"
                  value={novaNome}
                  autoFocus
                  onChange={(e) => setNovaNome(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarConstrutora(); } }}
                />
                <button type="button" className="btn btn--primary btn--sm" onClick={adicionarConstrutora} disabled={addingConstrutora}>
                  {addingConstrutora ? '…' : 'Adicionar'}
                </button>
              </div>
            ) : (
              <select
                name="construtoraId"
                className="field__select"
                required
                value={construtoraSel}
                onChange={(e) => setConstrutoraSel(e.target.value)}
              >
                <option value="" disabled>Selecione…</option>
                {lista.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            )}
          </div>
          <div className="field">
            <label className="field__label">Status</label>
            <select name="status" className="field__select" defaultValue="PRE_LANCAMENTO">
              <option value="PRE_LANCAMENTO">Pré-lançamento</option>
              <option value="OBRA">Em obra</option>
              <option value="ENTREGUE">Entregue</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label">Cidade *</label>
            <input name="cidade" className="field__input" required placeholder="Ex: Itapema" />
          </div>
          <div className="field">
            <label className="field__label">UF</label>
            <input name="estado" className="field__input" defaultValue="SC" maxLength={2} />
          </div>
          <div className="field">
            <label className="field__label">Unidades totais</label>
            <input name="unidadesTotal" className="field__input" type="number" min={0} defaultValue={0} />
          </div>
          <div className="field">
            <label className="field__label">Unidades vendidas</label>
            <input name="unidadesVendidas" className="field__input" type="number" min={0} defaultValue={0} />
          </div>
          <div className="field field--span-2">
            <label className="field__label">Valor inicial (R$)</label>
            <input
              name="valorInicial"
              className="field__input"
              type="number"
              min={0}
              step={1000}
              placeholder="Ex: 580000"
            />
          </div>
          <div className="field field--span-2">
            <label className="field__label">Descrição</label>
            <textarea
              name="descricao"
              className="field__textarea"
              rows={3}
              placeholder="Resumo, diferenciais, plantas..."
            />
          </div>
          <div className="field field--span-2">
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input name="publicado" type="checkbox" style={{ marginTop: 3 }} />
              <span>
                <span className="field__label" style={{ margin: 0 }}>Subir no site / landing pública</span>
                <span className="text-xs text-secondary" style={{ display: 'block' }}>
                  Pré-lançamento normalmente fica desmarcado — só publica quando liberar a divulgação.
                </span>
              </span>
            </label>
          </div>
        </div>

        <hr style={{ margin: '20px 0', borderColor: 'var(--border-light)' }} />

        <div style={{ marginBottom: 12 }}>
          <p className="field__label" style={{ margin: 0 }}>Ficha do site — página do imóvel</p>
          <p className="text-xs text-secondary" style={{ margin: '2px 0 0' }}>
            Opcional. Preenchido, o site mostra descritivo, localização, lazer, tipologias e datas na ficha do empreendimento.
          </p>
        </div>
        <div className="form-grid">
          <div className="field field--span-2">
            <label className="field__label">Descritivo completo</label>
            <textarea name="descritivo" className="field__textarea" rows={4} placeholder="Texto de apresentação do empreendimento (aparece na seção 'Descritivo' do site)." />
          </div>
          <div className="field field--span-2">
            <label className="field__label">Localização estratégica</label>
            <textarea name="localizacao" className="field__textarea" rows={2} placeholder="Ex: A 250 m do mar, no eixo de maior valorização, a 12 min de Balneário Camboriú." />
          </div>
          <div className="field">
            <label className="field__label">Endereço</label>
            <input name="endereco" className="field__input" placeholder="Av. ..., nº — bairro" />
          </div>
          <div className="field">
            <label className="field__label">Bairro</label>
            <input name="bairro" className="field__input" placeholder="Ex: Perequê" />
          </div>
          <div className="field">
            <label className="field__label">Distância do mar</label>
            <input name="distanciaMar" className="field__input" placeholder="Ex: 250 m" />
          </div>
          <div className="field">
            <label className="field__label">Área de lazer (m²)</label>
            <input name="areaLazerM2" className="field__input" type="number" min={0} step={1} placeholder="Ex: 2400" />
          </div>
          <div className="field field--span-2">
            <label className="field__label">Itens de lazer (um por linha)</label>
            <textarea name="itensLazer" className="field__textarea" rows={4} placeholder={'Piscina com raia\nAcademia equipada\nEspaço gourmet\nSalão de festas\nPlayground'} />
          </div>
          <div className="field field--span-2">
            <label className="field__label">Tipologias (texto)</label>
            <input name="tipologiasTexto" className="field__input" placeholder="Ex: 2 e 3 dormitórios · suíte máster" />
          </div>
          <div className="field">
            <label className="field__label">Área mínima (m²)</label>
            <input name="areaMin" className="field__input" type="number" min={0} step={0.01} placeholder="Ex: 58" />
          </div>
          <div className="field">
            <label className="field__label">Área máxima (m²)</label>
            <input name="areaMax" className="field__input" type="number" min={0} step={0.01} placeholder="Ex: 112" />
          </div>
          <div className="field">
            <label className="field__label">Vagas</label>
            <input name="vagas" className="field__input" type="number" min={0} step={1} placeholder="Ex: 2" />
          </div>
          <div className="field field--span-2">
            <label className="field__label">Acabamentos (um por linha)</label>
            <textarea name="acabamentos" className="field__textarea" rows={3} placeholder={'Porcelanato nas áreas sociais\nBancadas em quartzo\nEsquadrias com vidro duplo'} />
          </div>
          <div className="field">
            <label className="field__label">Início das obras</label>
            <input name="inicioObras" className="field__input" placeholder="Ex: Set/2025" />
          </div>
          <div className="field">
            <label className="field__label">Entrega prevista</label>
            <input name="entregaPrevista" className="field__input" placeholder="Ex: Dez/2027" />
          </div>
        </div>

        <hr style={{ margin: '20px 0', borderColor: 'var(--border-light)' }} />

        <div>
          <label className="field__label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Fotos do empreendimento</span>
            <span className="text-xs text-secondary">{pendingFiles.length} selecionada{pendingFiles.length === 1 ? '' : 's'}</span>
          </label>
          <input
            id="emp-novo-file"
            ref={inputFileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setPendingFiles((cur) => [...cur, ...files]);
              if (inputFileRef.current) inputFileRef.current.value = '';
            }}
          />
          <label
            htmlFor="emp-novo-file"
            className="btn btn--secondary btn--sm"
            style={{
              display: 'inline-flex',
              cursor: 'pointer',
            }}
          >
            <Icon name="plus" size={14} /> Adicionar fotos
          </label>
          {pendingFiles.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginTop: 12 }}>
              {pendingFiles.map((f, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', background: 'var(--bg-card-hover)' }}>
                  <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => setPendingFiles((cur) => cur.filter((_, idx) => idx !== i))}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Remover"
                  >
                    <Icon name="x" size={11} />
                  </button>
                  {i === 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        left: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: 'var(--pons-blue)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      CAPA
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="field__hint">A primeira foto vira a capa automaticamente. Você pode trocar depois.</div>
        </div>

        <hr style={{ margin: '20px 0', borderColor: 'var(--border-light)' }} />

        <div>
          <label className="field__label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Documentos (PDF)</span>
            <span className="text-xs text-secondary">{pendingDocs.length} selecionado{pendingDocs.length === 1 ? '' : 's'}</span>
          </label>
          <input
            id="emp-novo-doc"
            ref={inputDocRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files || []).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
              setPendingDocs((cur) => [...cur, ...files]);
              if (inputDocRef.current) inputDocRef.current.value = '';
            }}
          />
          <label
            htmlFor="emp-novo-doc"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
              if (files.length) setPendingDocs((cur) => [...cur, ...files]);
            }}
            className="btn btn--secondary btn--sm"
            style={{ display: 'inline-flex', cursor: 'pointer' }}
          >
            <Icon name="paperclip" size={14} /> Adicionar PDFs (ou arraste aqui)
          </label>
          {pendingDocs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {pendingDocs.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 13 }}>
                  <Icon name="doc" size={14} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingDocs((cur) => cur.filter((_, idx) => idx !== i))}
                    className="btn btn--secondary btn--sm"
                    title="Remover"
                  >
                    <Icon name="x" size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="field__hint">Materiais do empreendimento (tabelas, book, memorial…) — os corretores poderão ver e baixar.</div>
        </div>
      </form>
    </Modal>
  );
}

// ── Form embarcado dentro do modal de gerenciar empreendimento ──
function EditarDadosEmpreendimento({
  emp,
  onSaved,
}: {
  emp: Empreendimento;
  onSaved: (atualizado: Partial<Empreendimento>) => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const txt = (k: string) => { const x = fd.get(k); const s = x ? String(x).trim() : ''; return s || null; };
      const num = (k: string) => { const x = fd.get(k); return x && String(x).trim() !== '' ? Number(x) : null; };
      const payload: Record<string, any> = {
        nome: String(fd.get('nome') || ''),
        cidade: String(fd.get('cidade') || ''),
        estado: String(fd.get('estado') || '').toUpperCase(),
        status: String(fd.get('status') || ''),
        unidadesTotal: Number(fd.get('unidadesTotal') || 0),
        unidadesVendidas: Number(fd.get('unidadesVendidas') || 0),
        descricao: fd.get('descricao') ? String(fd.get('descricao')) : null,
        // Ficha completa (layout KÓRA no site)
        descritivo: txt('descritivo'),
        endereco: txt('endereco'),
        bairro: txt('bairro'),
        localizacao: txt('localizacao'),
        distanciaMar: txt('distanciaMar'),
        areaLazerM2: num('areaLazerM2'),
        itensLazer: txt('itensLazer'),
        tipologiasTexto: txt('tipologiasTexto'),
        areaMin: num('areaMin'),
        areaMax: num('areaMax'),
        acabamentos: txt('acabamentos'),
        vagas: num('vagas'),
        inicioObras: txt('inicioObras'),
        entregaPrevista: txt('entregaPrevista'),
      };
      const v = fd.get('valorInicial');
      if (v != null && String(v).trim() !== '') payload.valorInicial = Number(v);
      const atualizado = await Api.empreendimentoUpdate(emp.id, payload);
      toast.success('Empreendimento atualizado.');
      onSaved(atualizado);
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="emp-edit-form">
      <div className="field emp-edit-form__row--full">
        <label className="field__label">Nome</label>
        <input name="nome" className="field__input" required defaultValue={emp.nome} />
      </div>
      <div className="field">
        <label className="field__label">Status</label>
        <select name="status" className="field__select" defaultValue={emp.status || 'PRE_LANCAMENTO'}>
          <option value="PRE_LANCAMENTO">Pré-lançamento</option>
          <option value="OBRA">Em obra</option>
          <option value="ENTREGUE">Entregue</option>
        </select>
      </div>
      <div className="field">
        <label className="field__label">Valor inicial (R$)</label>
        <input name="valorInicial" type="number" step="0.01" className="field__input" defaultValue={emp.valorInicial || ''} />
      </div>
      <div className="field">
        <label className="field__label">Cidade</label>
        <input name="cidade" className="field__input" required defaultValue={emp.cidade} />
      </div>
      <div className="field">
        <label className="field__label">Estado (UF)</label>
        <input name="estado" maxLength={2} className="field__input" required defaultValue={emp.estado} />
      </div>
      <div className="field">
        <label className="field__label">Unidades totais</label>
        <input name="unidadesTotal" type="number" min="0" className="field__input" defaultValue={emp.unidadesTotal ?? 0} />
      </div>
      <div className="field">
        <label className="field__label">Unidades vendidas</label>
        <input name="unidadesVendidas" type="number" min="0" className="field__input" defaultValue={emp.unidadesVendidas ?? 0} />
      </div>
      <div className="field emp-edit-form__row--full">
        <label className="field__label">Descrição</label>
        <textarea name="descricao" className="field__textarea" rows={2} defaultValue={emp.descricao || ''} />
      </div>

      <div className="emp-edit-form__row--full" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12, marginTop: 4 }}>
        <p className="field__label" style={{ margin: 0 }}>Ficha do site — página do imóvel</p>
        <p className="text-xs text-secondary" style={{ margin: '2px 0 0' }}>Descritivo, localização, lazer, tipologias e datas exibidos na ficha do empreendimento no site.</p>
      </div>
      <div className="field emp-edit-form__row--full">
        <label className="field__label">Descritivo completo</label>
        <textarea name="descritivo" className="field__textarea" rows={4} defaultValue={emp.descritivo || ''} placeholder="Texto de apresentação (seção 'Descritivo' do site)." />
      </div>
      <div className="field emp-edit-form__row--full">
        <label className="field__label">Localização estratégica</label>
        <textarea name="localizacao" className="field__textarea" rows={2} defaultValue={emp.localizacao || ''} placeholder="Ex: A 250 m do mar, a 12 min de Balneário Camboriú." />
      </div>
      <div className="field">
        <label className="field__label">Endereço</label>
        <input name="endereco" className="field__input" defaultValue={emp.endereco || ''} placeholder="Av. ..., nº — bairro" />
      </div>
      <div className="field">
        <label className="field__label">Bairro</label>
        <input name="bairro" className="field__input" defaultValue={emp.bairro || ''} placeholder="Ex: Perequê" />
      </div>
      <div className="field">
        <label className="field__label">Distância do mar</label>
        <input name="distanciaMar" className="field__input" defaultValue={emp.distanciaMar || ''} placeholder="Ex: 250 m" />
      </div>
      <div className="field">
        <label className="field__label">Área de lazer (m²)</label>
        <input name="areaLazerM2" type="number" min="0" step="1" className="field__input" defaultValue={emp.areaLazerM2 ?? ''} placeholder="Ex: 2400" />
      </div>
      <div className="field emp-edit-form__row--full">
        <label className="field__label">Itens de lazer (um por linha)</label>
        <textarea name="itensLazer" className="field__textarea" rows={4} defaultValue={emp.itensLazer || ''} placeholder={'Piscina com raia\nAcademia equipada\nEspaço gourmet'} />
      </div>
      <div className="field emp-edit-form__row--full">
        <label className="field__label">Tipologias (texto)</label>
        <input name="tipologiasTexto" className="field__input" defaultValue={emp.tipologiasTexto || ''} placeholder="Ex: 2 e 3 dormitórios · suíte máster" />
      </div>
      <div className="field">
        <label className="field__label">Área mínima (m²)</label>
        <input name="areaMin" type="number" min="0" step="0.01" className="field__input" defaultValue={emp.areaMin ?? ''} placeholder="Ex: 58" />
      </div>
      <div className="field">
        <label className="field__label">Área máxima (m²)</label>
        <input name="areaMax" type="number" min="0" step="0.01" className="field__input" defaultValue={emp.areaMax ?? ''} placeholder="Ex: 112" />
      </div>
      <div className="field">
        <label className="field__label">Vagas</label>
        <input name="vagas" type="number" min="0" step="1" className="field__input" defaultValue={emp.vagas ?? ''} placeholder="Ex: 2" />
      </div>
      <div className="field emp-edit-form__row--full">
        <label className="field__label">Acabamentos (um por linha)</label>
        <textarea name="acabamentos" className="field__textarea" rows={3} defaultValue={emp.acabamentos || ''} placeholder={'Porcelanato nas áreas sociais\nBancadas em quartzo'} />
      </div>
      <div className="field">
        <label className="field__label">Início das obras</label>
        <input name="inicioObras" className="field__input" defaultValue={emp.inicioObras || ''} placeholder="Ex: Set/2025" />
      </div>
      <div className="field">
        <label className="field__label">Entrega prevista</label>
        <input name="entregaPrevista" className="field__input" defaultValue={emp.entregaPrevista || ''} placeholder="Ex: Dez/2027" />
      </div>

      <div className="emp-edit-form__actions">
        <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar dados'}
        </button>
      </div>
    </form>
  );
}

// ── Modal: galeria + gerenciar fotos de um empreendimento existente ──
function fmtBytes(n?: number | null) {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Área de documentos PDF do empreendimento: arrastar/soltar pra subir (quem
// edita) e Ver/Baixar pra todo mundo — inclusive corretor.
function DocumentosEmpreendimento({
  empId,
  docs,
  canEdit,
  onChanged,
}: {
  empId: number;
  docs: Doc[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enviar = async (files: FileList | File[]) => {
    const todos = Array.from(files);
    const list = todos.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!list.length) { toast.error('Envie arquivos PDF.'); return; }
    if (list.length !== todos.length) toast.info('Arquivos que não são PDF foram ignorados.');
    setBusy(true);
    try {
      const r = await Api.empreendimentoDocUpload(empId, list);
      toast.success(`${r.documentos?.length || 0} documento(s) enviado(s).`);
      onChanged();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setBusy(false);
    }
  };

  const excluir = async (d: Doc) => {
    const ok = await confirm({
      title: 'Remover documento?',
      message: `"${d.nome}" será apagado permanentemente.`,
      confirmText: 'Remover',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await Api.empreendimentoDocDelete(empId, d.id);
      toast.success('Documento removido.');
      onChanged();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setBusy(false);
    }
  };

  const baixar = async (d: Doc) => {
    try {
      await Api.empreendimentoDocDownload(empId, d.id, d.nome);
    } catch {
      toast.error('Falha no download.');
    }
  };

  return (
    <div>
      {canEdit && (
        <>
          <input
            ref={inputRef}
            id={`emp-docs-file-${empId}`}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            onChange={(e) => {
              if (e.target.files?.length) enviar(e.target.files);
              if (inputRef.current) inputRef.current.value = '';
            }}
          />
          <label
            htmlFor={`emp-docs-file-${empId}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) enviar(e.dataTransfer.files); }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '22px 16px',
              border: `2px dashed ${drag ? 'var(--pons-blue)' : 'var(--border-light)'}`,
              borderRadius: 10,
              cursor: busy ? 'wait' : 'pointer',
              color: 'var(--text-secondary)',
              background: drag ? 'rgba(59,130,246,0.06)' : 'var(--bg-card-hover)',
              marginBottom: 12,
              textAlign: 'center',
              fontSize: 12.5,
              opacity: busy ? 0.6 : 1,
              pointerEvents: busy ? 'none' : 'auto',
            }}
          >
            <Icon name="paperclip" size={18} />
            <span><b>Arraste os PDFs aqui</b> ou clique pra selecionar (até 25 MB cada)</span>
          </label>
        </>
      )}
      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
          Nenhum documento ainda.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map((d) => (
            <div
              key={d.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border-light)', borderRadius: 10, background: 'var(--bg-card)' }}
            >
              <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8, background: 'rgba(220,38,38,0.1)', color: '#DC2626', flexShrink: 0 }}>
                <Icon name="doc" size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nome}</div>
                {d.tamanho ? <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmtBytes(d.tamanho)}</div> : null}
              </div>
              <button className="btn btn--secondary btn--sm" onClick={() => window.open(d.url, '_blank', 'noopener')} title="Visualizar">
                <Icon name="eye" size={13} /> Ver
              </button>
              <button className="btn btn--secondary btn--sm" onClick={() => baixar(d)} title="Baixar">
                <Icon name="doc" size={13} /> Baixar
              </button>
              {canEdit && (
                <button className="btn btn--danger btn--sm" onClick={() => excluir(d)} disabled={busy} title="Excluir">
                  <Icon name="trash" size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Modal enxuto de documentos aberto pelo card — é por aqui que o CORRETOR
// visualiza e baixa os PDFs do empreendimento.
function DocsEmpreendimentoModal({
  empreendimento,
  canEdit,
  onClose,
  onChanged,
}: {
  empreendimento: Empreendimento;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [docs, setDocs] = useState<Doc[]>(empreendimento.documentos || []);

  const refetch = async () => {
    try {
      const fresh: any = await Api.empreendimento(empreendimento.id);
      setDocs(fresh.documentos || []);
    } catch {}
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Documentos · ${empreendimento.nome}`}
      subtitle="PDFs do empreendimento — visualize e baixe."
      size="md"
      footer={<button className="btn btn--primary" onClick={onClose}>Fechar</button>}
    >
      <DocumentosEmpreendimento
        empId={empreendimento.id}
        docs={docs}
        canEdit={canEdit}
        onChanged={() => { refetch(); onChanged(); }}
      />
    </Modal>
  );
}

function GaleriaFotosModal({
  empreendimento,
  onClose,
  onChanged,
}: {
  empreendimento: Empreendimento;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [emp, setEmp] = useState<Empreendimento>(empreendimento);
  const [busy, setBusy] = useState(false);
  const [aba, setAba] = useState<'fotos' | 'docs'>('fotos');
  const inputFileRef = useRef<HTMLInputElement>(null);

  const refetch = async () => {
    try {
      const fresh: any = await Api.empreendimento(emp.id);
      setEmp({ ...fresh, construtora: fresh.construtora, fotos: fresh.fotos || [] });
    } catch {}
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fotos = emp.fotos || [];

  const handleUpload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    try {
      const data = await Api.empreendimentoFotoUpload(emp.id, list);
      toast.success(`${data.fotos?.length || 0} foto(s) enviada(s).`);
      await refetch();
      onChanged();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setBusy(false);
    }
  };

  const deleteFoto = async (foto: Foto) => {
    const ok = await confirm({
      title: 'Remover foto?',
      message: 'A foto será apagada permanentemente do R2 e do empreendimento.',
      confirmText: 'Remover',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await Api.empreendimentoFotoDelete(emp.id, foto.id);
      toast.success('Foto removida.');
      await refetch();
      onChanged();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setBusy(false);
    }
  };

  const setCapa = async (foto: Foto) => {
    setBusy(true);
    try {
      await Api.empreendimentoFotoCapa(emp.id, foto.id);
      toast.success('Capa atualizada.');
      await refetch();
      onChanged();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Deletar empreendimento?',
      message: `"${emp.nome}" será removido permanentemente, junto com suas fotos e unidades. Esta ação não pode ser desfeita.`,
      confirmText: 'Deletar',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await Api.empreendimentoDelete(emp.id);
      toast.success('Empreendimento deletado.');
      onChanged();
      onClose();
    } catch (err: any) {
      if (err?.message === 'tem_vendas') {
        const n = err?.details?.count;
        toast.error(`Não dá pra deletar: há ${n ?? ''} venda(s) vinculada(s) a este empreendimento.`);
      } else {
        toast.error('Erro: ' + (err?.message || 'falha'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Gerenciar · ${emp.nome}`}
      subtitle={`${fotos.length} foto${fotos.length === 1 ? '' : 's'} · ${(emp.documentos || []).length} documento${(emp.documentos || []).length === 1 ? '' : 's'} · status, preço e detalhes editáveis abaixo`}
      size="lg"
      footer={
        <>
          <button className="btn btn--danger" onClick={handleDelete} disabled={busy} style={{ marginRight: 'auto' }}>
            <Icon name="trash" size={14} /> Deletar empreendimento
          </button>
          <button className="btn btn--primary" onClick={onClose}>Fechar</button>
        </>
      }
    >
      <EditarDadosEmpreendimento emp={emp} onSaved={async (atualizado) => { setEmp({ ...emp, ...atualizado }); onChanged(); }} />

      <div style={{ display: 'flex', gap: 6, margin: '24px 0 12px', borderBottom: '1px solid var(--border-light)' }}>
        {([['fotos', `Fotos (${fotos.length})`], ['docs', `Documentos (${(emp.documentos || []).length})`]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            style={{
              border: 'none',
              background: 'transparent',
              font: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              padding: '8px 12px',
              cursor: 'pointer',
              color: aba === key ? 'var(--pons-blue)' : 'var(--text-secondary)',
              borderBottom: aba === key ? '2px solid var(--pons-blue)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'docs' && (
        <DocumentosEmpreendimento
          empId={emp.id}
          docs={emp.documentos || []}
          canEdit
          onChanged={() => { refetch(); onChanged(); }}
        />
      )}

      {aba === 'fotos' && (
      <>
      {/* input file invisível mas acessível por label htmlFor (funciona dentro de <dialog>) */}
      <input
        id="emp-galeria-file"
        ref={inputFileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        onChange={(e) => {
          if (e.target.files) handleUpload(e.target.files);
          if (inputFileRef.current) inputFileRef.current.value = '';
        }}
      />
      {fotos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
          Nenhuma foto ainda.
          <br />
          <label
            htmlFor="emp-galeria-file"
            className="btn btn--primary btn--sm"
            style={{ marginTop: 12, display: 'inline-flex', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            <Icon name="plus" size={14} /> Carregar fotos
          </label>
        </div>
      ) : (
        <>
          <div className="emp-fotos-grid">
            {fotos.map((f) => {
              const isCapa = emp.imagemUrl === f.url;
              return (
                <div
                  key={f.id}
                  style={{
                    position: 'relative',
                    borderRadius: 10,
                    overflow: 'hidden',
                    aspectRatio: '4/3',
                    background: 'var(--bg-card-hover)',
                    border: isCapa ? '2px solid var(--pons-blue)' : '1px solid var(--border-light)',
                  }}
                >
                  <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {isCapa && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: 'var(--pons-blue)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      CAPA
                    </span>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      padding: 6,
                      background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)',
                      opacity: 0,
                      transition: 'opacity 150ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                  >
                    {!isCapa ? (
                      <button
                        onClick={() => setCapa(f)}
                        disabled={busy}
                        style={{
                          background: 'rgba(255,255,255,0.92)',
                          color: 'var(--pons-blue)',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Definir capa
                      </button>
                    ) : <span />}
                    <button
                      onClick={() => deleteFoto(f)}
                      disabled={busy}
                      style={{
                        background: 'rgba(199, 10, 26, 0.92)',
                        color: '#fff',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Icon name="trash" size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
            {(
              <label
                htmlFor="emp-galeria-file"
                style={{
                  borderRadius: 10,
                  border: '2px dashed var(--border-light)',
                  background: 'var(--bg-card-hover)',
                  color: 'var(--text-secondary)',
                  aspectRatio: '4/3',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  opacity: busy ? 0.6 : 1,
                  pointerEvents: busy ? 'none' : 'auto',
                }}
              >
                <Icon name="plus" size={20} />
                Carregar fotos
              </label>
            )}
          </div>
        </>
      )}
      </>
      )}
    </Modal>
  );
}

// ── Construtoras: cadastro completo (parceria, políticas, história, logo) ────
type ConstrutoraFull = {
  id: number;
  nome: string;
  logoUrl?: string | null;
  cidadeSede?: string | null;
  anoFundacao?: number | null;
  entregasRealizadas?: number | null;
  unidadesEntregues?: number | null;
  site?: string | null;
  instagram?: string | null;
  historia?: string | null;
  politicasComerciais?: string | null;
  _count?: { empreendimentos?: number };
};

function ConstrutorasModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [lista, setLista] = useState<ConstrutoraFull[] | null>(null);
  const [editing, setEditing] = useState<ConstrutoraFull | 'new' | null>(null);

  const load = async () => {
    try {
      setLista(await Api.construtoras());
    } catch {
      toast.error('Falha ao carregar construtoras.');
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (editing) {
    return (
      <ConstrutoraForm
        construtora={editing === 'new' ? null : editing}
        onBack={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Construtoras parceiras"
      subtitle="Cadastre a parceria, as políticas comerciais e a história de cada construtora — a ficha aparece no site (botão 'Conhecer a construtora')."
      size="lg"
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>Fechar</button>
          <button className="btn btn--primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={14} /> Nova construtora
          </button>
        </>
      }
    >
      {!lista ? (
        <LoadingBlock />
      ) : lista.length === 0 ? (
        <p className="text-secondary">Nenhuma construtora cadastrada ainda. Clique em “Nova construtora”.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {lista.map((c) => (
            <button
              key={c.id}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer', padding: 14, width: '100%' }}
              onClick={() => setEditing(c)}
            >
              <div style={{ width: 52, height: 52, borderRadius: 10, border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: '0 0 52px', background: 'var(--bg-subtle)' }}>
                {c.logoUrl ? (
                  <img src={c.logoUrl} alt={c.nome} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{(c.nome || '?').charAt(0)}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{c.nome}</div>
                <div className="text-xs text-secondary">
                  {[
                    c.anoFundacao ? `desde ${c.anoFundacao}` : null,
                    c.entregasRealizadas ? `${c.entregasRealizadas} entregas` : null,
                    c._count?.empreendimentos ? `${c._count.empreendimentos} no portfólio` : null,
                  ].filter(Boolean).join(' · ') || 'Sem ficha institucional'}
                </div>
              </div>
              <Icon name="pencil" size={14} />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ConstrutoraForm({ construtora, onBack }: { construtora: ConstrutoraFull | null; onBack: () => void }) {
  const toast = useToast();
  const isNew = !construtora;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [data, setData] = useState<ConstrutoraFull | null>(construtora);
  const [savedId, setSavedId] = useState<number | null>(construtora?.id || null);
  const [logoUrl, setLogoUrl] = useState<string | null>(construtora?.logoUrl || null);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew || !construtora) return;
    Api.construtora(construtora.id)
      .then((c) => { setData(c); setLogoUrl(c.logoUrl || null); })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const txt = (k: string) => { const v = fd.get(k); const s = v ? String(v).trim() : ''; return s || null; };
    const num = (k: string) => { const v = fd.get(k); return v && String(v).trim() !== '' ? Number(v) : null; };
    const nome = String(fd.get('nome') || '').trim();
    if (nome.length < 2) { toast.error('Informe o nome da construtora.'); return; }
    const payload = {
      nome,
      cidadeSede: txt('cidadeSede'),
      anoFundacao: num('anoFundacao'),
      entregasRealizadas: num('entregasRealizadas'),
      unidadesEntregues: num('unidadesEntregues'),
      site: txt('site'),
      instagram: txt('instagram'),
      historia: txt('historia'),
      politicasComerciais: txt('politicasComerciais'),
    };
    setSaving(true);
    try {
      let saved: ConstrutoraFull;
      if (savedId) saved = await Api.construtoraUpdate(savedId, payload);
      else saved = await Api.construtoraCreateFull(payload);
      setSavedId(saved.id);
      setData({ ...(data || {} as ConstrutoraFull), ...saved });
      toast.success(savedId ? 'Construtora atualizada.' : 'Construtora cadastrada. Agora você pode enviar o logo.');
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  const enviarLogo = async (file: File) => {
    if (!savedId) { toast.info('Salve a construtora antes de enviar o logo.'); return; }
    setLogoBusy(true);
    try {
      const r = await Api.construtoraLogoUpload(savedId, file);
      setLogoUrl(r.logoUrl || null);
      toast.success('Logo enviado.');
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err?.message || 'falha'));
    } finally {
      setLogoBusy(false);
      if (logoRef.current) logoRef.current.value = '';
    }
  };

  return (
    <Modal
      open
      onClose={onBack}
      title={isNew ? 'Nova construtora' : `Editar ${data?.nome || construtora?.nome || ''}`}
      subtitle="Estes dados alimentam a tela “Conhecer a construtora” no site."
      size="lg"
      footer={
        <>
          <button className="btn btn--ghost" onClick={onBack} disabled={saving}>Voltar à lista</button>
          <button form="form-construtora" className="btn btn--primary" disabled={saving}>
            {saving ? 'Salvando…' : savedId ? 'Salvar alterações' : 'Cadastrar construtora'}
          </button>
        </>
      }
    >
      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
            <div style={{ width: 76, height: 76, borderRadius: 12, border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: '0 0 76px', background: 'var(--bg-subtle)' }}>
              {logoUrl ? (
                <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Icon name="building" size={26} />
              )}
            </div>
            <div>
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                id="construtora-logo-file"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarLogo(f); }}
              />
              <label htmlFor="construtora-logo-file" className={`btn btn--secondary btn--sm${!savedId || logoBusy ? ' is-disabled' : ''}`} style={!savedId || logoBusy ? { pointerEvents: 'none', opacity: 0.55 } : undefined}>
                {logoBusy ? 'Enviando…' : logoUrl ? 'Trocar logo' : 'Enviar logo'}
              </label>
              <p className="text-xs text-secondary" style={{ margin: '6px 0 0' }}>
                {savedId ? 'PNG/JPG. Ideal fundo transparente.' : 'Salve a construtora para habilitar o envio do logo.'}
              </p>
            </div>
          </div>

          <form id="form-construtora" onSubmit={submit}>
            <div className="form-grid">
              <div className="field field--span-2">
                <label className="field__label">Nome da construtora *</label>
                <input name="nome" className="field__input" required defaultValue={data?.nome || ''} placeholder="Ex: MAXCES Incorporações" />
              </div>
              <div className="field">
                <label className="field__label">Cidade sede</label>
                <input name="cidadeSede" className="field__input" defaultValue={data?.cidadeSede || ''} placeholder="Ex: Balneário Camboriú/SC" />
              </div>
              <div className="field">
                <label className="field__label">Ano de fundação</label>
                <input name="anoFundacao" type="number" min="1900" max="2100" className="field__input" defaultValue={data?.anoFundacao ?? ''} placeholder="Ex: 2007" />
              </div>
              <div className="field">
                <label className="field__label">Entregas realizadas</label>
                <input name="entregasRealizadas" type="number" min="0" className="field__input" defaultValue={data?.entregasRealizadas ?? ''} placeholder="Ex: 32" />
              </div>
              <div className="field">
                <label className="field__label">Unidades entregues</label>
                <input name="unidadesEntregues" type="number" min="0" className="field__input" defaultValue={data?.unidadesEntregues ?? ''} placeholder="Ex: 2100" />
              </div>
              <div className="field">
                <label className="field__label">Site</label>
                <input name="site" className="field__input" defaultValue={data?.site || ''} placeholder="www.construtora.com.br" />
              </div>
              <div className="field">
                <label className="field__label">Instagram</label>
                <input name="instagram" className="field__input" defaultValue={data?.instagram || ''} placeholder="@construtora" />
              </div>
              <div className="field field--span-2">
                <label className="field__label">História da construtora</label>
                <textarea name="historia" className="field__textarea" rows={5} defaultValue={data?.historia || ''} placeholder="Trajetória, tempo de mercado, diferenciais e reputação. Aparece na tela 'Conhecer a construtora' no site." />
              </div>
              <div className="field field--span-2">
                <label className="field__label">Parceria e políticas comerciais (interno)</label>
                <textarea name="politicasComerciais" className="field__textarea" rows={5} defaultValue={data?.politicasComerciais || ''} placeholder="Condições da parceria, comissionamento, tabelas, prazos, reservas, regras de repasse. Uso interno — não vai para o site." />
              </div>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
