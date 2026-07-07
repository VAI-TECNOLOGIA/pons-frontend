// Fases do funil — CONFIGURÁVEIS. Os rótulos (label) são editáveis pelo cliente
// em Configurações → Funil (gravados no Setting `funil.fases`). As `key` são os
// valores internos de Lead.status (não mudam, pra não quebrar dado/lógica).
// `aliases` = status legados que caem nessa coluna (ex.: SDR/QUALIFICANDO/NEGOCIANDO → Contato).

export type Fase = { key: string; label: string; aliases?: string[]; klass?: string };

export const FUNIL_DEFAULT: Fase[] = [
  { key: 'NOVO', label: 'Novo' },
  { key: 'CONTATO', label: 'Contato', aliases: ['SDR', 'QUALIFICANDO', 'NEGOCIANDO'], klass: 'kanban__col--accent' },
  { key: 'VISITA', label: 'Visita' },
  { key: 'PROPOSTA', label: 'Proposta' },
  { key: 'FECHADO', label: 'Fechado', klass: 'kanban__col--success' },
  { key: 'PERDIDO', label: 'Perdido' },
];

export const FUNIL_SETTING_KEY = 'funil.fases';

// Lê as fases do Setting; cai no default se ausente/ inválido. Preserva aliases/klass
// do default quando o cliente só editou os rótulos.
export function parseFunil(settings?: Record<string, string> | null): Fase[] {
  try {
    const raw = settings?.[FUNIL_SETTING_KEY];
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length) {
        return p.map((f: any) => {
          const base = FUNIL_DEFAULT.find((d) => d.key === f.key);
          return { key: String(f.key), label: String(f.label || base?.label || f.key), aliases: f.aliases || base?.aliases, klass: base?.klass };
        });
      }
    }
  } catch { /* usa default */ }
  return FUNIL_DEFAULT;
}

// Retorna a `key` da fase que "contém" um status (respeitando aliases).
export function faseDoStatus(fases: Fase[], status: string): string | null {
  for (const f of fases) {
    if (f.key === status) return f.key;
    if (f.aliases?.includes(status)) return f.key;
  }
  return null;
}

// Rótulo amigável de um status individual (usa a fase que o contém).
export function labelDoStatus(fases: Fase[], status: string): string {
  const k = faseDoStatus(fases, status);
  return fases.find((f) => f.key === k)?.label || status;
}
