import { useApi } from './useApi';
import { Api } from './api';

export type NumeroWaba = { id: string; label: string };

// Números oficiais vêm da INTEGRAÇÃO (WABA via Meta Graph), não hardcoded.
// '' = pool padrão (round-robin no backend). Demais = phoneId + número exibido.
export function useWhatsappNumeros(): NumeroWaba[] {
  const { data } = useApi<any>(() => Api.metaNumbers().catch(() => null));
  const nums: NumeroWaba[] = (data?.numbers || []).map((n: any) => ({
    id: n.id,
    label: n.verifiedName ? `${n.displayNumber} · ${n.verifiedName}` : (n.displayNumber || n.id),
  }));
  return [{ id: '', label: 'Número padrão do CRM (rodízio)' }, ...nums];
}
