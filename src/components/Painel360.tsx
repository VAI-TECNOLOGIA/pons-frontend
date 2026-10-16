// Visão 360 do dashboard de gestão (pedido Elison 16/10): clicar no corretor do
// ranking ou num evento da linha do tempo abre este painel lateral.
//  - Corretor: números do período, tempo de casa, gestor, vendas, últimos leads,
//    trocas de sala e mensagem privada (sino + celular).
//  - Lead: chegada, aceite, etapa, conversa (quando passa pelo sistema), caminho
//    entre corretores e "cobrar o corretor".
// Dados: GET /api/dashboard/gestao/corretor/:id e /lead/:id (servidor aplica o escopo).
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Api } from '../lib/api';
import { formatCurrency, formatCurrencyShort, timeAgo, timeUntil } from '../lib/format';
import { Icon } from './Icon';
import { TrajetoTransferencias } from './TrajetoTransferencias';
import { FichaLeadModal } from './FichaLeadModal';

export type Alvo360 = { tipo: 'corretor' | 'lead'; id: number };

const STATUS_VENDA: Record<string, string> = {
  PRE_ANALISE: 'Pré-análise', ANALISE_JURIDICA: 'Análise jurídica', CONTRATO_EM_CONFERENCIA: 'Conferência',
  EM_ASSINATURA: 'Em assinatura', ASSINADO: 'Assinado', ASSINADO_AGUARDANDO_PAGAMENTO: 'Assinado · aguardando pagamento',
  AGUARDANDO_REPASSE: 'Aguardando repasse', INADIMPLENTE: 'Inadimplente', PAGO: 'Pago', CANCELADO: 'Cancelada',
};
const PAPEL_GESTOR_ORDEM = ['Gestor da sala', 'Líder da sala', 'Gestor direto', 'Sócio da filial', 'Informado no cadastro'];

const dataBR = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const dataHoraBR = (s?: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às') : '—');
const isoBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const pct = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(1).replace('.', ',')}%`);
const inteiro = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('pt-BR'));
const primeiroNome = (n?: string | null) => (n || '').trim().split(/\s+/)[0] || '';
const minutos = (m: number | null | undefined) => {
  if (m == null) return '—';
  if (m < 60) return `${m.toFixed(m < 10 ? 1 : 0).replace('.', ',')} min`;
  const h = m / 60;
  return h < 48 ? `${h.toFixed(1).replace('.', ',')} h` : `${Math.round(h / 24)} dias`;
};
function tempoDeCasa(dias: number) {
  if (dias < 31) return `${dias} dia${dias === 1 ? '' : 's'}`;
  const meses = Math.floor(dias / 30.44);
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12), resto = meses % 12;
  return `${anos} ano${anos > 1 ? 's' : ''}${resto ? ` e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : ''}`;
}

function Foto({ nome, initials, url, grande }: { nome: string; initials?: string; url?: string | null; grande?: boolean }) {
  const cls = `dg-avatar${grande ? ' dg-avatar--g' : ''}`;
  if (url) return <img className={cls} src={url} alt="" />;
  const ini = initials || nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return <span className={cls} aria-hidden="true">{ini}</span>;
}

function Numero({ rotulo, valor, nota, tom }: { rotulo: string; valor: string; nota?: string; tom?: 'ok' | 'ruim' }) {
  return (
    <div className={`dg-360-num${tom ? ` dg-360-num--${tom}` : ''}`}>
      <div className="dg-360-num-rot">{rotulo}</div>
      <div className="dg-360-num-val">{valor}</div>
      {nota && <div className="dg-360-num-nota">{nota}</div>}
    </div>
  );
}

function Secao({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="dg-360-secao">
      <div className="dg-card-topo"><h3 className="dg-card-titulo">{titulo}</h3>{nota && <span className="dg-card-nota">{nota}</span>}</div>
      {children}
    </section>
  );
}

// ── Caixa de mensagem privada ──────────────────────────────────────────────
function CaixaMensagem({ corretorId, nome, sugestoes, leadId, onEnviada, onCancelar }: {
  corretorId: number; nome: string; sugestoes: string[]; leadId?: number | null; onEnviada: () => void; onCancelar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true); setResultado(null);
    try {
      const r = await Api.dashboardMensagemCorretor(corretorId, t, leadId);
      const noCelular = r.push?.status === 'enviado' && r.push.success > 0;
      setResultado({ ok: true, msg: noCelular ? `Enviada. Chegou no celular e no sino de ${primeiroNome(nome)}.` : `Enviada para o sino do sistema. ${primeiroNome(nome)} não tem o aplicativo com notificação ativa, então vê quando abrir o sistema.` });
      setTexto('');
      onEnviada();
    } catch (e: any) {
      const cod = (e?.details as any)?.error || '';
      const msg = cod === 'sem_permissao' ? 'Você só pode mandar mensagem para os corretores que comanda.'
        : cod === 'limite_por_hora' ? 'Limite de 60 mensagens por hora atingido. Tente daqui a pouco.'
        : cod === 'corretor_inativo' ? 'Este corretor está desativado.'
        : 'Não foi possível enviar agora. Tente de novo.';
      setResultado({ ok: false, msg });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="dg-360-msg">
      <div className="dg-360-msg-rot">Mensagem privada para {primeiroNome(nome)} · chega no sino e no celular</div>
      {sugestoes.length > 0 && (
        <div className="dg-360-chips">
          {sugestoes.map((s) => <button key={s} type="button" className="dg-360-chip" onClick={() => setTexto(s)}>{s}</button>)}
        </div>
      )}
      <textarea
        ref={ref}
        className="dg-360-textarea"
        rows={4}
        maxLength={500}
        value={texto}
        placeholder="Escreva a mensagem ou toque numa sugestão acima"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) enviar(); }}
      />
      <div className="dg-360-msg-rodape">
        <span className="dg-card-nota">{texto.length}/500</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="dg-btn" onClick={onCancelar}>Fechar</button>
          <button type="button" className="dg-btn dg-btn--forte" disabled={!texto.trim() || enviando} onClick={enviar}>
            <Icon name="send" size={13} /> {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
      {resultado && <div className={`dg-360-aviso ${resultado.ok ? 'dg-360-aviso--ok' : 'dg-360-aviso--ruim'}`}>{resultado.msg}</div>}
    </div>
  );
}

// ── Corretor ───────────────────────────────────────────────────────────────
function PainelCorretor({ d, onLead, onFiltrar, onRecarregar }: { d: any; onLead: (id: number) => void; onFiltrar: () => void; onRecarregar: () => void }) {
  const [msgAberta, setMsgAberta] = useState(false);
  const n = d.numeros;
  const pn = primeiroNome(d.nome);
  const periodo = d.periodo.de === d.periodo.ate ? isoBR(d.periodo.de) : `${isoBR(d.periodo.de)} a ${isoBR(d.periodo.ate)}`;

  const sugestoes = useMemo(() => {
    const s: string[] = [];
    if (n.vendas > 0) s.push(`Parabéns, ${pn}! ${n.vendas === 1 ? 'Uma venda' : `${n.vendas} vendas`} no período, ${formatCurrencyShort(n.vgv)} em VGV. Seguimos juntos rumo à meta.`);
    if (n.posicao) s.push(`${pn}, você está em ${n.posicao}º no ranking do período. Vamos buscar o topo!`);
    if (n.pulos > 0) s.push(`${pn}, ${n.pulos} lead(s) passaram para outro corretor por falta de aceite no período. Fique de olho no celular para aceitar em até 5 minutos.`);
    else if (n.semAceite > 0) s.push(`${pn}, vi ${n.semAceite} lead(s) seus ainda sem aceite. Precisa de ajuda para atender mais rápido?`);
    if (!d.avatarUrl) s.push(`${pn}, coloque sua foto no perfil para aparecer no ranking e no painel da equipe.`);
    s.push(`${pn}, podemos conversar hoje? Me chama quando puder.`);
    return s.slice(0, 4);
  }, [d, n, pn]);

  const gestores = [...(d.gestores || [])].sort((a: any, b: any) => PAPEL_GESTOR_ORDEM.indexOf(a.papel) - PAPEL_GESTOR_ORDEM.indexOf(b.papel));
  const maxEtapa = Math.max(1, ...(d.carteira?.etapas || []).map((e: any) => e.n));

  return (
    <>
      <div className="dg-360-cab">
        <Foto nome={d.nome} initials={d.initials} url={d.avatarUrl} grande />
        <div style={{ minWidth: 0 }}>
          <div className="dg-eyebrow">Corretor</div>
          <h2 className="dg-360-nome">{d.nome}</h2>
          <div className="dg-pessoa-sub">{[d.sala?.nome || 'Sem sala', d.filial].filter(Boolean).join(' · ')}</div>
          <div className="dg-360-tags">
            {!d.ativo && <span className="dg-360-tag dg-360-tag--ruim">Desativado</span>}
            {d.ativo && (d.recebendoLeads ? <span className="dg-360-tag dg-360-tag--ok">Recebendo leads</span> : <span className="dg-360-tag dg-360-tag--atencao">Pausou o recebimento de leads</span>)}
            {d.online ? <span className="dg-360-tag dg-360-tag--ok">Online agora</span> : d.ultimoOnlineAt ? <span className="dg-360-tag">Visto {timeAgo(d.ultimoOnlineAt)}</span> : null}
            {!d.avatarUrl && <span className="dg-360-tag">Sem foto no perfil</span>}
          </div>
        </div>
      </div>

      <div className="dg-360-acoes">
        {d.podeMensagem && !msgAberta && <button className="dg-btn dg-btn--forte" onClick={() => setMsgAberta(true)}><Icon name="send" size={13} /> Mandar mensagem</button>}
        <button className="dg-btn" onClick={onFiltrar}><Icon name="search" size={13} /> Ver o dashboard só dele</button>
      </div>
      {msgAberta && <CaixaMensagem corretorId={d.id} nome={d.nome} sugestoes={sugestoes} onEnviada={onRecarregar} onCancelar={() => setMsgAberta(false)} />}

      <Secao titulo="No período" nota={periodo}>
        <div className="dg-360-nums">
          <Numero rotulo="VGV" valor={formatCurrencyShort(n.vgv)} nota={`${n.vendas} venda(s)`} />
          <Numero rotulo="Ranking" valor={n.posicao ? `${n.posicao}º` : '—'} nota={n.posicao ? `de ${n.noRanking} com venda` : 'sem venda no período'} />
          {n.leads != null && <Numero rotulo="Leads recebidos" valor={inteiro(n.leads)} nota={`${inteiro(n.aceitos)} aceito(s)`} />}
          {n.leads != null && <Numero rotulo="Tempo até aceitar" valor={minutos(n.tempoAceiteMin)} nota={n.aceitosAte5minPct != null ? `${pct(n.aceitosAte5minPct)} em até 5 min` : 'mediana'} tom={n.tempoAceiteMin != null && n.tempoAceiteMin > 5 ? 'ruim' : undefined} />}
          {n.leads != null && <Numero rotulo="Deixou passar" valor={inteiro(n.pulos)} nota="lead(s) que pularam por falta de aceite" tom={n.pulos > 0 ? 'ruim' : undefined} />}
          {n.leads != null && <Numero rotulo="Conversão" valor={pct(n.conversao)} nota={`${inteiro(n.convertidos)} lead(s) viraram venda`} />}
        </div>
      </Secao>

      <Secao titulo="Na Pons">
        <div className="dg-360-fatos">
          <div><span>Tempo de casa</span><strong>{tempoDeCasa(d.tempoCasa.dias)}</strong><em>desde {dataBR(d.tempoCasa.desde)}{d.tempoCasa.fonte === 'cadastro' ? ' · data do cadastro no sistema, a entrada real não foi informada' : ''}</em></div>
          <div><span>Gestor</span>{gestores.length ? gestores.map((g: any) => <strong key={g.nome + g.papel}>{g.nome} <em>{g.papel.toLowerCase()}</em></strong>) : <strong>Nenhum gestor cadastrado</strong>}</div>
          <div><span>Contato</span><strong>{d.telefone || 'Sem telefone'}</strong>{d.email && <em>{d.email}</em>}{d.creci && <em>{/^creci/i.test(d.creci) ? d.creci : `CRECI ${d.creci}`}</em>}</div>
          <div><span>Vendas na Pons</span><strong>{d.totais.vendas} · {formatCurrencyShort(d.totais.vgv)}</strong><em>todas as vendas não canceladas</em></div>
        </div>
      </Secao>

      {d.carteira && (
        <Secao titulo="Carteira hoje" nota={`${inteiro(d.carteira.total)} lead(s) com ele`}>
          {d.carteira.etapas.length === 0 ? <div className="dg-vazio">Nenhum lead com ele agora.</div> : d.carteira.etapas.map((e: any) => (
            <div key={e.etapa} className="dg-barra-linha">
              <span className="dg-barra-nome" title={e.etapa}>{e.etapa}</span>
              <span className="dg-barra"><span style={{ width: `${(e.n / maxEtapa) * 100}%` }} /></span>
              <span className="dg-barra-num">{inteiro(e.n)}</span>
            </div>
          ))}
        </Secao>
      )}

      <Secao titulo="Vendas" nota={d.vendas.length >= 40 ? 'últimas 40' : undefined}>
        {d.vendas.length === 0 ? <div className="dg-vazio">Nenhuma venda registrada.</div> : (
          <div className="dg-360-lista">
            {d.vendas.map((v: any) => (
              <div key={v.id} className={`dg-360-item${v.status === 'CANCELADO' ? ' dg-360-item--off' : ''}`}>
                <div style={{ minWidth: 0 }}>
                  <div className="dg-pessoa-nome">{v.cliente}</div>
                  <div className="dg-pessoa-sub">{[v.empreendimento, v.unidade ? `unid. ${v.unidade}` : null, dataBR(v.em)].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="dg-360-item-dir">
                  <strong title={formatCurrency(v.valor)}>{formatCurrencyShort(v.valor)}</strong>
                  <span>{STATUS_VENDA[v.status] || v.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>

      {d.leads && (
        <Secao titulo="Últimos leads" nota="toque para abrir">
          {d.leads.length === 0 ? <div className="dg-vazio">Nenhum lead recebido.</div> : (
            <div className="dg-360-lista">
              {d.leads.map((l: any) => (
                <button key={l.id} type="button" className="dg-360-item dg-360-item--btn" onClick={() => onLead(l.id)}>
                  <div style={{ minWidth: 0 }}>
                    <div className="dg-pessoa-nome">{l.nome || 'Sem nome'}</div>
                    <div className="dg-pessoa-sub">{l.origem} · {timeAgo(l.em)}</div>
                  </div>
                  <div className="dg-360-item-dir">
                    <span className="dg-360-etapa">{l.etapa}</span>
                    <span className={l.aceito ? '' : 'dg-360-txt-ruim'}>{l.aceito ? (l.tempoAceiteMin != null ? `aceito em ${minutos(l.tempoAceiteMin)}` : 'aceito') : 'sem aceite'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Secao>
      )}

      <Secao titulo="Salas e filiais">
        {d.salas.length === 0 ? (
          <div className="dg-card-nota" style={{ lineHeight: 1.5 }}>
            Nenhuma troca registrada. Sala atual: <strong>{d.sala?.nome || 'sem sala'}</strong>. As trocas feitas pela tela de Equipes sempre ficaram registradas; as feitas direto no cadastro passam a ficar a partir de 16/10/2026.
          </div>
        ) : (
          <div className="dg-360-lista">
            {d.salas.map((s: any, i: number) => (
              <div key={i} className="dg-360-item">
                <div style={{ minWidth: 0 }}>
                  <div className="dg-pessoa-nome">{s.de || 'sem ' + s.tipo} <Icon name="arrow_right" size={11} /> {s.para || 'sem ' + s.tipo}</div>
                  <div className="dg-pessoa-sub">{[s.tipo === 'filial' ? 'Troca de filial' : 'Troca de sala', s.por ? `por ${s.por}` : null, s.motivo].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="dg-360-item-dir"><span>{dataBR(s.em)}</span></div>
              </div>
            ))}
          </div>
        )}
      </Secao>

      {d.mensagens.length > 0 && (
        <Secao titulo="Mensagens da gestão">
          <div className="dg-360-lista">
            {d.mensagens.map((m: any) => (
              <div key={m.id} className="dg-360-item dg-360-item--col">
                <div className="dg-pessoa-sub">{m.por || 'Gestão'} · {dataHoraBR(m.em)}</div>
                <div className="dg-360-texto">{m.texto}</div>
              </div>
            ))}
          </div>
        </Secao>
      )}
    </>
  );
}

// ── Lead ───────────────────────────────────────────────────────────────────
function PainelLead({ d, onCorretor, onRecarregar }: { d: any; onCorretor: (id: number) => void; onRecarregar: () => void }) {
  const [msgAberta, setMsgAberta] = useState(false);
  const [ficha, setFicha] = useState(false);
  const [trajeto, setTrajeto] = useState<any[] | null>(null);
  useEffect(() => { Api.transferenciasLead(d.id).then(setTrajeto).catch(() => setTrajeto([])); }, [d.id]);

  const c = d.corretor;
  const pn = primeiroNome(c?.nome);
  const ln = d.nome || 'este lead';
  const sugestoes = useMemo(() => {
    if (!c) return [];
    const s: string[] = [];
    if (!d.aceitoEm && !d.aceiteAutomatico) s.push(`${pn}, o lead ${ln} chegou ${timeAgo(d.distribuidoEm || d.chegouEm)} e ainda não foi aceito. Consegue atender agora?`);
    s.push(`${pn}, como está o atendimento do lead ${ln}?`);
    if (d.venda) s.push(`Parabéns pela venda para ${ln}, ${pn}!`);
    else s.push(`${pn}, me conta o próximo passo com o lead ${ln}.`);
    return s;
  }, [d, c, pn, ln]);

  let aceite: string;
  if (d.aceiteAutomatico) aceite = 'Entrou direto no atendimento pela fila';
  else if (d.aceitoEm) aceite = `Aceito em ${minutos(d.tempoAceiteMin)} · ${dataHoraBR(d.aceitoEm)}`;
  else if (c && d.distribuidoEm) aceite = `Sem aceite há ${timeAgo(d.distribuidoEm).replace('há ', '')}`;
  else aceite = 'Ainda sem corretor';

  return (
    <>
      <div className="dg-360-cab">
        <span className="dg-avatar dg-avatar--g dg-avatar--lead"><Icon name="users" size={22} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="dg-eyebrow">Lead</div>
          <h2 className="dg-360-nome">{d.nome || 'Sem nome'}</h2>
          <div className="dg-pessoa-sub">{[d.telefone, d.cidade].filter(Boolean).join(' · ') || 'Sem contato'}</div>
          <div className="dg-360-tags">
            <span className={`dg-360-tag dg-360-tag--${d.situacao.tipo === 'ok' ? 'ok' : d.situacao.tipo === 'alerta' ? 'atencao' : 'neutro'}`}>{d.situacao.texto}</span>
            {d.etapa !== d.situacao.texto && <span className="dg-360-tag">{d.etapa}</span>}
            {d.vezesRedistribuido > 0 && <span className="dg-360-tag">Passou por {d.vezesRedistribuido + 1} corretores</span>}
          </div>
        </div>
      </div>

      <div className="dg-360-acoes">
        {d.podeMensagem && !msgAberta && <button className="dg-btn dg-btn--forte" onClick={() => setMsgAberta(true)}><Icon name="send" size={13} /> Falar com o corretor</button>}
        <button className="dg-btn" onClick={() => setFicha(true)}><Icon name="doc" size={13} /> Ficha completa</button>
        <a className="dg-btn" href={`/chat?lead=${d.id}`}><Icon name="chat" size={13} /> Abrir no Atendimento</a>
      </div>
      {msgAberta && c && <CaixaMensagem corretorId={c.id} nome={c.nome} sugestoes={sugestoes} leadId={d.id} onEnviada={onRecarregar} onCancelar={() => setMsgAberta(false)} />}

      <Secao titulo="Atendimento">
        <div className="dg-360-fatos">
          <div>
            <span>Corretor</span>
            {c ? (
              <button type="button" className="dg-360-pessoa-btn" onClick={() => onCorretor(c.id)}>
                <Foto nome={c.nome} initials={c.initials} url={c.avatarUrl} />
                <span><strong>{c.nome}</strong><em>{c.sala || 'Sem sala'}{c.ativo ? '' : ' · desativado'} · ver o corretor</em></span>
              </button>
            ) : <strong>Sem corretor</strong>}
          </div>
          <div><span>Aceite</span><strong className={!d.aceitoEm && !d.aceiteAutomatico && c ? 'dg-360-txt-ruim' : ''}>{aceite}</strong>
            {d.puloEm && !d.aceitoEm && <em>{d.puloPausado ? 'O prazo para pular está pausado fora do horário da fila' : `Passa para o próximo corretor ${timeUntil(d.puloEm)}`}</em>}
          </div>
          <div><span>Chegou</span><strong>{dataHoraBR(d.chegouEm)}</strong><em>{timeAgo(d.chegouEm)}{d.fila ? ` · fila ${d.fila}` : ''}</em></div>
          <div><span>Origem</span><strong>{d.campanha || d.formulario || d.origem}</strong><em>{[d.origem, d.conjuntoAnuncio, d.criativo].filter(Boolean).join(' · ')}</em></div>
          {d.interesse && <div><span>Interesse</span><strong>{d.interesse}</strong></div>}
          <div><span>Última movimentação</span><strong>{d.ultimaInteracao ? dataHoraBR(d.ultimaInteracao) : 'Nenhuma registrada'}</strong>{d.ultimaInteracao && <em>{timeAgo(d.ultimaInteracao)}</em>}</div>
          {d.venda && <div><span>Venda</span><strong>{formatCurrency(d.venda.valor)}</strong><em>{[d.venda.empreendimento, STATUS_VENDA[d.venda.status] || d.venda.status, dataBR(d.venda.em)].filter(Boolean).join(' · ')}</em></div>}
        </div>
      </Secao>

      <Secao titulo="Conversa" nota={d.conversa.length ? `${d.conversa.length} mensagem(ns)` : undefined}>
        {d.conversa.length === 0 ? (
          <div className="dg-360-aviso">
            A conversa deste lead não passou pelo sistema: o corretor atende pelo WhatsApp dele. Aqui aparecem o aceite, a etapa do funil e o caminho do lead.
          </div>
        ) : (
          <div className="dg-360-chat">
            {d.conversa.map((m: any) => (
              <div key={m.id} className={`dg-360-bolha dg-360-bolha--${m.autor === 'LEAD' ? 'lead' : m.autor === 'NOTA' ? 'nota' : 'equipe'}`}>
                <div className="dg-360-bolha-autor">{m.autor === 'LEAD' ? (d.nome || 'Lead') : m.autor === 'IA' ? 'Assistente' : m.autor === 'NOTA' ? 'Nota interna' : (c?.nome || 'Corretor')}</div>
                {m.arquivo && !m.texto ? <a href={m.arquivo.url} target="_blank" rel="noreferrer">{m.arquivo.nome || 'Arquivo'}</a> : <div className="dg-360-texto">{m.texto}</div>}
                <div className="dg-360-bolha-hora">{dataHoraBR(m.em)}</div>
              </div>
            ))}
          </div>
        )}
      </Secao>

      {d.notas && <Secao titulo="Notas"><div className="dg-360-texto">{d.notas}</div></Secao>}

      <Secao titulo="Caminho do lead">
        {trajeto === null ? <div className="dg-vazio">Carregando…</div> : <TrajetoTransferencias transfs={trajeto} origem={d.campanha || d.formulario || d.origem} />}
        {d.rastro.length > 0 && (
          <div className="dg-360-rastro">
            {d.rastro.slice(-8).map((r: any) => <div key={r.id}><em>{dataHoraBR(r.em)}</em> {r.texto}</div>)}
          </div>
        )}
      </Secao>

      {ficha && <FichaLeadModal leadId={d.id} onClose={() => setFicha(false)} />}
    </>
  );
}

// ── Gaveta ─────────────────────────────────────────────────────────────────
export function Painel360({ alvo, filtros, onFechar, onFiltrarCorretor }: {
  alvo: Alvo360; filtros: Record<string, unknown>; onFechar: () => void; onFiltrarCorretor: (id: number) => void;
}) {
  const [pilha, setPilha] = useState<Alvo360[]>([alvo]);
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const atual = pilha[pilha.length - 1];
  const chaveFiltros = JSON.stringify({ de: filtros.de, ate: filtros.ate });
  const corpo = useRef<HTMLDivElement>(null);

  useEffect(() => { setPilha([alvo]); }, [alvo.tipo, alvo.id]);
  useEffect(() => {
    let vivo = true;
    setErro(null);
    const req = atual.tipo === 'corretor' ? Api.dashboardCorretor360(atual.id, JSON.parse(chaveFiltros)) : Api.dashboardLead360(atual.id);
    req.then((d) => { if (vivo) setDados({ ...d, _tipo: atual.tipo }); })
      .catch((e: any) => { if (vivo) setErro(e?.status === 403 ? 'Este corretor não faz parte das suas equipes.' : e?.status === 404 ? 'Não encontrado (pode ter sido arquivado).' : 'Não foi possível carregar agora.'); });
    return () => { vivo = false; };
  }, [atual.tipo, atual.id, chaveFiltros, versao]);
  useEffect(() => { corpo.current?.scrollTo?.({ top: 0 }); }, [atual.tipo, atual.id]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = overflow; };
  }, [onFechar]);

  const abrir = (a: Alvo360) => setPilha((p) => [...p, a]);
  const pronto = dados && dados._tipo === atual.tipo && dados.id === atual.id;

  // Portal no <body>: dentro do conteúdo da página o cabeçalho e o menu do app
  // ficavam por cima do painel (escondiam o Fechar e o Voltar).
  return createPortal(
    <>
      <div className="dg-gaveta-fundo" onClick={onFechar} />
      <aside className="dg dg-gaveta" role="dialog" aria-modal="true" aria-label={atual.tipo === 'corretor' ? 'Visão do corretor' : 'Visão do lead'}>
        <div className="dg-gaveta-topo">
          {pilha.length > 1
            ? <button className="dg-btn" onClick={() => setPilha((p) => p.slice(0, -1))}><Icon name="arrow_left" size={13} /> Voltar</button>
            : <span className="dg-eyebrow" style={{ margin: 0 }}>Visão 360</span>}
          <button className="dg-gaveta-x" onClick={onFechar} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </div>
        <div className="dg-gaveta-corpo" ref={corpo}>
          {erro && <div className="dg-vazio">{erro}</div>}
          {!erro && !pronto && <div className="dg-vazio">Carregando…</div>}
          {!erro && pronto && atual.tipo === 'corretor' && (
            <PainelCorretor d={dados} onLead={(id) => abrir({ tipo: 'lead', id })} onFiltrar={() => { onFiltrarCorretor(dados.id); onFechar(); }} onRecarregar={() => setVersao((v) => v + 1)} />
          )}
          {!erro && pronto && atual.tipo === 'lead' && (
            <PainelLead d={dados} onCorretor={(id) => abrir({ tipo: 'corretor', id })} onRecarregar={() => setVersao((v) => v + 1)} />
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}
