// Erro de "versão antiga": o app (ou aba) ficou aberto com a versão anterior e,
// depois de uma publicação, tenta baixar um pedaço do sistema que não existe mais.
// Cada navegador escreve a mensagem de um jeito — o iPhone (Safari / app iOS)
// diz "Importing a module script failed.", que antes não era reconhecido e
// caía na tela "Algo deu errado" (corretora Neusa, 16/10 12h21, logo após deploy).
const SINAIS = [
  'Failed to fetch dynamically imported module', // Chrome / Android
  'error loading dynamically imported module', // Firefox
  'Importing a module script failed', // Safari / iOS
  'Loading chunk',
  'Loading CSS chunk',
  'Unable to preload CSS',
  'is not a valid JavaScript MIME type',
  "'text/html'",
];

export function ehErroDeVersaoAntiga(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '');
  return SINAIS.some((s) => msg.includes(s));
}

// Recarrega a página para pegar a versão nova — no máximo 1 vez a cada 30 s
// (se a versão nova também falhar, não entra em loop).
export function recarregarParaVersaoNova(): boolean {
  const chave = 'pons.chunkReloadAt';
  let ultima = 0;
  try { ultima = Number(sessionStorage.getItem(chave) || '0'); } catch { /* sem storage */ }
  if (Date.now() - ultima < 30_000) return false;
  try { sessionStorage.setItem(chave, String(Date.now())); } catch { /* sem storage */ }
  window.location.reload();
  return true;
}
