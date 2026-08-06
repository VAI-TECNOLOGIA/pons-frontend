import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface ReguaTimelineStep {
  ordem: number;
  nomeExibicao: string;
  atrasoHoras: number;
  // Omitido = modo edição/preview (sem noção de progresso). Preenchido = modo
  // execução (ficha do lead): done = já enviado, active = próximo a disparar.
  status?: 'done' | 'active' | 'pending';
  detalhe?: ReactNode;
}

interface ReguaTimelineProps {
  steps: ReguaTimelineStep[];
  emptyLabel?: string;
}

// Timeline vertical (círculo numerado + linha conectando + relógio/horas),
// no estilo do print que o cliente mandou. Reaproveita .timeline/.timeline__dot
// de components.css via o modificador .timeline--vertical — usada tanto no
// editor de passos da régua quanto (futuro) no progresso de uma execução na
// ficha do lead.
export function ReguaTimeline({ steps, emptyLabel = 'Nenhum passo configurado ainda.' }: ReguaTimelineProps) {
  if (!steps.length) {
    return <div className="timeline__empty">{emptyLabel}</div>;
  }
  return (
    <div className="timeline timeline--vertical">
      {steps.map((s) => {
        const status = s.status || 'pending';
        return (
          <div key={s.ordem} className={`timeline__step timeline__step--${status}`}>
            <div className="timeline__dot">
              {status === 'done' ? <Icon name="check" size={16} /> : s.ordem}
            </div>
            <div className="timeline__body">
              <div className="timeline__label">{s.nomeExibicao}</div>
              <div className="timeline__date">
                <Icon name="clock" size={12} />
                {s.atrasoHoras}h após o início
              </div>
              {s.detalhe && <div className="timeline__detalhe">{s.detalhe}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
