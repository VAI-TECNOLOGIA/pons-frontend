// Follow-up configurável (Pons 10/11): passos quando o lead não responde e caminhos pela resposta.
import { useEffect, useMemo, useState } from 'react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';

type No = {
  id: string; titulo: string;
  envio?: { tipo: 'TEMPLATE' | 'TEXTO'; templateName?: string; templateLang?: string; vars?: string[]; texto?: string; templateReabrir?: string | null } | null;
  espera: { horas: number; horarios: string[] };
  seSemResposta: string; seRespondeu: string; seInteresse?: string | null; seSemInteresse?: string | null;
  palavrasInteresse?: string; palavrasSemInteresse?: string;
  etapaId?: number | null; tag?: string | null;
};
const ESPECIAIS: Record<string, string> = { IA: 'A IA assume', CORRETOR: 'O corretor assume', FIM: 'Encerra' };
const CORES = { sem: '#94A3B8', resp: '#0E7C9B', int: '#16A34A', semint: '#DC2626' };
const W = 236, H = 104, GX = 90, GY = 34, PAD = 24;

function rotuloDestino(d: string | null | undefined, nos: No[]) {
  if (!d) return '—';
  if (ESPECIAIS[d]) return ESPECIAIS[d];
  return nos.find((n) => n.id === d)?.titulo || d;
}
function resumoEspera(e: No['espera']) {
  const partes = [];
  if (e?.horas) partes.push(`${e.horas}h`);
  if (e?.horarios?.length) partes.push(`às ${e.horarios.join(' / ')}`);
  return partes.length ? `espera ${partes.join(' ')}` : 'sem espera';
}

// Distribui os passos em colunas a partir do inicial (caminho mais curto).
function layout(nos: No[]) {
  const nivel = new Map<string, number>();
  const fila = ['inicio'];
  nivel.set('inicio', 0);
  while (fila.length) {
    const id = fila.shift()!;
    const no = nos.find((n) => n.id === id);
    if (!no) continue;
    for (const d of [no.seSemResposta, no.seRespondeu, no.seInteresse, no.seSemInteresse]) {
      if (d && !ESPECIAIS[d] && nos.some((n) => n.id === d) && !nivel.has(d)) { nivel.set(d, nivel.get(id)! + 1); fila.push(d); }
    }
  }
  const max = Math.max(0, ...nivel.values());
  nos.forEach((n) => { if (!nivel.has(n.id)) nivel.set(n.id, max + 1); });
  const colunas = new Map<number, string[]>();
  nos.forEach((n) => { const l = nivel.get(n.id)!; colunas.set(l, [...(colunas.get(l) || []), n.id]); });
  const pos = new Map<string, { x: number; y: number }>();
  for (const [l, ids] of colunas) ids.forEach((id, i) => pos.set(id, { x: PAD + l * (W + GX), y: PAD + i * (H + GY) }));
  const largura = PAD * 2 + (Math.max(...colunas.keys(), 0) + 1) * (W + GX) - GX;
  const altura = PAD * 2 + Math.max(...[...colunas.values()].map((c) => c.length), 1) * (H + GY) - GY + 40;
  return { pos, largura, altura };
}

export function FollowUpTab() {
  const toast = useToast();
  const [lista, setLista] = useState<any[]>([]);
  const [atual, setAtual] = useState<{ id: number | null; nome: string; descricao?: string; ativo: boolean; nos: No[] } | null>(null);
  const [sel, setSel] = useState('inicio');
  const [templates, setTemplates] = useState<any[]>([]);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);

  const carregar = () => Api.centralFollowups().then(setLista).catch(() => {});
  useEffect(() => {
    carregar();
    Api.whatsappTemplates().then((r: any) => setTemplates((r.items || []).filter((t: any) => !t.status || t.status === 'APPROVED'))).catch(() => {});
    Api.centralEtapas().then(setEtapas).catch(() => {});
    Api.centralTags().then(setTags).catch(() => {});
  }, []);

  const novo = async () => {
    const m = await Api.centralFollowupModelo();
    setAtual({ id: null, nome: m.nome, ativo: true, nos: m.nos });
    setSel('inicio');
  };
  const abrir = (f: any) => { setAtual({ id: f.id, nome: f.nome, descricao: f.descricao, ativo: f.ativo, nos: f.nos || [] }); setSel('inicio'); };
  const salvar = async () => {
    if (!atual) return;
    setSalvando(true);
    try {
      const r = await Api.centralFollowupSalvar(atual.id, { nome: atual.nome, descricao: atual.descricao || null, ativo: atual.ativo, nos: atual.nos });
      setAtual({ ...atual, id: r.id });
      toast.success('Follow-up salvo. Escolha ele na campanha.');
      carregar();
    } catch (e: any) { toast.error(e?.message || 'Não consegui salvar.'); } finally { setSalvando(false); }
  };

  const no = atual?.nos.find((n) => n.id === sel) || null;
  const alterarNo = (patch: Partial<No>) => setAtual((a) => a && ({ ...a, nos: a.nos.map((n) => (n.id === sel ? { ...n, ...patch } : n)) }));
  const addPasso = () => {
    if (!atual) return;
    let i = atual.nos.length + 1;
    while (atual.nos.some((n) => n.id === `p${i}`)) i++;
    const id = `p${i}`;
    const novoNo: No = { id, titulo: `${i}ª abordagem`, envio: { tipo: 'TEMPLATE', templateName: '', vars: [] }, espera: { horas: 24, horarios: [] }, seSemResposta: 'FIM', seRespondeu: 'IA', seSemInteresse: 'FIM', palavrasSemInteresse: 'não tenho interesse, sem interesse, pare, remover, não quero' };
    // Liga o passo selecionado ao novo quando ele terminava sem resposta.
    const nos = atual.nos.map((n) => (n.id === sel && n.seSemResposta === 'FIM' ? { ...n, seSemResposta: id } : n));
    setAtual({ ...atual, nos: [...nos, novoNo] });
    setSel(id);
  };
  const removerPasso = () => {
    if (!atual || sel === 'inicio') return;
    const nos = atual.nos.filter((n) => n.id !== sel).map((n) => {
      const c = { ...n };
      (['seSemResposta', 'seRespondeu', 'seInteresse', 'seSemInteresse'] as const).forEach((k) => { if (c[k] === sel) (c as any)[k] = k === 'seRespondeu' ? 'IA' : k === 'seSemResposta' ? 'FIM' : null; });
      return c;
    });
    setAtual({ ...atual, nos });
    setSel('inicio');
  };

  const mapa = useMemo(() => (atual ? layout(atual.nos) : null), [atual]);
  const destinos = (atual?.nos || []).filter((n) => n.id !== sel).map((n) => ({ v: n.id, l: n.titulo || n.id }));
  const selDestino = (label: string, valor: string | null | undefined, onChange: (v: string | null) => void, permitirVazio = false, extras = ['IA', 'CORRETOR', 'FIM']) => (
    <div className="field"><label className="field__label">{label}</label>
      <select className="field__select" value={valor || ''} onChange={(e) => onChange(e.target.value || null)}>
        {permitirVazio && <option value="">Igual a "respondeu"</option>}
        {extras.map((x) => <option key={x} value={x}>{ESPECIAIS[x]}</option>)}
        {destinos.map((d) => <option key={d.v} value={d.v}>Ir para: {d.l}</option>)}
      </select>
    </div>
  );

  if (!atual) {
    return (
      <div className="cc-card">
        <div className="cc-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Follow-ups</h3>
            <p className="cc-muted" style={{ margin: '4px 0 0' }}>O que acontece quando o lead não responde: as próximas abordagens, os horários e para onde ele vai quando responde.</p>
          </div>
          <button type="button" className="btn btn--primary btn--sm" onClick={novo}>+ Novo follow-up</button>
        </div>
        {!lista.length ? <p className="cc-muted">Nenhum follow-up ainda. Comece pelo modelo de 3 abordagens e ajuste do jeito da Pons.</p> : (
          <table className="cc-table">
            <thead><tr><th>Nome</th><th className="num">Passos</th><th>Situação</th><th></th></tr></thead>
            <tbody>{lista.map((f) => (
              <tr key={f.id}>
                <td><strong>{f.nome}</strong>{f.descricao && <div className="cc-muted">{f.descricao}</div>}</td>
                <td className="num">{(f.nos || []).length}</td>
                <td>{f.ativo ? 'Ativo' : 'Desligado'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => abrir(f)}>Editar</button>{' '}
                  <button type="button" className="btn btn--ghost btn--sm" onClick={async () => { if (!window.confirm(`Apagar o follow-up "${f.nome}"?`)) return; try { await Api.centralFollowupApagar(f.id); carregar(); } catch (e: any) { toast.error(e?.message || 'Falha.'); } }}>Apagar</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="cc-card" style={{ marginBottom: 14 }}>
        <div className="cc-row" style={{ justifyContent: 'space-between' }}>
          <div className="cc-row" style={{ flex: 1, minWidth: 260 }}>
            <input className="field__input" style={{ fontSize: 16, fontWeight: 700, maxWidth: 360 }} value={atual.nome} onChange={(e) => setAtual({ ...atual, nome: e.target.value })} aria-label="Nome do follow-up" />
            <label className="cc-row" style={{ fontSize: 14 }}><input type="checkbox" checked={atual.ativo} onChange={(e) => setAtual({ ...atual, ativo: e.target.checked })} /> Ativo</label>
          </div>
          <div className="cc-row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setAtual(null); carregar(); }}>Voltar</button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={addPasso}>+ Passo</button>
            <button type="button" className="btn btn--primary btn--sm" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar follow-up'}</button>
          </div>
        </div>
        <div className="cc-row" style={{ marginTop: 10, fontSize: 12 }}>
          <span className="cc-chip"><span className="cc-dot" style={{ background: CORES.sem }} />Sem resposta</span>
          <span className="cc-chip"><span className="cc-dot" style={{ background: CORES.resp }} />Respondeu</span>
          <span className="cc-chip"><span className="cc-dot" style={{ background: CORES.int }} />Com interesse</span>
          <span className="cc-chip"><span className="cc-dot" style={{ background: CORES.semint }} />Sem interesse</span>
        </div>
      </div>

      <div className="cc-fu">
        <div className="cc-mapa">
          {mapa && (
            <svg width={mapa.largura} height={mapa.altura} role="img" aria-label="Mapa do follow-up">
              <defs>
                {Object.entries(CORES).map(([k, c]) => (
                  <marker key={k} id={`seta-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={c} /></marker>
                ))}
              </defs>
              {atual.nos.flatMap((n) => {
                const a = mapa.pos.get(n.id)!;
                const ligas: [string | null | undefined, keyof typeof CORES, string][] = [[n.seSemResposta, 'sem', 'sem resposta'], [n.seRespondeu, 'resp', 'respondeu'], [n.seInteresse, 'int', 'interesse'], [n.seSemInteresse, 'semint', 'sem interesse']];
                return ligas.filter(([d]) => d && mapa.pos.has(d)).map(([d, k, rot], i) => {
                  const b = mapa.pos.get(d!)!;
                  const x1 = a.x + W, y1 = a.y + 22 + i * 18, x2 = b.x, y2 = b.y + H / 2;
                  const tras = x2 <= x1;
                  const path = tras
                    ? `M${x1},${y1} C${x1 + 60},${y1} ${x1 + 60},${Math.max(a.y, b.y) + H + 26} ${(x1 + x2) / 2},${Math.max(a.y, b.y) + H + 26} S${x2 - 60},${y2} ${x2},${y2}`
                    : `M${x1},${y1} C${x1 + GX / 2},${y1} ${x2 - GX / 2},${y2} ${x2},${y2}`;
                  return (
                    <g key={`${n.id}-${k}`}>
                      <path className="cc-aresta" d={path} stroke={CORES[k]} strokeDasharray={k === 'sem' ? '5 4' : undefined} markerEnd={`url(#seta-${k})`} />
                      <text className="cc-aresta-l" x={tras ? (x1 + x2) / 2 : (x1 + x2) / 2} y={tras ? Math.max(a.y, b.y) + H + 20 : (y1 + y2) / 2 - 4} textAnchor="middle" fill={CORES[k]}>{rot}</text>
                    </g>
                  );
                });
              })}
              {atual.nos.map((n) => {
                const p = mapa.pos.get(n.id)!;
                const especiais = [['respondeu', n.seRespondeu], ['sem resposta', n.seSemResposta], ['interesse', n.seInteresse], ['sem interesse', n.seSemInteresse]].filter(([, d]) => d && ESPECIAIS[d as string]);
                const envio = n.id === 'inicio' ? 'Mensagem da campanha' : n.envio?.tipo === 'TEXTO' ? `Texto: ${(n.envio?.texto || '').slice(0, 26)}` : `Modelo: ${n.envio?.templateName || 'escolher'}`;
                return (
                  <g key={n.id} className={'cc-no' + (sel === n.id ? ' is-sel' : '')} transform={`translate(${p.x},${p.y})`} onClick={() => setSel(n.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSel(n.id); }}>
                    <rect width={W} height={H} rx={12} />
                    <text className="t1" x={12} y={22}>{(n.titulo || n.id).slice(0, 28)}</text>
                    <text className="t2" x={12} y={42}>{envio.slice(0, 34)}</text>
                    <text className="t2" x={12} y={60}>{resumoEspera(n.espera)}</text>
                    {especiais.slice(0, 2).map(([rot, d], i) => <text key={i} className="t2" x={12} y={78 + i * 15}>{`${rot} → ${ESPECIAIS[d as string]}`}</text>)}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {no && (
          <div className="cc-card cc-painel">
            <div className="cc-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>{no.id === 'inicio' ? 'Passo inicial' : 'Passo'}</h3>
              {no.id !== 'inicio' && <button type="button" className="btn btn--ghost btn--sm" onClick={removerPasso}>Remover passo</button>}
            </div>
            <div className="field"><label className="field__label">Nome do passo</label><input className="field__input" style={{ fontSize: 16 }} value={no.titulo} onChange={(e) => alterarNo({ titulo: e.target.value })} /></div>
            {no.id === 'inicio' ? (
              <p className="cc-hint">Este passo é a mensagem da própria campanha. Aqui você define quanto esperar a resposta e o que acontece depois.</p>
            ) : (
              <>
                <div className="field"><label className="field__label">Mensagem</label>
                  <select className="field__select" value={no.envio?.tipo || 'TEMPLATE'} onChange={(e) => alterarNo({ envio: { ...(no.envio || {}), tipo: e.target.value as any } })}>
                    <option value="TEMPLATE">Modelo aprovado (funciona com a janela fechada)</option>
                    <option value="TEXTO">Texto livre (só com a janela de 24h aberta)</option>
                  </select>
                </div>
                {(no.envio?.tipo || 'TEMPLATE') === 'TEMPLATE' ? (
                  <ModeloComVars templates={templates} nome={no.envio?.templateName || ''} vars={no.envio?.vars || []} onChange={(templateName, vars, lang) => alterarNo({ envio: { ...(no.envio || { tipo: 'TEMPLATE' }), tipo: 'TEMPLATE', templateName, vars, templateLang: lang } })} />
                ) : (
                  <>
                    <div className="field"><label className="field__label">Texto</label>
                      <textarea className="field__input" rows={4} style={{ fontSize: 16 }} value={no.envio?.texto || ''} onChange={(e) => alterarNo({ envio: { ...(no.envio || { tipo: 'TEXTO' }), tipo: 'TEXTO', texto: e.target.value } })} placeholder="Ex.: {{nome}}, conseguiu ver a mensagem anterior?" />
                      <div className="cc-hint">Use {'{{nome}}'} para o primeiro nome do cliente.</div>
                    </div>
                    <div className="field"><label className="field__label">Se a janela estiver fechada, reabrir com o modelo</label>
                      <select className="field__select" value={no.envio?.templateReabrir || ''} onChange={(e) => alterarNo({ envio: { ...(no.envio || { tipo: 'TEXTO' }), tipo: 'TEXTO', templateReabrir: e.target.value || null } })}>
                        <option value="">Não enviar (pula para "sem resposta")</option>
                        {templates.filter((t) => !t.varCount).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </>
            )}
            <div className="cc-filtros" style={{ marginTop: 6 }}>
              <div className="field"><label className="field__label">Esperar (horas)</label><input type="number" min={0} className="field__input" value={no.espera?.horas ?? 0} onChange={(e) => alterarNo({ espera: { ...no.espera, horas: Number(e.target.value) || 0 } })} /></div>
              <div className="field"><label className="field__label">Horários fixos (opcional)</label><input className="field__input" style={{ fontSize: 16 }} value={(no.espera?.horarios || []).join(', ')} onChange={(e) => alterarNo({ espera: { ...no.espera, horarios: e.target.value.split(/[,;\s]+/).filter(Boolean) } })} placeholder="10:00, 18:00" /></div>
            </div>
            <div className="cc-hint" style={{ marginBottom: 8 }}>Depois da espera, o próximo passo sai no primeiro horário fixo (horário de Brasília). A janela da Meta é de 24h; lead que veio de anúncio de WhatsApp tem 3 dias.</div>
            {selDestino('Se não responder', no.seSemResposta, (v) => alterarNo({ seSemResposta: v || 'FIM' }), false, ['FIM'])}
            {selDestino('Se responder', no.seRespondeu, (v) => alterarNo({ seRespondeu: v || 'IA' }))}
            {selDestino('Se responder com interesse', no.seInteresse, (v) => alterarNo({ seInteresse: v }), true)}
            {no.seInteresse && <div className="field"><label className="field__label">Palavras de interesse</label><input className="field__input" style={{ fontSize: 16 }} value={no.palavrasInteresse || ''} onChange={(e) => alterarNo({ palavrasInteresse: e.target.value })} placeholder="quero, tenho interesse, valor, visita" /></div>}
            {selDestino('Se responder sem interesse', no.seSemInteresse, (v) => alterarNo({ seSemInteresse: v }), true)}
            {no.seSemInteresse && <div className="field"><label className="field__label">Palavras de sem interesse</label><input className="field__input" style={{ fontSize: 16 }} value={no.palavrasSemInteresse || ''} onChange={(e) => alterarNo({ palavrasSemInteresse: e.target.value })} /></div>}
            <div className="cc-filtros">
              <div className="field"><label className="field__label">Mover no Kanban para</label>
                <select className="field__select" value={no.etapaId || ''} onChange={(e) => alterarNo({ etapaId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Não mover</option>
                  {etapas.map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
              <div className="field"><label className="field__label">Marcar tag</label>
                <select className="field__select" value={no.tag || ''} onChange={(e) => alterarNo({ tag: e.target.value || null })}>
                  <option value="">Nenhuma</option>
                  {tags.map((t: any) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ModeloComVars({ templates, nome, vars, onChange }: { templates: any[]; nome: string; vars: string[]; onChange: (nome: string, vars: string[], lang: string) => void }) {
  const tpl = templates.find((t) => t.name === nome);
  const qtd = tpl?.varCount || 0;
  return (
    <>
      <div className="field"><label className="field__label">Modelo aprovado</label>
        <select className="field__select" value={nome} onChange={(e) => { const t = templates.find((x) => x.name === e.target.value); onChange(e.target.value, Array.from({ length: t?.varCount || 0 }, (_, i) => (i === 0 ? '{{nome}}' : '')), t?.language || 'pt_BR'); }}>
          <option value="">Escolha o modelo</option>
          {templates.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        {tpl?.bodyText && <div className="cc-hint" style={{ whiteSpace: 'pre-wrap' }}>{tpl.bodyText}</div>}
      </div>
      {Array.from({ length: qtd }, (_, i) => (
        <div className="field" key={i}><label className="field__label">{`Variável {{${i + 1}}}`}</label>
          <input className="field__input" style={{ fontSize: 16 }} value={vars[i] || ''} onChange={(e) => { const v = [...vars]; v[i] = e.target.value; onChange(nome, v, tpl?.language || 'pt_BR'); }} placeholder="{{nome}} ou texto fixo" />
        </div>
      ))}
    </>
  );
}
