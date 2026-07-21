import { useMemo, useRef, useState } from 'react';
import { Api } from '../lib/api';
import { Icon } from './Icon';
import { Modal } from './Modal';
import './novo-template.css';

const APP_STORE_URL = 'https://apps.apple.com/br/app/grupo-pons/id6783093167';
const LIMITE_META = 1024;

// Comprimento como a Meta conta (UTF-16: emoji vale 2).
function len16(s: string) {
 let n = 0;
 for (let i = 0; i < s.length; i++) n++;
 return n;
}

export function NovoTemplateModal({ onClose }: { onClose: () => void }) {
 const [name, setName] = useState('');
 const [category, setCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('UTILITY');
 const [bodyText, setBodyText] = useState('Olá {{1}}! ');
 const [footer, setFooter] = useState('');
 const [examples, setExamples] = useState<string[]>([]);
 const [topo, setTopo] = useState<'nenhum' | 'logo' | 'pdf'>('nenhum');
 const [comBotao, setComBotao] = useState(false);
 const [botaoText, setBotaoText] = useState('Baixar o app');
 const [botaoUrl, setBotaoUrl] = useState(APP_STORE_URL);
 const [enviando, setEnviando] = useState(false);
 const [erro, setErro] = useState('');
 const [ok, setOk] = useState<null | { status: string }>(null);

 // Conta as variáveis {{n}} distintas do corpo → quantos exemplos a Meta exige.
 const nVars = useMemo(() => new Set((bodyText.match(/\{\{\d+\}\}/g) || [])).size, [bodyText]);
 const nomeValido = /^[a-z0-9_]+$/.test(name);
 const botaoUrlOk = /^https?:\/\/.+/.test(botaoUrl);
 const chars = len16(bodyText);
 const estourou = chars > LIMITE_META;
 // Regras da Meta validadas ANTES do envio (evita recusa desnecessária):
 const comecaComVar = /^\s*\{\{\d+\}\}/.test(bodyText);
 const terminaComVar = /\{\{\d+\}\}\s*[*_~]?\s*$/.test(bodyText);
 const textoFixo = bodyText.replace(/\{\{\d+\}\}/g, '').replace(/\s+/g, ' ').trim().length;
 const poucoTexto = nVars > 0 && textoFixo / nVars < 9; // heurística: Meta recusa var demais pra texto de menos
 const setExemplo = (i: number, v: string) => setExamples((cur) => { const nx = [...cur]; nx[i] = v; return nx; });
 const preview = bodyText.replace(/\{\{(\d+)\}\}/g, (m, n) => examples[Number(n) - 1] || m);

 // Insere a próxima {{n}} na posição do cursor — mais fácil que digitar na mão.
 const bodyRef = useRef<HTMLTextAreaElement>(null);
 const adicionarVariavel = () => {
 const usados = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
 const prox = usados.length ? Math.max(...usados) + 1 : 1;
 const token = `{{${prox}}}`;
 const el = bodyRef.current;
 const ini = el?.selectionStart ?? bodyText.length;
 const fim = el?.selectionEnd ?? ini;
 setBodyText(bodyText.slice(0, ini) + token + bodyText.slice(fim));
 requestAnimationFrame(() => {
 if (!el) return;
 el.focus();
 el.selectionStart = el.selectionEnd = ini + token.length;
 });
 };

 // Remove a variável de maior número (todas as ocorrências) e o exemplo dela.
 const removerVariavel = () => {
 const usados = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
 if (!usados.length) return;
 const max = Math.max(...usados);
 setBodyText(bodyText.replaceAll(`{{${max}}}`, ''));
 setExamples((cur) => cur.slice(0, max - 1));
 };

 async function submeter() {
 setErro('');
 if (!nomeValido) { setErro('O nome deve ser snake_case: só letras minúsculas, números e _.'); return; }
 if (!bodyText.trim()) { setErro('O corpo do template não pode ficar vazio.'); return; }
 if (estourou) { setErro(`O corpo tem ${chars} caracteres — o limite da Meta é ${LIMITE_META}.`); return; }
 if (comecaComVar) { setErro('A Meta não aceita template COMEÇANDO com variável — escreva algum texto antes da primeira {{n}}.'); return; }
 if (terminaComVar) { setErro('A Meta não aceita template TERMINANDO com variável — escreva algum texto depois da última {{n}}.'); return; }
 if (comBotao && !botaoUrlOk) { setErro('O link do botão precisa começar com http:// ou https://.'); return; }
 setEnviando(true);
 try {
 const r = await Api.whatsappTemplateCreate({
 name, category, language: 'pt_BR', bodyText,
 footer: footer.trim() || undefined,
 example: nVars > 0 ? Array.from({ length: nVars }, (_, i) => examples[i]?.trim() || `exemplo${i + 1}`) : [],
 comLogo: topo === 'logo',
 headerDocument: topo === 'pdf',
 botao: comBotao ? { text: botaoText.trim() || 'Baixar', url: botaoUrl.trim() } : undefined,
 });
 setOk({ status: r.status || 'PENDING' });
 } catch (e: any) {
 // Mostra o motivo REAL da recusa da Meta (nome repetido, variável no
 // início/fim, etc.) — antes aparecia só "erro no servidor".
 const meta = e?.details?.meta;
 const detalhe = meta?.error_user_msg || meta?.message || e?.details?.message;
 setErro(detalhe ? `Meta recusou: ${detalhe}` : (e?.message || 'Falha ao enviar o template para a Meta.'));
 } finally {
 setEnviando(false);
 }
 }

 return (
 <Modal open onClose={enviando ? () => {} : onClose} size="xl" title="Novo template de WhatsApp" subtitle="Vai pra aprovação da Meta — leva de minutos a algumas horas">

 {ok ? (
 <div className="tplm__sucesso">
 <span className="tplm__sucesso-icone"><Icon name="check" size={26} /></span>
 <h3>Template enviado para a Meta</h3>
 <p>
 Status: <strong>{ok.status}</strong>. Quando ficar <strong>Aprovado</strong>, o template
 <strong> {name}</strong> aparece na lista e já pode ser usado em disparos e campanhas.
 </p>
 <button className="btn btn--primary" onClick={onClose}>Fechar</button>
 </div>
 ) : (
 <>
 <div className="tplm__corpo">
 <div className="tplm__form">
 <div className="tplm__secao">Identificação</div>
 <div className="tplm__linha">
 <div className="field" style={{ flex: 2 }}>
 <label className="field__label">Nome (identificador)</label>
 <input className="field__input" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))} placeholder="protocolo_venda" />
 {name && !nomeValido && <div className="tplm__erro-campo">Só letras minúsculas, números e _</div>}
 </div>
 <div className="field" style={{ flex: 1.4 }}>
 <label className="field__label">Categoria</label>
 <select className="field__select" value={category} onChange={(e) => setCategory(e.target.value as any)}>
 <option value="UTILITY">Utilidade (aviso)</option>
 <option value="MARKETING">Marketing</option>
 <option value="AUTHENTICATION">Autenticação</option>
 </select>
 </div>
 <div className="field" style={{ width: 96 }}>
 <label className="field__label">Idioma</label>
 <input className="field__input" value="pt_BR" disabled />
 </div>
 </div>

 <div className="tplm__secao">Mensagem</div>
 <div className="field">
 <div className="tplm__label-linha">
 <label className="field__label">Corpo da mensagem</label>
 <div className="tplm__label-acoes">
 <button type="button" className="tplm__add-var" onClick={adicionarVariavel} title="Insere a próxima variável na posição do cursor">
 <Icon name="plus" size={11} /> Variável
 </button>
 {nVars > 0 && (
 <button type="button" className="tplm__add-var tplm__add-var--rm" onClick={removerVariavel} title="Remove a última variável e o exemplo dela">
 <Icon name="x" size={11} /> Remover
 </button>
 )}
 <span className={'tplm__contador' + (estourou ? ' tplm__contador--estourou' : chars > LIMITE_META * 0.9 ? ' tplm__contador--quase' : '')}>
 {chars}/{LIMITE_META}
 </span>
 </div>
 </div>
 <textarea ref={bodyRef} className="field__input tplm__textarea" value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={7} />
 {comecaComVar && <div className="tplm__regra tplm__regra--erro">Não pode começar com variável — escreva um texto antes da {'{{1}}'} (ex.: "Olá {'{{1}}'}").</div>}
 {terminaComVar && <div className="tplm__regra tplm__regra--erro">Não pode terminar com variável — feche com um texto fixo depois da última {'{{n}}'} (uma saudação ou assinatura resolve).</div>}
 {!comecaComVar && !terminaComVar && poucoTexto && <div className="tplm__regra tplm__regra--aviso">Muitas variáveis pra pouco texto fixo — a Meta costuma recusar. Escreva rótulos/frases entre as variáveis.</div>}
 <p className="tplm__nota" style={{ margin: '4px 0 0' }}>Clique em "+ Variável" pra inserir um campo dinâmico ({'{{1}}'}, {'{{2}}'}…) onde o cursor estiver.</p>
 </div>
 {nVars > 0 && (
 <div className="field">
 <label className="field__label">Exemplos das variáveis (a Meta exige um por {'{{n}}'})</label>
 <div className="tplm__exemplos">
 {Array.from({ length: nVars }, (_, i) => (
 <div key={i} className="tplm__exemplo">
 <span className="tplm__exemplo-tag">{`{{${i + 1}}}`}</span>
 <input className="field__input" value={examples[i] || ''} onChange={(e) => setExemplo(i, e.target.value)} placeholder={`Exemplo ${i + 1}`} />
 </div>
 ))}
 </div>
 </div>
 )}

 <div className="tplm__secao">Topo da mensagem</div>
 <div className="tplm__topo-opcoes">
 {([
 { v: 'nenhum', titulo: 'Nenhum', desc: 'Só o texto' },
 { v: 'logo', titulo: 'Logo Grupo Pons', desc: 'Imagem da marca' },
 { v: 'pdf', titulo: 'PDF anexado', desc: 'Ex.: protocolo da venda' },
 ] as const).map((o) => (
 <button key={o.v} className={'tplm__topo-opcao' + (topo === o.v ? ' tplm__topo-opcao--on' : '')} onClick={() => setTopo(o.v)}>
 <span className="tplm__topo-titulo">{o.titulo}</span>
 <span className="tplm__topo-desc">{o.desc}</span>
 </button>
 ))}
 </div>
 {topo === 'pdf' && (
 <p className="tplm__nota">Não precisa anexar nada aqui: a amostra pra Meta vai automática. O PDF de verdade é definido em cada envio — na venda aprovada, o sistema anexa o protocolo sozinho; no teste, você pode colar um link de PDF.</p>
 )}
 {topo === 'logo' && (
 <p className="tplm__nota">A logo oficial do Grupo Pons entra automaticamente em todos os envios deste template.</p>
 )}

 <div className="tplm__secao">Extras</div>
 <div className="field">
 <label className="field__label">Rodapé (opcional, até 60 caracteres)</label>
 <input className="field__input" value={footer} onChange={(e) => setFooter(e.target.value.slice(0, 60))} placeholder="Grupo Pons Imobiliário" />
 </div>
 <label className="tplm__check">
 <input type="checkbox" checked={comBotao} onChange={(e) => setComBotao(e.target.checked)} />
 Botão de link (CTA)
 </label>
 {comBotao && (
 <div className="tplm__linha">
 <div className="field" style={{ flex: 1 }}>
 <label className="field__label">Texto do botão</label>
 <input className="field__input" value={botaoText} onChange={(e) => setBotaoText(e.target.value.slice(0, 25))} />
 </div>
 <div className="field" style={{ flex: 2 }}>
 <label className="field__label">Link</label>
 <input className="field__input" value={botaoUrl} onChange={(e) => setBotaoUrl(e.target.value)} placeholder="https://…" />
 </div>
 </div>
 )}

 <div className="tplm__dicas">
 <div className="tplm__dicas-titulo"><Icon name="lightbulb" size={13} /> Regras da Meta pra aprovar de primeira</div>
 <ul>
 <li>Não pode começar nem terminar com variável — sempre um texto fixo nas pontas</li>
 <li>Escreva rótulos e frases entre as variáveis (variável demais pra texto de menos é recusado)</li>
 <li>O nome precisa ser inédito — mesmo excluído, um nome fica travado por ~30 dias</li>
 <li>Máximo de 1024 caracteres já contando as variáveis preenchidas no envio</li>
 <li>Categoria certa ajuda: aviso de sistema é Utilidade; promoção é Marketing</li>
 </ul>
 </div>
 </div>

 <aside className="tplm__preview">
 <div className="tplm__preview-titulo">Prévia no WhatsApp</div>
 <div className="tplm__zap">
 <div className="tplm__bolha">
 {topo === 'logo' && <div className="tplm__bolha-logo">GRUPO&nbsp;PONS</div>}
 {topo === 'pdf' && (
 <div className="tplm__bolha-doc">
 <span className="tplm__bolha-pdf">PDF</span>
 <span>documento.pdf</span>
 </div>
 )}
 <div className="tplm__bolha-texto">{preview || '(corpo vazio)'}</div>
 {footer && <div className="tplm__bolha-rodape">{footer}</div>}
 <div className="tplm__bolha-hora">11:42</div>
 {comBotao && <div className="tplm__bolha-botao">{botaoText || 'Abrir'}</div>}
 </div>
 </div>
 </aside>
 </div>

 <footer className="tplm__foot">
 <span className="tplm__foot-erro">{erro}</span>
 <div className="tplm__foot-acoes">
 <button className="btn btn--secondary" onClick={onClose} disabled={enviando}>Cancelar</button>
 <button className="btn btn--primary" onClick={submeter} disabled={enviando || !name || estourou}>
 {enviando ? 'Enviando…' : 'Enviar para aprovação da Meta'}
 </button>
 </div>
 </footer>
 </>
 )}
 </Modal>
 );
}
