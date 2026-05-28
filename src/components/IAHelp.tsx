import { useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { Step, Code, HelpHeader } from './IntegracoesHelp';

import './integracoes-help.css';

type Section = 'setup' | 'modelos' | 'prompt';

/**
 * Help dialog dedicado à IA. Sistema usa exclusivamente Claude (Anthropic).
 * Cobre: setup da conta + API key, comparativo de modelos Claude com custo
 * estimado, e esqueleto de prompt do SDR.
 */
export function IAHelp() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Section>('setup');

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => setOpen(true)}
        title="Guia da IA — Claude, modelos e prompt"
      >
        <Icon name="doc" size={14} /> Como conectar
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Guia da IA" size="lg">
        <div className="integracoes-help">
          <div className="integracoes-help__tabs">
            <Tab id="setup" label="Setup Claude" current={active} onPick={setActive} />
            <Tab id="modelos" label="Comparar modelos" current={active} onPick={setActive} />
            <Tab id="prompt" label="Dicas de prompt" current={active} onPick={setActive} />
          </div>

          <div className="integracoes-help__body">
            {active === 'setup' && <SetupClaude />}
            {active === 'modelos' && <ModelosComparativo />}
            {active === 'prompt' && <PromptDicas />}
          </div>
        </div>
      </Modal>
    </>
  );
}

function Tab({
  id,
  label,
  current,
  onPick,
}: {
  id: Section;
  label: string;
  current: Section;
  onPick: (s: Section) => void;
}) {
  return (
    <button
      type="button"
      className={'integracoes-help__tab ' + (current === id ? 'integracoes-help__tab--active' : '')}
      onClick={() => onPick(id)}
    >
      {label}
    </button>
  );
}

// ─────────── Setup ──────────────────────────────────────────────────────
function SetupClaude() {
  return (
    <div>
      <HelpHeader
        logo="/assets/claude-icon.png"
        fallbackIcon={<Icon name="bot" size={22} />}
        title="Claude (Anthropic)"
        lead="Modelo de IA que cuida do atendimento automático na aba Atendimento. Responde leads novos enquanto o corretor não assume e qualifica VIPs."
      />

      <Step n={1} title="Crie conta + adicione billing">
        Acesse{' '}
        <a href="https://console.anthropic.com" target="_blank" rel="noopener">
          console.anthropic.com
        </a>
        . Crie conta com email da empresa. Vá em <strong>Billing</strong> → adicione cartão e
        compre crédito inicial (US$ 5 já cobre semanas de teste).
      </Step>

      <Step n={2} title="Gere uma API Key">
        Menu lateral → <strong>API Keys</strong> → <strong>Create Key</strong>. Nome:{' '}
        <Code>pons-sdr-ia</Code>. <em>Copie agora</em> — a key só aparece uma vez (formato{' '}
        <Code>sk-ant-api03-...</Code>).
      </Step>

      <Step n={3} title="Cole no Pons">
        Volte aqui em <strong>Configurações → IA & Atendimento</strong> e preencha:
        <ul>
          <li>
            <strong>API Key:</strong> cole a chave que você gerou
          </li>
          <li>
            <strong>Modelo:</strong> <Code>claude-haiku-4-5-20251001</Code> (recomendado pra
            começar — ver aba "Comparar modelos" pra trocar)
          </li>
        </ul>
        Clique <strong>Salvar</strong> e confirme com sua senha.
      </Step>

      <Step n={4} title="Teste no Atendimento">
        Vá no <strong>Atendimento</strong>, abra um lead pendente, clique{' '}
        <strong>Responder com IA</strong>. Em ~1-2s aparece a resposta. Se preferir tom diferente,
        ajuste o prompt em <em>Prompt do SDR</em> nesta mesma página.
      </Step>

      <div className="help-warn" style={{ marginTop: 16 }}>
        <strong>Pra monitorar gasto:</strong> volte em{' '}
        <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a> →{' '}
        <em>Usage</em>. Mostra quanto cada modelo consumiu por dia. Configure um limite mensal
        em <em>Billing → Limits</em> pra não estourar.
      </div>
    </div>
  );
}

// ─────────── Comparativo de modelos ─────────────────────────────────────
function ModelosComparativo() {
  return (
    <div>
      <HelpHeader
        logo="/assets/claude-icon.png"
        fallbackIcon={<Icon name="chart" size={22} />}
        title="Modelos Claude — comparativo"
        lead="Preços em USD por milhão de tokens. 1 token ≈ 4 caracteres ≈ 0,75 palavra. Uma conversa típica de WhatsApp consome 200-500 tokens por turno (input + output)."
      />

      <table className="help-table">
        <thead>
          <tr>
            <th>Modelo</th>
            <th>Input (M tok)</th>
            <th>Output (M tok)</th>
            <th>Contexto</th>
            <th>Quando usar</th>
          </tr>
        </thead>
        <tbody>
          <tr className="help-table__row--recommended">
            <td>
              <strong>Claude Haiku 4.5</strong>
              <span className="help-badge--reco">recomendado</span>
              <br />
              <code>claude-haiku-4-5-20251001</code>
            </td>
            <td>$1,00</td>
            <td>$5,00</td>
            <td>200k</td>
            <td>
              SDR / atendimento de alto volume. Latência ~1s e qualidade Claude. O equilíbrio
              certo entre custo e bom acabamento de resposta.
            </td>
          </tr>
          <tr>
            <td>
              <strong>Claude Sonnet 4.6</strong>
              <br />
              <code>claude-sonnet-4-6</code>
            </td>
            <td>$3,00</td>
            <td>$15,00</td>
            <td>1M</td>
            <td>
              Conversas complexas: objeções difíceis, raciocínio multi-passo, contexto longo
              (histórico extenso). 3× mais caro que Haiku.
            </td>
          </tr>
          <tr>
            <td>
              <strong>Claude Opus 4.7</strong>
              <br />
              <code>claude-opus-4-7</code>
            </td>
            <td>$15,00</td>
            <td>$75,00</td>
            <td>1M</td>
            <td>
              Casos críticos onde qualidade absoluta vale o custo (negociações high-ticket,
              análises detalhadas). 15× Haiku — caro pra atendimento em massa.
            </td>
          </tr>
        </tbody>
      </table>

      <h4 className="help-table__heading">Estimativa de custo mensal</h4>
      <p className="help-lead" style={{ marginTop: 0 }}>
        Calculado com 5 turnos por conversa × ~400 tokens por turno (input+output) = ~2k tokens
        por conversa. Valores arredondados, em USD.
      </p>
      <table className="help-table">
        <thead>
          <tr>
            <th>Volume / mês</th>
            <th>Haiku 4.5</th>
            <th>Sonnet 4.6</th>
            <th>Opus 4.7</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1.000 conversas</td>
            <td>~ $6</td>
            <td>~ $18</td>
            <td>~ $90</td>
          </tr>
          <tr>
            <td>10.000 conversas</td>
            <td>~ $60</td>
            <td>~ $180</td>
            <td>~ $900</td>
          </tr>
          <tr>
            <td>50.000 conversas</td>
            <td>~ $300</td>
            <td>~ $900</td>
            <td>~ $4.500</td>
          </tr>
          <tr>
            <td>100.000 conversas</td>
            <td>~ $600</td>
            <td>~ $1.800</td>
            <td>~ $9.000</td>
          </tr>
        </tbody>
      </table>

      <div className="help-warn" style={{ marginTop: 12 }}>
        <strong>Nossa recomendação:</strong> comece com{' '}
        <code>claude-haiku-4-5-20251001</code>. Em 95% dos atendimentos imobiliários ele dá
        conta. Suba pro Sonnet apenas em casos onde notar respostas rasas ou perda de contexto
        — testa primeiro, confirma melhora, depois migra.
      </div>
    </div>
  );
}

// ─────────── Prompt do SDR ──────────────────────────────────────────────
function PromptDicas() {
  return (
    <div>
      <HelpHeader
        fallbackIcon={<Icon name="pencil" size={22} />}
        title="Dicas pro prompt do SDR"
        lead="A IA segue as instruções do prompt cegamente. Quanto mais específico, melhor a conversão. Aqui um esqueleto que funciona pra imobiliária."
      />

      <Step n={1} title="Identidade clara">
        Comece dizendo quem é o SDR e o tom de voz. Exemplo:{' '}
        <em>"Você é a Cris, SDR da Grupo Pons. Sua voz é direta, cordial e nordestina sem
        gírias. Nunca use emoji. Sempre trate o cliente por 'você'."</em>
      </Step>

      <Step n={2} title="Tarefa de cada turno">
        Diga o que ela DEVE entregar em cada resposta:
        <ul>
          <li>Cumprimentar com nome (use a 1ª palavra do lead.nome).</li>
          <li>Perguntar 1 informação por vez (orçamento → finalidade → cidade).</li>
          <li>Nunca mandar mais de 2 parágrafos.</li>
          <li>Se for VIP, escalar pro corretor humano.</li>
        </ul>
      </Step>

      <Step n={3} title="Sinais pra qualificação">
        Liste sinais explícitos pra IA capturar:
        <ul>
          <li>Tem orçamento aprovado / FGTS / financiamento?</li>
          <li>Visita ao decorado já agendada?</li>
          <li>É investidor ou pra morar?</li>
        </ul>
        Quando achar 2+ sinais positivos, ela marca o lead como <Code>VIP</Code>.
      </Step>

      <Step n={4} title="Quando passar pro corretor">
        Defina o critério. Exemplo: <em>"Quando o cliente pedir pra falar com humano, OU
        agendar visita, OU disser que vai assinar contrato — diga 'vou te conectar com o
        corretor agora' e sugira estágio NEGOCIANDO."</em>
      </Step>

      <Step n={5} title="O que NUNCA fazer">
        <ul>
          <li>Inventar preços / disponibilidade que não está no contexto.</li>
          <li>Prometer condição comercial sem aprovação.</li>
          <li>Mandar áudios, links externos, ou pedir foto de documento.</li>
        </ul>
      </Step>

      <div className="help-warn" style={{ marginTop: 12 }}>
        <strong>Teste sempre antes de soltar em produção:</strong> mude o prompt → clique{' '}
        <em>Salvar</em> → vá no Atendimento → use <em>Responder com IA</em> num lead seu
        próprio (não cliente real). Repita até a resposta soar como você quer.
      </div>
    </div>
  );
}
