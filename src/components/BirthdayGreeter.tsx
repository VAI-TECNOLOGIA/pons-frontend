import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { Auth } from '../lib/auth';
import { useUser } from '../lib/userContext';
import { Modal } from './Modal';

import './birthday.css';

export function BirthdayGreeter() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!Auth.token || !user || checked) return;
    setChecked(true);
    (async () => {
      try {
        const me: any = await Api.meProfile();
        if (me?.aniversarioHoje) setOpen(true);
      } catch {}
    })();
  }, [user, checked]);

  const fechar = async () => {
    setOpen(false);
    try {
      await Api.meAniversarioSaudado();
    } catch {}
  };

  if (!user) return null;
  const primeiroNome = user.name.split(' ')[0];

  return (
    <Modal open={open} onClose={fechar} title=" " size="sm">
      <div className="bday">
        <div className="bday__confetti" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} style={{ ['--i' as any]: i }} />
          ))}
        </div>
        <div className="bday__cake">
          <svg width="84" height="84" viewBox="0 0 64 64" fill="none">
            <rect x="8" y="32" width="48" height="22" rx="3" fill="#E10600" />
            <rect x="8" y="40" width="48" height="14" fill="#B30500" />
            <path d="M8 38 Q14 32 20 38 T32 38 T44 38 T56 38 V42 H8 Z" fill="#fff" opacity="0.95" />
            <rect x="14" y="22" width="3" height="12" rx="1" fill="#88C559" />
            <rect x="30" y="22" width="3" height="12" rx="1" fill="#F2B544" />
            <rect x="46" y="22" width="3" height="12" rx="1" fill="#5D8FE0" />
            <path d="M15.5 22 q-3 -4 0 -8 q3 4 0 8z" fill="#F2B544" />
            <path d="M31.5 22 q-3 -4 0 -8 q3 4 0 8z" fill="#E10600" />
            <path d="M47.5 22 q-3 -4 0 -8 q3 4 0 8z" fill="#88C559" />
            <rect x="6" y="52" width="52" height="6" rx="2" fill="#3A0202" />
          </svg>
        </div>
        <h2 className="bday__title">Parabéns, {primeiroNome}!</h2>
        <p className="bday__msg">
          Hoje é seu dia. Que ele seja cheio de vitórias na pista e fora dela.
          <br />
          <strong>Toda a equipe do Grupo Pons te deseja um feliz aniversário!</strong>
        </p>
        <button className="btn btn--primary" onClick={fechar} style={{ marginTop: 12 }}>
          Obrigado!
        </button>
      </div>
    </Modal>
  );
}
