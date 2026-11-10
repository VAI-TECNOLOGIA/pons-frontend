import { useEffect, useState } from 'react';
import { Api } from '../../lib/api';

const STATUS: Record<string, string> = { AGENDADA: 'Agendada', ENVIANDO: 'Enviando' };
const n = (v: any) => (Number(v) || 0).toLocaleString('pt-BR');

export function PainelTab({ irPara }: { irPara: (aba: any) => void }) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { Api.centralPainel().then(setD).catch((e) => setErro(e?.message || 'Falha ao carregar.')); }, []);
  if (erro) return <div className="cc-card">{erro}</div>;
  if (!d) return <div className="cc-muted">Carregando…</div>;
  return (
    <>
      <div className="cc-kpis">
        <div className="cc-kpi"><div className="cc-kpi__l">Mensagens enviadas</div><div className="cc-kpi__v">{n(d.enviados)}</div><div className="cc-kpi__s">em {n(d.campanhas)} campanhas</div></div>
        <div className="cc-kpi"><div className="cc-kpi__l">Responderam</div><div className="cc-kpi__v">{n(d.respondidos)}</div><div className="cc-kpi__s">{String(d.taxaResposta).replace('.', ',')}% de resposta</div></div>
        <div className="cc-kpi"><div className="cc-kpi__l">No follow-up agora</div><div className="cc-kpi__v">{n(d.aguardando)}</div><div className="cc-kpi__s">aguardando resposta</div></div>
        <div className="cc-kpi"><div className="cc-kpi__l">Campanhas em andamento</div><div className="cc-kpi__v">{n(d.emAndamento)}</div><div className="cc-kpi__s">agendadas ou enviando</div></div>
        <div className="cc-kpi"><div className="cc-kpi__l">Follow-ups ativos</div><div className="cc-kpi__v">{n(d.followups)}</div><div className="cc-kpi__s">{n(d.listas)} listas de público</div></div>
      </div>
      <div className="cc-grid2">
        <div className="cc-card">
          <h3>Próximos disparos</h3>
          {!d.proximas?.length ? <p className="cc-muted">Nenhuma campanha agendada ou enviando.</p> : (
            <table className="cc-table">
              <thead><tr><th>Campanha</th><th>Situação</th><th className="num">Enviadas</th></tr></thead>
              <tbody>
                {d.proximas.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.nome}{c.agendadoPara && c.status === 'AGENDADA' && <div className="cc-muted">{new Date(c.agendadoPara).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>}</td>
                    <td>{STATUS[c.status] || c.status}</td>
                    <td className="num">{n(c.enviados)} / {n(c.totalDestinatarios)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="cc-card">
          <h3>Como montar uma campanha</h3>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 14 }}>
            <li><button type="button" className="btn btn--ghost btn--sm" onClick={() => irPara('publico')}>Público e bases</button> escolha quem recebe (filtros da base ou planilha importada) e salve como lista.</li>
            <li><button type="button" className="btn btn--ghost btn--sm" onClick={() => irPara('followup')}>Follow-up</button> monte as próximas abordagens para quem não responder e os caminhos pela resposta.</li>
            <li><button type="button" className="btn btn--ghost btn--sm" onClick={() => irPara('campanhas')}>Campanhas</button> crie a campanha com a lista, o modelo aprovado e o follow-up, e dispare ou agende.</li>
            <li><button type="button" className="btn btn--ghost btn--sm" onClick={() => irPara('kanban')}>Kanban</button> acompanhe em que etapa cada lead parou.</li>
            <li><button type="button" className="btn btn--ghost btn--sm" onClick={() => irPara('relatorio')}>Relatório</button> veja o funil da campanha até a venda e a jornada de cada lead.</li>
          </ol>
        </div>
      </div>
    </>
  );
}
