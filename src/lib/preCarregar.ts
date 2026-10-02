import { ROTA_TELA } from './rotasTelas';

// Baixa o código de UMA tela quando o usuário aponta/toca no item do menu —
// ~100–300 ms antes do clique. Só aquela tela, uma vez (sem pré-carregar tudo:
// executar ~100 telas de uma vez pesava no navegador e no celular).
const feitas = new Set<string>();
export function preCarregarRota(caminho: string) {
  const rota = caminho.split('?')[0];
  if (feitas.has(rota)) return;
  const f = ROTA_TELA[rota];
  if (!f) return;
  feitas.add(rota);
  f().catch(() => feitas.delete(rota));
}
