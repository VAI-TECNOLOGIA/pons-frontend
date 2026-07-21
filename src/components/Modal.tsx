import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

import './modal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    // ESC não fecha: clique fora ou tecla errada fechavam modais de criação e
    // o usuário perdia o formulário inteiro. Fechar SÓ pelo X (ou Cancelar).
    const handleCancel = (e: Event) => e.preventDefault();
    dlg.addEventListener('cancel', handleCancel);
    return () => dlg.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  // Sem onClick no backdrop de propósito — clicar fora NÃO fecha (perda de dados).
  return (
    <dialog
      ref={ref}
      className={`modal modal--${size}`}
    >
      <div className="modal__content">
        <header className="modal__header">
          <div>
            <h3 className="modal__title">{title}</h3>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="modal__close" aria-label="Fechar">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
