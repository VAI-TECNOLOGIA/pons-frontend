// Página pública obrigatória pra OAuth consent (Google + Facebook) e LGPD.
// Texto deliberadamente direto e específico — Google Verification rejeita
// privacy policies genéricas copiadas do template.
export default function Privacidade() {
  return (
    <div style={containerStyle}>
      <Hero />
      <article style={articleStyle}>
        <h1 style={h1Style}>Política de Privacidade</h1>
        <p style={metaStyle}>Última atualização: 5 de junho de 2026 · VAI Sistema</p>

        <Section title="Quem somos">
          O VAI Sistema é operado pela <strong>VAI Tecnologia</strong> (vaitecnologialp@gmail.com),
          uma plataforma SaaS de CRM/ERP para imobiliárias e profissionais autônomos do mercado
          imobiliário. Esta política descreve como coletamos, usamos, armazenamos e protegemos
          os dados pessoais tratados pela plataforma.
        </Section>

        <Section title="Dados que coletamos">
          <ul style={ulStyle}>
            <li><strong>De usuários do sistema</strong> (corretores, gestores, sócios da imobiliária):
              nome, e-mail, telefone, data de nascimento opcional, foto de perfil opcional, função
              (CEO/Diretor/Corretor/Gerente), filial e equipe à qual pertence.
            </li>
            <li><strong>De leads importados</strong>: nome, telefone, e-mail, origem, status,
              histórico de interações — fornecidos pelos próprios usuários da imobiliária via
              importação CSV, integrações com plataformas de anúncios (Facebook Lead Ads, ZAP
              Imóveis, sites próprios) ou cadastro manual.
            </li>
            <li><strong>Operacionais</strong>: data/hora de login, IPs de acesso, ações executadas
              (auditoria), preferências de uso da plataforma.
            </li>
            <li><strong>De integrações autorizadas</strong>: ao conectar a conta do Google Calendar,
              acessamos somente eventos do calendário do usuário para sincronização bidirecional.
              Ao conectar Facebook Business Manager, acessamos páginas, contas de anúncio e
              formulários de Lead Ads que o usuário explicitamente autorizou.
            </li>
          </ul>
        </Section>

        <Section title="Como usamos">
          <ul style={ulStyle}>
            <li>Operar o CRM (gestão de leads, vendas, cadências de follow-up, distribuição entre corretores)</li>
            <li>Sincronizar agendamentos com o Google Calendar do usuário</li>
            <li>Capturar leads automaticamente de Facebook Lead Ads e ZAP Imóveis</li>
            <li>Enviar notificações por e-mail e WhatsApp (via VAI CRM) — apenas relacionadas ao trabalho do usuário</li>
            <li>Gerar relatórios analíticos, rankings e insights de performance para os gestores</li>
            <li>Auditoria de eventos críticos por exigência regulatória e investigação de incidentes</li>
          </ul>
          <p>Não vendemos, alugamos nem cedemos dados para fins de marketing de terceiros.</p>
        </Section>

        <Section title="Integrações com Google APIs">
          O uso de APIs do Google pelo VAI Sistema cumpre integralmente a <strong>Google API
          Services User Data Policy</strong>, incluindo os requisitos de Limited Use. Resumindo:
          <ul style={ulStyle}>
            <li>Acessamos apenas escopos estritamente necessários para a funcionalidade ofertada (Calendar events)</li>
            <li>Não usamos dados do Google para treinar modelos de IA, publicidade ou qualquer finalidade não declarada</li>
            <li>Não transferimos dados do Google para terceiros, exceto provedores de infraestrutura sob NDA (Railway, Cloudflare R2, Vercel) e quando exigido por lei</li>
            <li>O usuário pode desconectar a integração a qualquer momento em Configurações &rarr; Integrações</li>
          </ul>
        </Section>

        <Section title="Compartilhamento">
          Compartilhamos dados pessoais apenas com:
          <ul style={ulStyle}>
            <li><strong>Infraestrutura</strong>: Railway (hospedagem e banco), Cloudflare R2 (uploads), Vercel (frontend) — operam sob compromisso contratual de confidencialidade</li>
            <li><strong>Comunicação</strong>: VAI CRM (envio WhatsApp), Anthropic (LLM para assistente IA, com mascaramento de PII quando possível)</li>
            <li><strong>Autoridade competente</strong>: mediante ordem judicial ou requisição legal válida</li>
          </ul>
        </Section>

        <Section title="Retenção">
          Dados de usuários ativos são mantidos enquanto a conta estiver ativa. Após
          desativação, mantemos os dados por até 180 dias para fins de auditoria e
          eventual reativação. Logs de auditoria (AuditEvent) são append-only e
          mantidos por 5 anos por exigência regulatória.
        </Section>

        <Section title="Seus direitos (LGPD)">
          Você tem direito a, a qualquer tempo:
          <ul style={ulStyle}>
            <li>Confirmar a existência de tratamento</li>
            <li>Acessar seus dados</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
            <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários</li>
            <li>Solicitar portabilidade</li>
            <li>Revogar consentimento</li>
          </ul>
          Solicitações para <a href="mailto:vaitecnologialp@gmail.com">vaitecnologialp@gmail.com</a>.
        </Section>

        <Section title="Segurança">
          Senhas são armazenadas com hash bcrypt (10 rounds). Comunicação por HTTPS/TLS.
          Tokens JWT com expiração. Rate limit em endpoints sensíveis. Logs centralizados
          (Pino + Sentry) com mascaramento automático de campos sensíveis.
        </Section>

        <Section title="Cookies">
          Usamos apenas cookies estritamente necessários (sessão, preferência de tema,
          flag de gate de entrada). Não usamos cookies de rastreamento publicitário.
        </Section>

        <Section title="Contato do Encarregado (DPO)">
          E-mail: <a href="mailto:vaitecnologialp@gmail.com">vaitecnologialp@gmail.com</a>
        </Section>

        <Section title="Mudanças nesta política">
          Notificaremos via e-mail e dentro do sistema 30 dias antes de qualquer mudança
          material. A versão vigente é sempre a mais recente publicada neste endereço.
        </Section>

        <Footer />
      </article>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0F172A',
  color: '#E2E8F0',
  padding: '40px 20px',
};

const articleStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  background: '#1E293B',
  padding: '40px 32px',
  borderRadius: 12,
  boxShadow: '0 10px 40px rgba(0,0,0,.3)',
  lineHeight: 1.6,
  fontSize: 15,
};

const h1Style: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  marginTop: 0,
  marginBottom: 8,
  color: '#F8FAFC',
};

const metaStyle: React.CSSProperties = {
  color: '#94A3B8',
  fontSize: 13,
  margin: 0,
  marginBottom: 32,
};

const ulStyle: React.CSSProperties = {
  paddingLeft: 20,
  margin: '8px 0',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Hero() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <a href="/" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: 13 }}>← Voltar</a>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #334155', fontSize: 12, color: '#64748B' }}>
      VAI Tecnologia · Brasil · CNPJ informado mediante solicitação ·
      <a href="/termos" style={{ color: '#60A5FA', marginLeft: 6 }}>Termos de Uso</a>
    </div>
  );
}
