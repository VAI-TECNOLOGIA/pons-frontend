// Botão "Excluir minha conta" exibido dentro do app (perfil do usuário).
// Necessário pra Apple Guideline 5.1.1(v) — a app store exige que o usuário
// consiga iniciar o pedido de exclusão de DENTRO do app, não só na web.
//
// O fluxo aqui: confirma senha → POST /auth/delete-account → logout local.
import { useState } from 'react';
import { Api } from '../lib/api';
import { Auth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { Icon } from './Icon';

export function DeleteAccountCard() {
  const user = Auth.user;
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const solicitar = async () => {
    if (!password) return toast.error('Digite sua senha pra confirmar.');
    const ok = await confirm({
      title: 'Excluir minha conta?',
      message:
        'Sua conta vai ser desativada imediatamente e os dados pessoais serão anonimizados ' +
        'em até 30 dias. Vendas e movimentações que você participou ficam mantidas por exigência fiscal. ' +
        'Essa ação NÃO pode ser desfeita.',
      confirmText: 'Sim, excluir',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await fetch(
        (import.meta.env.VITE_API_BASE_URL || 'https://web-production-e420b.up.railway.app') +
          '/api/auth/delete-account',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, password, reason }),
        },
      ).then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || 'falha');
        }
      });
      toast.success('Pedido registrado. Sua conta foi desativada.');
      // Logout local — sessão atual já não vale mais
      Auth.clear();
      setTimeout(() => { window.location.href = '/login'; }, 1500);
    } catch (e: any) {
      const msg = e?.message === 'credenciais_invalidas' ? 'Senha incorreta.' : 'Falha ao processar. Tente de novo.';
      toast.error(msg);
      setBusy(false);
    }
  };

  return (
    <div
      className="card"
      style={{ borderColor: 'rgba(220, 38, 38, 0.3)', background: 'rgba(220, 38, 38, 0.04)' }}
    >
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, color: 'var(--color-danger)' }}>
        <Icon name="warn" size={16} /> Excluir minha conta
      </h3>
      <p className="text-sm" style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
        Exclusão definitiva: sua conta é desativada agora e os dados pessoais são anonimizados
        em até 30 dias. Vendas em que você participou ficam mantidas (exigência fiscal — 5 anos).
        Pra apagar só categorias específicas sem encerrar a conta, use{' '}
        <a href="/excluir-dados" style={{ color: 'var(--pons-blue, #2563eb)' }}>
          /excluir-dados
        </a>.
      </p>

      {!open ? (
        <button
          className="btn btn--sm"
          style={{ marginTop: 12, background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}
          onClick={() => setOpen(true)}
        >
          Iniciar exclusão
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <label className="field" style={{ margin: 0 }}>
            <span className="field__label">Sua senha (pra confirmar identidade)</span>
            <input
              type="password"
              className="field__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span className="field__label">Motivo (opcional)</span>
            <textarea
              className="field__input"
              style={{ minHeight: 70, fontFamily: 'inherit' }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Não precisa, mas ajuda."
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { setOpen(false); setPassword(''); setReason(''); }}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              className="btn btn--sm"
              style={{ background: 'var(--color-danger)', color: '#fff', border: 'none' }}
              onClick={solicitar}
              disabled={busy || !password}
            >
              {busy ? 'Processando…' : 'Excluir minha conta'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Mantém o Api import referenciado pra TS não reclamar caso a gente migre o fetch
// pra Api.* no futuro.
void Api;
