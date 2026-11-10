import { useEffect, useMemo, useRef, useState } from 'react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { Modal } from '../../components/Modal';

const ETAPAS_CRM = ['NOVO', 'NAO_RESPONDE', 'LISTA_VIP', 'EM_ATENDIMENTO', 'FLUXO', 'PAROU_RESPONDER', 'POS_FLUXO', 'VISITA', 'NEGOCIANDO', 'FECHADO', 'PERDIDO'];
const ROT_ETAPA: Record<string, string> = { NOVO: 'Novo', NAO_RESPONDE: 'Não responde', LISTA_VIP: 'Lista VIP', EM_ATENDIMENTO: 'Em atendimento', FLUXO: 'Fluxo', PAROU_RESPONDER: 'Parou de responder', POS_FLUXO: 'Pós-fluxo', VISITA: 'Visita', NEGOCIANDO: 'Negociando', FECHADO: 'Fechado', PERDIDO: 'Perdido' };
const n = (v: any) => (Number(v) || 0).toLocaleString('pt-BR');

export function PublicoTab() {
  const toast = useToast();
  const [op, setOp] = useState<any>({ listas: [], bases: [], bolsoes: [], empreendimentos: [], equipes: [], unidades: [], tags: [], corretores: [] });
  const [f, setF] = useState<any>({});
  const [prev, setPrev] = useState<{ total: number; amostra: any[] } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [acao, setAcao] = useState<null | 'lista' | 'tag' | 'exterior'>(null);
  const [nomeLista, setNomeLista] = useState('');
  const [tagSel, setTagSel] = useState('');
  const [tagRemover, setTagRemover] = useState(false);
  const [importar, setImportar] = useState(false);
  const [novaTag, setNovaTag] = useState('');
  const [busy, setBusy] = useState(false);

  const carregarOpcoes = () => Api.centralOpcoes().then(setOp).catch(() => {});
  useEffect(() => { carregarOpcoes(); }, []);

  const filtro = useMemo(() => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null && v !== false)), [f]);
  useEffect(() => {
    setCarregando(true);
    const t = setTimeout(() => {
      Api.centralPublicoPreview(filtro).then(setPrev).catch(() => setPrev(null)).finally(() => setCarregando(false));
    }, 400);
    return () => clearTimeout(t);
  }, [filtro]);

  const set = (k: string, v: any) => setF((cur: any) => ({ ...cur, [k]: v }));
  const sel = (k: string, label: string, opcoes: { v: any; l: string }[], vazio = 'Todos') => (
    <div className="field"><label className="field__label">{label}</label>
      <select className="field__select" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)}>
        <option value="">{vazio}</option>
        {opcoes.map((o) => <option key={String(o.v)} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );

  const executar = async () => {
    setBusy(true);
    try {
      if (acao === 'lista') {
        if (!nomeLista.trim()) { toast.error('Dê um nome para a lista.'); return; }
        const l = await Api.centralListaDoFiltro(nomeLista.trim(), filtro);
        toast.success(`Lista "${l.nome}" salva com ${n(l.total)} leads. Use na campanha.`);
      } else if (acao === 'tag') {
        if (!tagSel) { toast.error('Escolha a tag.'); return; }
        const r = await Api.centralPublicoMarcar({ filtro, tag: tagSel, remover: tagRemover });
        toast.success(`${tagRemover ? 'Tag tirada de' : 'Tag aplicada em'} ${n(r.alterados)} leads.`);
      } else if (acao === 'exterior') {
        const r = await Api.centralPublicoMarcar({ filtro, moraExterior: true });
        toast.success(`${n(r.alterados)} leads marcados como "mora no exterior".`);
      }
      setAcao(null); setNomeLista(''); carregarOpcoes();
      setF((cur: any) => ({ ...cur }));
    } catch (e: any) { toast.error(e?.message || 'Não consegui concluir.'); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="cc-card" style={{ marginBottom: 16 }}>
        <div className="cc-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Quem recebe</h3>
          <div className="cc-row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setF({})}>Limpar filtros</button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setImportar(true)}>Importar base (planilha)</button>
          </div>
        </div>
        <div className="cc-filtros">
          <div className="field"><label className="field__label">Nome ou telefone</label><input className="field__input" style={{ fontSize: 16 }} value={f.busca || ''} onChange={(e) => set('busca', e.target.value)} placeholder="Buscar" /></div>
          {sel('listaId', 'Lista ou base importada', op.listas.map((l: any) => ({ v: l.id, l: `${l.nome} (${n(l.total)})` })), 'Toda a base')}
          {sel('tags', 'Tag', op.tags.map((t: any) => ({ v: t.nome, l: t.nome })))}
          {sel('classificacao', 'Etiqueta', ['NOVO', 'FRIO', 'MORNO', 'QUENTE'].map((x) => ({ v: x, l: x[0] + x.slice(1).toLowerCase() })))}
          {sel('status', 'Etapa no CRM', ETAPAS_CRM.map((x) => ({ v: x, l: ROT_ETAPA[x] })))}
          {sel('corretorId', 'Corretor', op.corretores.map((c: any) => ({ v: c.id, l: c.nome })))}
          {sel('equipeId', 'Equipe', op.equipes.map((e: any) => ({ v: e.id, l: e.nome })))}
          {sel('unidadeId', 'Filial', op.unidades.map((u: any) => ({ v: u.id, l: u.nome })))}
          {sel('baseLeadId', 'Base de leads', op.bases.map((b: any) => ({ v: b.id, l: b.nome })))}
          {sel('bolsaoId', 'Bolsão', op.bolsoes.map((b: any) => ({ v: b.id, l: b.nome })))}
          {sel('empreendimentoId', 'Empreendimento de interesse', op.empreendimentos.map((e: any) => ({ v: e.id, l: e.nome })))}
          {sel('exterior', 'Exterior', [{ v: 'SIM', l: 'Só exterior (DDI de fora ou mora fora)' }, { v: 'NAO', l: 'Só Brasil' }])}
          <div className="field"><label className="field__label">Origem ou campanha contém</label><input className="field__input" style={{ fontSize: 16 }} value={f.origem || ''} onChange={(e) => set('origem', e.target.value)} placeholder="Ex.: Meta, Imobilead" /></div>
          <div className="field"><label className="field__label">Formulário contém</label><input className="field__input" style={{ fontSize: 16 }} value={f.formulario || ''} onChange={(e) => set('formulario', e.target.value)} /></div>
          <div className="field"><label className="field__label">Entrou de</label><input type="date" className="field__input" value={f.criadoDe || ''} onChange={(e) => set('criadoDe', e.target.value)} /></div>
          <div className="field"><label className="field__label">Entrou até</label><input type="date" className="field__input" value={f.criadoAte || ''} onChange={(e) => set('criadoAte', e.target.value)} /></div>
          <div className="field"><label className="field__label">Sem interação há (dias)</label><input type="number" min={0} className="field__input" value={f.semInteracaoDias || ''} onChange={(e) => set('semInteracaoDias', e.target.value)} placeholder="Ex.: 30" /></div>
          <div className="field" style={{ alignSelf: 'end' }}>
            <label className="cc-row" style={{ fontSize: 14, minHeight: 40 }}><input type="checkbox" checked={!!f.semResposta} onChange={(e) => set('semResposta', e.target.checked)} /> Nunca respondeu</label>
            <label className="cc-row" style={{ fontSize: 14, minHeight: 32 }}><input type="checkbox" checked={!!f.semCorretor} onChange={(e) => set('semCorretor', e.target.checked)} /> Sem corretor</label>
          </div>
        </div>
      </div>

      <div className="cc-card" style={{ marginBottom: 16 }}>
        <div className="cc-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="cc-muted">Leads com telefone neste público</div>
            <div className="cc-total">{carregando && !prev ? '…' : n(prev?.total)}</div>
          </div>
          <div className="cc-row">
            <button type="button" className="btn btn--primary btn--sm" disabled={!prev?.total} onClick={() => setAcao('lista')}>Salvar como lista</button>
            <button type="button" className="btn btn--secondary btn--sm" disabled={!prev?.total} onClick={() => setAcao('tag')}>Aplicar tag</button>
            <button type="button" className="btn btn--ghost btn--sm" disabled={!prev?.total} onClick={() => setAcao('exterior')}>Marcar "mora no exterior"</button>
          </div>
        </div>
        {!!prev?.amostra?.length && (
          <div className="cc-scroll" style={{ marginTop: 12 }}>
            <table className="cc-table">
              <thead><tr><th>Nome</th><th>Telefone</th><th>País</th><th>Etiqueta</th><th>Etapa</th><th>Corretor</th></tr></thead>
              <tbody>{prev.amostra.map((l: any) => (
                <tr key={l.id}><td>{l.nome}</td><td>{l.telefone}</td><td>{l.pais || '—'}</td><td>{l.etiqueta || '—'}</td><td>{ROT_ETAPA[l.etapa] || l.etapa}</td><td>{l.corretor || 'Sem corretor'}</td></tr>
              ))}</tbody>
            </table>
            <p className="cc-muted" style={{ marginTop: 6 }}>Mostrando os {prev.amostra.length} mais recentes.</p>
          </div>
        )}
      </div>

      <div className="cc-grid2">
        <div className="cc-card">
          <h3>Listas e bases</h3>
          {!op.listas.length ? <p className="cc-muted">Nenhuma lista ainda. Salve um filtro ou importe uma planilha.</p> : (
            <table className="cc-table">
              <thead><tr><th>Nome</th><th className="num">Leads</th><th></th></tr></thead>
              <tbody>{op.listas.map((l: any) => (
                <tr key={l.id}>
                  <td><button type="button" className="btn btn--ghost btn--sm" style={{ padding: 0 }} onClick={() => setF({ listaId: String(l.id) })}>{l.nome}</button></td>
                  <td className="num">{n(l.total)}</td>
                  <td style={{ textAlign: 'right' }}><button type="button" className="btn btn--ghost btn--sm" onClick={async () => { if (!window.confirm(`Apagar a lista "${l.nome}"? Os leads continuam no sistema.`)) return; await Api.centralListaApagar(l.id); carregarOpcoes(); }}>Apagar</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div className="cc-card">
          <h3>Tags</h3>
          <div className="cc-row" style={{ marginBottom: 10 }}>
            {op.tags.map((t: any) => (
              <span key={t.id} className="cc-chip"><span className="cc-dot" style={{ background: t.cor }} />{t.nome}
                <button type="button" aria-label={`Apagar tag ${t.nome}`} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }} onClick={async () => { await Api.centralTagApagar(t.id); carregarOpcoes(); }}>×</button>
              </span>
            ))}
            {!op.tags.length && <span className="cc-muted">Nenhuma tag cadastrada.</span>}
          </div>
          <div className="cc-row">
            <input className="field__input" style={{ maxWidth: 220, fontSize: 16 }} value={novaTag} onChange={(e) => setNovaTag(e.target.value)} placeholder="Nova tag (ex.: Investidor)" />
            <button type="button" className="btn btn--secondary btn--sm" disabled={!novaTag.trim()} onClick={async () => { try { await Api.centralTagCriar(novaTag.trim()); setNovaTag(''); carregarOpcoes(); } catch (e: any) { toast.error(e?.message || 'Falha.'); } }}>Criar tag</button>
          </div>
        </div>
      </div>

      {acao && (
        <Modal open onClose={() => setAcao(null)} title={acao === 'lista' ? 'Salvar como lista' : acao === 'tag' ? 'Aplicar tag' : 'Mora no exterior'} subtitle={`${n(prev?.total)} leads deste público`}>
          {acao === 'lista' && (
            <div className="field"><label className="field__label">Nome da lista</label><input className="field__input" style={{ fontSize: 16 }} value={nomeLista} onChange={(e) => setNomeLista(e.target.value)} placeholder="Ex.: Investidores exterior novembro" autoFocus /></div>
          )}
          {acao === 'tag' && (
            <>
              <div className="field"><label className="field__label">Tag</label>
                <select className="field__select" value={tagSel} onChange={(e) => setTagSel(e.target.value)}>
                  <option value="">Escolha</option>
                  {op.tags.map((t: any) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                </select>
              </div>
              <label className="cc-row" style={{ fontSize: 14 }}><input type="checkbox" checked={tagRemover} onChange={(e) => setTagRemover(e.target.checked)} /> Tirar esta tag em vez de aplicar</label>
            </>
          )}
          {acao === 'exterior' && <p style={{ fontSize: 14 }}>Marca estes leads como "mora no exterior", para entrarem no filtro Exterior mesmo com número do Brasil.</p>}
          <div className="cc-row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn--ghost" onClick={() => setAcao(null)}>Cancelar</button>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={executar}>{busy ? 'Salvando…' : 'Confirmar'}</button>
          </div>
        </Modal>
      )}
      {importar && <ImportarBase tags={op.tags} onClose={(mudou) => { setImportar(false); if (mudou) carregarOpcoes(); }} />}
    </>
  );
}

function ImportarBase({ tags, onClose }: { tags: any[]; onClose: (mudou: boolean) => void }) {
  const toast = useToast();
  const inp = useRef<HTMLInputElement>(null);
  const [lida, setLida] = useState<any>(null);
  const [nome, setNome] = useState('');
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);
  const ler = async (file: File) => {
    setBusy(true);
    try { const r = await Api.centralLerPlanilha(file); setLida(r); if (!nome) setNome(file.name.replace(/\.[^.]+$/, '')); }
    catch (e: any) { toast.error(e?.message || 'Não consegui ler a planilha.'); } finally { setBusy(false); }
  };
  const importar = async () => {
    if (!nome.trim()) { toast.error('Dê um nome para a base.'); return; }
    setBusy(true);
    try { const r = await Api.centralListaImportar({ nome: nome.trim(), tag: tag || null, linhas: lida.linhas }); setRes(r.stats); }
    catch (e: any) { toast.error(e?.message || 'Falha ao importar.'); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={() => onClose(!!res)} title="Importar base de clientes" subtitle="Planilha CSV ou Excel com nome e telefone" size="lg">
      {res ? (
        <>
          <p style={{ fontSize: 14 }}>Base "{nome}" importada. {n(res.linhas)} linhas: <strong>{n(res.novos)}</strong> contatos novos, <strong>{n(res.existentes)}</strong> já estavam no sistema (entraram na lista sem duplicar), {n(res.exterior)} do exterior, {n(res.invalidos)} sem telefone válido.</p>
          <p className="cc-muted">Os contatos novos entram sem corretor e fora da distribuição. Quando responderem a uma campanha, seguem a fila da campanha.</p>
          <div className="cc-row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button type="button" className="btn btn--primary" onClick={() => onClose(true)}>Concluir</button></div>
        </>
      ) : !lida ? (
        <>
          <p style={{ fontSize: 14 }}>A primeira linha precisa ter os nomes das colunas. O sistema reconhece: Nome, Telefone (ou Celular, WhatsApp), E-mail, Tags e Cidade. Número do exterior com + e o DDI (ex.: +351 912 345 678).</p>
          <input ref={inp} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) ler(fl); }} />
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => inp.current?.click()}>{busy ? 'Lendo…' : 'Escolher planilha'}</button>
        </>
      ) : (
        <>
          <div className="cc-row" style={{ marginBottom: 10 }}>
            <span className="cc-chip">{n(lida.total)} linhas</span>
            {Object.entries(lida.mapa).map(([campo, col]) => <span key={campo} className="cc-chip">{campo}: {col ? String(col) : 'não encontrada'}</span>)}
          </div>
          {!lida.mapa.telefone && <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>Não achei a coluna de telefone. Renomeie a coluna para "Telefone" e escolha a planilha de novo.</p>}
          <div className="cc-scroll" style={{ maxHeight: 220, marginBottom: 12 }}>
            <table className="cc-table"><thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Tags</th></tr></thead>
              <tbody>{lida.linhas.slice(0, 8).map((l: any, i: number) => <tr key={i}><td>{l.nome}</td><td>{l.telefone}</td><td>{l.email}</td><td>{l.tags}</td></tr>)}</tbody></table>
          </div>
          <div className="cc-filtros">
            <div className="field"><label className="field__label">Nome da base</label><input className="field__input" style={{ fontSize: 16 }} value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="field"><label className="field__label">Tag para todos (opcional)</label>
              <select className="field__select" value={tag} onChange={(e) => setTag(e.target.value)}><option value="">Nenhuma</option>{tags.map((t: any) => <option key={t.id} value={t.nome}>{t.nome}</option>)}</select>
            </div>
          </div>
          <div className="cc-row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn--ghost" onClick={() => setLida(null)}>Trocar planilha</button>
            <button type="button" className="btn btn--primary" disabled={busy || !lida.mapa.telefone} onClick={importar}>{busy ? 'Importando…' : `Importar ${n(lida.total)} linhas`}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
