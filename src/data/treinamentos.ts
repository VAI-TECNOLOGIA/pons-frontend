// ============================================================================
// ACADEMIA PONS — catálogo de treinamentos (EXCLUSIVO do app)
// ----------------------------------------------------------------------------
// Vídeos reais do canal do Grupo Pons. Para publicar mais, adicione um item com
// o link do YouTube/Vimeo (Shorts incluídos). `destaque: true` joga o vídeo pro
// topo (hero). `thumb` é opcional; sem ela, usamos a capa do YouTube.
// ============================================================================

export type Treino = {
  id: string;
  titulo: string;
  url?: string;
  thumb?: string;
  destaque?: boolean;
};

// IMPORTANTE (direito de imagem): só publicar vídeos cujas pessoas autorizaram
// por escrito o uso da imagem. Em 2026-07 um vídeo foi removido por não ter essa
// autorização. Na dúvida, não publique.
export const TREINAMENTOS: Treino[] = [
  {
    id: 'grande-conquista',
    titulo: 'Toda grande conquista começa com uma decisão',
    url: 'https://youtube.com/shorts/FPsh2qhrjts',
    destaque: true,
  },
  {
    id: 'autorresponsabilidade',
    titulo: 'Autorresponsabilidade',
    url: 'https://youtube.com/shorts/wJWfhFm3Xxs',
  },
  {
    id: 'mensagem-ou-ligacao',
    titulo: 'Mensagem ou ligação?',
    url: 'https://youtube.com/shorts/N-TdrN-H1yA',
  },
  {
    id: 'decisao-preco',
    titulo: 'Toda decisão carrega um preço',
    url: 'https://youtube.com/shorts/L0_sAepnrt4',
  },
];
