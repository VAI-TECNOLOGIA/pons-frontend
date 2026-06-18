import { useState, useMemo } from 'react';
import { Icon } from './Icon';

import './calendar-view.css';

export interface CalendarEvent {
  id: number | string;
  titulo: string;
  inicio: string | Date;
  fim?: string | Date | null;
  tipo?: string;
  local?: string;
  cor?: string;
  executivo?: string;
  notas?: string;
  concluido?: boolean;
}

type View = 'mes' | 'semana' | 'lista' | 'checklist';

interface Props {
  events: CalendarEvent[];
  onEventClick?: (ev: CalendarEvent) => void;
  onNew?: (date?: Date) => void;
  onToggleDone?: (ev: CalendarEvent, concluido: boolean) => void;
  onClearDone?: () => void;
  autoCleanup?: {
    modo: 'manual' | 'semanal' | 'periodico';
    dias: number;
  };
  onAutoCleanupChange?: (cfg: { modo: 'manual' | 'semanal' | 'periodico'; dias: number }) => void;
  initialView?: View;
}

const WEEKDAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const TIPO_COR: Record<string, string> = {
  REUNIAO: '#0E7C9B',
  VISITA: '#88C559',
  EVENTO: '#D9B45B',
  LIGACAO: '#F2B544',
  PESSOAL: '#3FB6D4',
};

function tipoColor(t?: string) {
  return (t && TIPO_COR[t]) || '#3FB6D4';
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function CalendarView({
  events,
  onEventClick,
  onNew,
  onToggleDone,
  onClearDone,
  autoCleanup,
  onAutoCleanupChange,
  initialView = 'mes',
}: Props) {
  const [view, setView] = useState<View>(initialView);
  const [anchor, setAnchor] = useState(() => new Date());

  const parsed = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        inicio: e.inicio instanceof Date ? e.inicio : new Date(e.inicio),
        fim: e.fim ? (e.fim instanceof Date ? e.fim : new Date(e.fim)) : null,
      })),
    [events],
  );

  const today = new Date();

  // Navegação
  const goPrev = () => {
    const n = new Date(anchor);
    if (view === 'mes') n.setMonth(n.getMonth() - 1);
    else if (view === 'semana') n.setDate(n.getDate() - 7);
    else n.setDate(n.getDate() - 7);
    setAnchor(n);
  };
  const goNext = () => {
    const n = new Date(anchor);
    if (view === 'mes') n.setMonth(n.getMonth() + 1);
    else if (view === 'semana') n.setDate(n.getDate() + 7);
    else n.setDate(n.getDate() + 7);
    setAnchor(n);
  };
  const goToday = () => setAnchor(new Date());

  // Header label
  const headerLabel =
    view === 'mes'
      ? `${MONTH_NAME[anchor.getMonth()]} ${anchor.getFullYear()}`
      : view === 'semana'
      ? (() => {
          const start = startOfWeek(anchor);
          const end = addDays(start, 6);
          return `${start.getDate()} ${MONTH_NAME[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTH_NAME[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
        })()
      : 'Próximos compromissos';

  return (
    <div className="cal">
      <div className="cal__header">
        <div className="cal__nav">
          <button className="cal__nav-btn" onClick={goPrev} aria-label="Anterior">
            <Icon name="arrow_right" size={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button className="cal__today" onClick={goToday}>Hoje</button>
          <button className="cal__nav-btn" onClick={goNext} aria-label="Próximo">
            <Icon name="arrow_right" size={16} />
          </button>
          <h3 className="cal__title">{headerLabel}</h3>
        </div>
        <div className="cal__views">
          {(['mes', 'semana', 'lista', 'checklist'] as View[]).map((v) => (
            <button
              key={v}
              className={'cal__view ' + (view === v ? 'cal__view--active' : '')}
              onClick={() => setView(v)}
            >
              {v === 'mes' ? 'Mês' : v === 'semana' ? 'Semana' : v === 'lista' ? 'Lista' : 'Checklist'}
            </button>
          ))}
          {onNew && (
            <button className="btn btn--primary btn--sm" onClick={() => onNew()} style={{ marginLeft: 8 }}>
              + Novo
            </button>
          )}
        </div>
      </div>

      {view === 'mes' && (
        <MonthView events={parsed as any} anchor={anchor} today={today} onEventClick={onEventClick} onNew={onNew} />
      )}
      {view === 'semana' && (
        <WeekView events={parsed as any} anchor={anchor} today={today} onEventClick={onEventClick} onNew={onNew} />
      )}
      {view === 'lista' && <ListView events={parsed as any} onEventClick={onEventClick} />}
      {view === 'checklist' && (
        <ChecklistView
          events={parsed as any}
          onEventClick={onEventClick}
          onToggleDone={onToggleDone}
          onClearDone={onClearDone}
          autoCleanup={autoCleanup}
          onAutoCleanupChange={onAutoCleanupChange}
        />
      )}
    </div>
  );
}

function MonthView({
  events,
  anchor,
  today,
  onEventClick,
  onNew,
}: {
  events: NormalizedEvent[];
  anchor: Date;
  today: Date;
  onEventClick?: (ev: CalendarEvent) => void;
  onNew?: (date?: Date) => void;
}) {
  // Construir grid 6×7 do mês
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  return (
    <div className="cal-month">
      <div className="cal-month__head">
        {WEEKDAY.map((d) => (
          <div className="cal-month__weekday" key={d}>{d}</div>
        ))}
      </div>
      <div className="cal-month__grid">
        {cells.map((d, i) => {
          const isOutside = d.getMonth() !== anchor.getMonth();
          const isToday = sameDay(d, today);
          const dayEvents = events.filter((ev) => sameDay(ev.inicio, d));
          return (
            <div
              className={
                'cal-month__cell' +
                (isOutside ? ' cal-month__cell--outside' : '') +
                (isToday ? ' cal-month__cell--today' : '')
              }
              key={i}
              onDoubleClick={() => onNew?.(d)}
            >
              <div className="cal-month__date">{d.getDate()}</div>
              <div className="cal-month__events">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    className="cal-chip"
                    onClick={() => onEventClick?.(ev)}
                    style={{ borderLeftColor: ev.cor || tipoColor(ev.tipo) }}
                  >
                    <span className="cal-chip__time">
                      {ev.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="cal-chip__title">{ev.titulo}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="cal-chip cal-chip--more">+{dayEvents.length - 3} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface NormalizedEvent extends Omit<CalendarEvent, 'inicio' | 'fim'> {
  inicio: Date;
  fim: Date | null;
}

function WeekView({
  events,
  anchor,
  today,
  onEventClick,
  onNew,
}: {
  events: NormalizedEvent[];
  anchor: Date;
  today: Date;
  onEventClick?: (ev: CalendarEvent) => void;
  onNew?: (date?: Date) => void;
}) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7h às 20h

  return (
    <div className="cal-week">
      <div className="cal-week__head">
        <div className="cal-week__corner" />
        {days.map((d) => {
          const isToday = sameDay(d, today);
          return (
            <div className={'cal-week__day' + (isToday ? ' cal-week__day--today' : '')} key={d.toISOString()}>
              <div className="cal-week__day-name">{WEEKDAY[d.getDay()]}</div>
              <div className="cal-week__day-num">{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div className="cal-week__body">
        <div className="cal-week__hours">
          {hours.map((h) => (
            <div className="cal-week__hour" key={h}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {days.map((d) => (
          <div className="cal-week__col" key={d.toISOString()} onDoubleClick={() => onNew?.(d)}>
            {hours.map((h) => (
              <div className="cal-week__slot" key={h} />
            ))}
            {events
              .filter((ev) => sameDay(ev.inicio, d))
              .map((ev) => {
                const startH = ev.inicio.getHours() + ev.inicio.getMinutes() / 60;
                const endH = ev.fim ? ev.fim.getHours() + ev.fim.getMinutes() / 60 : startH + 1;
                const top = (startH - 7) * 48;
                const height = Math.max(24, (endH - startH) * 48);
                return (
                  <button
                    key={ev.id}
                    className="cal-week__event"
                    style={{
                      top,
                      height,
                      borderLeftColor: ev.cor || tipoColor(ev.tipo),
                      background: (ev.cor || tipoColor(ev.tipo)) + '22',
                    }}
                    onClick={() => onEventClick?.(ev)}
                  >
                    <div className="cal-week__event-time">
                      {ev.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="cal-week__event-title">{ev.titulo}</div>
                    {ev.local && <div className="cal-week__event-meta">{ev.local}</div>}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistView({
  events,
  onEventClick,
  onToggleDone,
  onClearDone,
  autoCleanup,
  onAutoCleanupChange,
}: {
  events: NormalizedEvent[];
  onEventClick?: (ev: CalendarEvent) => void;
  onToggleDone?: (ev: CalendarEvent, concluido: boolean) => void;
  onClearDone?: () => void;
  autoCleanup?: { modo: 'manual' | 'semanal' | 'periodico'; dias: number };
  onAutoCleanupChange?: (cfg: { modo: 'manual' | 'semanal' | 'periodico'; dias: number }) => void;
}) {
  const [showConfig, setShowConfig] = useState(false);
  const sorted = [...events].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const pendentes = sorted.filter((e) => !e.concluido);
  const concluidos = sorted.filter((e) => e.concluido);
  const cfg = autoCleanup || { modo: 'manual' as const, dias: 7 };

  return (
    <div className="cal-check">
      <div className="cal-check__toolbar">
        <div className="cal-check__stats">
          <span className="cal-check__count">
            <strong>{pendentes.length}</strong> pendentes
          </span>
          <span className="cal-check__sep">·</span>
          <span className="cal-check__count cal-check__count--done">
            <strong>{concluidos.length}</strong> concluídas
          </span>
        </div>
        <div className="cal-check__actions">
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setShowConfig((v) => !v)}
            title="Configurar auto-limpar"
          >
            <Icon name="settings" size={14} />
            Auto-limpar
          </button>
          <button
            className="btn btn--secondary btn--sm"
            onClick={onClearDone}
            disabled={!onClearDone || concluidos.length === 0}
          >
            <Icon name="trash" size={14} />
            Limpar concluídas
          </button>
        </div>
      </div>

      {showConfig && onAutoCleanupChange && (
        <div className="cal-check__config">
          <div className="cal-check__config-title">Como limpar automaticamente?</div>
          <div className="cal-check__config-options">
            <label className={'cal-check__radio ' + (cfg.modo === 'manual' ? 'is-active' : '')}>
              <input
                type="radio"
                checked={cfg.modo === 'manual'}
                onChange={() => onAutoCleanupChange({ ...cfg, modo: 'manual' })}
              />
              <span>Manual — limpo quando eu quiser</span>
            </label>
            <label className={'cal-check__radio ' + (cfg.modo === 'semanal' ? 'is-active' : '')}>
              <input
                type="radio"
                checked={cfg.modo === 'semanal'}
                onChange={() => onAutoCleanupChange({ ...cfg, modo: 'semanal' })}
              />
              <span>Toda semana (domingo)</span>
            </label>
            <label className={'cal-check__radio ' + (cfg.modo === 'periodico' ? 'is-active' : '')}>
              <input
                type="radio"
                checked={cfg.modo === 'periodico'}
                onChange={() => onAutoCleanupChange({ ...cfg, modo: 'periodico' })}
              />
              <span>A cada</span>
              <input
                type="number"
                min={1}
                max={365}
                className="cal-check__days"
                value={cfg.dias}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onAutoCleanupChange({ ...cfg, modo: 'periodico', dias: Number(e.target.value) || 1 })}
              />
              <span>dia(s)</span>
            </label>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="cal-check__empty">Nenhum compromisso na agenda.</div>
      ) : (
        <div className="cal-check__list">
          {pendentes.length > 0 && (
            <div className="cal-check__group">
              <div className="cal-check__group-title">Pendentes</div>
              {pendentes.map((ev) => (
                <ChecklistItem key={ev.id} ev={ev} onClick={onEventClick} onToggle={onToggleDone} />
              ))}
            </div>
          )}
          {concluidos.length > 0 && (
            <div className="cal-check__group">
              <div className="cal-check__group-title">Concluídas</div>
              {concluidos.map((ev) => (
                <ChecklistItem key={ev.id} ev={ev} onClick={onEventClick} onToggle={onToggleDone} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistItem({
  ev,
  onClick,
  onToggle,
}: {
  ev: NormalizedEvent;
  onClick?: (ev: CalendarEvent) => void;
  onToggle?: (ev: CalendarEvent, concluido: boolean) => void;
}) {
  return (
    <div className={'cal-check__item ' + (ev.concluido ? 'is-done' : '')}>
      <button
        className="cal-check__box"
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.(ev, !ev.concluido);
        }}
        aria-label={ev.concluido ? 'Desmarcar' : 'Marcar como feita'}
      >
        {ev.concluido && <Icon name="check" size={14} />}
      </button>
      <button
        className="cal-check__body"
        onClick={() => onClick?.(ev)}
        style={{ borderLeftColor: ev.cor || tipoColor(ev.tipo) }}
      >
        <div className="cal-check__title">{ev.titulo}</div>
        <div className="cal-check__meta">
          {ev.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          {' · '}
          {ev.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          {ev.local ? ' · ' + ev.local : ''}
          {ev.tipo ? ' · ' + ev.tipo : ''}
        </div>
      </button>
    </div>
  );
}

function ListView({
  events,
  onEventClick,
}: {
  events: NormalizedEvent[];
  onEventClick?: (ev: CalendarEvent) => void;
}) {
  const sorted = [...events].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const grupos: Record<string, typeof events> = {};
  sorted.forEach((ev) => {
    const k = ev.inicio.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    (grupos[k] = grupos[k] || []).push(ev);
  });

  if (sorted.length === 0) {
    return <div className="cal-list__empty">Nenhum compromisso agendado.</div>;
  }

  return (
    <div className="cal-list">
      {Object.entries(grupos).map(([dia, evs]) => (
        <div className="cal-list__day" key={dia}>
          <div className="cal-list__day-label">{dia}</div>
          {evs.map((ev) => (
            <button
              key={ev.id}
              className="cal-list__item"
              onClick={() => onEventClick?.(ev)}
              style={{ borderLeftColor: ev.cor || tipoColor(ev.tipo) }}
            >
              <div className="cal-list__time">
                {ev.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="cal-list__main">
                <div className="cal-list__title">
                  {ev.titulo}
                  {ev.tipo && <span className="cal-list__tag">{ev.tipo}</span>}
                </div>
                {(ev.local || ev.executivo) && (
                  <div className="cal-list__meta">{[ev.local, ev.executivo].filter(Boolean).join(' · ')}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
