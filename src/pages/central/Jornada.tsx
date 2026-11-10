import { useEffect, useState } from 'react';
import { Api } from '../../lib/api';
import { Modal } from '../../components/Modal';

const TIPO: Record<string, string> = { DISPARO: 'Campanha enviada', ENVIO: 'Follow-up enviado', FALHA: 'Falha no envio', RESPOSTA: 'Lead respondeu', IA: 'IA assumiu', CORRETOR: 'Corretor assumiu', ETAPA: 'Etapa alterada', FIM: 'Follow-up encerrado', ERRO: 'Aviso' };
const AUTOR: Record<string, string> = { LEAD: 'Cliente', IA: 'IA', CORRETOR: 'Corretor', SISTEMA: 'Sistema' };
const dt = (d: any) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const brl = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function JornadaModal({ destId, onClose }: { destId: number; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { Api.centralJornada(destId).then(setD).catch((e) => setErro(e?.message || 'Falha ao carregar.')); }, [destId]);
  const hist: any[] = Array.isArray(d?.destinatario?.historico) ? d.destinatario.historico : [];
  return (
    <Modal open onClose={onClose} title={d?.destinatario?.nome || d?.lead?.nome || 'Jornada do lead'} subtitle={d ? `${d.destinatario.campanha?.nome || ''} · final ${d.destinatario.final}` : ''} size="lg">
      {erro && <p>{erro}</p>}
      {!d && !erro && <p className="cc-muted">Carregando…</p>}
      {d && (
        <div className="cc-grid2">
          <div>
            <div className="cc-row" style={{ marginBottom: 12 }}>
              {d.etapa && <span className="cc-chip"><span className="cc-dot" style={{ background: d.etapa.cor }} />{d.etapa.nome}</span>}
              {d.lead?.classificacao && <span className="cc-chip">Etiqueta: {d.lead.classificacao}</span>}
              {d.lead?.corretor?.user?.name && <span className="cc-chip">Corretor: {d.lead.corretor.user.name}</span>}
              {d.vendas?.map((v: any) => <span key={v.codigo} className="cc-chip" style={{ borderColor: 'var(--color-success)' }}>Venda {v.codigo}: {brl(v.valorVenda)}</span>)}
            </div>
            <h3 style={{ fontSize: 14 }}>Linha do tempo da campanha</h3>
            {!hist.length ? <p className="cc-muted">Sem eventos ainda.</p> : (
              <div className="cc-linha">
                {hist.map((e, i) => <div key={i} className="cc-ev"><strong>{TIPO[e.tipo] || e.tipo}</strong><small>{dt(e.em)}</small>{e.texto && <div>{e.texto}</div>}</div>)}
              </div>
            )}
          </div>
          <div>
            <h3 style={{ fontSize: 14 }}>Conversa</h3>
            {!d.mensagens?.length ? <p className="cc-muted">Sem mensagens.</p> : (
              <div style={{ maxHeight: 420, overflowY: 'auto', display: 'grid', gap: 8 }}>
                {d.mensagens.map((m: any, i: number) => (
                  <div key={i} style={{ justifySelf: m.autor === 'LEAD' ? 'start' : 'end', maxWidth: '88%', background: m.autor === 'LEAD' ? 'var(--bg-card-hover)' : 'rgba(14,124,155,.1)', borderRadius: 10, padding: '6px 10px', fontSize: 13 }}>
                    <div className="cc-muted" style={{ fontSize: 11 }}>{AUTOR[m.autor] || m.autor} · {dt(m.createdAt)}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.contentType && m.contentType !== 'text' ? `[${m.contentType}] ` : ''}{m.texto}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
