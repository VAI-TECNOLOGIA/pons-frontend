// Exclusão parcial — Google Play "Account Deletion" exige link de exclusão
// de dados que NÃO apague a conta inteira. LGPD Art. 18 inciso VI também.
//
// Aqui o usuário escolhe categorias específicas pra apagar mantendo a conta:
// histórico de atividade, preferências, tokens de integrações, etc.
import { useState } from 'react';

const CATEGORIAS = [
  { id: 'historico', label: 'Histórico de logins e atividade', desc: 'Logs de auditoria e acessos dos últimos meses.' },
  { id: 'preferencias', label: 'Preferências de uso', desc: 'Tema, layout, notificações configuradas.' },
  { id: 'integracoes', label: 'Tokens de integrações', desc: 'Google Calendar, Facebook Business Manager — você é desconectado.' },
  { id: 'avatar', label: 'Foto de perfil e mídia pessoal', desc: 'Avatar e arquivos que você subiu.' },
  { id: 'agenda', label: 'Eventos pessoais da agenda', desc: 'Compromissos e tarefas marcadas apenas por você.' },
];

export default function ExcluirDados() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'erro'>('idle');
  const [msg, setMsg] = useState('');

  const toggle = (id: string) =>
    setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sel.length === 0) {
      setStatus('erro');
      setMsg('Selecione pelo menos uma categoria.');
      return;
    }
    setBusy(true);
    setStatus('idle');
    setMsg('');
    try {
      const r = await fetch(
        'https://web-production-e420b.up.railway.app/api/auth/delete-data',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, categorias: sel }),
        },
      );
      if (r.ok) {
        setStatus('ok');
        setMsg(`Pedido registrado. As categorias selecionadas (${sel.length}) serão removidas em até 15 dias.`);
      } else {
        const j = await r.json().catch(() => ({}));
        setStatus('erro');
        setMsg(j.error === 'credenciais_invalidas' ? 'E-mail ou senha incorretos.' : 'Falha ao processar.');
      }
    } catch {
      setStatus('erro');
      setMsg('Falha de rede. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={containerStyle}>
      <Hero />
      <article style={articleStyle}>
        <h1 style={h1Style}>Excluir dados (mantendo a conta)</h1>
        <p style={metaStyle}>VAI Sistema · Grupo Pons Imobiliário</p>

        <Section title="Sobre essa opção">
          Esta página permite apagar categorias específicas dos seus dados <strong>sem encerrar
          sua conta</strong>. Sua conta de acesso continua funcionando — só os dados que você
          marcar serão removidos do nosso banco.
          <br /><br />
          Pra exclusão definitiva da conta, use{' '}
          <a href="/excluir-conta" style={linkStyle}>/excluir-conta</a>.
        </Section>

        <Section title="O que você quer apagar?">
          {status === 'ok' ? (
            <div style={okBoxStyle}>
              <strong>✓ Pedido recebido</strong>
              <div style={{ marginTop: 6 }}>{msg}</div>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {CATEGORIAS.map((c) => (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      padding: 12, borderRadius: 8,
                      background: sel.includes(c.id) ? '#1E3A8A33' : '#0F172A',
                      border: '1px solid ' + (sel.includes(c.id) ? '#3B82F6' : '#334155'),
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sel.includes(c.id)}
                      onChange={() => toggle(c.id)}
                      style={{ marginTop: 4 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#F8FAFC' }}>{c.label}</div>
                      <div style={{ fontSize: 13, color: '#94A3B8' }}>{c.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

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
              {status === 'erro' && <div style={errBoxStyle}>{msg}</div>}
              <button type="submit" disabled={busy} style={btnStyle}>
                {busy ? 'Processando…' : `Apagar ${sel.length || 0} categoria${sel.length === 1 ? '' : 's'}`}
              </button>
            </form>
          )}
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
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#CBD5E1' };
const inputStyle: React.CSSProperties = { background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none' };
const btnStyle: React.CSSProperties = { background: '#EA580C', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
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
      <a href="/excluir-conta" style={{ color: '#60A5FA' }}>Excluir conta inteira</a>
    </div>
  );
}
