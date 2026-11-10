import { useEffect, useState } from 'react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { Modal } from '../../components/Modal';
import { JornadaModal } from './Jornada';

export function KanbanTab() {
  const toast = useToast();
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [campanhaId, setCampanhaId] = useState<number | ''>('');
  const [busca, setBusca] = useState('');
  const [d, setD] = useState<{ etapas: any[]; cards: any[] } | null>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [jornada, setJornada] = useState<number | null>(null);
  const [editEtapas, setEditEtapas] = useState(false);

  const carregar = () => Api.centralKanban({ campanhaId, busca }).then(setD).catch((e) => toast.error(e?.message || 'Falha ao carregar.'));
  useEffect(() => { Api.campanhas().then((r: any) => setCampanhas(r?.campanhas || [])).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(carregar, 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [campanhaId, busca]);

  const mover = async (cardId: number, etapaId: number) => {
    if (!d) return;
    const antes = d;
    setD({ ...d, cards: d.cards.map((c) => (c.id === cardId ? { ...c, etapaId, etapaEm: new Date().toISOString() } : c)) });
    try { await Api.centralKanbanMover(cardId, etapaId); } catch (e: any) { setD(antes); toast.error(e?.message || 'Não consegui mover.'); }
  };

  return (
    <>
      <div className="cc-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="cc-row">
          <select className="field__select" style={{ maxWidth: 280 }} value={campanhaId} onChange={(e) => setCampanhaId(e.target.value ? Number(e.target.value) : '')} aria-label="Campanha">
            <option value="">Todas as campanhas</option>
            {campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <input className="field__input" style={{ maxWidth: 220, fontSize: 16 }} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lead" aria-label="Buscar lead" />
        </div>
        <div className="cc-row">
          {d && !d.cards.length && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={async () => {
              try { const r = await Api.centralKanbanAnteriores(); toast.success(`${r.respondeu} que responderam e ${r.disparado} que receberam entraram no Kanban.`); carregar(); }
              catch (e: any) { toast.error(e?.message || 'Falha.'); }
            }}>Trazer campanhas anteriores</button>
          )}
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditEtapas(true)}>Editar etapas</button>
        </div>
      </div>
      {!d ? <p className="cc-muted">Carregando…</p> : (
        <div className="cc-kanban">
          {d.etapas.map((e) => {
            const cards = d.cards.filter((c) => c.etapaId === e.id);
            return (
              <div key={e.id} className={'cc-col' + (sobre === e.id ? ' is-over' : '')}
                onDragOver={(ev) => { ev.preventDefault(); setSobre(e.id); }} onDragLeave={() => setSobre(null)}
                onDrop={(ev) => { ev.preventDefault(); setSobre(null); if (arrastando != null) mover(arrastando, e.id); setArrastando(null); }}>
                <div className="cc-col__h"><span className="cc-row" style={{ gap: 6 }}><span className="cc-dot" style={{ background: e.cor }} />{e.nome}</span><span className="cc-muted">{cards.length}</span></div>
                {cards.slice(0, 200).map((c) => (
                  <div key={c.id} className="cc-cardk" draggable onDragStart={() => setArrastando(c.id)} onClick={() => setJornada(c.id)} role="button" tabIndex={0} onKeyDown={(k) => { if (k.key === 'Enter') setJornada(c.id); }}>
                    <div className="cc-cardk__n">{c.nome || `Final ${c.final}`}</div>
                    {c.ultimaResposta && <div className="cc-cardk__r">"{c.ultimaResposta}"</div>}
                    <div className="cc-row" style={{ marginTop: 6, gap: 6 }}>
                      <span className="cc-chip" style={{ fontSize: 11 }}>{c.campanha?.nome}</span>
                      {c.fluxoStatus === 'AGUARDANDO' && <span className="cc-chip" style={{ fontSize: 11 }}>follow-up {c.passosEnviados}</span>}
                      {c.corretor && <span className="cc-chip" style={{ fontSize: 11 }}>{c.corretor}</span>}
                    </div>
                  </div>
                ))}
                {cards.length > 200 && <p className="cc-muted">+{cards.length - 200} nesta etapa. Filtre por campanha.</p>}
              </div>
            );
          })}
        </div>
      )}
      {jornada != null && <JornadaModal destId={jornada} onClose={() => setJornada(null)} />}
      {editEtapas && d && <EtapasModal etapas={d.etapas} onClose={(mudou) => { setEditEtapas(false); if (mudou) carregar(); }} />}
    </>
  );
}

function EtapasModal({ etapas, onClose }: { etapas: any[]; onClose: (mudou: boolean) => void }) {
  const toast = useToast();
  const [lista, setLista] = useState<any[]>(etapas.map((e) => ({ ...e })));
  const [busy, setBusy] = useState(false);
  const mover = (i: number, d: number) => { const l = [...lista]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); setLista(l); };
  const salvar = async () => {
    setBusy(true);
    try { await Api.centralEtapasSalvar(lista); toast.success('Etapas salvas.'); onClose(true); }
    catch (e: any) { toast.error(e?.message || 'Falha ao salvar.'); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={() => onClose(false)} title="Etapas do Kanban" subtitle="Os blocos da metodologia Pons. As etapas automáticas (Disparado, Respondeu, Sem interesse, Não respondeu) só mudam nome e cor.">
      <div style={{ display: 'grid', gap: 8 }}>
        {lista.map((e, i) => (
          <div key={e.id || `n${i}`} className="cc-row" style={{ flexWrap: 'nowrap' }}>
            <input type="color" value={e.cor} onChange={(ev) => setLista(lista.map((x, j) => (j === i ? { ...x, cor: ev.target.value } : x)))} aria-label="Cor" style={{ width: 36, height: 34, padding: 0, border: 0, background: 'none' }} />
            <input className="field__input" style={{ fontSize: 16 }} value={e.nome} onChange={(ev) => setLista(lista.map((x, j) => (j === i ? { ...x, nome: ev.target.value } : x)))} />
            <button type="button" className="btn btn--ghost btn--sm" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir">↑</button>
            <button type="button" className="btn btn--ghost btn--sm" disabled={i === lista.length - 1} onClick={() => mover(i, 1)} aria-label="Descer">↓</button>
            <button type="button" className="btn btn--ghost btn--sm" disabled={!!e.papel} onClick={() => setLista(lista.filter((_, j) => j !== i))}>Tirar</button>
          </div>
        ))}
      </div>
      <div className="cc-row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setLista([...lista, { nome: `Bloco ${lista.length}`, cor: '#1258CA' }])}>+ Etapa</button>
        <div className="cc-row">
          <button type="button" className="btn btn--ghost" onClick={() => onClose(false)}>Cancelar</button>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={salvar}>{busy ? 'Salvando…' : 'Salvar etapas'}</button>
        </div>
      </div>
    </Modal>
  );
}
