import { useId } from 'react';

/**
 * Marca da IA do Grupo Pons — bandeira quadriculada de F1.
 * Traço fino e cantos arredondados: a leitura é "linha de chegada", não "robô".
 * Herda a cor do contexto (currentColor), então serve em fundo claro e escuro.
 */
export function IaMark({ size = 24, className }: { size?: number; className?: string }) {
  // id único: várias instâncias na tela não podem compartilhar o mesmo clipPath
  const cid = `iamark-${useId().replace(/:/g, '')}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={cid}>
          <path d="M6.1 5.1c2.9-1.7 5.9 1.7 8.8 0v7.7c-2.9 1.7-5.9-1.7-8.8 0V5.1Z" />
        </clipPath>
      </defs>

      {/* mastro */}
      <path d="M5.1 3.5v17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />

      {/* xadrez, recortado pelo contorno ondulado do pano */}
      <g clipPath={`url(#${cid})`}>
        <rect x="6" y="3" width="2.95" height="3.3" fill="currentColor" opacity="0.92" />
        <rect x="11.9" y="3" width="2.95" height="3.3" fill="currentColor" opacity="0.92" />
        <rect x="8.95" y="6.3" width="2.95" height="3.3" fill="currentColor" opacity="0.92" />
        <rect x="14.85" y="6.3" width="2.95" height="3.3" fill="currentColor" opacity="0.92" />
        <rect x="6" y="9.6" width="2.95" height="3.3" fill="currentColor" opacity="0.92" />
        <rect x="11.9" y="9.6" width="2.95" height="3.3" fill="currentColor" opacity="0.92" />
      </g>

      {/* contorno do pano por cima, suavizando o recorte dos quadrados */}
      <path
        d="M6.1 5.1c2.9-1.7 5.9 1.7 8.8 0v7.7c-2.9 1.7-5.9-1.7-8.8 0V5.1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}
