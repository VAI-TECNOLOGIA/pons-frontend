// Página pública obrigatória pra OAuth consent (Google + Facebook).
export default function Termos() {
  return (
    <div style={containerStyle}>
      <div style={heroStyle}>
        <a href="/" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: 13 }}>← Voltar</a>
      </div>
      <article style={articleStyle}>
        <h1 style={h1Style}>Termos de Uso</h1>
        <p style={metaStyle}>Última atualização: 5 de junho de 2026 · VAI Sistema</p>

        <Section title="1. Aceitação">
          Ao criar uma conta no VAI Sistema, você declara ter lido, entendido e concordado
          integralmente com estes Termos de Uso e com a{' '}
          <a href="/privacidade" style={linkStyle}>Política de Privacidade</a>.
        </Section>

        <Section title="2. Descrição do serviço">
          O VAI Sistema é uma plataforma SaaS de CRM/ERP focada no mercado imobiliário,
          oferecendo gestão de leads, automação de follow-up, distribuição entre corretores,
          relatórios analíticos, financeiro com rateio de comissão, integrações com Facebook
          Lead Ads, ZAP Imóveis, Google Calendar e WhatsApp (via VAI CRM).
        </Section>

        <Section title="3. Cadastro e responsabilidade">
          <ul style={ulStyle}>
            <li>O usuário deve fornecer dados verdadeiros, completos e atualizados</li>
            <li>Senhas são pessoais e intransferíveis</li>
            <li>O titular é responsável por toda atividade originada da sua conta</li>
            <li>Não é permitido criar conta em nome de terceiros sem autorização expressa</li>
          </ul>
        </Section>

        <Section title="4. Uso permitido">
          O sistema deve ser usado exclusivamente para fins comerciais legítimos relacionados
          à gestão imobiliária. É <strong>vedado</strong>:
          <ul style={ulStyle}>
            <li>Importar bases de leads adquiridas sem consentimento da LGPD</li>
            <li>Enviar mensagens em massa não-solicitadas (spam)</li>
            <li>Tentar burlar limites técnicos ou contornar autenticação</li>
            <li>Engenharia reversa, web scraping ou uso automatizado não autorizado</li>
            <li>Uso para qualquer fim ilícito, abusivo ou que viole direitos de terceiros</li>
          </ul>
        </Section>

        <Section title="5. Integrações com terceiros">
          O VAI Sistema integra-se com serviços de terceiros (Facebook, Google, ZAP Imóveis,
          Cloudflare, Anthropic, VAI CRM). Ao autorizar essas integrações, o usuário também
          aceita os termos dos respectivos provedores. Não nos responsabilizamos por
          indisponibilidades dessas plataformas.
        </Section>

        <Section title="6. Propriedade intelectual">
          O código-fonte, marca, identidade visual e qualquer material do VAI Sistema são
          propriedade da VAI Tecnologia. Os dados inseridos pelo usuário (leads, vendas,
          configurações) pertencem ao próprio usuário.
        </Section>

        <Section title="7. Disponibilidade do serviço">
          Buscamos manter a plataforma disponível 24/7, mas não garantimos disponibilidade
          ininterrupta. Manutenções programadas e incidentes podem ocorrer. SLA específico
          pode ser objeto de contrato comercial separado.
        </Section>

        <Section title="8. Encerramento de conta">
          O usuário pode solicitar o encerramento a qualquer tempo. A VAI Tecnologia pode
          encerrar contas que violem estes Termos, com aviso prévio de 15 dias, exceto em
          casos de violação grave (uso ilícito), que ensejam encerramento imediato.
        </Section>

        <Section title="9. Limitação de responsabilidade">
          Na máxima extensão permitida em lei, a VAI Tecnologia não responde por danos
          indiretos, lucros cessantes ou perda de oportunidades comerciais decorrentes
          do uso ou indisponibilidade do sistema.
        </Section>

        <Section title="10. Foro">
          Fica eleito o foro da comarca de domicílio da VAI Tecnologia para dirimir
          quaisquer controvérsias, com renúncia a qualquer outro por mais privilegiado
          que seja.
        </Section>

        <Section title="11. Contato">
          E-mail: <a href="mailto:vaitecnologialp@gmail.com" style={linkStyle}>vaitecnologialp@gmail.com</a>
        </Section>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #334155', fontSize: 12, color: '#64748B' }}>
          VAI Tecnologia · Brasil · <a href="/privacidade" style={linkStyle}>Política de Privacidade</a>
        </div>
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

const heroStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
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

const linkStyle: React.CSSProperties = {
  color: '#60A5FA',
  textDecoration: 'underline',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
