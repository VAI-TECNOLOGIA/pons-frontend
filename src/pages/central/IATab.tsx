// Treinar IA (Pons 10/11): metodologia em blocos, chat de teste com correção por
// mensagem, responder no mesmo formato e voz pela ElevenLabs.
import { useEffect, useRef, useState } from 'react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { Modal } from '../../components/Modal';

type Msg = { autor: 'LEAD' | 'IA'; texto: string; leitura?: any };

export function IATab() {
  const toast = useToast();
  const [cfg, setCfg] = useState<any>(null);
  const [blocos, setBlocos] = useState<{ nome: string; texto: string }[]>([]);
  const [mesmoFormato, setMesmoFormato] = useState(true);
  const [voz, setVoz] = useState({ chave: '', voiceId: '', modelo: 'eleven_multilingual_v2' });
  const [salvando, setSalvando] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [ajustando, setAjustando] = useState<number | null>(null);
  const [certa, setCerta] = useState('');
  const [ouvindo, setOuvindo] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const carregar = () => Api.centralIaConfig().then((c) => {
    setCfg(c);
    setBlocos(c.blocos?.length ? c.blocos : [
      { nome: 'Apresentação', texto: '' }, { nome: 'Qualificação', texto: '' }, { nome: 'Produto', texto: '' }, { nome: 'Ligação e fechamento', texto: '' },
    ]);
    setMesmoFormato(!!c.mesmoFormato);
    setVoz({ chave: c.voz?.chave || '', voiceId: c.voz?.voiceId || '', modelo: c.voz?.modelo || 'eleven_multilingual_v2' });
  }).catch((e) => toast.error(e?.message || 'Falha ao carregar.'));
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { fim.current?.scrollIntoView({ block: 'nearest' }); }, [msgs, pensando]);

  const salvar = async () => {
    setSalvando(true);
    try { await Api.centralIaSalvar({ blocos, mesmoFormato, voz }); toast.success('Treinamento salvo. A IA já usa nas próximas respostas.'); carregar(); }
    catch (e: any) { toast.error(e?.message || 'Falha ao salvar.'); } finally { setSalvando(false); }
  };
  const enviar = async () => {
    const t = texto.trim();
    if (!t || pensando) return;
    const hist = msgs.map((m) => ({ autor: m.autor, texto: m.texto }));
    setMsgs((m) => [...m, { autor: 'LEAD', texto: t }]);
    setTexto('');
    setPensando(true);
    try {
      const r = await Api.centralIaTestar({ historico: hist, mensagem: t });
      setMsgs((m) => [...m, { autor: 'IA', texto: r.texto + (r.material ? '\n[enviaria as fotos do empreendimento]' : ''), leitura: r.leitura }]);
    } catch (e: any) { toast.error(e?.message || 'A IA não respondeu.'); } finally { setPensando(false); }
  };
  const salvarAjuste = async () => {
    if (ajustando == null || !certa.trim()) return;
    const pergunta = [...msgs.slice(0, ajustando)].reverse().find((m) => m.autor === 'LEAD')?.texto || '';
    try {
      await Api.centralIaAjuste({ pergunta, respostaRuim: msgs[ajustando].texto, respostaCerta: certa.trim() });
      setMsgs((m) => m.map((x, i) => (i === ajustando ? { ...x, texto: certa.trim(), leitura: { ...(x.leitura || {}), ajustada: true } } : x)));
      setAjustando(null); setCerta('');
      toast.success('Correção salva. A IA passa a responder assim.');
      carregar();
    } catch (e: any) { toast.error(e?.message || 'Falha ao salvar a correção.'); }
  };
  const ouvir = async () => {
    setOuvindo(true);
    try { const url = await Api.centralIaVozTestar(); new Audio(url).play(); }
    catch (e: any) { toast.error(e?.message || 'Não consegui gerar o áudio.'); } finally { setOuvindo(false); }
  };

  if (!cfg) return <p className="cc-muted">Carregando…</p>;
  return (
    <>
      {!cfg.llmConfigurada && (
        <div className="cc-card" style={{ marginBottom: 14, borderColor: 'var(--color-warning)' }}>
          A IA de atendimento ainda não tem a chave da OpenAI. Configure no menu <strong>Agente IA</strong> (lá também ficam o tom, a descrição e a base de conhecimento).
        </div>
      )}
      <div className="cc-grid2">
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div className="cc-card">
            <div className="cc-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Metodologia em blocos</h3>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setBlocos([...blocos, { nome: `Bloco ${blocos.length + 1}`, texto: '' }])}>+ Bloco</button>
            </div>
            <p className="cc-muted" style={{ marginTop: 0 }}>A IA conduz a conversa bloco a bloco, nesta ordem. A cada mensagem ela marca no CRM em que bloco o cliente está, a etiqueta e as tags, e move o card no Kanban.</p>
            {blocos.map((b, i) => (
              <div key={i} style={{ borderTop: i ? '1px solid var(--border-light, #e5e7eb)' : 0, paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0 }}>
                <div className="cc-row" style={{ flexWrap: 'nowrap' }}>
                  <strong style={{ whiteSpace: 'nowrap' }}>Bloco {i + 1}</strong>
                  <input className="field__input" style={{ fontSize: 16, flex: 1, minWidth: 0 }} value={b.nome} onChange={(e) => setBlocos(blocos.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} placeholder="Nome do bloco" />
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setBlocos(blocos.filter((_, j) => j !== i))}>Tirar</button>
                </div>
                <textarea className="field__input" rows={3} style={{ fontSize: 16, marginTop: 6, width: '100%', boxSizing: 'border-box' }} value={b.texto} onChange={(e) => setBlocos(blocos.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))} placeholder="O que a IA faz neste bloco. Ex.: apresenta o corretor, a Pons e o produto em poucas linhas." />
              </div>
            ))}
            <div className="cc-hint">Os blocos 1, 2, 3... ligam com as etapas comuns do Kanban na mesma ordem (aba Kanban, Editar etapas).</div>
          </div>
          <div className="cc-card">
            <h3>Formato e voz</h3>
            <label className="cc-row" style={{ fontSize: 14, marginBottom: 10 }}><input type="checkbox" checked={mesmoFormato} onChange={(e) => setMesmoFormato(e.target.checked)} /> Responder no mesmo formato do cliente (áudio com áudio, texto com texto)</label>
            <div className="cc-filtros">
              <div className="field"><label className="field__label">Chave da ElevenLabs</label><input className="field__input" style={{ fontSize: 16 }} value={voz.chave} onChange={(e) => setVoz({ ...voz, chave: e.target.value })} placeholder="Cole a chave da API" autoComplete="off" /></div>
              <div className="field"><label className="field__label">ID da voz</label><input className="field__input" style={{ fontSize: 16 }} value={voz.voiceId} onChange={(e) => setVoz({ ...voz, voiceId: e.target.value })} placeholder="Voice ID da ElevenLabs" /></div>
            </div>
            <div className="cc-hint">O áudio do cliente é transcrito e a IA responde em áudio com esta voz. Sem a chave, ela responde em texto.</div>
            <div className="cc-row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="btn btn--ghost btn--sm" disabled={ouvindo || !cfg.voz?.configurada} onClick={ouvir}>{ouvindo ? 'Gerando…' : 'Ouvir a voz'}</button>
            </div>
          </div>
          <div className="cc-row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--primary" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar treinamento'}</button>
          </div>
          {!!cfg.ajustes?.length && (
            <div className="cc-card">
              <h3>Correções da equipe ({cfg.ajustes.length})</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {cfg.ajustes.map((a: any, i: number) => (
                  <div key={i} style={{ fontSize: 13, borderBottom: '1px solid var(--border-light, #eef0f3)', paddingBottom: 8 }}>
                    <div className="cc-muted">Cliente: "{a.pergunta}"</div>
                    <div>Responder: "{a.respostaCerta}"</div>
                    <div className="cc-row" style={{ justifyContent: 'space-between' }}><small className="cc-muted">{a.por}{a.em ? ` · ${new Date(a.em).toLocaleDateString('pt-BR')}` : ''}</small>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={async () => { await Api.centralIaAjusteApagar(i); carregar(); }}>Tirar</button></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="cc-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 520, position: 'sticky', top: 12, alignSelf: 'start' }}>
          <div className="cc-row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Testar a IA</h3>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMsgs([])}>Nova conversa</button>
          </div>
          <p className="cc-muted" style={{ marginTop: 4 }}>Escreva como se fosse o cliente. Nada é enviado no WhatsApp. Não gostou de uma resposta? Clique em "Ajustar" nela. Salve o treinamento antes de testar.</p>
          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 8, alignContent: 'start', padding: '8px 2px', maxHeight: 460 }}>
            {!msgs.length && <p className="cc-muted">Ex.: "Oi, vi o anúncio do apartamento, ainda tem?"</p>}
            {msgs.map((m, i) => (
              <div key={i} style={{ justifySelf: m.autor === 'LEAD' ? 'end' : 'start', maxWidth: '86%' }}>
                <div style={{ background: m.autor === 'LEAD' ? 'rgba(14,124,155,.12)' : 'var(--bg-card-hover)', borderRadius: 12, padding: '8px 12px', fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.texto}</div>
                {m.autor === 'IA' && (
                  <div className="cc-row" style={{ gap: 6, marginTop: 4 }}>
                    {m.leitura?.bloco ? <span className="cc-chip" style={{ fontSize: 11 }}>Bloco {m.leitura.bloco}</span> : null}
                    {m.leitura?.etiqueta && <span className="cc-chip" style={{ fontSize: 11 }}>{m.leitura.etiqueta.toLowerCase()}</span>}
                    {m.leitura?.tags?.map((t: string) => <span key={t} className="cc-chip" style={{ fontSize: 11 }}>{t}</span>)}
                    {m.leitura?.ajustada ? <span className="cc-chip" style={{ fontSize: 11 }}>corrigida</span> : <button type="button" className="btn btn--ghost btn--sm" style={{ padding: '0 6px', fontSize: 12 }} onClick={() => { setAjustando(i); setCerta(m.texto); }}>Ajustar</button>}
                  </div>
                )}
              </div>
            ))}
            {pensando && <div className="cc-muted">A IA está escrevendo…</div>}
            <div ref={fim} />
          </div>
          <div className="cc-row" style={{ flexWrap: 'nowrap', marginTop: 8 }}>
            <textarea className="field__input" rows={2} style={{ fontSize: 16, resize: 'none', flex: 1, width: '100%', minWidth: 0 }} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }} placeholder="Mensagem do cliente" aria-label="Mensagem do cliente" />
            <button type="button" className="btn btn--primary" disabled={pensando || !texto.trim()} onClick={enviar}>Enviar</button>
          </div>
        </div>
      </div>

      {ajustando != null && (
        <Modal open onClose={() => setAjustando(null)} title="Ajustar a resposta da IA" subtitle="Escreva como a IA deveria ter respondido. Ela passa a seguir isso em situações parecidas.">
          <div className="cc-muted" style={{ marginBottom: 6 }}>Resposta da IA:</div>
          <div style={{ background: 'var(--bg-card-hover)', borderRadius: 10, padding: 10, fontSize: 14, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{msgs[ajustando]?.texto}</div>
          <div className="field"><label className="field__label">Como deveria responder</label>
            <textarea className="field__input" rows={5} style={{ fontSize: 16, width: '100%', boxSizing: 'border-box' }} value={certa} onChange={(e) => setCerta(e.target.value)} autoFocus />
          </div>
          <div className="cc-row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn--ghost" onClick={() => setAjustando(null)}>Cancelar</button>
            <button type="button" className="btn btn--primary" disabled={!certa.trim()} onClick={salvarAjuste}>Salvar correção</button>
          </div>
        </Modal>
      )}
    </>
  );
}
