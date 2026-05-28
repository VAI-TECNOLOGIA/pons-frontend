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
function GoogleGuide({ apiBase }: { apiBase: string }) {
  const callback = `${apiBase}/integracoes/google/callback`;
  return (
    <div>
      <HelpHeader
        logo="/assets/calendar-icon.png"
        fallbackIcon={<GoogleCalendarIcon size={22} />}
        title="Google Calendar"
        lead="Eventos criados no Pons aparecem no Calendar do usuário. Compromissos criados no Google são puxados quando o usuário sincroniza."
      />

      <Step n={1} title="Abra o Google Cloud Console">
        Acesse{' '}
        <a href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noopener">
          console.cloud.google.com/auth/clients
        </a>{' '}
        logado com a conta que vai ser dona da integração.
      </Step>

      <Step n={2} title="Crie um projeto (se ainda não tem)">
        Topo da página → seletor de projeto → <strong>Novo Projeto</strong>. Nome sugerido:{' '}
        <Code>Pons CRM</Code>.
      </Step>

      <Step n={3} title="Configure a tela de consentimento OAuth">
        Menu lateral → <strong>Branding</strong>. Tipo de usuário: <strong>Externo</strong>.
        Preencha nome do app, email de suporte e contato. Não precisa enviar pra verificação —
        funciona em modo "Em testes".
      </Step>

      <Step n={4} title="Adicione você como Test User">
        Em <strong>Público</strong> → <strong>Add users</strong> → adicione o email Google que
        vai usar o Pons (ex.: <Code>paulo@grupopons.com.br</Code>). Sem isso, o login dá "Acesso
        bloqueado".
      </Step>

      <Step n={5} title="Crie o OAuth Client">
        Menu <strong>Clientes</strong> → <strong>+ Criar credenciais</strong> →{' '}
        <strong>ID do cliente OAuth 2.0</strong>. Tipo de aplicativo:{' '}
        <strong>Aplicativo da Web</strong>.
      </Step>

      <Step n={6} title="Adicione esta Authorized Redirect URI">
        <CopyCode value={callback} />
        <div className="help-warn">
          Tem que ser <em>exatamente</em> essa URL — Google é literal com domínio, path e barras.
        </div>
      </Step>

      <Step n={7} title="Baixe o JSON e cole as creds aqui">
        Após criar, o Google mostra um modal com Client ID + Client Secret. Clique em{' '}
        <strong>Baixar o JSON</strong> antes de fechar (o secret só aparece uma vez). Cole
        Client ID e Client Secret nos campos <em>Outras integrações externas → Google Calendar</em>{' '}
        nesta página e salve.
      </Step>

      <Step n={8} title="Conecte sua conta">
        Volte no topo desta página, no card <em>Google Calendar</em> → clique{' '}
        <strong>Conectar Google</strong>. Abre o consentimento, autoriza, fecha. Pronto.
      </Step>
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
function VaiGuide({ apiBase }: { apiBase: string }) {
  const webhook = `${apiBase}/webhooks/vai`;
  const flow = `${apiBase}/webhooks/vai-flow`;
  return (
    <div>
      <HelpHeader
        logo="/assets/vaicrm-icon.png"
        fallbackIcon={<Icon name="bot" size={22} />}
        title="VAI CRM"
        lead="Opcional. Use se a sua operação roda chatbots/flows pelo VAI. Se você só usa Meta direto, pode pular essa integração."
      />

      <Step n={1} title="Acesse o painel VAI">
        Abra <a href="https://app.vaicrm.com.br" target="_blank" rel="noopener">app.vaicrm.com.br</a>{' '}
        com a conta da operação.
      </Step>

      <Step n={2} title="Pegue suas credenciais de API">
        Em <em>Configurações → API</em>: anote o email/senha que vai ser usado pelo Pons (recomendo
        criar um usuário de serviço dedicado).
      </Step>

      <Step n={3} title="Identifique o Channel ID (canal WhatsApp)">
        Em <em>Canais</em>, copie o ID do canal WhatsApp que será usado. Cole no campo
        Channel ID, ou deixe vazio que o Pons descobre via API.
      </Step>

      <Step n={4} title="Configure os webhooks">
        Em <em>Configurações → Webhooks</em> aponte:
        <ul>
          <li>
            <strong>Mensagens</strong>: <CopyCode value={webhook} />
          </li>
          <li>
            <strong>Flows</strong> (se usar): <CopyCode value={flow} />
          </li>
        </ul>
        Configure também o <em>Webhook Secret</em> — deve ser o mesmo nas duas pontas.
      </Step>

      <Step n={5} title="Cole creds no Pons">
        Volte aqui em Configurações → Integrações → VAI, preencha tudo e salve.
      </Step>
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
