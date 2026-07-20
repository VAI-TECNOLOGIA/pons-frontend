import { useMemo, useState } from 'react';
import { Api } from '../lib/api';
import '../pages/campanhas.css';

const APP_STORE_URL = 'https://apps.apple.com/br/app/grupo-pons/id6783093167';

export function NovoTemplateModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('app_liberado');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('MARKETING');
  // Com botão, o link vira o botão — o corpo fica só com a mensagem.
  const [bodyText, setBodyText] = useState(
    'Olá {{1}}! O Grupo Pons acaba de liberar o acesso exclusivo ao aplicativo. ' +
    'Toque no botão abaixo para baixar o app e, logo após, realize o seu cadastro.',
  );
  const [footer, setFooter] = useState('Grupo Pons Imobiliário');
  const [examples, setExamples] = useState<string[]>(['Rafael']);
  const [comLogo, setComLogo] = useState(true);
  const [comPdf, setComPdf] = useState(false);
  const [comBotao, setComBotao] = useState(true);
  const [botaoText, setBotaoText] = useState('Baixar o app');
  const [botaoUrl, setBotaoUrl] = useState(APP_STORE_URL);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState<null | { status: string }>(null);

  // Conta as variáveis {{n}} distintas do corpo → quantos exemplos a Meta exige.
  const nVars = useMemo(() => new Set((bodyText.match(/\{\{\d+\}\}/g) || [])).size, [bodyText]);
  const nomeValido = /^[a-z0-9_]+$/.test(name);
  const botaoUrlOk = /^https?:\/\/.+/.test(botaoUrl);
  const setExemplo = (i: number, v: string) => setExamples((cur) => { const nx = [...cur]; nx[i] = v; return nx; });
  const preview = bodyText.replace(/\{\{(\d+)\}\}/g, (m, n) => examples[Number(n) - 1] || m);

  async function submeter() {
    setErro('');
    if (!nomeValido) { setErro('O nome deve ser snake_case: só letras minúsculas, números e _.'); return; }
    if (!bodyText.trim()) { setErro('O corpo do template não pode ficar vazio.'); return; }
    if (comBotao && !botaoUrlOk) { setErro('O link do botão precisa começar com http:// ou https://.'); return; }
    setEnviando(true);
    try {
      const r = await Api.whatsappTemplateCreate({
        name, category, language: 'pt_BR', bodyText,
        footer: footer.trim() || undefined,
        example: nVars > 0 ? Array.from({ length: nVars }, (_, i) => examples[i]?.trim() || `exemplo${i + 1}`) : [],
        comLogo: comPdf ? false : comLogo,
        headerDocument: comPdf,
        botao: comBotao ? { text: botaoText.trim() || 'Baixar', url: botaoUrl.trim() } : undefined,
      });
      setOk({ status: r.status || 'PENDING' });
    } catch (e: any) {
      setErro(e?.message || 'Falha ao enviar o template para a Meta.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="camp-modal__backdrop" onClick={enviando ? undefined : onClose}>
      <div className="camp-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="camp-modal__head">
          <h2>Novo template de WhatsApp</h2>
          <button className="camp-modal__close" onClick={onClose} disabled={enviando}>✕</button>
        </div>

        <div className="camp-modal__body" style={{ display: 'block' }}>
          {ok ? (
            <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 6 }}>✓</div>
              <h3 style={{ margin: '0 0 6px' }}>Template enviado para a Meta</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                Status: <b>{ok.status}</b>. A aprovação leva de minutos a algumas horas. Quando ficar
                <b> APROVADO</b>, o template <b>{name}</b> aparece na lista e já pode ser usado numa campanha.
              </p>
              <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={onClose}>Fechar</button>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
                Este template é enviado para aprovação da Meta. Use <code>{'{{1}}'}</code> para o nome do
                contato. Templates de <b>marketing</b> têm custo por mensagem no disparo.
              </p>

              <div className="field">
                <label className="field__label">Nome (identificador)</label>
                <input className="field__input" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder="app_liberado" />
                {!nomeValido && <div style={{ color: 'var(--color-danger)', fontSize: 11.5, marginTop: 4 }}>só minúsculas, números e _</div>}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field__label">Categoria</label>
                  <select className="field__select" value={category} onChange={(e) => setCategory(e.target.value as any)}>
                    <option value="MARKETING">Marketing (anúncio/promoção)</option>
                    <option value="UTILITY">Utilidade (aviso transacional)</option>
                    <option value="AUTHENTICATION">Autenticação (código)</option>
                  </select>
                </div>
                <div className="field" style={{ width: 140 }}>
                  <label className="field__label">Idioma</label>
                  <input className="field__input" value="Português" disabled />
                </div>
              </div>

              <div className="field">
                <label className="field__label">Corpo da mensagem</label>
                <textarea className="field__input" value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={5} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              {nVars > 0 && (
                <div className="field">
                  <label className="field__label">Exemplos das variáveis (a Meta exige um por {'{{n}}'})</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, maxHeight: 180, overflowY: 'auto', padding: 2 }}>
                    {Array.from({ length: nVars }, (_, i) => (
                      <input
                        key={i}
                        className="field__input"
                        style={{ height: 32, fontSize: 13 }}
                        value={examples[i] || ''}
                        onChange={(e) => setExemplo(i, e.target.value)}
                        placeholder={`{{${i + 1}}}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="field">
                <label className="field__label">Rodapé (opcional)</label>
                <input className="field__input" value={footer} onChange={(e) => setFooter(e.target.value.slice(0, 60))} placeholder="Grupo Pons Imobiliário" />
              </div>

              {/* Logo da marca no topo (header de imagem) */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '4px 0 2px', cursor: 'pointer', fontSize: 14, opacity: comPdf ? 0.5 : 1 }}>
                <input type="checkbox" checked={comLogo && !comPdf} disabled={comPdf} onChange={(e) => setComLogo(e.target.checked)} />
                Logo do Grupo Pons no topo da mensagem
              </label>

              {/* Header DOCUMENT: a mensagem chega com um PDF anexado no topo
                  (ex.: protocolo da venda). Exclusivo com a logo — 1 header só. */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '10px 0 2px', cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={comPdf} onChange={(e) => setComPdf(e.target.checked)} />
                PDF anexado no topo (ex.: protocolo da venda)
              </label>
              {comPdf && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0 26px' }}>
                  No disparo, o sistema informa qual PDF vai na mensagem. Substitui a logo (a Meta só aceita um topo).
                </div>
              )}

              {/* Botão de link (CTA) */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '10px 0 2px', cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={comBotao} onChange={(e) => setComBotao(e.target.checked)} />
                Botão para baixar o app
              </label>
              {comBotao && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="field" style={{ width: 170 }}>
                    <label className="field__label">Texto do botão</label>
                    <input className="field__input" value={botaoText} onChange={(e) => setBotaoText(e.target.value.slice(0, 25))} placeholder="Baixar o app" />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label className="field__label">Link do botão</label>
                    <input className="field__input" value={botaoUrl} onChange={(e) => setBotaoUrl(e.target.value)} placeholder="https://apps.apple.com/…" />
                  </div>
                </div>
              )}

              {/* Prévia fiel do WhatsApp: logo no topo, mensagem, rodapé, botão */}
              <div style={{ marginTop: 14, background: '#0b141a', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8696a0', marginBottom: 8 }}>Prévia no WhatsApp</div>
                <div style={{ background: '#202c33', color: '#e9edef', borderRadius: 8, borderTopLeftRadius: 0, overflow: 'hidden', maxWidth: 320 }}>
                  {comLogo && !comPdf && <div style={{ height: 92, background: 'linear-gradient(158deg,#17181b,#0a0a0c)', display: 'grid', placeItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--f1, sans-serif)', letterSpacing: '.18em', fontWeight: 800, color: '#fff', fontSize: 15 }}>GRUPO&nbsp;PONS</span>
                  </div>}
                  {comPdf && <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111b21', padding: '10px 12px' }}>
                    <span style={{ width: 30, height: 36, borderRadius: 4, background: '#d93025', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 9, fontWeight: 800 }}>PDF</span>
                    <span style={{ fontSize: 12.5, color: '#e9edef' }}>documento.pdf</span>
                  </div>}
                  <div style={{ padding: '9px 11px 7px' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.5 }}>{preview}</div>
                    {footer && <div style={{ fontSize: 12, color: '#8696a0', marginTop: 7 }}>{footer}</div>}
                    <div style={{ fontSize: 10.5, color: '#8696a0', textAlign: 'right', marginTop: 3 }}>11:42 ✓✓</div>
                  </div>
                  {comBotao && (
                    <div style={{ borderTop: '1px solid #2a3942', textAlign: 'center', padding: '9px', color: '#53bdeb', fontWeight: 500, fontSize: 13.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span style={{ fontSize: 15 }}>↗</span> {botaoText || 'Baixar o app'}
                    </div>
                  )}
                </div>
              </div>

              {erro && <div className="card camp-erro" style={{ marginTop: 12 }}>{erro}</div>}
            </>
          )}
        </div>

        {!ok && (
          <div className="camp-modal__foot">
            <button className="btn btn--ghost" onClick={onClose} disabled={enviando}>Cancelar</button>
            <button className="btn btn--primary" onClick={submeter} disabled={enviando || !nomeValido}>
              {enviando ? 'Enviando…' : 'Enviar para aprovação da Meta'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
