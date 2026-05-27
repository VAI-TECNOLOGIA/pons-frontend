import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { Api, ApiError } from '../lib/api';

interface Props {
  open: boolean;
  title?: string;
  message?: string;
  /** Texto do botão de confirmar. Default: "Confirmar". */
  confirmLabel?: string;
  onClose: () => void;
  /** Chamado quando a senha bate. */
  onConfirm: () => void | Promise<void>;
}

/**
 * Modal de step-up auth — pede a senha do usuário logado pra liberar uma ação sensível
 * (ex: salvar chave de IA). Backend valida em /api/auth/verify-password.
 *
 * Não emite novo token. Não fecha automaticamente caso `onConfirm` lance.
 */
export function PasswordConfirmModal({
  open,
  title = 'Confirmar com sua senha',
  message = 'Digite sua senha de login para aplicar essa alteração.',
  confirmLabel = 'Confirmar',
  onClose,
  onConfirm,
}: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Limpa estado ao abrir/fechar
  useEffect(() => {
    if (open) {
      setPassword('');
      setErr(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const submit = async () => {
    if (busy || !password) return;
    setBusy(true);
    setErr(null);
    try {
      await Api.verifyPassword(password);
      await onConfirm();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setErr('Senha incorreta. Tente novamente.');
      } else if (e instanceof ApiError && e.status === 429) {
        setErr('Muitas tentativas. Aguarde um minuto.');
      } else {
        setErr((e as any)?.message || 'Falha ao validar. Tente novamente.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={message}
      size="sm"
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={busy || !password}>
            {busy ? 'Verificando…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field__label">Senha de login</label>
        <input
          ref={inputRef}
          type="password"
          className="field__input"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          autoComplete="current-password"
        />
        {err && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: 'var(--color-danger-fg)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon name="warn" size={12} /> {err}
          </div>
        )}
      </div>
    </Modal>
  );
}
