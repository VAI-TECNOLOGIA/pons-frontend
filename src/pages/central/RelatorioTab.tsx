import { useEffect, useState } from 'react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { Modal } from '../../components/Modal';
import { JornadaModal } from './Jornada';

const n = (v: any) => (Number(v) || 0).toLocaleString('pt-BR');
const pct = (a: number, b: number) => (b ? `${(Math.round((a / b) * 1000) / 10).toLocaleString('pt-BR')}%` : '—');
const brl = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const STATUS: Record<string, string> = { RASCUNHO: 'Rascunho', AGENDADA: 'Agendada', ENVIANDO: 'Enviando', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' };
const ENVIO: Record<string, string> = { PENDENTE: 'Na fila', ENVIADO: 'Enviado', ENTREGUE: 'Entregue', LIDO: 'Lido', RESPONDIDO: 'Respondeu', FALHOU: 'Falhou' };

export function RelatorioTab() {
  const toast = useToast();
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [campanhaId, setCampanhaId] = useState<number | ''>('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [d, setD] = useState<any>(null);
  const [leads, setLeads] = useState<{ campanha: any; linhas: any[] } | null>(null);
  const [jornada, setJornada] = useState<number | null>(null);

  useEffect(() => { Api.campanhas().then((r: any) => setCampanhas(r?.campanhas || [])).catch(() => {}); }, []);
  useEffect(() => {
    setD(null);
    Api.centralRelatorio({ campanhaId, de, ate }).then(setD).catch((e) => toast.error(e?.message || 'Falha ao carregar.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaId, de, ate]);

  const abrirLeads = async (c: any) => {
    try { setLeads({ campanha: c, linhas: await Api.centralRelatorioLeads(c.id) }); } catch (e: any) { toast.error(e?.message || 'Falha.'); }
  };
  const exportar = () => {
    if (!leads) return;
    const cab = ['Nome', 'Final do telefone', 'Envio', 'Enviado em', 'Respondeu em', 'Última resposta', 'Etapa Kanban', 'Etapa CRM', 'Etiqueta', 'Corretor', 'Mensagens enviadas', 'Erro'];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const dt = (v: any) => (v ? new Date(v).toLocaleString('pt-BR') : '');
    const linhas = leads.linhas.map((l) => [l.nome, l.final, ENVIO[l.status] || l.status, dt(l.enviadoEm), dt(l.respondeuEm), l.ultimaResposta, l.etapa, l.etapaCrm, l.etiqueta, l.corretor, l.passosEnviados, l.erro].map(esc).join(';'));
    const blob = new Blob(['﻿' + [cab.map(esc).join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `campanha-${leads.campanha.nome}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  };

  const g = d?.geral;
  const funil: [string, number][] = g ? [
    ['Público', g.destinatarios], ['Enviadas', g.enviados], ['Entregues', g.entregues], ['Lidas', g.lidos],
    ['Responderam', g.responderam], ['Avançaram nos blocos', g.emBlocos], ['Visita ou negociação', g.visitas], ['Venda', g.vendas],
  ] : [];
  const topo = Math.max(1, ...funil.map(([, v]) => v));

  return (
    <>
      <div className="cc-row" style={{ marginBottom: 14 }}>
        <select className="field__select" style={{ maxWidth: 280 }} value={campanhaId} onChange={(e) => setCampanhaId(e.target.value ? Number(e.target.value) : '')} aria-label="Campanha">
          <option value="">Todas as campanhas</option>
          {campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <label className="cc-row cc-muted">de <input type="date" className="field__input" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label className="cc-row cc-muted">até <input type="date" className="field__input" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
      </div>
      {!d ? <p className="cc-muted">Carregando…</p> : (
        <>
          <div className="cc-kpis">
            <div className="cc-kpi"><div className="cc-kpi__l">Enviadas</div><div className="cc-kpi__v">{n(g.enviados)}</div><div className="cc-kpi__s">{pct(g.entregues, g.enviados)} entregues</div></div>
            <div className="cc-kpi"><div className="cc-kpi__l">Lidas</div><div className="cc-kpi__v">{n(g.lidos)}</div><div className="cc-kpi__s">{pct(g.lidos, g.entregues)} das entregues</div></div>
            <div className="cc-kpi"><div className="cc-kpi__l">Responderam</div><div className="cc-kpi__v">{n(g.responderam)}</div><div className="cc-kpi__s">{pct(g.responderam, g.enviados)} de resposta</div></div>
            <div className="cc-kpi"><div className="cc-kpi__l">Sem interesse</div><div className="cc-kpi__v">{n(g.semInteresse)}</div><div className="cc-kpi__s">{n(g.naoResponderam)} não responderam</div></div>
            <div className="cc-kpi"><div className="cc-kpi__l">Vendas</div><div className="cc-kpi__v">{n(g.vendas)}</div><div className="cc-kpi__s">{brl(g.vgv)} em VGV</div></div>
          </div>
          <div className="cc-grid2" style={{ marginBottom: 16 }}>
            <div className="cc-card">
              <h3>Funil da campanha</h3>
              <div className="cc-funil">
                {funil.map(([rot, v]) => (
                  <div key={rot} className="cc-funil__l"><span>{rot}</span><div className="cc-funil__bar"><span style={{ width: `${(v / topo) * 100}%` }} /></div><strong style={{ textAlign: 'right' }}>{n(v)}</strong></div>
                ))}
              </div>
            </div>
            <div className="cc-card">
              <h3>Onde estão os leads (Kanban)</h3>
              <div className="cc-funil">
                {d.etapas.map((e: any) => {
                  const v = g.porEtapa?.[e.id] || 0;
                  return (
                    <div key={e.id} className="cc-funil__l">
                      <span className="cc-row" style={{ gap: 6 }}><span className="cc-dot" style={{ background: e.cor }} />{e.nome}</span>
                      <div className="cc-funil__bar"><span style={{ width: `${(v / Math.max(1, g.destinatarios)) * 100}%`, background: e.cor }} /></div>
                      <strong style={{ textAlign: 'right' }}>{n(v)}</strong>
                    </div>
                  );
                })}
              </div>
              {!!Object.keys(g.respondeuNaAbordagem || {}).length && (
                <>
                  <h3 style={{ marginTop: 16 }}>Respondeu em qual mensagem</h3>
                  <div className="cc-row">{Object.entries(g.respondeuNaAbordagem).sort().map(([k, v]) => <span key={k} className="cc-chip">{k}: {n(v)}</span>)}</div>
                </>
              )}
            </div>
          </div>
          <div className="cc-card" style={{ marginBottom: 16 }}>
            <h3>Por campanha</h3>
            <div className="cc-scroll">
              <table className="cc-table">
                <thead><tr><th>Campanha</th><th>Situação</th><th className="num">Público</th><th className="num">Enviadas</th><th className="num">Lidas</th><th className="num">Responderam</th><th className="num">Taxa</th><th className="num">Vendas</th><th className="num">VGV</th><th></th></tr></thead>
                <tbody>{d.porCampanha.map((c: any) => (
                  <tr key={c.id}>
                    <td><strong>{c.nome}</strong><div className="cc-muted">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</div></td>
                    <td>{STATUS[c.status] || c.status}</td>
                    <td className="num">{n(c.resumo.destinatarios)}</td><td className="num">{n(c.resumo.enviados)}</td><td className="num">{n(c.resumo.lidos)}</td>
                    <td className="num">{n(c.resumo.responderam)}</td><td className="num">{pct(c.resumo.responderam, c.resumo.enviados)}</td>
                    <td className="num">{n(c.resumo.vendas)}</td><td className="num">{brl(c.resumo.vgv)}</td>
                    <td><button type="button" className="btn btn--ghost btn--sm" onClick={() => abrirLeads(c)}>Leads</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <div className="cc-card">
            <h3>Por corretor</h3>
            <div className="cc-scroll">
              <table className="cc-table">
                <thead><tr><th>Corretor</th><th className="num">Leads</th><th className="num">Responderam</th><th className="num">Vendas</th><th className="num">VGV</th></tr></thead>
                <tbody>{d.porCorretor.map((r: any) => <tr key={r.corretor}><td>{r.corretor}</td><td className="num">{n(r.leads)}</td><td className="num">{n(r.responderam)}</td><td className="num">{n(r.vendas)}</td><td className="num">{brl(r.vgv)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {leads && (
        <Modal open onClose={() => setLeads(null)} title={`Leads da campanha ${leads.campanha.nome}`} subtitle={`${n(leads.linhas.length)} contatos. Clique num lead para ver a jornada.`} size="lg">
          <div className="cc-row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}><button type="button" className="btn btn--secondary btn--sm" onClick={exportar}>Baixar planilha (Excel)</button></div>
          <div className="cc-scroll" style={{ maxHeight: 460 }}>
            <table className="cc-table">
              <thead><tr><th>Nome</th><th>Envio</th><th>Respondeu</th><th>Etapa</th><th>Corretor</th></tr></thead>
              <tbody>{leads.linhas.map((l) => (
                <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setJornada(l.id)}>
                  <td>{l.nome || `Final ${l.final}`}</td>
                  <td>{ENVIO[l.status] || l.status}</td>
                  <td>{l.respondeuEm ? new Date(l.respondeuEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}{l.ultimaResposta && <div className="cc-muted">"{String(l.ultimaResposta).slice(0, 60)}"</div>}</td>
                  <td>{l.etapa || '—'}</td>
                  <td>{l.corretor || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Modal>
      )}
      {jornada != null && <JornadaModal destId={jornada} onClose={() => setJornada(null)} />}
    </>
  );
}
