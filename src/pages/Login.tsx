import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../lib/auth';
import { Api, ApiError } from '../lib/api';
import { useUser } from '../lib/userContext';

import './login.css';

export default function Login() {
 const navigate = useNavigate();
 const { setUser } = useUser();
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');
 const [busy, setBusy] = useState(false);

 useEffect(() => {
 if (Auth.token) {
 Api.me()
 .then((r) => navigate(r.user?.role === 'DEV' ? '/dev/mensagens' : '/dashboard', { replace: true }))
 .catch(() => Auth.clear());
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
 navigate(user.role === 'DEV' ? '/dev/mensagens' : '/dashboard', { replace: true });
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
 <div className="auth">
 <div className="auth__hero">
 <div className="speed-line" style={{ position: 'absolute', top: 0 }} />
 <div className="auth__brand">
 <img src="/assets/logo_white.png" alt="Grupo Pons Imobiliário" />
 </div>

 <div className="auth__hero-body">
 <div className="auth__eyebrow">Grupo Pons · Imobiliário</div>
 <h1 className="auth__title">
 GRANDEZA
 <br />& <em>VELOCIDADE</em>
 </h1>
 <p className="auth__sub">A operação imobiliária mais veloz do litoral de Santa Catarina.</p>

 <div className="auth__stats">
 <div>
 <div className="auth__stat-v" style={{ color: '#88C559' }}>+R$ 1 Bi</div>
 <div className="auth__stat-l">movimentados</div>
 </div>
 <div>
 <div className="auth__stat-v">130</div>
 <div className="auth__stat-l">corretores</div>
 </div>
 <div>
 <div className="auth__stat-v">30</div>
 <div className="auth__stat-l">lançamentos</div>
 </div>
 </div>
 </div>
 </div>

 <div className="auth__panel">
 <div className="auth__speed-lines" />
 <div className="login">
 <div className="login__flag">
 {Array.from({ length: 12 }).map((_, i) => {
 const col = i % 4;
 const row = Math.floor(i / 4);
 const show = (col + row) % 2 === 0;
 return (
 <span
 key={i}
 style={{
 visibility: show ? 'visible' : 'hidden',
 animationDelay: `${(col + row) * 0.1}s`,
 }}
 />
 );
 })}
 </div>
 <div className="login__logo">
 <img src="/assets/logo_white.png" alt="Grupo Pons" />
 </div>
 <div className="login__eyebrow">Grid de Largada</div>
 <h1 className="login__title">Acesso ao Sistema</h1>
 <p className="login__subtitle">Entre com sua conta corporativa</p>

 <form onSubmit={handleSubmit} className="login__form">
 {error && <div className="login__error login__error--show">{error}</div>}
 <div className="field">
 <label className="field__label">E-mail</label>
 <input
 className="field__input"
 type="email"
 autoComplete="email"
 required
 placeholder="seu@grupopons.com.br"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 />
 </div>
 <div className="field">
 <label className="field__label">Senha</label>
 <input
 className="field__input"
 type="password"
 autoComplete="current-password"
 required
 placeholder="••••••••"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 />
 </div>
 <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%' }} disabled={busy}>
 {busy ? 'Acelerando…' : 'Entrar'}
 </button>
 </form>

 </div>
 </div>
 </div>
 );
}
