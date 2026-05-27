interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Ícone oficial do Google Calendar — versão PNG em /assets/calendar-icon.png
 */
export function GoogleCalendarIcon({ size = 22, className, style }: Props) {
  return (
    <img
      src="/assets/calendar-icon.png"
      alt="Google Calendar"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', objectFit: 'contain', flexShrink: 0, ...style }}
    />
  );
}
