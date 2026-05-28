import { useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { Step, Code, CopyCode, HelpHeader } from './IntegracoesHelp';

import './integracoes-help.css';

type Section = 'anthropic' | 'openai' | 'modelos' | 'prompt';

/**
 * Help dialog dedicado à IA: como configurar Anthropic/OpenAI,
 * tabelas comparativas de modelos (custo, latência, contexto, recomendação)
 * e dicas pro prompt do SDR.
 */
export function IAHelp() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Section>('anthropic');

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => setOpen(true)}
        title="Guia da IA — provedores, modelos e custos"
      >
        <Icon name="doc" size={14} /> Como conectar
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Guia da IA" size="lg">
        <div className="integracoes-help">
          <div className="integracoes-help__tabs">
            <Tab id="anthropic" label="Anthropic (Claude)" current={active} onPick={setActive} />
            <Tab id="openai" label="OpenAI (GPT)" current={active} onPick={setActive} />
            <Tab id="modelos" label="Comparar modelos" current={active} onPick={setActive} />
            <Tab id="prompt" label="Dicas de prompt" current={active} onPick={setActive} />
          </div>

          <div className="integracoes-help__body">
            {active === 'anthropic' && <AnthropicGuide />}
            {active === 'openai' && <OpenAIGuide />}
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

// ─────────── Anthropic ──────────────────────────────────────────────────
function AnthropicGuide() {
  return (
    <div>
      <HelpHeader
        logo="/assets/anthropic.png"
        fallbackIcon={<Icon name="bot" size={22} />}
        title="Anthropic — Claude (recomendado)"
        lead="Família de modelos Claude. Recomendamos pra atendimento por: melhor controle de tom, instruction-following forte e Haiku 4.5 entregando qualidade alta com latência baixa e custo competitivo."
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
        <Code>pons-sdr-ia</Code>. <em>Copie agora</em> — a key só aparece uma vez.
      </Step>

      <Step n={3} title="Cole no Pons">
        Volte aqui em <strong>Configurações → IA & Atendimento</strong>:
        <ul>
          <li>
            <strong>Provider:</strong> <Code>anthropic</Code>
          </li>
          <li>
            <strong>API Key:</strong> cole a chave (formato <Code>sk-ant-api03-...</Code>)
          </li>
          <li>
            <strong>Modelo:</strong> <Code>claude-haiku-4-5-20251001</Code> (recomendado pra
            começar)
          </li>
        </ul>
        Salve e confirme com sua senha.
      </Step>

      <Step n={4} title="Teste no Atendimento">
        Vá no <strong>Atendimento</strong>, abra um lead pendente, clique{' '}
        <strong>Responder com IA</strong>. Em ~1-2s aparece a resposta. Se preferir tom diferente,
        ajuste o prompt em <em>Configurações → IA & Atendimento → Prompt do SDR</em>.
      </Step>
    </div>
  );
}

// ─────────── OpenAI ────────────────────────────────────────────────────
function OpenAIGuide() {
  return (
    <div>
      <HelpHeader
        logo="/assets/openai.png"
        fallbackIcon={<Icon name="bot" size={22} />}
        title="OpenAI — GPT (alternativa)"
        lead="Funciona com qualquer modelo da OpenAI ou compatible (Groq, Together, Mistral, etc.) via o protocolo OpenAI. Use se já tem créditos OpenAI ou se quer testar comparativo."
      />

      <Step n={1} title="Crie conta + adicione billing">
        Acesse{' '}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">
          platform.openai.com/api-keys
        </a>{' '}
        → crie conta → adicione cartão e crédito.
      </Step>

      <Step n={2} title="Gere uma API Key">
        <strong>Create new secret key</strong>. Permissions: <em>Read + Write</em> em todos os
        recursos (ou pelo menos <em>Model capabilities → write</em>). Copie no formato{' '}
        <Code>sk-proj-...</Code>.
      </Step>

      <Step n={3} title="Cole no Pons">
        <ul>
          <li>
            <strong>Provider:</strong> <Code>openai</Code>
          </li>
          <li>
            <strong>API Key:</strong> a chave OpenAI
          </li>
          <li>
            <strong>Modelo:</strong> <Code>gpt-4o-mini</Code> (recomendado custo/qualidade)
            ou <Code>gpt-4o</Code> pra qualidade superior
          </li>
        </ul>
      </Step>

      <Step n={4} title="Compatíveis (mais barato)">
        Se quiser usar Groq (latência absurda), Together AI ou outro provider OpenAI-compatible,
        configure o Base URL via env <Code>OPENAI_BASE_URL</Code> no backend (ex.:{' '}
        <Code>https://api.groq.com/openai/v1</Code>) e use o modelo equivalente.
      </Step>
    </div>
  );
}

// ─────────── Comparativo de modelos ─────────────────────────────────────
function ModelosComparativo() {
  return (
    <div>
      <HelpHeader
        fallbackIcon={<Icon name="chart" size={22} />}
        title="Comparar modelos"
        lead="Preços por milhão de tokens (USD). 1 token ≈ 4 caracteres ≈ 0,75 palavra. Uma conversa típica de WhatsApp consome 200-500 tokens por turno (input+output)."
      />

      <h4 className="help-table__heading">Anthropic — Claude</h4>
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
            <td>SDR/atendimento de alto volume. Rápido (~1s) e qualidade Claude.</td>
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
            <td>Conversas complexas (objeções difíceis, raciocínio multi-passo).</td>
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
            <td>Casos críticos. Caro pra atendimento em massa.</td>
          </tr>
        </tbody>
      </table>

      <h4 className="help-table__heading">OpenAI — GPT</h4>
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
          <tr>
            <td>
              <strong>GPT-4o-mini</strong>
              <br />
              <code>gpt-4o-mini</code>
            </td>
            <td>$0,15</td>
            <td>$0,60</td>
            <td>128k</td>
            <td>Mais barato. Bom pra começar com volume.</td>
          </tr>
          <tr>
            <td>
              <strong>GPT-4o</strong>
              <br />
              <code>gpt-4o</code>
            </td>
            <td>$2,50</td>
            <td>$10,00</td>
            <td>128k</td>
            <td>Equilibrado. Compete com Claude Sonnet em qualidade.</td>
          </tr>
          <tr>
            <td>
              <strong>GPT-4.1</strong>
              <br />
              <code>gpt-4.1</code>
            </td>
            <td>$2,00</td>
            <td>$8,00</td>
            <td>1M</td>
            <td>Contexto longo (manuais inteiros, histórico extenso).</td>
          </tr>
        </tbody>
      </table>

      <h4 className="help-table__heading">Estimativa de custo mensal</h4>
      <table className="help-table">
        <thead>
          <tr>
            <th>Volume</th>
            <th>Haiku 4.5</th>
            <th>GPT-4o-mini</th>
            <th>Sonnet 4.6</th>
            <th>GPT-4o</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1k conversas/mês<br /><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>~5 turnos cada</span></td>
            <td>~$30</td>
            <td>~$3</td>
            <td>~$90</td>
            <td>~$75</td>
          </tr>
          <tr>
            <td>10k conversas/mês</td>
            <td>~$300</td>
            <td>~$30</td>
            <td>~$900</td>
            <td>~$750</td>
          </tr>
          <tr>
            <td>50k conversas/mês</td>
            <td>~$1.500</td>
            <td>~$150</td>
            <td>~$4.500</td>
            <td>~$3.750</td>
          </tr>
        </tbody>
      </table>

      <div className="help-warn" style={{ marginTop: 12 }}>
        <strong>Nossa recomendação:</strong> comece com <code>claude-haiku-4-5-20251001</code>{' '}
        (qualidade alta, latência baixa, custo razoável). Migre pra GPT-4o-mini se o orçamento
        apertar — ele é 5-10× mais barato mas perde em controle de tom e tende a ser mais
        verboso.
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
        corretor agora' e sugira estagio NEGOCIANDO."</em>
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
