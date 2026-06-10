// Página pública obrigatória — Apple Guideline 5.1.1(v) e LGPD Art. 18.
// Fluxo: usuário informa email → backend (re)autentica e dispara o pedido
// de exclusão definitiva. Aprovado e processado em até 30 dias.
import { useState } from 'react';

export default function ExcluirConta() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'erro'>('idle');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus('idle');
    setMsg('');
    try {
      const r = await fetch(
        'https://web-production-e420b.up.railway.app/api/auth/delete-account',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, reason }),
        },
      );
      if (r.ok) {
        setStatus('ok');
        setMsg(
          'Solicitação registrada. A exclusão será processada em até 30 dias. ' +
            'Você receberá um e-mail de confirmação no endereço informado.',
        );
      } else {
        const j = await r.json().catch(() => ({}));
        setStatus('erro');
        setMsg(j.error === 'credenciais_invalidas' ? 'E-mail ou senha incorretos.' : 'Falha ao processar o pedido. Tente de novo.');
      }
    } catch {
      setStatus('erro');
      setMsg('Falha de rede. Verifique sua conexão e tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={containerStyle}>
      <Hero />
      <article style={articleStyle}>
        <h1 style={h1Style}>Excluir minha conta</h1>
        <p style={metaStyle}>VAI Sistema · Grupo Pons Imobiliário</p>

        <Section title="O que será apagado">
          <ul style={ulStyle}>
            <li>Seu cadastro de usuário (nome, e-mail, telefone, foto, senha hash, função, equipe)</li>
            <li>Seu histórico pessoal de logins e auditoria de ações</li>
            <li>Suas preferências, tarefas pessoais, eventos de agenda e insights</li>
            <li>Avatar e arquivos que você subiu para o perfil</li>
            <li>Tokens de integração que você vinculou (Google Calendar, etc.)</li>
          </ul>
        </Section>

        <Section title="O que pode ser mantido">
          <ul style={ulStyle}>
            <li>
              <strong>Vendas, comissões e movimentações financeiras</strong> em que você
              participou (a legislação fiscal brasileira exige guarda por 5 anos).
              Seus dados pessoais nesses registros são <em>anonimizados</em>.
            </li>
            <li>
              <strong>Logs de auditoria críticos</strong> exigidos pela CVM/COFECI/Receita
              também são anonimizados, não removidos.
            </li>
          </ul>
        </Section>

        <Section title="Prazo">
          A exclusão é processada em até <strong>30 dias corridos</strong> a partir da
          confirmação. Durante esse período sua conta fica bloqueada — você não consegue
          mais logar. Após processada, a exclusão é definitiva e não pode ser desfeita.
        </Section>

        <Section title="Solicitação">
          {status === 'ok' ? (
            <div style={okBoxStyle}>
              <strong>✓ Pedido recebido</strong>
              <div style={{ marginTop: 6 }}>{msg}</div>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={labelStyle}>
                E-mail da conta
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                  placeholder="seu@grupopons.com.br"
                />
              </label>
              <label style={labelStyle}>
                Senha (pra confirmar que é você)
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                  placeholder="••••••••"
                />
              </label>
              <label style={labelStyle}>
                Motivo (opcional)
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ ...inputStyle, minHeight: 80, fontFamily: 'inherit' }}
                  placeholder="Não precisa, mas ajuda a melhorar o produto"
                />
              </label>
              {status === 'erro' && (
                <div style={errBoxStyle}>{msg}</div>
              )}
              <button type="submit" disabled={busy} style={btnStyle}>
                {busy ? 'Processando…' : 'Solicitar exclusão definitiva'}
              </button>
            </form>
          )}
        </Section>

        <Section title="Dúvidas?">
          Entre em contato com <a href="mailto:vaitecnologialp@gmail.com" style={linkStyle}>vaitecnologialp@gmail.com</a>{' '}
          ou pelo perfil dentro do app (Perfil → Excluir minha conta).
        </Section>

        <Footer />
      </article>
    </div>
  );
}

const containerStyle: React.CSSProperties = { minHeight: '100vh', background: '#0F172A', color: '#E2E8F0', padding: '40px 20px' };
const articleStyle: React.CSSProperties = { maxWidth: 760, margin: '0 auto', background: '#1E293B', padding: '40px 32px', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,.3)', lineHeight: 1.6, fontSize: 15 };
const h1Style: React.CSSProperties = { fontSize: 28, fontWeight: 700, marginTop: 0, marginBottom: 8, color: '#F8FAFC' };
const metaStyle: React.CSSProperties = { color: '#94A3B8', fontSize: 13, margin: 0, marginBottom: 32 };
const ulStyle: React.CSSProperties = { paddingLeft: 20, margin: '8px 0' };
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#CBD5E1' };
const inputStyle: React.CSSProperties = { background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none' };
const btnStyle: React.CSSProperties = { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4 };
const okBoxStyle: React.CSSProperties = { background: '#052E16', border: '1px solid #16A34A', color: '#86EFAC', padding: 14, borderRadius: 8 };
const errBoxStyle: React.CSSProperties = { background: '#450A0A', border: '1px solid #DC2626', color: '#FCA5A5', padding: 12, borderRadius: 8, fontSize: 13 };
const linkStyle: React.CSSProperties = { color: '#60A5FA' };

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
    <div style={{ maxWidth: 760, margin: '0 auto 16px' }}>
      <a href="/" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: 13 }}>← Voltar</a>
    </div>
  );
}
function Footer() {
  return (
    <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #334155', fontSize: 12, color: '#64748B' }}>
      VAI Tecnologia · Brasil ·{' '}
      <a href="/politica-de-seguranca" style={{ color: '#60A5FA' }}>Política de Privacidade</a> ·{' '}
      <a href="/excluir-dados" style={{ color: '#60A5FA' }}>Excluir dados sem apagar conta</a>
    </div>
  );
}
