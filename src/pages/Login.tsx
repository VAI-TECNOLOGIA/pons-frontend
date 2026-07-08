import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../lib/auth';
import { Api, ApiError } from '../lib/api';
import { useUser } from '../lib/userContext';
import { isNativeApp } from '../lib/platform';

import './login.css';

// Colaborador em contratação (onboardingStatus != ATIVO) fica preso na esteira
// /onboarding — e /api/users/me é bloqueado pelo gate, então nem dá pra validar
// via Api.me(). Manda direto pra esteira nesses casos.
function landingFor(user?: { role?: string | null; onboardingStatus?: string | null } | null): string {
  const onb = user?.onboardingStatus;
  if (onb && onb !== 'ATIVO') return '/onboarding';
  return user?.role === 'DEV' ? '/dev/mensagens' : '/dashboard';
}

const BG_COUNT = 3;

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bgIdx, setBgIdx] = useState(0);
  // "Solicitar acesso" — só no navegador (não no app nativo). Cria conta que
  // fica pendente de aprovação de um administrador.
  const [showRequest, setShowRequest] = useState(false);
  const web = !isNativeApp();

  // Slideshow de fundo: crossfade suave a cada 5s (estilo Apple).
  useEffect(() => {
    const t = setInterval(() => setBgIdx((i) => (i + 1) % BG_COUNT), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (Auth.token) {
      // Onboarding: /api/users/me daria 403 (gate) e o catch limparia a sessão.
      // Vai direto pra esteira usando o status já persistido.
      const onb = Auth.user?.onboardingStatus;
      if (onb && onb !== 'ATIVO') {
        navigate('/onboarding', { replace: true });
      } else {
        Api.me()
          .then((r) => navigate(landingFor(r.user), { replace: true }))
          .catch(() => Auth.clear());
      }
    }
    // Aquece o banco enquanto o usuário digita
    Api.warmup().catch(() => {});
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token, user } = await Api.login(email.trim(), password);
      // Persist no localStorage E atualiza o React state global (UserContext)
      // — sem o segundo, a Topbar/avatar continua mostrando o user anterior
      // até o próximo reload do browser.
      Auth.set(token, user);
      setUser(user);
      // Boas-vindas: o WelcomeSplash (Layout) abre 100% das vezes ao logar
      sessionStorage.setItem('pons.welcome.show', '1');
      navigate(landingFor(user), { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiError && err.message === 'credenciais_invalidas'
          ? 'E-mail ou senha incorretos.'
          : err instanceof ApiError && err.message === 'conta_desativada'
            ? 'Conta desativada — fale com o administrador.'
            : 'Erro ao entrar: ' + (err instanceof Error ? err.message : 'desconhecido');
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-bg" aria-hidden>
        {Array.from({ length: BG_COUNT }).map((_, i) => (
          <div key={i} className={`login-bg__layer l${i} ${i === bgIdx ? 'is-active' : ''}`} />
        ))}
        <div className="login-bg__veil" />
      </div>

      <header className="login-logos">
        <img src="/assets/home/grupopons_logo.png" alt="Grupo Pons Imobiliário" className="login-logos__pons" />
      </header>

      <main className="login-stage">
        <div className="login-stage__brand">
          <img src="/assets/home/gpi_logo.png" alt="GPI — Grupo Pons Imobiliário" className="login-stage__emblem" />
        </div>
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card__eyebrow">Grid de Largada</div>
          <h1 className="login-card__title">Acesso do Piloto</h1>
          <p className="login-card__sub">Entre com a sua conta corporativa</p>

          {error && <div className="login-card__error">{error}</div>}

          <label className="login-field">
            <span className="login-field__label">Email</span>
            <input
              className="login-field__input"
              type="email"
              autoComplete="email"
              required
              placeholder="piloto@grupopons.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="login-field">
            <span className="login-field__label">Senha</span>
            <input
              className="login-field__input"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button type="submit" className="login-btn" disabled={busy}>
            {busy ? 'Acelerando…' : 'Entrar'}
          </button>

          {web && (
            <button
              type="button"
              className="login-request-link"
              onClick={() => setShowRequest(true)}
            >
              Não tem conta? Solicitar acesso
            </button>
          )}
        </form>

        <div className="login-tagline">
          <span className="login-tagline__pre">O seu lugar de</span>
          <strong className="login-tagline__main">Alta Performance</strong>
        </div>
      </main>

      <footer className="login-foot">Grupo Pons Imobiliário ®</footer>

      {showRequest && <RequestAccessModal onClose={() => setShowRequest(false)} />}
    </div>
  );
}

// Modal de solicitação de acesso (web). Cria uma conta que fica pendente de
// aprovação — não libera nada até um administrador aprovar.
function RequestAccessModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await Api.solicitarAcesso({ nome: nome.trim(), email: email.trim(), senha, telefone: telefone.trim() || undefined });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar. Tente novamente.');
      setBusy(false);
    }
  };

  return (
    <div className="login-modal" role="dialog" aria-modal="true" aria-label="Solicitar acesso" onClick={onClose}>
      <div className="login-modal__card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-modal__close" aria-label="Fechar" onClick={onClose}>×</button>
        {done ? (
          <div className="login-modal__done">
            <h2 className="login-card__title">Solicitação enviada</h2>
            <p className="login-card__sub">
              Recebemos o seu pedido. Você receberá acesso assim que um administrador aprovar a sua conta.
            </p>
            <button type="button" className="login-btn" onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="login-card__eyebrow">Novo por aqui?</div>
            <h2 className="login-card__title">Solicitar acesso</h2>
            <p className="login-card__sub">Crie sua conta — a liberação é feita por um administrador.</p>

            {error && <div className="login-card__error">{error}</div>}

            <label className="login-field">
              <span className="login-field__label">Nome completo</span>
              <input className="login-field__input" type="text" required value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label className="login-field">
              <span className="login-field__label">Email</span>
              <input className="login-field__input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="login-field">
              <span className="login-field__label">Telefone (opcional)</span>
              <input className="login-field__input" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </label>
            <label className="login-field">
              <span className="login-field__label">Senha</span>
              <input className="login-field__input" type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
              <span className="login-field__hint">8+ caracteres, com maiúscula, minúscula, número e símbolo.</span>
            </label>

            <button type="submit" className="login-btn" disabled={busy}>
              {busy ? 'Enviando…' : 'Solicitar acesso'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
