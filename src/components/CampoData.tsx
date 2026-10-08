// Campo de data amigável: digita-se 27/02/2007 direto (a barra entra sozinha),
// sem a caixinha nativa que obriga a preencher dia/mês/ano separados. Tem um
// botão de calendário para escolher visualmente. Trabalha sempre em ISO
// (aaaa-mm-dd) por fora — igual ao <input type="date"> que substitui.
//
// Dois modos, como o input nativo:
//  • controlado:   <CampoData value={iso} onChange={(iso) => setX(iso)} />
//  • de formulário: <CampoData name="campo" defaultValue={iso} /> (vai no FormData em ISO)
import { useRef, useState, useEffect } from 'react';
import { maskDataBR, brParaIso, isoParaBr } from '../lib/mascaras';

type Props = {
  name?: string;
  value?: string;            // ISO (controlado)
  defaultValue?: string;     // ISO (não controlado)
  onChange?: (iso: string, el?: HTMLInputElement) => void;
  id?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  title?: string;
  min?: string;              // ISO
  max?: string;              // ISO
  autoFocus?: boolean;
  style?: React.CSSProperties;
  inputRef?: React.Ref<HTMLInputElement>;
};

export function CampoData({
  name, value, defaultValue, onChange, id, className = 'field__input',
  required, disabled, title, min, max, autoFocus, style, inputRef,
}: Props) {
  const controlado = value !== undefined;
  const [texto, setTexto] = useState(() => isoParaBr(controlado ? (value || '') : (defaultValue || '')));
  const [iso, setIso] = useState(() => (controlado ? (value || '') : (defaultValue || '')));
  const dateRef = useRef<HTMLInputElement>(null);

  // Controlado: acompanha o value de fora.
  useEffect(() => {
    if (controlado) { setTexto(isoParaBr(value || '')); setIso(value || ''); }
  }, [value, controlado]);

  const aplicar = (txt: string, el?: HTMLInputElement) => {
    const masked = maskDataBR(txt);
    const novoIso = brParaIso(masked);
    if (!controlado) { setTexto(masked); setIso(novoIso); }
    onChange?.(novoIso, el);
  };

  const abrirCalendario = () => {
    const el = dateRef.current;
    if (!el) return;
    el.value = iso || '';
    // showPicker abre o calendário nativo sem mostrar a caixinha segmentada.
    if (typeof el.showPicker === 'function') { try { el.showPicker(); return; } catch { /* fallback */ } }
    el.focus();
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: '100%', ...style }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={className}
        placeholder="dd/mm/aaaa"
        maxLength={10}
        required={required}
        disabled={disabled}
        title={title}
        autoFocus={autoFocus}
        value={controlado ? isoParaBr(value || '') : texto}
        style={{ paddingRight: 34, width: '100%' }}
        onChange={(e) => aplicar(e.target.value, e.currentTarget)}
        onBlur={(e) => { const m = maskDataBR(e.target.value); if (!controlado) setTexto(m); }}
      />
      {/* valor em ISO para o formulário (FormData) */}
      {name ? <input type="hidden" name={name} value={iso} /> : null}
      {/* calendário nativo escondido, aberto pelo botão */}
      <input
        ref={dateRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        min={min}
        max={max}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, right: 30, bottom: 0, pointerEvents: 'none' }}
        onChange={(e) => aplicar(isoParaBr(e.target.value))}
      />
      <button
        type="button"
        onClick={abrirCalendario}
        disabled={disabled}
        aria-label="Abrir calendário"
        title="Escolher no calendário"
        style={{
          position: 'absolute', right: 1, top: 1, bottom: 1, width: 30, border: 'none',
          background: 'transparent', cursor: disabled ? 'default' : 'pointer', color: 'var(--text-secondary, #6b7280)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
    </span>
  );
}
