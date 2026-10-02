// Pré-carrega em segundo plano o código das telas (cada tela é um arquivo
// separado, baixado na 1ª visita — em produção levava 0,3–0,6 s e a troca de
// tela "piscava"). Roda uma vez, quando o navegador está ocioso, 2 por vez.
const fabricas: Array<() => Promise<unknown>> = [];
let iniciado = false;

export function registrarTela(f: () => Promise<unknown>) {
  fabricas.push(f);
}

export function preCarregarTelas() {
  if (iniciado) return;
  iniciado = true;
  // Economia de dados ligada no celular: não pré-carrega.
  if ((navigator as any)?.connection?.saveData) return;
  const fila = [...fabricas];
  const proximo = (): void => {
    const f = fila.shift();
    if (!f) return;
    f().catch(() => { /* falhou: carrega normalmente na visita */ }).finally(() => agendar(proximo));
  };
  const agendar = (cb: () => void) => {
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => void);
    if (ric) ric(cb, { timeout: 2000 }); else setTimeout(cb, 200);
  };
  setTimeout(() => { agendar(proximo); agendar(proximo); }, 2500);
}
