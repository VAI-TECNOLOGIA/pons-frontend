// Minha esteira (pedido Elison 21/10): tela simples do corretor. O lead chega,
// ele vê os dados, escreve a observação, chama no WhatsApp do celular dele e
// marca a etapa; o card anda na esteira. Lead há 5+ dias na mesma etapa fica
// vermelho (e o servidor avisa todo dia às 9h). Visual: quadro de tarefas M-077
// recolorido com os tokens do app (tema claro/escuro).
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { Auth } from '../lib/auth';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import './esteira.css';

type Coluna = { key: string; titulo: string; dica: string; cor: string; statuses: string[] };
// 5 colunas (decisão 21/10). As etapas extras do funil caem na mais próxima.
const COLUNAS: Coluna[] = [
  { key: 'NOVO', titulo: 'Novo', dica: 'Chame o lead', cor: '#0E7C9B', statuses: ['NOVO', 'SDR', 'NAO_RESPONDE'] },
  { key: 'EM_ATENDIMENTO', titulo: 'Em atendimento', dica: 'Conversando', cor: '#7A5AF8', statuses: ['EM_ATENDIMENTO', 'QUALIFICANDO', 'LISTA_VIP', 'FLUXO', 'PAROU_RESPONDER', 'POS_FLUXO'] },
  { key: 'VISITA', titulo: 'Visita', dica: 'Vídeo ou visita', cor: '#F2B544', statuses: ['VISITA'] },
  { key: 'NEGOCIANDO', titulo: 'Negociando', dica: 'Proposta na mesa', cor: '#E8743B', statuses: ['NEGOCIANDO', 'PROPOSTA', 'CONTATO'] },
  { key: 'FECHADO', titulo: 'Venda', dica: 'Parabéns', cor: '#2E9E5B', statuses: ['FECHADO', 'VENDIDO', 'GANHO'] },
];
const FORA = ['PERDIDO', 'DESCARTADO'];
const MOTIVOS_PERDA = ['Sem condições financeiras', 'Não responde', 'Comprou com outro', 'Sem perfil / só curiosidade', 'Outro'];
const DIAS_ALERTA = 5;
const DIA = 86400000;

const colunaDe = (status: string) => COLUNAS.find((c) => c.statuses.includes(status)) || COLUNAS[0];
function diasNaEtapa(l: any): number {
  const desde = Math.max(
    l.statusDesde ? new Date(l.statusDesde).getTime() : 0,
    l.distribuidoEm ? new Date(l.distribuidoEm).getTime() : 0,
    l.statusDesde || l.distribuidoEm ? 0 : new Date(l.createdAt).getTime(),
  );
  return desde ? Math.max(0, Math.floor((Date.now() - desde) / DIA)) : 0;
}
function linkWhats(l: any): string | null {
  if (l.telefoneOculto) return null;
  let d = String(l.telefone || '').replace(/\D/g, '');
  if (d.length < 10) return null;
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}`;
}
const dataBR = (s?: string) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—');

export default function MinhaEsteira() {
  const toast = useToast();
  // Gestão (CEO/diretoria) escolhe de qual corretor ver a esteira (22/10).
  const gestao = ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'MARKETING', 'GESTOR_TRAFEGO'].includes(Auth.user?.role || '');
  const [verCorretor, setVerCorretor] = useState<string>('');
  const { data: corretoresLista } = useApi<any[]>(() => (gestao ? Api.corretores() : Promise.resolve([])), [gestao]);
  const meuCorretorId = gestao ? (verCorretor ? Number(verCorretor) : undefined) : (Auth.user?.role !== 'CORRETOR' ? Auth.user?.corretor?.id : undefined);
  const semCadastro = gestao ? !verCorretor : (Auth.user?.role !== 'CORRETOR' && !Auth.user?.corretor?.id);
  const { data, loading, error } = useApi<any[]>(async () => {
    if (semCadastro) return []; // gestor/sócio sem cadastro de corretor não tem esteira própria
    if (import.meta.env.DEV && (window as any).__ESTEIRA_DEMO__) return (window as any).__ESTEIRA_DEMO__; // prévia local com dados fictícios
    // Paginado como o Funil (corretor com 100+ leads não pode perder card).
    const base: any = meuCorretorId ? { corretorId: String(meuCorretorId) } : {};
    const lote = (r: any) => (Array.isArray(r) ? r : r?.leads || []);
    const r1: any = await Api.leads({ ...base, page: 1, limit: 200 });
    const out = [...lote(r1)];
    const total = Array.isArray(r1) ? 0 : Number(r1?.total ?? 0);
    const paginas = Math.min(5, Math.ceil(total / 200));
    if (paginas > 1 && out.length === 200) {
      const resto = await Promise.all(Array.from({ length: paginas - 1 }, (_, i) => Api.leads({ ...base, page: i + 2, limit: 200 })));
      for (const r of resto) out.push(...lote(r));
    }
    return out;
  }, [meuCorretorId]);

  const [aba, setAba] = useState('NOVO');
  const [soParados, setSoParados] = useState(false);
  const [aberto, setAberto] = useState<any | null>(null);
  const [movendo, setMovendo] = useState<number | null>(null);
  const [local, setLocal] = useState<Record<number, any>>({}); // mudanças otimistas

  const leads = useMemo(
    () => (data || []).map((l) => ({ ...l, ...(local[l.id] || {}) })).filter((l) => !FORA.includes(l.status)),
    [data, local],
  );
  const porColuna = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const c of COLUNAS) m[c.key] = [];
    for (const l of leads) {
      if (soParados && (colunaDe(l.status).key === 'FECHADO' || diasNaEtapa(l) < DIAS_ALERTA)) continue;
      m[colunaDe(l.status).key].push(l);
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => diasNaEtapa(b) - diasNaEtapa(a));
    return m;
  }, [leads, soParados]);

  const ativos = leads.filter((l) => colunaDe(l.status).key !== 'FECHADO');
  const parados = ativos.filter((l) => diasNaEtapa(l) >= DIAS_ALERTA).length;
  const hoje = new Date().toDateString();
  const chegaramHoje = leads.filter((l) => l.createdAt && new Date(l.createdAt).toDateString() === hoje).length;
  const vendas = leads.filter((l) => colunaDe(l.status).key === 'FECHADO').length;

  const mover = async (l: any, status: string) => {
    setMovendo(l.id);
    setLocal((cur) => ({ ...cur, [l.id]: { ...(cur[l.id] || {}), status, statusDesde: new Date().toISOString() } }));
    try {
      await Api.leadUpdate(l.id, { status });
      const c = COLUNAS.find((x) => x.key === status);
      toast.success(status === 'PERDIDO' ? `${l.nome}: marcado como perdido.` : `${l.nome}: ${c?.titulo || status}.`);
      if (aberto?.id === l.id) setAberto((a: any) => (a ? { ...a, status, statusDesde: new Date().toISOString() } : a));
    } catch (e: any) {
      setLocal((cur) => { const n = { ...cur }; delete n[l.id]; return n; });
      toast.error('Não consegui mudar a etapa: ' + (e.message || 'erro'));
    } finally { setMovendo(null); }
  };
  const proxima = (l: any) => {
    const i = COLUNAS.findIndex((c) => c.key === colunaDe(l.status).key);
    return i >= 0 && i < COLUNAS.length - 1 ? COLUNAS[i + 1] : null;
  };

  if (loading && !data) return (<><Topbar title="Minha esteira" /><div className="main__content"><LoadingBlock /></div></>);
  if (error) return (<><Topbar title="Minha esteira" /><div className="main__content"><ErrorBlock error={error} /></div></>);

  const Card = ({ l }: { l: any }) => {
    const dias = diasNaEtapa(l);
    const col = colunaDe(l.status);
    const prox = proxima(l);
    const wa = linkWhats(l);
    const nivel = col.key === 'FECHADO' ? '' : dias >= DIAS_ALERTA ? 'esteira-card--parado' : dias >= 3 ? 'esteira-card--atencao' : '';
    return (
      <div className={`esteira-card ${nivel}`}>
        <button type="button" className="esteira-card__corpo" onClick={() => setAberto(l)}>
          <div className="esteira-card__topo">
            <span className="esteira-tag" style={{ background: `${col.cor}22`, color: col.cor }}>{col.titulo}</span>
            {l.vip && <span className="esteira-tag esteira-tag--vip">VIP</span>}
            <span className={`esteira-dias ${nivel ? 'esteira-dias--' + (dias >= DIAS_ALERTA ? 'alto' : 'medio') : ''}`}>
              <Icon name="clock" size={12} /> {dias === 0 ? 'hoje' : dias === 1 ? '1 dia' : `${dias} dias`}
            </span>
          </div>
          <div className="esteira-card__nome">{l.nome}</div>
          <div className="esteira-card__info">{l.interesse || l.produto || 'Sem empreendimento informado'}</div>
          {l.observacaoCorretor && <div className="esteira-card__obs">{l.observacaoCorretor}</div>}
          {col.key !== 'FECHADO' && dias >= DIAS_ALERTA && (
            <div className="esteira-card__alerta"><Icon name="warn" size={13} /> Parado há {dias} dias. Chame ou marque a etapa.</div>
          )}
        </button>
        {col.key !== 'FECHADO' && (
          <div className="esteira-card__acoes">
            {wa ? (
              <a className="esteira-btn esteira-btn--whats" href={wa} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={15} /> WhatsApp</a>
            ) : (
              <button type="button" className="esteira-btn esteira-btn--neutro" onClick={() => setAberto(l)}><Icon name="lock" size={14} /> Telefone</button>
            )}
            {prox && (
              <button type="button" className="esteira-btn esteira-btn--avancar" disabled={movendo === l.id} onClick={() => mover(l, prox.key)} title={`Mover para ${prox.titulo}`} aria-label={`Avançar para ${prox.titulo}`}>
                Avançar <Icon name="send" size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Topbar title="Minha esteira" />
      <div className="main__content esteira">
        <PageHeader breadcrumb="Comercial · Atendimento" title="Minha esteira" subtitle="Seus leads por etapa. Chame no WhatsApp e marque a etapa: o card anda sozinho." />

        {gestao && (
          <div className="esteira-ver">
            <label htmlFor="esteira-ver">Ver a esteira de</label>
            <select id="esteira-ver" className="field__select" value={verCorretor} onChange={(e) => setVerCorretor(e.target.value)}>
              <option value="">Escolha um corretor</option>
              {(corretoresLista || []).filter((c: any) => c.status !== 'INATIVO' && c.ativo !== false).sort((a: any, b: any) => String(a.nome).localeCompare(String(b.nome))).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}
        {semCadastro && !gestao && <div className="esteira-filtro">Seu usuário não tem cadastro de corretor, então não recebe leads na esteira. Use Leads ou Funil para acompanhar a equipe.</div>}
        {semCadastro && gestao && <div className="esteira-filtro">Escolha um corretor acima para ver a esteira dele, do jeito que ele vê.</div>}
        <div className="esteira-kpis">
          <div className="esteira-kpi" style={{ ['--k' as any]: '#0E7C9B' }}><span>Na esteira</span><strong>{ativos.length}</strong></div>
          <button type="button" className={`esteira-kpi esteira-kpi--botao ${soParados ? 'is-on' : ''}`} style={{ ['--k' as any]: '#C70A1A' }} onClick={() => setSoParados((v) => !v)} title="Mostrar só os parados">
            <span>Parados {DIAS_ALERTA}+ dias</span><strong>{parados}</strong>
          </button>
          <div className="esteira-kpi" style={{ ['--k' as any]: '#7A5AF8' }}><span>Chegaram hoje</span><strong>{chegaramHoje}</strong></div>
          <div className="esteira-kpi" style={{ ['--k' as any]: '#2E9E5B' }}><span>Vendas</span><strong>{vendas}</strong></div>
        </div>
        {soParados && <div className="esteira-filtro">Mostrando só os leads parados há {DIAS_ALERTA} dias ou mais. <button type="button" onClick={() => setSoParados(false)}>Ver todos</button></div>}

        {/* Celular: abas por etapa */}
        <div className="esteira-abas" role="tablist">
          {COLUNAS.map((c) => (
            <button key={c.key} type="button" role="tab" aria-selected={aba === c.key} className={`esteira-aba ${aba === c.key ? 'is-on' : ''}`} onClick={() => setAba(c.key)}>
              {c.titulo} <span>{porColuna[c.key].length}</span>
            </button>
          ))}
        </div>

        <div className="esteira-quadro">
          {COLUNAS.map((c) => (
            <section key={c.key} className={`esteira-col ${aba === c.key ? 'is-on' : ''}`}>
              <header className="esteira-col__topo">
                <span className="esteira-col__ponto" style={{ background: c.cor }} />
                <strong>{c.titulo}</strong><span className="esteira-col__qtd">{porColuna[c.key].length}</span>
                <small>{c.dica}</small>
              </header>
              <div className="esteira-col__lista">
                {porColuna[c.key].length === 0
                  ? <div className="esteira-vazio">Nenhum lead aqui.</div>
                  : porColuna[c.key].map((l) => <Card key={l.id} l={l} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
      {aberto && createPortal(<FichaEsteira lead={aberto} onFechar={() => setAberto(null)} onMover={mover} onSalvo={(obs) => {
        setLocal((cur) => ({ ...cur, [aberto.id]: { ...(cur[aberto.id] || {}), observacaoCorretor: obs } }));
        setAberto((a: any) => (a ? { ...a, observacaoCorretor: obs } : a));
      }} onLiberado={(tel) => {
        setLocal((cur) => ({ ...cur, [aberto.id]: { ...(cur[aberto.id] || {}), telefone: tel, telefoneOculto: false } }));
        setAberto((a: any) => (a ? { ...a, telefone: tel, telefoneOculto: false } : a));
      }} />, document.body)}
    </>
  );
}

function FichaEsteira({ lead, onFechar, onMover, onSalvo, onLiberado }: { lead: any; onFechar: () => void; onMover: (l: any, s: string) => void; onSalvo: (obs: string) => void; onLiberado: (tel: string) => void }) {
  const toast = useToast();
  const [obs, setObs] = useState(lead.observacaoCorretor || '');
  const [salvando, setSalvando] = useState(false);
  const [perdendo, setPerdendo] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS_PERDA[0]);
  const [justif, setJustif] = useState('');
  const [pedindo, setPedindo] = useState(false);
  const col = colunaDe(lead.status);
  const dias = diasNaEtapa(lead);
  const wa = linkWhats(lead);

  const salvarObs = async () => {
    setSalvando(true);
    try { await Api.leadObservacao(lead.id, obs); onSalvo(obs); toast.success('Observação salva.'); }
    catch (e: any) { toast.error('Erro: ' + (e.message || 'falha')); }
    finally { setSalvando(false); }
  };
  const marcarPerdido = async () => {
    const texto = `${obs ? obs + '\n' : ''}Perdido: ${motivo}`;
    try { await Api.leadObservacao(lead.id, texto); onSalvo(texto); } catch { /* segue para a etapa */ }
    onMover(lead, 'PERDIDO');
    onFechar();
  };
  const pedirTelefone = async () => {
    if (!justif.trim()) { toast.error('Escreva o motivo para pedir o telefone.'); return; }
    setPedindo(true);
    try {
      const r = await Api.leadLiberarContato(lead.id, justif.trim());
      if (r.telefone) { onLiberado(r.telefone); toast.success('Telefone liberado.'); }
      else toast.success('Pedido enviado ao gestor. Você recebe um aviso quando ele liberar.');
      setJustif('');
    } catch (e: any) { toast.error(e.message || 'Não consegui pedir.'); }
    finally { setPedindo(false); }
  };

  return (
    <div className="esteira-ficha__fundo" onClick={onFechar}>
      <aside className="esteira-ficha" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Lead ${lead.nome}`}>
        <div className="esteira-ficha__topo">
          <div>
            <span className="esteira-tag" style={{ background: `${col.cor}22`, color: col.cor }}>{col.titulo}</span>
            <h2>{lead.nome}</h2>
            <p>{lead.interesse || lead.produto || 'Sem empreendimento informado'}</p>
          </div>
          <button type="button" className="esteira-ficha__fechar" onClick={onFechar} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </div>

        {col.key !== 'FECHADO' && dias >= DIAS_ALERTA && (
          <div className="esteira-ficha__alerta">Parado há {dias} dias nesta etapa. Chame o lead ou marque a etapa certa; se continuar parado, ele volta para o marketing trabalhar.</div>
        )}

        <div className="esteira-ficha__dados">
          <div><span>Telefone</span><strong>{lead.telefone || '—'}</strong></div>
          <div><span>Chegou em</span><strong>{dataBR(lead.distribuidoEm || lead.createdAt)}</strong></div>
          <div><span>Na etapa há</span><strong>{dias === 0 ? 'hoje' : `${dias} dia${dias > 1 ? 's' : ''}`}</strong></div>
          {lead.cidade && <div><span>Cidade</span><strong>{lead.cidade}</strong></div>}
          {lead.email && <div><span>E-mail</span><strong>{lead.email}</strong></div>}
        </div>

        {wa ? (
          <a className="esteira-btn esteira-btn--whats esteira-btn--grande" href={wa} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={18} /> Chamar no WhatsApp</a>
        ) : (
          <div className="esteira-ficha__pedir">
            <p>O telefone deste lead ainda não foi liberado para você.</p>
            <textarea className="field__input" rows={2} placeholder="Por que você precisa do contato? (ex.: cliente pediu ligação)" value={justif} onChange={(e) => setJustif(e.target.value)} />
            <button type="button" className="esteira-btn esteira-btn--neutro esteira-btn--grande" disabled={pedindo} onClick={pedirTelefone}>{pedindo ? 'Enviando…' : 'Pedir telefone ao gestor'}</button>
          </div>
        )}

        <div className="esteira-ficha__bloco">
          <span className="esteira-ficha__rotulo">Em que etapa ele está?</span>
          <div className="esteira-etapas">
            {COLUNAS.map((c) => (
              <button key={c.key} type="button" className={`esteira-etapa ${c.key === col.key ? 'is-on' : ''}`} style={{ ['--k' as any]: c.cor }} onClick={() => c.key !== col.key && onMover(lead, c.key)}>{c.titulo}</button>
            ))}
          </div>
        </div>

        <div className="esteira-ficha__bloco">
          <span className="esteira-ficha__rotulo">Observação (só a equipe vê)</span>
          <textarea className="field__input esteira-ficha__obs" rows={4} placeholder="Ex.: quer 3 dormitórios, tem R$ 50 mil de entrada, retorno sexta." value={obs} onChange={(e) => setObs(e.target.value)} />
          <button type="button" className="esteira-btn esteira-btn--avancar" disabled={salvando || obs === (lead.observacaoCorretor || '')} onClick={salvarObs}>{salvando ? 'Salvando…' : 'Salvar observação'}</button>
        </div>

        {col.key !== 'FECHADO' && (
          <div className="esteira-ficha__bloco">
            {!perdendo ? (
              <button type="button" className="esteira-link-perdido" onClick={() => setPerdendo(true)}>Marcar como perdido</button>
            ) : (
              <div className="esteira-perdido">
                <span className="esteira-ficha__rotulo">Por que perdeu?</span>
                <select className="field__select" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                  {MOTIVOS_PERDA.map((m) => <option key={m}>{m}</option>)}
                </select>
                <div className="esteira-perdido__acoes">
                  <button type="button" className="esteira-btn esteira-btn--neutro" onClick={() => setPerdendo(false)}>Cancelar</button>
                  <button type="button" className="esteira-btn esteira-btn--perigo" onClick={marcarPerdido}>Confirmar perdido</button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
