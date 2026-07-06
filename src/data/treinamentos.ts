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

export const TREINAMENTOS: Treino[] = [
  {
    id: 'pit-stop',
    titulo: 'Pit Stop Semanal',
    url: 'https://youtube.com/shorts/iycfAgg1U-g',
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
    id: 'grande-conquista',
    titulo: 'Toda grande conquista começa com uma decisão',
    url: 'https://youtube.com/shorts/FPsh2qhrjts',
  },
  {
    id: 'decisao-preco',
    titulo: 'Toda decisão carrega um preço',
    url: 'https://youtube.com/shorts/L0_sAepnrt4',
  },
];
