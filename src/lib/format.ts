export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatCurrencyShort(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return 'R$ 0';
  // pt-BR usa vírgula decimal: "R$ 22,9M", não "R$ 22.9M".
  // Negativos (saldo no vermelho) também precisam abreviar, senão estouram o card.
  const sinal = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `${sinal}R$ ${Math.round(abs / 1_000)}K`;
  return formatCurrency(value);
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

// Title Case PT-BR para nomes próprios: 1ª letra de cada palavra maiúscula,
// resto minúsculo; conectivos (de, da, do, dos, das, e) ficam minúsculos
// (exceto no início). Trata hífen/apóstrofo. Ex.: "FABIO DE PAULA" → "Fabio de Paula",
// "gesilaine lutz" → "Gesilaine Lutz". NÃO use em siglas (ex.: "GPI BC").
const NOME_MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du']);
export function formatNome(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && NOME_MINUSCULAS.has(w) ? w : w.replace(/(^|[-'’])([a-zà-ÿ])/g, (_m, p1, p2) => p1 + p2.toUpperCase())))
    .join(' ');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}
