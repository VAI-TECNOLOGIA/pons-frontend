import { useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { GoogleCalendarIcon } from './GoogleCalendarIcon';

import './integracoes-help.css';

type Guide = 'google' | 'meta' | 'vai' | 'r2' | 'sicredi' | 'tracking';

export function IntegracoesHelp() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Guide>('google');

  const apiBase =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}/api`
      : '/api';

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => setOpen(true)}
        title="Guia passo-a-passo das integrações"
      >
        <Icon name="doc" size={14} /> Como conectar
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Guia das integrações" size="lg">
        <div className="integracoes-help">
          <div className="integracoes-help__tabs">
            <Tab id="google" label="Google Calendar" current={active} onPick={setActive} />
            <Tab id="meta" label="Meta WhatsApp" current={active} onPick={setActive} />
            <Tab id="vai" label="VAI CRM" current={active} onPick={setActive} />
            <Tab id="r2" label="R2 Cloudflare" current={active} onPick={setActive} />
            <Tab id="sicredi" label="Sicredi" current={active} onPick={setActive} />
            <Tab id="tracking" label="Webhook tracking" current={active} onPick={setActive} />
          </div>

          <div className="integracoes-help__body">
            {active === 'google' && <GoogleGuide apiBase={apiBase} />}
            {active === 'meta' && <MetaGuide apiBase={apiBase} />}
            {active === 'vai' && <VaiGuide apiBase={apiBase} />}
            {active === 'r2' && <R2Guide />}
            {active === 'sicredi' && <SicrediGuide />}
            {active === 'tracking' && <TrackingGuide apiBase={apiBase} />}
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
  id: Guide;
  label: string;
  current: Guide;
  onPick: (g: Guide) => void;
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

// ── Helpers compartilhados ──────────────────────────────────────────────
export function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="help-step">
      <div className="help-step__num">{n}</div>
      <div className="help-step__body">
        <div className="help-step__title">{title}</div>
        <div className="help-step__content">{children}</div>
      </div>
    </div>
  );
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className="help-code">{children}</code>;
}

export function CopyCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <code
      className="help-code help-code--copyable"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      title="Clique para copiar"
    >
      {value} {copied ? '✓' : ''}
    </code>
  );
}

/**
 * Cabeçalho do guia com logo da marca + título.
 * `logo` é caminho em /public/assets (ex: '/assets/meta.png').
 * Se a imagem não existir/falhar, o fallback (`fallbackIcon`) entra em cena.
 */
export function HelpHeader({
  logo,
  fallbackIcon,
  title,
  lead,
}: {
  logo?: string;
  fallbackIcon?: React.ReactNode;
  title: string;
  lead?: string;
}) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <>
      <h3 className="help-h">
        <span className="help-h__logo" aria-hidden="true">
          {logo && imgOk ? (
            <img src={logo} alt="" onError={() => setImgOk(false)} />
          ) : (
            fallbackIcon || <Icon name="settings" size={20} />
          )}
        </span>
        {title}
      </h3>
      {lead && <p className="help-lead">{lead}</p>}
    </>
  );
}

// ── Google Calendar ────────────────────────────────────────────────────
function GoogleGuide({ apiBase: _apiBase }: { apiBase: string }) {
  return (
    <div>
      <HelpHeader
        logo="/assets/calendar-icon.png"
        fallbackIcon={<GoogleCalendarIcon size={22} />}
        title="Google Calendar"
        lead="Eventos criados no Pons aparecem na sua agenda Google. Compromissos criados no Google são puxados quando você sincroniza."
      />

      <Step n={1} title="Clique em Conectar Google">
        No topo desta página, no card <strong>Google Calendar</strong>, clique{' '}
        <strong>Conectar Google</strong>. Abre uma janela do Google.
      </Step>

      <Step n={2} title="Escolha sua conta Google">
        Entre com a conta Google onde você quer que os eventos apareçam. Geralmente é a mesma
        do email corporativo.
      </Step>

      <Step n={3} title="Autorize o acesso à agenda">
        O Google pergunta se o Pons pode gerenciar seus eventos. Clique <strong>Continuar</strong>
        → <strong>Permitir</strong>. A janela fecha sozinha.
      </Step>

      <Step n={4} title="Pronto">
        O card fica verde com sua conta vinculada. A partir daqui, cada evento criado na aba
        <em> Agenda</em> sincroniza pro seu Google automaticamente. Se precisar trocar de
        conta, clica em <strong>Desconectar</strong> e refaz.
      </Step>

      <div className="help-warn" style={{ marginTop: 12 }}>
        <strong>Acesso bloqueado?</strong> O Pons é um app em modo de teste no Google. Se
        aparecer "Acesso bloqueado: o app não concluiu o processo de verificação", peça pra
        equipe VAI te adicionar como <em>test user</em> no Google Cloud Console (~30s).
      </div>
    </div>
  );
}

// ── Meta WhatsApp Cloud ────────────────────────────────────────────────
function MetaGuide({ apiBase }: { apiBase: string }) {
  const webhook = `${apiBase}/webhooks/meta-whatsapp`;
  return (
    <div>
      <HelpHeader
        logo="/assets/meta-icon.png"
        fallbackIcon={<Icon name="chat" size={22} />}
        title="Meta WhatsApp Cloud"
        lead="Atendimento de WhatsApp direto via API oficial Meta. Sem precisar de proxy externo."
      />

      <Step n={1} title="Acesse o Business Manager">
        Abra <a href="https://business.facebook.com" target="_blank" rel="noopener">business.facebook.com</a>{' '}
        → escolha sua conta de negócio.
      </Step>

      <Step n={2} title="Crie um app no Meta for Developers (se ainda não tem)">
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a>{' '}
        → <strong>Criar app</strong> → tipo <strong>Outros</strong> → propósito{' '}
        <strong>Empresa</strong>.
      </Step>

      <Step n={3} title="Adicione o produto WhatsApp ao app">
        Painel do app → <strong>Adicionar produto</strong> → <strong>WhatsApp</strong> →{' '}
        <strong>Configurar</strong>. Aceita os termos.
      </Step>

      <Step n={4} title="Pegue o WABA ID e Phone Number ID">
        <strong>Configuração da API</strong> → copie <em>WhatsApp Business Account ID</em> (WABA)
        e <em>ID do número de telefone</em>. Cole aqui no Pons.
      </Step>

      <Step n={5} title="Gere um System User Token (permanente)">
        Business Settings → <strong>Usuários do sistema</strong> → criar usuário com role admin
        → <strong>Gerar novo token</strong>. Permissões: <Code>whatsapp_business_messaging</Code>,{' '}
        <Code>whatsapp_business_management</Code>, <Code>business_management</Code>. Esse token
        não expira — guarde, cole aqui no campo <em>Token</em>.
      </Step>

      <Step n={6} title="Cole o App Secret">
        Configurações do app → <strong>Básico</strong> → <em>Chave secreta do app</em>. Cole no
        campo App Secret. Sem isso o backend não consegue validar a assinatura HMAC dos webhooks.
      </Step>

      <Step n={7} title="Configure o webhook">
        Defina o <strong>Verify Token</strong> (qualquer string aleatória — gera no Pons e cola
        no Meta também) e a <strong>Callback URL</strong>:
        <CopyCode value={webhook} />
        Inscreva nos eventos <Code>messages</Code> e{' '}
        <Code>message_template_status_update</Code>.
      </Step>

      <Step n={8} title="Pronto pra mandar e receber">
        Cole tudo aqui no Pons → salva → aba <em>Atendimento</em> mostra conversas em tempo real.
      </Step>

      <div className="help-warn" style={{ marginTop: 16 }}>
        <strong>Importante — Janela de 24h:</strong> mensagens livres só são entregues nas 24h
        após a última msg do cliente. Fora dessa janela, use templates HSM aprovados no Meta.
      </div>
    </div>
  );
}

// ── VAI CRM ─────────────────────────────────────────────────────────────
function VaiGuide({ apiBase: _apiBase }: { apiBase: string }) {
  return (
    <div>
      <HelpHeader
        logo="/assets/vaicrm-icon.png"
        fallbackIcon={<Icon name="bot" size={22} />}
        title="VAI CRM"
        lead="Conecta seu número WhatsApp Business ao Atendimento via VAI. Mensagens recebidas e enviadas pelo Pons trafegam pelo seu canal VAI."
      />

      <Step n={1} title="Tenha conta ativa no painel VAI">
        Acesse <a href="https://app.vaicrm.com.br" target="_blank" rel="noopener">app.vaicrm.com.br</a>{' '}
        com o login da sua operação. Se ainda não tem conta, fale com a VAI Tecnologia pra
        provisionar (canal WhatsApp + usuário de API).
      </Step>

      <Step n={2} title="Preencha email e senha aqui">
        Volte no card <em>WhatsApp via VAI CRM</em> nesta página → preencha:
        <ul>
          <li>
            <strong>Email do painel VAI</strong>
          </li>
          <li>
            <strong>Senha do painel VAI</strong>
          </li>
        </ul>
        Recomendamos criar um usuário de serviço dedicado pro Pons (não use seu login pessoal).
      </Step>

      <Step n={3} title="Salve e teste a conexão">
        Clique <strong>Salvar credenciais VAI</strong>. Em seguida, <strong>Testar conexão</strong>.
        Se aparecer "VAI respondeu — login OK", está pronto.
      </Step>

      <Step n={4} title="Pronto">
        Mensagens recebidas no número WhatsApp do canal VAI já vão chegar no Atendimento. As
        respostas enviadas pelo Pons saem pelo canal automaticamente.
      </Step>

      <div className="help-warn" style={{ marginTop: 16 }}>
        <strong>O resto fica com a VAI Tecnologia:</strong> URLs de webhook, Channel ID,
        secret HMAC, secret de Flows — tudo isso é configurado por nós no backend (variáveis
        de ambiente) ao provisionar sua conta. Você não precisa mexer no painel VAI.
      </div>
    </div>
  );
}

// ── Cloudflare R2 ──────────────────────────────────────────────────────
function R2Guide() {
  return (
    <div>
      <HelpHeader
        logo="/assets/r2-icon.png"
        fallbackIcon={<Icon name="building" size={22} />}
        title="Cloudflare R2"
        lead="Storage de fotos de empreendimentos, avatares e anexos. R2 é S3-compatível sem custo de egress."
      />

      <Step n={1} title="Criar conta + bucket">
        Abra <a href="https://dash.cloudflare.com" target="_blank" rel="noopener">dash.cloudflare.com</a>
        → R2 → <strong>Create bucket</strong>. Nome sugerido: <Code>pons</Code>.
      </Step>

      <Step n={2} title="Habilite acesso público (subdomain r2.dev)">
        No bucket → <em>Settings</em> → <em>R2.dev subdomain</em> →{' '}
        <strong>Allow Access</strong>. Anote a URL pública (formato{' '}
        <Code>https://pub-xxx.r2.dev</Code>).
      </Step>

      <Step n={3} title="Gere R2 Token (API)">
        Sidebar → <strong>Manage R2 API Tokens</strong> → <strong>Create API token</strong>.
        Permissão <strong>Admin Read & Write</strong> no bucket criado. Copie:
        <ul>
          <li>Access Key ID</li>
          <li>Secret Access Key (só aparece uma vez)</li>
          <li>Endpoint S3 API: <Code>https://{'{'}account_id{'}'}.r2.cloudflarestorage.com</Code></li>
        </ul>
      </Step>

      <Step n={4} title="Cole no Pons">
        Aba <em>Storage R2</em> em Configurações: cole Account ID, Bucket, Endpoint, Access Key,
        Secret e Public URL. Salve.
      </Step>
    </div>
  );
}

// ── Sicredi ─────────────────────────────────────────────────────────────
function SicrediGuide() {
  return (
    <div>
      <HelpHeader
        logo="/assets/sicredi-icon.png"
        fallbackIcon={<Icon name="bank" size={22} />}
        title="Sicredi"
        lead="Cobrança automatizada via API (PIX e boleto). Registra cobranças de comissão e baixa entradas automaticamente."
      />

      <Step n={1} title="Solicite acesso à API no Sicredi">
        Procure o gerente da conta PJ → solicite credenciais da <strong>API Cobrança</strong>{' '}
        (também conhecida como API SicrediNet Cobrança). Eles devolvem um Client ID + Secret.
      </Step>

      <Step n={2} title="Ambiente sandbox vs produção">
        Comece em sandbox pra testar (Sicredi te dá creds separadas). Quando estiver OK, troque
        pelas creds de produção.
      </Step>

      <Step n={3} title="Cole no Pons">
        Configurações → Integrações → Sicredi: cole Client ID + Client Secret. Salve.
      </Step>

      <Step n={4} title="Teste com um lançamento de R$ 1,00">
        Crie um lançamento financeiro de baixo valor, aprove e clique <em>Enviar Sicredi</em>{' '}
        pra confirmar que o token e a configuração estão certos antes de processar valores
        reais.
      </Step>
    </div>
  );
}

// ── Tracking Webhook ────────────────────────────────────────────────────
function TrackingGuide({ apiBase }: { apiBase: string }) {
  const url = `${apiBase}/webhooks/lead`;
  return (
    <div>
      <HelpHeader
        fallbackIcon={<Icon name="webhook" size={22} />}
        title="Webhook de Tracking"
        lead="Endpoint pra Meta Lead Ads, formulários do site, Zapier, etc. mandarem leads pro Pons automaticamente."
      />

      <Step n={1} title="Defina um token compartilhado">
        Em Configurações → Integrações → <em>Token do Webhook</em>: cole uma string
        aleatória forte. Esse token vai proteger o endpoint de spam.
      </Step>

      <Step n={2} title="Use esta URL no provedor">
        <CopyCode value={url} />
        Método: <Code>POST</Code> · Content-Type: <Code>application/json</Code>
      </Step>

      <Step n={3} title="Header obrigatório">
        <Code>X-Webhook-Token: {'{'}seu_token{'}'}</Code>
      </Step>

      <Step n={4} title="Body esperado">
        <pre className="help-pre">
{`{
  "nome": "João Silva",
  "telefone": "(48) 99888-7766",
  "email": "joao@email.com",
  "origem": "META_ADS",
  "campanha": "Park View - Maio 2026",
  "interesse": "Park View"
}`}
        </pre>
      </Step>

      <Step n={5} title="Meta Lead Ads">
        No Meta Business → conecte via Zapier/Make (Make é mais barato pra esse volume). Action:{' '}
        <em>HTTP POST</em> → URL acima + header. Mapeie os campos do formulário.
      </Step>
    </div>
  );
}
