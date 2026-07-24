// Tela pública de redefinição de senha — aberta pelo link do e-mail
// (/redefinir-senha?token=...). Token vale 30 minutos, uso único.
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Api } from '../lib/api';
import './login.css';

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (senha.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (senha !== confirma) { setErro('As senhas não conferem.'); return; }
    setBusy(true);
    try {
      await Api.redefinirSenha(token, senha);
      setOk(true);
    } catch (err: any) {
      setErro(err?.message || 'Link inválido ou expirado — peça uma nova redefinição na tela de login.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <main className="login-main" style={{ justifyContent: 'center' }}>
        <div className="login-card" style={{ maxWidth: 420, width: '100%' }}>
          <div className="login-card__eyebrow">Recuperar acesso</div>
          <h2 className="login-card__title">Nova senha</h2>
          {!token ? (
            <>
              <p className="login-card__sub">Link incompleto — abra o link exatamente como veio no e-mail, ou peça uma nova redefinição.</p>
              <button type="button" className="login-btn" onClick={() => navigate('/login')}>Ir pro login</button>
            </>
          ) : ok ? (
            <>
              <p className="login-card__sub">Senha redefinida com sucesso. Já dá pra entrar com a nova senha.</p>
              <button type="button" className="login-btn" onClick={() => navigate('/login')}>Fazer login</button>
            </>
          ) : (
            <form onSubmit={enviar}>
              <p className="login-card__sub">Crie a nova senha da sua conta (mínimo de 6 caracteres).</p>
              {erro && <div className="login-card__error">{erro}</div>}
              <label className="login-field">
                <span className="login-field__label">Nova senha</span>
                <input className="login-field__input" type="password" autoComplete="new-password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus />
              </label>
              <label className="login-field">
                <span className="login-field__label">Confirmar nova senha</span>
                <input className="login-field__input" type="password" autoComplete="new-password" required minLength={6} value={confirma} onChange={(e) => setConfirma(e.target.value)} />
              </label>
              <button type="submit" className="login-btn" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
            </form>
          )}
        </div>
      </main>
      <footer className="login-foot">Grupo Pons Imobiliário ®</footer>
    </div>
  );
}
