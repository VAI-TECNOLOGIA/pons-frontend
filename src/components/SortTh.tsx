import { Icon } from './Icon';

// Cabeçalho de tabela clicável para ordenar. 1º clique = crescente; 2º = decrescente.
export type Ordem = { col: string; dir: 'asc' | 'desc' } | null;

export function SortTh({ label, col, ordem, onOrdenar, className }: {
  label: string;
  col: string;
  ordem: Ordem;
  onOrdenar: (o: Ordem) => void;
  className?: string;
}) {
  const ativo = ordem?.col === col;
  const dir = ativo ? ordem!.dir : null;
  const proximo: Ordem = !ativo ? { col, dir: 'asc' } : dir === 'asc' ? { col, dir: 'desc' } : null;
  return (
    <th className={className} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button type="button" className={'th-sort' + (ativo ? ' th-sort--ativo' : '')} onClick={() => onOrdenar(proximo)} title={`Ordenar por ${label}`}>
        {label}
        <Icon name={dir === 'desc' ? 'arrow_down' : 'arrow_up'} size={11} className="th-sort__icone" />
      </button>
    </th>
  );
}

// Paginação simples para listas carregadas inteiras na tela.
export function Paginacao({ pagina, total, porPagina, onPagina }: { pagina: number; total: number; porPagina: number; onPagina: (p: number) => void }) {
  if (total <= porPagina) return null;
  const ultima = Math.ceil(total / porPagina);
  const de = (pagina - 1) * porPagina + 1;
  const ate = Math.min(pagina * porPagina, total);
  return (
    <div className="paginacao">
      <span>Mostrando <strong>{de}–{ate}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong></span>
      <div className="flex gap-2">
        <button type="button" className="btn btn--ghost btn--sm" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>← Anterior</button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={pagina >= ultima} onClick={() => onPagina(pagina + 1)}>Próxima →</button>
      </div>
    </div>
  );
}
