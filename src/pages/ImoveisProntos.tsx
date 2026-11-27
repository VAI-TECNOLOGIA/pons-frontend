// Imóveis prontos agenciados pelos corretores (pedido da Jú Beal, 27/11/2026).
// Substitui o grupo de agenciamento do WhatsApp: cadastro com fotos e filtros.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/EmptyState';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { formatCurrency } from '../lib/format';

import './imoveis-prontos.css';

type Foto = { id: number; url: string; ordem: number };
type Imovel = {
  id: number;
  agenciadorId: number;
  tipo: string;
  titulo: string;
  condominio: string | null;
  unidade: string | null;
  cidade: string;
  bairro: string | null;
  referencia: string | null;
  dormitorios: number | null;
  suites: number | null;
  vagas: number | null;
  vagaCoberta: boolean;
  areaPrivativa: number | null;
  mobilia: string;
  lazer: string | null;
  valor: number | null;
  estudaProposta: boolean;
  descricao: string | null;
  status: string;
  createdAt: string;
  agenciador: { id: number; name: string; phone: string | null; avatarUrl: string | null };
  fotos: Foto[];
  capaUrl: string | null;
  podeEditar: boolean;
};

const TIPOS: Record<string, string> = {
  APARTAMENTO: 'Apartamento',
  CASA: 'Casa',
  COBERTURA: 'Cobertura',
  TERRENO: 'Terreno',
  SALA_COMERCIAL: 'Sala comercial',
  OUTRO: 'Outro',
};
const MOBILIAS: Record<string, string> = { SEM: 'Sem mobília', SEMI: 'Semi mobiliado', MOBILIADO: 'Mobiliado' };
const STATUS: Record<string, [string, string]> = {
  DISPONIVEL: ['success', 'Disponível'],
  RESERVADO: ['warning', 'Reservado'],
  VENDIDO: ['neutral', 'Vendido'],
};
const LAZER_OPCOES = [
  'Piscina', 'Academia', 'Salão de festas', 'Espaço gourmet', 'Churrasqueira', 'Playground',
  'Brinquedoteca', 'Sauna', 'Quadra', 'Salão de jogos', 'Cinema', 'Coworking', 'Pet place', 'Bicicletário',
];
const MAX_FOTOS = 20;

const FILTRO_INICIAL = {
  q: '', cidade: '', bairro: '', tipo: '', dormMin: '', suitesMin: '', vagasMin: '',
  valorMin: '', valorMax: '', mobilia: '', estudaProposta: '', agenciadorId: '', status: '', meus: '', ordem: 'recentes',
};
type Filtro = typeof FILTRO_INICIAL;

function linkWhatsApp(phone: string | null, texto: string) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

function resumoNumeros(i: Imovel) {
  const partes: string[] = [];
  if (i.dormitorios != null) partes.push(`${i.dormitorios} dorm.`);
  if (i.suites) partes.push(`${i.suites} suíte${i.suites > 1 ? 's' : ''}`);
  if (i.vagas != null) partes.push(`${i.vagas} vaga${i.vagas === 1 ? '' : 's'}${i.vagas && i.vagaCoberta ? ' coberta' + (i.vagas > 1 ? 's' : '') : ''}`);
  if (i.areaPrivativa) partes.push(`${i.areaPrivativa.toLocaleString('pt-BR')} m²`);
  return partes;
}

function local(i: Imovel) {
  return [i.bairro, i.cidade].filter(Boolean).join(', ');
}

export default function ImoveisProntos() {
  const [params, setParams] = useSearchParams();
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_INICIAL);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const { data: itens, loading, error, reload } = useApi<Imovel[]>(() => Api.imoveisProntos(filtro), [JSON.stringify(filtro)]);
  const { data: opcoes, reload: reloadOpcoes } = useApi(() => Api.imoveisProntosOpcoes());
  const [detalhe, setDetalhe] = useState<Imovel | null>(null);
  const [form, setForm] = useState<{ imovel: Imovel | null } | null>(null);

  // Link do aviso no sino: /imoveis-prontos?id=123 abre o imóvel.
  useEffect(() => {
    const id = Number(params.get('id'));
    if (!id) return;
    Api.imovelPronto(id).then(setDetalhe).catch(() => {});
    params.delete('id');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof Filtro, v: string) => setFiltro((f) => ({ ...f, [k]: v }));
  const ativos = Object.entries(filtro).filter(([k, v]) => k !== 'ordem' && v !== '').length;
  const recarregar = () => { reload(); reloadOpcoes(); };

  return (
    <>
      <Topbar
        title="Imóveis prontos"
        right={
          <button className="btn btn--primary btn--sm" onClick={() => setForm({ imovel: null })}>
            <Icon name="plus" size={14} /> Cadastrar imóvel
          </button>
        }
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Comercial · Imóveis prontos"
          title="Imóveis prontos da equipe"
          subtitle="Imóveis agenciados pelos corretores do Grupo Pons. Procure com os filtros e fale direto com quem agenciou."
        />

        <div className="ip-busca">
          <div className="ip-busca__linha">
            <div className="ip-busca__campo">
              <Icon name="search" size={16} />
              <input
                className="field__input"
                placeholder="Buscar por prédio, bairro, referência..."
                value={filtro.q}
                onChange={(e) => set('q', e.target.value)}
              />
            </div>
            <button className="btn btn--secondary ip-busca__toggle" onClick={() => setFiltrosAbertos((v) => !v)}>
              <Icon name="settings" size={14} /> Filtros{ativos ? ` (${ativos})` : ''}
            </button>
          </div>

          <div className={`ip-filtros${filtrosAbertos ? ' ip-filtros--aberto' : ''}`}>
            <select className="field__select" value={filtro.cidade} onChange={(e) => set('cidade', e.target.value)} aria-label="Cidade">
              <option value="">Todas as cidades</option>
              {opcoes?.cidades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="field__select" value={filtro.bairro} onChange={(e) => set('bairro', e.target.value)} aria-label="Bairro">
              <option value="">Todos os bairros</option>
              {opcoes?.bairros.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="field__select" value={filtro.tipo} onChange={(e) => set('tipo', e.target.value)} aria-label="Tipo">
              <option value="">Todos os tipos</option>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="field__select" value={filtro.dormMin} onChange={(e) => set('dormMin', e.target.value)} aria-label="Dormitórios">
              <option value="">Dormitórios</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+ dormitórios</option>)}
            </select>
            <select className="field__select" value={filtro.suitesMin} onChange={(e) => set('suitesMin', e.target.value)} aria-label="Suítes">
              <option value="">Suítes</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+ suíte{n > 1 ? 's' : ''}</option>)}
            </select>
            <select className="field__select" value={filtro.vagasMin} onChange={(e) => set('vagasMin', e.target.value)} aria-label="Vagas">
              <option value="">Vagas</option>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}+ vaga{n > 1 ? 's' : ''}</option>)}
            </select>
            <input className="field__input" type="number" inputMode="numeric" min={0} placeholder="Valor de (R$)" value={filtro.valorMin} onChange={(e) => set('valorMin', e.target.value)} aria-label="Valor mínimo" />
            <input className="field__input" type="number" inputMode="numeric" min={0} placeholder="Valor até (R$)" value={filtro.valorMax} onChange={(e) => set('valorMax', e.target.value)} aria-label="Valor máximo" />
            <select className="field__select" value={filtro.mobilia} onChange={(e) => set('mobilia', e.target.value)} aria-label="Mobília">
              <option value="">Mobília</option>
              {Object.entries(MOBILIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="field__select" value={filtro.agenciadorId} onChange={(e) => set('agenciadorId', e.target.value)} aria-label="Agenciador">
              <option value="">Todos os agenciadores</option>
              {opcoes?.agenciadores.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select className="field__select" value={filtro.status} onChange={(e) => set('status', e.target.value)} aria-label="Situação">
              <option value="">Disponíveis e reservados</option>
              <option value="DISPONIVEL">Só disponíveis</option>
              <option value="VENDIDO">Vendidos</option>
              <option value="TODOS">Todos</option>
            </select>
            <select className="field__select" value={filtro.ordem} onChange={(e) => set('ordem', e.target.value)} aria-label="Ordem">
              <option value="recentes">Mais recentes</option>
              <option value="menor_valor">Menor valor</option>
              <option value="maior_valor">Maior valor</option>
            </select>
            <label className="ip-check">
              <input type="checkbox" checked={filtro.estudaProposta === '1'} onChange={(e) => set('estudaProposta', e.target.checked ? '1' : '')} />
              Estuda proposta
            </label>
            <label className="ip-check">
              <input type="checkbox" checked={filtro.meus === '1'} onChange={(e) => set('meus', e.target.checked ? '1' : '')} />
              Só os meus
            </label>
            {ativos > 0 && (
              <button className="btn btn--ghost btn--sm" onClick={() => setFiltro(FILTRO_INICIAL)}>Limpar filtros</button>
            )}
          </div>
        </div>

        {loading && !itens ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock error={error} />
        ) : !itens?.length ? (
          ativos ? (
            <EmptyState icon="search" title="Nenhum imóvel com esses filtros" description="Tente tirar algum filtro." action={{ label: 'Limpar filtros', onClick: () => setFiltro(FILTRO_INICIAL) }} />
          ) : (
            <EmptyState icon="building" title="Nenhum imóvel pronto cadastrado ainda" description="Cadastre o primeiro imóvel que você agenciou. Ele fica disponível para toda a equipe." action={{ label: 'Cadastrar imóvel', onClick: () => setForm({ imovel: null }) }} />
          )
        ) : (
          <>
            <div className="ip-total">{itens.length} {itens.length === 1 ? 'imóvel' : 'imóveis'}</div>
            <div className="ip-grid">
              {itens.map((i) => <CardImovel key={i.id} imovel={i} onAbrir={() => setDetalhe(i)} />)}
            </div>
          </>
        )}
      </div>

      {detalhe && (
        <DetalheModal
          imovel={detalhe}
          onClose={() => setDetalhe(null)}
          onEditar={() => { setForm({ imovel: detalhe }); setDetalhe(null); }}
          onMudou={(novo) => { if (novo) setDetalhe(novo); else setDetalhe(null); recarregar(); }}
        />
      )}

      {form && (
        <FormModal
          imovel={form.imovel}
          onClose={() => setForm(null)}
          onSalvo={(salvo) => { setForm(null); recarregar(); setDetalhe(salvo); }}
        />
      )}
    </>
  );
}

function CardImovel({ imovel: i, onAbrir }: { imovel: Imovel; onAbrir: () => void }) {
  const [cls, label] = STATUS[i.status] || ['neutral', i.status];
  return (
    <button type="button" className="ip-card" onClick={onAbrir}>
      <div className="ip-card__capa" style={i.capaUrl ? { backgroundImage: `url(${i.capaUrl})` } : undefined}>
        {!i.capaUrl && <Icon name="building" size={32} />}
        <span className={`badge badge--${cls} ip-card__status`}>{label}</span>
        {i.fotos.length > 1 && <span className="ip-card__nfotos">{i.fotos.length} fotos</span>}
      </div>
      <div className="ip-card__corpo">
        <div className="ip-card__tipo">{TIPOS[i.tipo] || i.tipo}</div>
        <div className="ip-card__titulo">{i.titulo}</div>
        <div className="ip-card__local">{local(i)}{i.referencia ? ` · ${i.referencia}` : ''}</div>
        <div className="ip-card__numeros">
          {resumoNumeros(i).map((p) => <span key={p}>{p}</span>)}
        </div>
        <div className="ip-card__rodape">
          <div>
            <div className="ip-card__valor">{i.valor ? formatCurrency(i.valor) : 'Valor a consultar'}</div>
            {i.estudaProposta && <div className="ip-card__proposta">Estuda proposta</div>}
          </div>
          <div className="ip-card__agenciador" title="Agenciador">{i.agenciador?.name}</div>
        </div>
      </div>
    </button>
  );
}

function DetalheModal({ imovel: i, onClose, onEditar, onMudou }: {
  imovel: Imovel;
  onClose: () => void;
  onEditar: () => void;
  onMudou: (novo: Imovel | null) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [fotoAtual, setFotoAtual] = useState(0);
  const [busy, setBusy] = useState(false);
  const foto = i.fotos[fotoAtual] || i.fotos[0];
  const wa = linkWhatsApp(i.agenciador?.phone, `Olá, ${i.agenciador?.name?.split(' ')[0] || ''}! Vi no sistema o imóvel "${i.titulo}". Ele ainda está disponível?`);
  const lazer = (i.lazer || '').split(',').map((s) => s.trim()).filter(Boolean);

  const mudarStatus = async (status: string) => {
    setBusy(true);
    try {
      const novo = await Api.imovelProntoUpdate(i.id, { status });
      toast.success(`Situação alterada para ${STATUS[status]?.[1] || status}.`);
      onMudou(novo);
    } catch {
      toast.error('Não foi possível alterar a situação.');
    } finally { setBusy(false); }
  };

  const excluir = async () => {
    const ok = await confirm({ title: 'Excluir imóvel', message: `Excluir "${i.titulo}" e as fotos dele? Isso não pode ser desfeito.`, confirmText: 'Excluir', tone: 'danger' });
    if (!ok) return;
    setBusy(true);
    try {
      await Api.imovelProntoDelete(i.id);
      toast.success('Imóvel excluído.');
      onMudou(null);
    } catch {
      toast.error('Não foi possível excluir.');
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={i.titulo} subtitle={`${TIPOS[i.tipo] || i.tipo} · ${local(i)}`} size="lg">
      <div className="ip-det">
        <div className="ip-det__galeria">
          {foto ? (
            <img src={foto.url} alt={i.titulo} className="ip-det__foto" />
          ) : (
            <div className="ip-det__semfoto"><Icon name="building" size={40} /><span>Sem fotos</span></div>
          )}
          {i.fotos.length > 1 && (
            <div className="ip-det__miniaturas">
              {i.fotos.map((f, idx) => (
                <button key={f.id} type="button" className={`ip-det__mini${idx === fotoAtual ? ' ip-det__mini--ativa' : ''}`} onClick={() => setFotoAtual(idx)} aria-label={`Foto ${idx + 1}`}>
                  <img src={f.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ip-det__info">
          <div className="ip-det__valor">
            {i.valor ? formatCurrency(i.valor) : 'Valor a consultar'}
            {i.estudaProposta && <span className="badge badge--info">Estuda proposta</span>}
            <span className={`badge badge--${STATUS[i.status]?.[0] || 'neutral'}`}>{STATUS[i.status]?.[1] || i.status}</span>
          </div>

          <dl className="ip-det__lista">
            {i.condominio && <><dt>Prédio / condomínio</dt><dd>{i.condominio}{i.unidade ? ` · unidade ${i.unidade}` : ''}</dd></>}
            {!i.condominio && i.unidade && <><dt>Unidade</dt><dd>{i.unidade}</dd></>}
            <dt>Localização</dt><dd>{local(i)}{i.referencia ? ` · ${i.referencia}` : ''}</dd>
            {i.dormitorios != null && <><dt>Dormitórios</dt><dd>{i.dormitorios}{i.suites ? ` (${i.suites} suíte${i.suites > 1 ? 's' : ''})` : ''}</dd></>}
            {i.vagas != null && <><dt>Vagas</dt><dd>{i.vagas}{i.vagas > 0 && i.vagaCoberta ? ' coberta' + (i.vagas > 1 ? 's' : '') : ''}</dd></>}
            {i.areaPrivativa != null && <><dt>Área privativa</dt><dd>{i.areaPrivativa.toLocaleString('pt-BR')} m²</dd></>}
            <dt>Mobília</dt><dd>{MOBILIAS[i.mobilia] || i.mobilia}</dd>
          </dl>

          {lazer.length > 0 && (
            <div className="ip-det__bloco">
              <div className="ip-det__rotulo">Área de lazer</div>
              <div className="ip-det__tags">{lazer.map((l) => <span key={l} className="ip-tag">{l}</span>)}</div>
            </div>
          )}

          {i.descricao && (
            <div className="ip-det__bloco">
              <div className="ip-det__rotulo">Descrição</div>
              <p className="ip-det__descricao">{i.descricao}</p>
            </div>
          )}

          <div className="ip-det__agenciador">
            <div>
              <div className="ip-det__rotulo">Agenciador</div>
              <div className="ip-det__nome">{i.agenciador?.name}</div>
            </div>
            {wa ? (
              <a className="btn btn--primary btn--sm" href={wa} target="_blank" rel="noopener noreferrer">
                <Icon name="whatsapp" size={14} /> Falar com o agenciador
              </a>
            ) : (
              <span className="text-secondary text-sm">Sem telefone no cadastro</span>
            )}
          </div>

          {i.podeEditar && (
            <div className="ip-det__acoes">
              <select className="field__select" value={i.status} disabled={busy} onChange={(e) => mudarStatus(e.target.value)} aria-label="Situação">
                {Object.entries(STATUS).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <button className="btn btn--secondary btn--sm" onClick={onEditar} disabled={busy}>
                <Icon name="pencil" size={13} /> Editar
              </button>
              <button className="btn btn--ghost btn--sm ip-det__excluir" onClick={excluir} disabled={busy}>
                <Icon name="trash" size={13} /> Excluir
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

const numOuVazio = (v: number | null | undefined) => (v == null ? '' : String(v));

function FormModal({ imovel, onClose, onSalvo }: {
  imovel: Imovel | null;
  onClose: () => void;
  onSalvo: (salvo: Imovel) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const editando = !!imovel;
  const [v, setV] = useState(() => ({
    tipo: imovel?.tipo || 'APARTAMENTO',
    titulo: imovel?.titulo || '',
    condominio: imovel?.condominio || '',
    unidade: imovel?.unidade || '',
    cidade: imovel?.cidade || '',
    bairro: imovel?.bairro || '',
    referencia: imovel?.referencia || '',
    dormitorios: numOuVazio(imovel?.dormitorios),
    suites: numOuVazio(imovel?.suites),
    vagas: numOuVazio(imovel?.vagas),
    vagaCoberta: imovel?.vagaCoberta || false,
    areaPrivativa: numOuVazio(imovel?.areaPrivativa),
    mobilia: imovel?.mobilia || 'SEM',
    valor: numOuVazio(imovel?.valor),
    estudaProposta: imovel?.estudaProposta || false,
    descricao: imovel?.descricao || '',
    status: imovel?.status || 'DISPONIVEL',
  }));
  const lazerInicial = useMemo(() => (imovel?.lazer || '').split(',').map((s) => s.trim()).filter(Boolean), [imovel]);
  const [lazer, setLazer] = useState<string[]>(lazerInicial.filter((l) => LAZER_OPCOES.includes(l)));
  const [lazerOutros, setLazerOutros] = useState(lazerInicial.filter((l) => !LAZER_OPCOES.includes(l)).join(', '));
  const [fotosAtuais, setFotosAtuais] = useState<Foto[]>(imovel?.fotos || []);
  const [novas, setNovas] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const inputFotos = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => novas.map((f) => URL.createObjectURL(f)), [novas]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const set = (k: keyof typeof v, val: any) => setV((s) => ({ ...s, [k]: val }));
  const vagasFotos = MAX_FOTOS - fotosAtuais.length - novas.length;

  const escolherFotos = (files: FileList | null) => {
    const imgs = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (imgs.length > vagasFotos) toast.error(`Cabem mais ${Math.max(0, vagasFotos)} fotos (limite de ${MAX_FOTOS}).`);
    setNovas((n) => [...n, ...imgs.slice(0, Math.max(0, vagasFotos))]);
    if (inputFotos.current) inputFotos.current.value = '';
  };

  const removerFotoAtual = async (f: Foto) => {
    if (!imovel) return;
    const ok = await confirm({ title: 'Remover foto', message: 'Remover esta foto do imóvel?', confirmText: 'Remover', tone: 'danger' });
    if (!ok) return;
    try {
      await Api.imovelProntoFotoDelete(imovel.id, f.id);
      setFotosAtuais((l) => l.filter((x) => x.id !== f.id));
    } catch { toast.error('Não foi possível remover a foto.'); }
  };

  const tornarCapa = async (f: Foto) => {
    if (!imovel) return;
    try {
      await Api.imovelProntoFotoCapa(imovel.id, f.id);
      setFotosAtuais((l) => [f, ...l.filter((x) => x.id !== f.id)]);
    } catch { toast.error('Não foi possível trocar a capa.'); }
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.titulo.trim() || !v.cidade.trim()) { toast.error('Preencha o título e a cidade.'); return; }
    const lazerFinal = [...lazer, ...lazerOutros.split(',').map((s) => s.trim()).filter(Boolean)].join(', ');
    const payload = { ...v, lazer: lazerFinal };
    setSalvando(true);
    try {
      let salvo: Imovel = editando
        ? await Api.imovelProntoUpdate(imovel!.id, payload)
        : await Api.imovelProntoCreate(payload);
      if (novas.length) {
        try {
          await Api.imovelProntoFotoUpload(salvo.id, novas);
        } catch (err: any) {
          toast.error(err?.message || 'O imóvel foi salvo, mas as fotos não subiram. Tente de novo em Editar.');
        }
        salvo = await Api.imovelPronto(salvo.id);
      }
      toast.success(editando ? 'Imóvel atualizado.' : 'Imóvel cadastrado. A equipe foi avisada.');
      onSalvo(salvo);
    } catch (err: any) {
      toast.error(err?.message?.includes('dados_invalidos') ? 'Confira os campos preenchidos.' : 'Não foi possível salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editando ? 'Editar imóvel pronto' : 'Cadastrar imóvel pronto'}
      subtitle={editando ? undefined : 'Você fica como agenciador deste imóvel.'}
      size="lg"
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button form="form-imovel-pronto" className="btn btn--primary" disabled={salvando}>
            {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Cadastrar'}
          </button>
        </>
      }
    >
      <form id="form-imovel-pronto" onSubmit={salvar}>
        <div className="form-grid">
          <div className="field">
            <label className="field__label">Tipo *</label>
            <select className="field__select" value={v.tipo} onChange={(e) => set('tipo', e.target.value)}>
              {Object.entries(TIPOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Situação</label>
            <select className="field__select" value={v.status} onChange={(e) => set('status', e.target.value)}>
              {Object.entries(STATUS).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="field field--span-2">
            <label className="field__label">Título do anúncio *</label>
            <input className="field__input" value={v.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex.: Apartamento 1206 - Green Park" required maxLength={140} />
          </div>
          <div className="field">
            <label className="field__label">Prédio / condomínio</label>
            <input className="field__input" value={v.condominio} onChange={(e) => set('condominio', e.target.value)} placeholder="Ex.: Green Park" maxLength={120} />
          </div>
          <div className="field">
            <label className="field__label">Unidade</label>
            <input className="field__input" value={v.unidade} onChange={(e) => set('unidade', e.target.value)} placeholder="Ex.: 1206" maxLength={40} />
          </div>
          <div className="field">
            <label className="field__label">Cidade *</label>
            <input className="field__input" value={v.cidade} onChange={(e) => set('cidade', e.target.value)} placeholder="Ex.: Itapema" required maxLength={80} />
          </div>
          <div className="field">
            <label className="field__label">Bairro</label>
            <input className="field__input" value={v.bairro} onChange={(e) => set('bairro', e.target.value)} placeholder="Ex.: Meia Praia" maxLength={80} />
          </div>
          <div className="field field--span-2">
            <label className="field__label">Referência</label>
            <input className="field__input" value={v.referencia} onChange={(e) => set('referencia', e.target.value)} placeholder="Ex.: Frente BR 101" maxLength={140} />
          </div>
          <div className="field">
            <label className="field__label">Dormitórios</label>
            <input className="field__input" type="number" inputMode="numeric" min={0} max={20} value={v.dormitorios} onChange={(e) => set('dormitorios', e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Suítes</label>
            <input className="field__input" type="number" inputMode="numeric" min={0} max={20} value={v.suites} onChange={(e) => set('suites', e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Vagas de garagem</label>
            <input className="field__input" type="number" inputMode="numeric" min={0} max={20} value={v.vagas} onChange={(e) => set('vagas', e.target.value)} />
            <label className="ip-check ip-check--campo">
              <input type="checkbox" checked={v.vagaCoberta} onChange={(e) => set('vagaCoberta', e.target.checked)} /> Coberta
            </label>
          </div>
          <div className="field">
            <label className="field__label">Área privativa (m²)</label>
            <input className="field__input" type="number" inputMode="decimal" min={0} step="0.01" value={v.areaPrivativa} onChange={(e) => set('areaPrivativa', e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Mobília</label>
            <select className="field__select" value={v.mobilia} onChange={(e) => set('mobilia', e.target.value)}>
              {Object.entries(MOBILIAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Valor (R$)</label>
            <input className="field__input" type="number" inputMode="numeric" min={0} step={1000} value={v.valor} onChange={(e) => set('valor', e.target.value)} placeholder="Ex.: 780000" />
            <label className="ip-check ip-check--campo">
              <input type="checkbox" checked={v.estudaProposta} onChange={(e) => set('estudaProposta', e.target.checked)} /> Estuda proposta
            </label>
          </div>
          <div className="field field--span-2">
            <label className="field__label">Área de lazer</label>
            <div className="ip-lazer">
              {LAZER_OPCOES.map((l) => (
                <label key={l} className={`ip-lazer__item${lazer.includes(l) ? ' ip-lazer__item--on' : ''}`}>
                  <input type="checkbox" checked={lazer.includes(l)} onChange={(e) => setLazer((s) => (e.target.checked ? [...s, l] : s.filter((x) => x !== l)))} />
                  {l}
                </label>
              ))}
            </div>
            <input className="field__input" style={{ marginTop: 8 }} value={lazerOutros} onChange={(e) => setLazerOutros(e.target.value)} placeholder="Outros itens, separados por vírgula" maxLength={300} />
          </div>
          <div className="field field--span-2">
            <label className="field__label">Descrição</label>
            <textarea className="field__textarea" rows={4} value={v.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Diferenciais, andar, vista, condições..." maxLength={4000} />
          </div>
          <div className="field field--span-2">
            <label className="field__label">Fotos ({fotosAtuais.length + novas.length} de {MAX_FOTOS}) · a primeira é a capa</label>
            <div className="ip-fotos">
              {fotosAtuais.map((f, idx) => (
                <div key={f.id} className="ip-fotos__item">
                  <img src={f.url} alt="" />
                  {idx === 0 ? <span className="ip-fotos__capa">Capa</span> : (
                    <button type="button" className="ip-fotos__btn ip-fotos__btn--capa" onClick={() => tornarCapa(f)}>Usar como capa</button>
                  )}
                  <button type="button" className="ip-fotos__btn ip-fotos__btn--x" onClick={() => removerFotoAtual(f)} aria-label="Remover foto"><Icon name="x" size={12} /></button>
                </div>
              ))}
              {previews.map((u, idx) => (
                <div key={u} className="ip-fotos__item">
                  <img src={u} alt="" />
                  {fotosAtuais.length === 0 && idx === 0 && <span className="ip-fotos__capa">Capa</span>}
                  <button type="button" className="ip-fotos__btn ip-fotos__btn--x" onClick={() => setNovas((n) => n.filter((_, j) => j !== idx))} aria-label="Tirar foto"><Icon name="x" size={12} /></button>
                </div>
              ))}
              {vagasFotos > 0 && (
                <button type="button" className="ip-fotos__add" onClick={() => inputFotos.current?.click()}>
                  <Icon name="plus" size={18} />
                  <span>Adicionar fotos</span>
                </button>
              )}
            </div>
            <input ref={inputFotos} type="file" accept="image/*" multiple hidden onChange={(e) => escolherFotos(e.target.files)} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
