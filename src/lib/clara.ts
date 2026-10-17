// Clara (assistente do Paulo dentro do app): quem pode usar e o atalho para abrir.
import { Api } from './api';

let status: Promise<boolean> | null = null;
export function claraPermitida(): Promise<boolean> {
  if (!status) status = Api.claraStatus().then((r) => !!r.permitido).catch(() => false);
  return status;
}
export function esquecerClara() { status = null; }

const EVENTO = 'abrir-clara';
export function abrirClara() { window.dispatchEvent(new Event(EVENTO)); }
export function aoAbrirClara(fn: () => void) {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}
