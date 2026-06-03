// PageWrap — adiciona animação de entrada padronizada em qualquer página
// Uso: envolva o conteúdo principal de uma page com <PageWrap>...</PageWrap>
// Os filhos top-level animam em stagger.

interface PageWrapProps {
  children: React.ReactNode;
  stagger?: boolean;
  className?: string;
}

export function PageWrap({ children, stagger = true, className = '' }: PageWrapProps) {
  return (
    <div className={`page-enter ${stagger ? 'stagger' : ''} ${className}`}>
      {children}
    </div>
  );
}
