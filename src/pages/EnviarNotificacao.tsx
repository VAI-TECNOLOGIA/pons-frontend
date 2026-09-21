import { useEffect, useMemo, useState } from 'react';
import { Api } from '../lib/api';
import { formatRole } from '../lib/auth';
import { Icon } from '../components/Icon';
import './enviar-notificacao.css';

// Tela "Enviar notificação" (pedido do Elison 21/09): diretoria/marketing escolhe
// usuários (ou papel, ou todos), escreve título + texto e manda — sino no app +
// push no celular, na hora. A resposta traz o RESULTADO REAL do push (enviado,
// simulado, sem aparelho, desligado, erro) — por isso serve como painel de teste:
// "mandei pro teste android: o servidor disparou pra 1 aparelho?".

type Dest = { id: number; name: string; role: string; unidade: string | null; plataformas: string[] };
type Alvo = 'usuarios' | 'papeis' | 'todos';
type Resultado = {
  destinatarios: number; comDevice: number; semDevice: number; porPlataforma: Record<string, number>;
  sinoOk: boolean; modo: 'real' | 'simulado';
  push: { status: string; success: number; failure: number; tokens: number };
};

const PAPEIS = [
  'CORRETOR', 'GERENTE_EQUIPE', 'SOCIO_UNIDADE', 'GESTOR_TRAFEGO', 'GESTOR_MARKETING', 'MARKETING',
  'ASSESSORA', 'ASSESSORA_MARKETING', 'ADMINISTRATIVO', 'FINANCEIRO', 'ANALISTA',
  'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'DIRETOR_JURIDICO', 'CEO',
];

const plataformaLabel = (p: string) => (p === 'ios' ? 'iPhone' : 'Android');

export default function EnviarNotificacao() {
  const [dest, setDest] = useState<Dest[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [alvo, setAlvo] = useState<Alvo>('usuarios');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [papeis, setPapeis] = useState<Set<string>>(new Set());
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    Api.notificacaoDestinatarios()
      .then(setDest)
      .catch(() => setErro('Não foi possível carregar os usuários.'))
      .finally(() => setCarregando(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return dest;
    return dest.filter((d) => d.name.toLowerCase().includes(q) || formatRole(d.role).toLowerCase().includes(q));
  }, [dest, busca]);

  const comAparelho = useMemo(() => dest.filter((d) => d.plataformas.length > 0).length, [dest]);
  const qtdPrevista = alvo === 'todos'
    ? dest.length
    : alvo === 'papeis'
      ? dest.filter((d) => papeis.has(d.role)).length
      : sel.size;
  const podeEnviar = !!titulo.trim() && !!texto.trim() && qtdPrevista > 0 && !enviando;

  const toggleSel = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePapel = (r: string) => setPapeis((s) => { const n = new Set(s); if (n.has(r)) n.delete(r); else n.add(r); return n; });

  async function enviar() {
    setErro(null);
    setResultado(null);
    if (alvo === 'todos' && !confirm(`Enviar para TODOS os ${dest.length} usuários ativos? Vai tocar no celular de cada um.`)) return;
    setEnviando(true);
    try {
      const r = await Api.notificacaoEnviar({
        titulo: titulo.trim(),
        texto: texto.trim(),
        alvo,
        userIds: alvo === 'usuarios' ? [...sel] : undefined,
        roles: alvo === 'papeis' ? [...papeis] : undefined,
      });
      setResultado(r);
    } catch (e) {
      // Api já traduz o código do servidor (push_desligado, sem_destinatarios…).
      setErro((e as Error)?.message || 'Falha ao enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  // Texto honesto do resultado do push — nada de "receberam" sem prova.
  function linhaPush(r: Resultado): { ok: boolean; texto: string } {
    const plat = Object.entries(r.porPlataforma || {}).map(([p, n]) => `${plataformaLabel(p)} ${n}`).join(' · ');
    switch (r.push.status) {
      case 'enviado':
        return {
          ok: r.push.failure === 0,
          texto: `Push disparado para ${r.push.success} aparelho${r.push.success === 1 ? '' : 's'}${plat ? ` (${plat})` : ''}`
            + (r.push.failure > 0 ? ` — ${r.push.failure} falharam (aparelho desregistrado; será limpo).` : '.'),
        };
      case 'simulado':
        return { ok: false, texto: 'Push NÃO saiu: o servidor está em modo simulado (sem credencial do Firebase). Só o sino foi gravado. Avise a VAI.' };
      case 'sem_tokens':
        return { ok: false, texto: 'Push NÃO saiu: nenhum dos destinatários tem aparelho registrado. Eles precisam abrir o app no celular e aceitar as notificações.' };
      case 'desligado':
        return { ok: false, texto: 'Push NÃO saiu: o evento de envio manual está desligado no catálogo de push.' };
      case 'sem_destinatarios':
        return { ok: false, texto: 'Push NÃO saiu: nenhum destinatário.' };
      default:
        return { ok: false, texto: 'Push falhou no servidor. Tente de novo; se repetir, avise a VAI.' };
    }
  }

  return (
    <div className="env">
      <div className="env__head">
        <Icon name="send" size={22} />
        <h1>Enviar notificação</h1>
      </div>
      <p className="env__sub">
        Chega como sino no app e como push no celular, na hora. Quem não tem aparelho registrado recebe só o sino.
        {!carregando && dest.length > 0 && (
          <> Aparelhos registrados hoje: <b>{comAparelho}</b> de {dest.length} usuários.</>
        )}
      </p>

      {erro && <div className="env__erro">{erro}</div>}

      <div className="env__grid">
        {/* ── Quem recebe ── */}
        <section className="env__card">
          <h2>Quem recebe</h2>
          <div className="env__alvos">
            <label className={'env__alvo' + (alvo === 'usuarios' ? ' is-on' : '')}>
              <input type="radio" name="alvo" checked={alvo === 'usuarios'} onChange={() => setAlvo('usuarios')} />
              Usuários específicos
            </label>
            <label className={'env__alvo' + (alvo === 'papeis' ? ' is-on' : '')}>
              <input type="radio" name="alvo" checked={alvo === 'papeis'} onChange={() => setAlvo('papeis')} />
              Por papel
            </label>
            <label className={'env__alvo' + (alvo === 'todos' ? ' is-on' : '')}>
              <input type="radio" name="alvo" checked={alvo === 'todos'} onChange={() => setAlvo('todos')} />
              Todos ({dest.length})
            </label>
          </div>

          {alvo === 'usuarios' && (
            <>
              <div className="env__busca">
                <Icon name="search" size={16} />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome ou papel"
                  aria-label="Buscar usuário"
                />
              </div>
              <div className="env__lista">
                {carregando ? (
                  <p className="env__muted">Carregando…</p>
                ) : filtrados.length === 0 ? (
                  <p className="env__muted">Nenhum usuário encontrado.</p>
                ) : (
                  filtrados.map((d) => (
                    <label key={d.id} className={'env__item' + (sel.has(d.id) ? ' is-on' : '')}>
                      <input type="checkbox" checked={sel.has(d.id)} onChange={() => toggleSel(d.id)} />
                      <span className="env__item-nome">{d.name}</span>
                      <span className="env__item-meta">
                        {formatRole(d.role)}{d.unidade ? ' · ' + d.unidade : ''}
                      </span>
                      {d.plataformas.length > 0 ? (
                        <span className="env__chip env__chip--ok" title="Tem aparelho registrado: o push chega">
                          {d.plataformas.map(plataformaLabel).join(' + ')}
                        </span>
                      ) : (
                        <span className="env__chip" title="Sem aparelho registrado: recebe só o sino">sem aparelho</span>
                      )}
                    </label>
                  ))
                )}
              </div>
              <div className="env__sel">{sel.size} selecionado{sel.size === 1 ? '' : 's'}</div>
            </>
          )}

          {alvo === 'papeis' && (
            <div className="env__papeis">
              {PAPEIS.map((r) => {
                const n = dest.filter((d) => d.role === r).length;
                if (n === 0) return null;
                return (
                  <label key={r} className={'env__papel' + (papeis.has(r) ? ' is-on' : '')}>
                    <input type="checkbox" checked={papeis.has(r)} onChange={() => togglePapel(r)} />
                    {formatRole(r)} <span className="env__muted">({n})</span>
                  </label>
                );
              })}
            </div>
          )}

          {alvo === 'todos' && (
            <p className="env__muted">
              Vai para todos os {dest.length} usuários ativos e aprovados (cadastros ainda pendentes ficam de fora). Pede confirmação ao enviar.
            </p>
          )}
        </section>

        {/* ── Mensagem ── */}
        <section className="env__card">
          <h2>Mensagem</h2>
          <label className="env__campo">
            <span>Título <small>{titulo.length}/60</small></span>
            <input value={titulo} maxLength={60} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reunião geral amanhã às 9h" />
          </label>
          <label className="env__campo">
            <span>Texto <small>{texto.length}/200</small></span>
            <textarea value={texto} maxLength={200} rows={4} onChange={(e) => setTexto(e.target.value)} placeholder="O que a pessoa vai ler na notificação." />
          </label>

          <div className="env__preview" aria-label="Prévia da notificação">
            <div className="env__preview-app">Grupo Pons · agora</div>
            <div className="env__preview-titulo">{titulo.trim() || 'Título da notificação'}</div>
            <div className="env__preview-texto">{texto.trim() || 'O texto aparece aqui, como no celular.'}</div>
          </div>

          <button type="button" className="env__enviar" disabled={!podeEnviar} onClick={enviar}>
            <Icon name="send" size={16} />
            {enviando ? 'Enviando…' : `Enviar para ${qtdPrevista} usuário${qtdPrevista === 1 ? '' : 's'}`}
          </button>

          {resultado && (() => {
            const p = linhaPush(resultado);
            return (
              <div className={'env__resultado' + (p.ok ? '' : ' env__resultado--alerta')}>
                <Icon name={p.ok ? 'check' : 'bell'} size={18} />
                <div>
                  <b>
                    {resultado.sinoOk
                      ? `Sino gravado para ${resultado.destinatarios} usuário${resultado.destinatarios === 1 ? '' : 's'}.`
                      : `Sino NÃO gravado (${resultado.destinatarios} destinatário${resultado.destinatarios === 1 ? '' : 's'}).`}
                  </b>
                  <div>{p.texto}</div>
                  {resultado.semDevice > 0 && resultado.push.status === 'enviado' && (
                    <div className="env__muted">{resultado.semDevice} sem aparelho registrado — receberam só o sino.</div>
                  )}
                </div>
              </div>
            );
          })()}
        </section>
      </div>
    </div>
  );
}
