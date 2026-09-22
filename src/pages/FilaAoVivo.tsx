import { useCallback, useEffect, useRef, useState } from 'react';
import { Topbar } from '../components/PageHeader';
import { Api } from '../lib/api';
import { Icon } from '../components/Icon';
import './fila-ao-vivo.css';

// Painel AO VIVO da fila (pedido Elison 22/09, mockup de 3 tabelas): o gestor vê
// a ordem real do rodízio, quem está pausado (e a posição que retoma) e os leads
// que entraram — pra acabar com "a fila furou". Atualiza sozinho a cada 15s.

type Dados = Awaited<ReturnType<typeof Api.roletaAoVivo>>;

function horaMin(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function desde(iso: string | null): string {
  if (!iso) return 'nunca recebeu';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function FilaAoVivo() {
  const [filas, setFilas] = useState<any[]>([]);
  const [filaId, setFilaId] = useState<number | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Carrega a lista de filas de atendimento (o gestor escolhe qual acompanhar).
  useEffect(() => {
    Api.roletas('ATENDIMENTO')
      .then((rs) => {
        setFilas(rs);
        if (rs.length) setFilaId((atual) => atual ?? rs[0].id);
      })
      .catch(() => setErro('Não foi possível carregar as filas.'));
  }, []);

  const carregar = useCallback(async (id: number) => {
    try {
      const d = await Api.roletaAoVivo(id);
      setDados(d);
      setAtualizadoEm(new Date());
      setErro(null);
    } catch {
      setErro('Não foi possível atualizar a fila.');
    }
  }, []);

  // Poll a cada 15s da fila selecionada; pausa quando a aba não está visível.
  useEffect(() => {
    if (filaId == null) return;
    carregar(filaId);
    const tick = () => { if (document.visibilityState === 'visible') carregar(filaId); };
    timer.current = setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [filaId, carregar]);

  return (
    <>
      <Topbar title="Fila ao vivo" />
      <div className="main__content">
        <div className="flv-head">
          <div className="flv-head__left">
            <span className="flv-live"><span className="flv-live__dot" /> AO VIVO</span>
            <select className="flv-select" value={filaId ?? ''} onChange={(e) => setFilaId(Number(e.target.value))}>
              {filas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="flv-head__right">
            {atualizadoEm && <span className="flv-atualizado">atualizado {atualizadoEm.toLocaleTimeString('pt-BR')}</span>}
            <button className="flv-refresh" onClick={() => filaId != null && carregar(filaId)} title="Atualizar agora">
              <Icon name="clock" size={16} /> Atualizar
            </button>
          </div>
        </div>

        {erro && <div className="flv-erro">{erro}</div>}

        {dados && (
          <>
            <div className="flv-kpis">
              <div className="flv-kpi"><b>{dados.totalElegiveis}</b><span>na fila (recebendo)</span></div>
              <div className="flv-kpi flv-kpi--pausa"><b>{dados.totalPausados}</b><span>pausados</span></div>
              <div className="flv-kpi"><b>{dados.proximos[0]?.nome?.split(' ')[0] || '—'}</b><span>próximo a receber</span></div>
            </div>

            <div className="flv-grid">
              {/* ── Próximo da fila ── */}
              <section className="flv-card">
                <h3><Icon name="layers" size={16} /> Próximo da fila</h3>
                <div className="flv-tabela">
                  <div className="flv-row flv-row--head"><span>#</span><span>Corretor</span><span>Sala</span><span>Último lead</span></div>
                  {dados.proximos.map((p) => (
                    <div key={p.corretorId} className={'flv-row' + (p.posicao === 1 ? ' flv-row--first' : '')}>
                      <span className="flv-pos">{p.posicao}</span>
                      <span className="flv-nome">{p.nome}</span>
                      <span className="flv-sala">{p.sala}</span>
                      <span className="flv-tempo" title={horaMin(p.ultimaAtribuicao)}>{desde(p.ultimaAtribuicao)}</span>
                    </div>
                  ))}
                  {dados.proximos.length === 0 && <div className="flv-vazio">Ninguém recebendo agora.</div>}
                </div>
              </section>

              {/* ── Pausados ── */}
              <section className="flv-card">
                <h3><Icon name="clock" size={16} /> Pausados</h3>
                <p className="flv-explica">Fora da distribuição. Ao voltar, retomam a posição indicada — não vão pro fim.</p>
                <div className="flv-tabela">
                  <div className="flv-row flv-row--head flv-row--pausa"><span>Corretor</span><span>Sala</span><span>Volta como</span></div>
                  {dados.pausados.map((p) => (
                    <div key={p.corretorId} className="flv-row flv-row--pausa">
                      <span className="flv-nome">{p.nome}</span>
                      <span className="flv-sala">{p.sala}</span>
                      <span className="flv-retoma">{p.posicaoRetoma}º</span>
                    </div>
                  ))}
                  {dados.pausados.length === 0 && <div className="flv-vazio">Ninguém pausado.</div>}
                </div>
              </section>

              {/* ── Leads recebidos ── */}
              <section className="flv-card">
                <h3><Icon name="users" size={16} /> Leads recebidos</h3>
                <div className="flv-tabela flv-tabela--leads">
                  <div className="flv-row flv-row--head flv-row--leads"><span>Corretor</span><span>Lead</span><span>Quando</span></div>
                  {dados.recebidos.map((l, i) => (
                    <div key={i} className="flv-row flv-row--leads">
                      <span className="flv-nome">{l.corretor}<small>{l.sala}</small></span>
                      <span className="flv-lead">{l.lead}</span>
                      <span className="flv-tempo">{horaMin(l.quando)}</span>
                    </div>
                  ))}
                  {dados.recebidos.length === 0 && <div className="flv-vazio">Nenhum lead distribuído nesta fila ainda.</div>}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}
