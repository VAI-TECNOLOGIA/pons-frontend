import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../lib/auth';
import { Api } from '../lib/api';

import './gate.css';

export default function Gate() {
 const navigate = useNavigate();
 const [token, setToken] = useState('');
 const [error, setError] = useState('');
 const [busy, setBusy] = useState(false);
 const [shake, setShake] = useState(false);
 const inputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 if (Auth.gatePassed) navigate('/login', { replace: true });
 // Aquece o banco (Neon hiberna no free) enquanto o usuário digita
 Api.warmup().catch(() => {});
 }, [navigate]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 const t = token.trim();
 if (!t) return;
 setError('');
 setBusy(true);
 try {
 await Api.gateVerificar(t);
 Auth.setGate();
 setTimeout(() => navigate('/login', { replace: true }), 200);
 } catch {
 setError('Código inválido. Verifique com a VAI.');
 setShake(true);
 setTimeout(() => setShake(false), 450);
 setBusy(false);
 inputRef.current?.select();
 }
 };

 return (
 <div className={'gate' + (shake ? ' gate--shake' : '')} id="gate">
 <div className="vai-logo">
 <img src="/assets/vai-logo.png" alt="VAI" className="vai-img" />
 <div className="vai-sub">Sistema</div>
 </div>

 <div className="gate__card">
 <div className="gate__eyebrow">Ambiente exclusivo</div>
 <div className="gate__title">Acesso protegido</div>
 <p className="gate__hint">
 Digite o código de acesso fornecido pela VAI para entrar no sistema do cliente.
 </p>
 <form onSubmit={handleSubmit}>
 <input
 ref={inputRef}
 className="gate__input"
 placeholder="Código de acesso"
 autoComplete="off"
 autoFocus
 maxLength={40}
 value={token}
 onChange={(e) => setToken(e.target.value)}
 />
 <button className="gate__btn" type="submit" disabled={busy}>
 {busy ? 'Verificando…' : 'Acessar →'}
 </button>
 </form>
 <div className="gate__err">{error}</div>
 </div>

 <div className="gate__foot">
 <span className="gate__lock">vai-sistema.com · acesso restrito e monitorado</span>
 </div>
 </div>
 );
}
