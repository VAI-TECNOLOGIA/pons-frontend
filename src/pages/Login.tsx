import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../lib/auth';
import { Api, ApiError } from '../lib/api';
import { useUser } from '../lib/userContext';
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
  // "Criar conta" — disponível no navegador E no app nativo (uso principal:
  // testadores entrando pelo celular). Cria corretor aprovado e loga direto.
  const [showRequest, setShowRequest] = useState(false);
  const [showEsqueci, setShowEsqueci] = useState(false);

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

          <button
            type="button"
            className="login-request-link"
            onClick={() => setShowEsqueci(true)}
          >
            Esqueci a senha
          </button>

          <button
            type="button"
            className="login-request-link"
            onClick={() => setShowRequest(true)}
          >
            Não tem conta? Criar conta
          </button>
        </form>

        <div className="login-tagline">
          <span className="login-tagline__pre">O seu lugar de</span>
          <strong className="login-tagline__main">Alta Performance</strong>
        </div>
      </main>

      <footer className="login-foot">Grupo Pons Imobiliário ®</footer>

      {showRequest && <CriarContaModal onClose={() => setShowRequest(false)} />}
      {showEsqueci && <EsqueciSenhaModal onClose={() => setShowEsqueci(false)} />}
    </div>
  );
}

// Modal "Esqueci a senha": pede o e-mail e dispara o link de redefinição.
// Resposta sempre genérica (não confirma se o e-mail existe).
function EsqueciSenhaModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await Api.esqueciSenha(email.trim());
      setEnviado(true);
    } catch {
      setEnviado(true); // resposta é genérica de qualquer forma
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-modal" role="dialog" aria-modal="true" aria-label="Esqueci a senha" onClick={onClose}>
      <div className="login-modal__card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-modal__close" aria-label="Fechar" onClick={onClose}>×</button>
        <div className="login-card__eyebrow">Recuperar acesso</div>
        <h2 className="login-card__title">Esqueci a senha</h2>
        {enviado ? (
          <>
            <p className="login-card__sub">
              Se o e-mail <strong>{email.trim()}</strong> estiver cadastrado, você vai receber um link de
              redefinição válido por 30 minutos. Confira também a caixa de spam.
            </p>
            <button type="button" className="login-btn" onClick={onClose}>Voltar pro login</button>
          </>
        ) : (
          <form onSubmit={enviar}>
            <p className="login-card__sub">Informe o e-mail da sua conta — enviaremos o link pra criar uma senha nova.</p>
            <label className="login-field">
              <span className="login-field__label">E-mail</span>
              <input
                className="login-field__input"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@grupopons.com.br"
              />
            </label>
            <button type="submit" className="login-btn" disabled={busy}>{busy ? 'Enviando…' : 'Enviar link'}</button>
            <button type="button" className="login-request-link" onClick={onClose}>Cancelar</button>
          </form>
        )}
      </div>
    </div>
  );
}

// Modal "Criar conta" (web). Cria a conta de CORRETOR já aprovada e loga
// direto no sistema — as contas nascem marcadas (origem + equipe de teste)
// pra gestão identificar e direcionar leads.
function CriarContaModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token, user } = await Api.registrar({ name: nome.trim(), email: email.trim(), password: senha, phone: telefone.trim() || undefined });
      Auth.set(token, user);
      setUser(user);
      sessionStorage.setItem('pons.welcome.show', '1');
      navigate(landingFor(user), { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError && err.message === 'email_em_uso'
        ? 'Esse e-mail já tem conta — use o login normal.'
        : err instanceof ApiError ? err.message : 'Não foi possível criar a conta. Tente novamente.';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <div className="login-modal" role="dialog" aria-modal="true" aria-label="Criar conta">
      <div className="login-modal__card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-modal__close" aria-label="Fechar" onClick={onClose}>×</button>
        <form onSubmit={submit}>
          <div className="login-card__eyebrow">Novo por aqui?</div>
          <h2 className="login-card__title">Criar conta</h2>
          <p className="login-card__sub">Preencha os dados e entre direto no sistema como corretor.</p>

          {error && <div className="login-card__error">{error}</div>}

          <label className="login-field">
            <span className="login-field__label">Nome completo</span>
            <input className="login-field__input" type="text" required minLength={3} value={nome} onChange={(e) => setNome(e.target.value)} />
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
            <input className="login-field__input" type="password" autoComplete="new-password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} />
            <span className="login-field__hint">Mínimo de 6 caracteres.</span>
          </label>

          <button type="submit" className="login-btn" disabled={busy}>
            {busy ? 'Criando…' : 'Criar conta e entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
