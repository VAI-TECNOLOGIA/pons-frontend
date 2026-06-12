// Boas-vindas pós-login — abre 100% das vezes ao entrar e só fecha clicando
// FORA do card (pensado pra ficar bonito em prints/publicações).
// Gatilho: Login grava sessionStorage 'pons.welcome.show' = '1' no sucesso.
import { useEffect, useState } from 'react';
import { useUser } from '../lib/userContext';

import './welcome.css';

const FLAG_KEY = 'pons.welcome.show';

function saudacao(): string {
 const h = new Date().getHours();
 if (h < 5) return 'Boa madrugada';
 if (h < 12) return 'Bom dia';
 if (h < 18) return 'Boa tarde';
 return 'Boa noite';
}

export function WelcomeSplash() {
 const { user } = useUser();
 const [open, setOpen] = useState(false);

 useEffect(() => {
 if (user && sessionStorage.getItem(FLAG_KEY) === '1') setOpen(true);
 }, [user]);

 if (!open || !user) return null;

 const fechar = () => {
 sessionStorage.removeItem(FLAG_KEY);
 setOpen(false);
 };

 const primeiroNome = user.name.split(' ')[0];

 return (
 <div className="welcome" onClick={fechar} role="dialog" aria-modal="true" aria-label="Boas-vindas">
 <div className="welcome__card" onClick={(e) => e.stopPropagation()}>
 <div className="welcome__speed" />
 <div className="welcome__flag" aria-hidden="true">
 {Array.from({ length: 12 }).map((_, i) => {
 const show = (i % 4 + Math.floor(i / 4)) % 2 === 0;
 return <span key={i} style={{ visibility: show ? 'visible' : 'hidden', animationDelay: `${i * 0.08}s` }} />;
 })}
 </div>

 <div className="welcome__logo">
 <img src="/assets/logo_white.png" alt="Grupo Pons Imobiliário" />
 </div>

 <div className="welcome__eyebrow">Grid de Largada</div>

 <h1 className="welcome__title">
 <small>Bem-vindo ao</small>
 <span className="grad">CRM Grupo Pons</span>
 </h1>

 <p className="welcome__hello">
 {saudacao()}, <b>{primeiroNome}</b> — sua operação já está em movimento. 🏁
 </p>
 <p className="welcome__tagline">Grandeza &amp; Velocidade · a operação imobiliária mais veloz do litoral</p>

 <div className="welcome__divider" />
 <div className="welcome__hint">clique fora para acelerar</div>
 </div>
 </div>
 );
}
