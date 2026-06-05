import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Api } from '../lib/api';
import { useUser } from '../lib/userContext';
import './assistant.css';

type Msg = {
  role: 'user' | 'ai';
  text: string;
  fonte?: 'ia' | 'demo';
  at: number;
};

type IaStatus = { configurado: boolean; provider?: string; model?: string };

const SUGGESTIONS: Array<{ group: string; items: string[] }> = [
  {
    group: 'Visão geral',
    items: [
      'Como vão as vendas do mês?',
      'Qual a taxa de conversão atual?',
      'Tenho tarefas pendentes?',
    ],
  },
  {
    group: 'Equipes & vendedores',
    items: [
      'Quantas equipes eu tenho?',
      'Qual equipe mais faturou no mês?',
      'Vendedor com mais leads ativos?',
      'Top 3 vendedores em VGV?',
    ],
  },
  {
    group: 'Leads & funil',
    items: [
      'Quantos leads ativos eu tenho?',
      'De onde vêm meus leads esse mês?',
      'Como ativo a negociação de um lead?',
    ],
  },
  {
    group: 'Empreendimentos',
    items: [
      'Quais empreendimentos eu tenho ativos?',
      'Qual empreendimento tem maior VSO?',
    ],
  },
  {
    group: 'Sistema',
    items: [
      'Como conecto o WhatsApp Cloud?',
      'Como ligo a IA SDR de leads?',
      'Como aprovo um pagamento?',
    ],
  },
];

const ALL_SUGGESTIONS = SUGGESTIONS.flatMap((g) => g.items);
const QUICK_SUGGESTIONS = ALL_SUGGESTIONS.slice(0, 4);

const HISTORY_KEY = 'pons-assistant-history';
const HISTORY_MAX = 50;

export function AssistantChat() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => loadHistory());
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [iaStatus, setIaStatus] = useState<IaStatus | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    Api.iaStatus().then(setIaStatus).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    saveHistory(msgs);
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, open]);

  // Esc fecha
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (texto?: string) => {
    const pergunta = (texto ?? draft).trim();
    if (!pergunta || sending) return;
    setShowSuggestions(false);
    setMsgs((cur) => append(cur, { role: 'user', text: pergunta, at: Date.now() }));
    setDraft('');
    setSending(true);
    try {
      const r: any = await Api.iaAssistente(pergunta);
      setMsgs((cur) =>
        append(cur, { role: 'ai', text: stripMarkdown(r?.texto || '...'), fonte: r?.fonte, at: Date.now() }),
      );
    } catch (err: any) {
      setMsgs((cur) =>
        append(cur, {
          role: 'ai',
          text: 'Não consegui responder agora. Tente novamente em instantes.',
          at: Date.now(),
        }),
      );
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setMsgs([]);
    try {
      sessionStorage.removeItem(HISTORY_KEY);
    } catch {}
  };

  if (!user) return null;

  return (
    <>
      {!open && (
        <button
          className="assistant-fab"
          onClick={() => setOpen(true)}
          aria-label="Abrir assistente IA"
          title="Assistente Pons IA"
        >
          <Icon name="bot" size={26} />
          <span className="assistant-fab__dot" aria-hidden />
        </button>
      )}

      {open && (
        <div className="assistant" role="dialog" aria-label="Assistente Pons IA">
          <div className="assistant__header">
            <div className="assistant__avatar">
              <Icon name="bot" size={20} />
            </div>
            <div className="assistant__title">
              <div className="assistant__title-main">Assistente Pons IA</div>
              <div className="assistant__title-sub">
                <span
                  className={
                    'assistant__status-dot' +
                    (iaStatus?.configurado ? '' : ' assistant__status-dot--demo')
                  }
                />
                {iaStatus?.configurado ? 'Pronto' : 'Modo demo (sem chave de IA)'}
              </div>
            </div>
            {msgs.length > 0 && (
              <button className="assistant__reset" onClick={reset} title="Limpar conversa">
                Limpar
              </button>
            )}
            <button
              className="assistant__close"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              title="Fechar"
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          <div className="assistant__body">
            {msgs.length === 0 && (
              <>
                <div className="assistant__empty">
                  <strong>Como posso ajudar, {user.name.split(' ')[0]}?</strong>
                  Pergunte sobre vendas, equipes, leads, comissões, empreendimentos ou como usar o sistema.
                </div>
                <div className="assistant__suggestions">
                  {QUICK_SUGGESTIONS.map((s) => (
                    <button key={s} className="assistant__suggestion" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                  <button
                    className="assistant__suggestion assistant__suggestion--more"
                    onClick={() => setShowSuggestions(true)}
                  >
                    <Icon name="lightbulb" size={12} /> Ver mais sugestões…
                  </button>
                </div>
              </>
            )}

            {msgs.map((m, i) => (
              <div
                key={i}
                className={'assistant__msg assistant__msg--' + (m.role === 'user' ? 'user' : 'ai')}
              >
                {m.text}
                {m.role === 'ai' && m.fonte === 'demo' && (
                  <div className="assistant__msg-meta">resposta demo · ligue IA real em Configurações</div>
                )}
              </div>
            ))}

            {sending && (
              <div className="assistant__typing" aria-label="Digitando">
                <span />
                <span />
                <span />
              </div>
            )}

            <div ref={endRef} />
          </div>

          {showSuggestions && (
            <SuggestionsPanel
              onPick={(t) => send(t)}
              onClose={() => setShowSuggestions(false)}
            />
          )}

          <div className="assistant__footer">
            <button
              className={
                'assistant__ideas' +
                (showSuggestions ? ' assistant__ideas--active' : '')
              }
              onClick={() => setShowSuggestions((v) => !v)}
              title="Sugestões de perguntas"
              aria-label="Sugestões"
              type="button"
            >
              <Icon name="lightbulb" size={16} />
            </button>
            <textarea
              ref={inputRef}
              className="assistant__input"
              placeholder="Pergunte algo…"
              value={draft}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={sending}
            />
            <button
              className="assistant__send"
              onClick={() => send()}
              disabled={sending || !draft.trim()}
              aria-label="Enviar"
              title="Enviar (Enter)"
            >
              <Icon name="send" size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SuggestionsPanel({
  onPick,
  onClose,
}: {
  onPick: (text: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="assistant__suggestions-panel">
      <div className="assistant__suggestions-panel-header">
        <span>Sugestões de perguntas</span>
        <button onClick={onClose} className="assistant__suggestions-close" aria-label="Fechar">
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="assistant__suggestions-panel-body">
        {SUGGESTIONS.map((group) => (
          <div key={group.group} className="assistant__suggestions-group">
            <div className="assistant__suggestions-group-title">{group.group}</div>
            {group.items.map((q) => (
              <button
                key={q}
                className="assistant__suggestion"
                onClick={() => {
                  onPick(q);
                  onClose();
                }}
              >
                {q}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Remove markdown leve das respostas da IA — o prompt já pede texto puro,
 * mas LLMs às vezes insistem em **negrito** ou *itálico*. Limpamos defensivamente
 * sem afetar pontuação normal.
 */
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1') // ***bold-italic***
    .replace(/\*\*(.+?)\*\*/g, '$1')      // **bold**
    .replace(/(?<![A-Za-z0-9])\*([^*\n]+?)\*(?![A-Za-z0-9])/g, '$1') // *italic* sem grudar em palavras
    .replace(/__(.+?)__/g, '$1')          // __bold__
    .replace(/`([^`]+)`/g, '$1')          // `code`
    .replace(/^#{1,6}\s+/gm, '');         // headings no início de linha
}

function append(arr: Msg[], m: Msg): Msg[] {
  const next = [...arr, m];
  if (next.length > HISTORY_MAX) return next.slice(next.length - HISTORY_MAX);
  return next;
}

function loadHistory(): Msg[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function saveHistory(msgs: Msg[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(msgs));
  } catch {}
}
