// Biblioteca dos Gestores — mídias, criativos, ofertas ativas, follow-up e
// materiais de apoio. Aberta: qualquer gestor publica (arquivo ou link);
// só o autor (ou CEO) remove.
import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { Auth } from '../lib/auth';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { timeAgo } from '../lib/format';

const CATEGORIAS = [
  { key: 'MIDIA', label: 'Mídias', icon: 'play' },
  { key: 'CRIATIVO', label: 'Criativos', icon: 'sparkles' },
  { key: 'OFERTA', label: 'Ofertas ativas', icon: 'fire' },
  { key: 'FOLLOWUP', label: 'Follow-up', icon: 'chat' },
  { key: 'APOIO', label: 'Materiais de apoio', icon: 'doc' },
] as const;

const fmtTamanho = (b?: number | null) => {
  if (!b) return '';
  if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(b / 1024)} KB`;
};

export default function Biblioteca() {
  const [aba, setAba] = useState<string>('MIDIA');
  const [openNovo, setOpenNovo] = useState(false);
  const { data: itens, loading, error, reload } = useApi<any[]>(() => Api.bibliotecaItens(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const lista = (itens || []).filter((i) => i.categoria === aba);
  const contagem = (cat: string) => (itens || []).filter((i) => i.categoria === cat).length;

  const remover = async (item: any) => {
    const ok = await confirm({ title: 'Remover material', message: `Remover "${item.titulo}" da biblioteca?` });
    if (!ok) return;
    try {
      await Api.bibliotecaRemover(item.id);
      toast.success('Removido');
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'falha'));
    }
  };

  return (
    <>
      <Topbar title="Biblioteca" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Conteúdo · Gestores"
          title="Biblioteca dos Gestores"
          subtitle="Mídias, criativos, ofertas e materiais — publique e compartilhe com os demais gestores."
          actions={<button className="btn btn--primary" onClick={() => setOpenNovo(true)}><Icon name="plus" size={14} /> Publicar material</button>}
        />

        <div className="flex" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {CATEGORIAS.map((c) => (
            <button
              key={c.key}
              className={'btn btn--sm ' + (aba === c.key ? 'btn--primary' : 'btn--secondary')}
              onClick={() => setAba(c.key)}
            >
              <Icon name={c.icon as any} size={13} /> {c.label} ({contagem(c.key)})
            </button>
          ))}
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock error={error} />}
        {!loading && !error && (
          lista.length === 0 ? (
            <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)' }}>
              Nada em {CATEGORIAS.find((c) => c.key === aba)?.label} ainda — publique o primeiro material.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {lista.map((i) => (
                <div className="card" key={i.id} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{i.titulo}</div>
                  {i.descricao && <div className="text-xs text-secondary" style={{ whiteSpace: 'pre-wrap' }}>{i.descricao}</div>}
                  <div className="text-xs text-secondary" style={{ marginTop: 'auto' }}>
                    {i.criadoPor?.nome} · {timeAgo(i.createdAt)}{i.tamanho ? ` · ${fmtTamanho(i.tamanho)}` : ''}
                  </div>
                  <div className="flex" style={{ gap: 6 }}>
                    <a className="btn btn--secondary btn--sm" href={i.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, justifyContent: 'center' }}>
                      <Icon name="external" size={13} /> Abrir / baixar
                    </a>
                    {(i.criadoPor?.id === Auth.user?.id || Auth.user?.role === 'CEO') && (
                      <button className="btn btn--ghost btn--sm" style={{ color: 'var(--color-danger-fg)' }} onClick={() => remover(i)} title="Remover">
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {openNovo && <NovoMaterialModal categoriaInicial={aba} onClose={() => setOpenNovo(false)} onCriado={() => { setOpenNovo(false); reload(); }} />}
    </>
  );
}

function NovoMaterialModal({ categoriaInicial, onClose, onCriado }: { categoriaInicial: string; onClose: () => void; onCriado: () => void }) {
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [link, setLink] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();

  const salvar = async () => {
    if (!titulo.trim()) { toast.error('Dê um título ao material.'); return; }
    if (!arquivo && !link.trim()) { toast.error('Anexe um arquivo OU informe um link.'); return; }
    setSalvando(true);
    try {
      let url = link.trim();
      let key: string | undefined; let tipo: string | undefined; let tamanho: number | undefined;
      if (arquivo) {
        const up = await Api.uploadDocumento(arquivo);
        url = up.url; key = up.key; tipo = up.contentType; tamanho = up.size;
      }
      await Api.bibliotecaCriar({ categoria, titulo: titulo.trim(), descricao: descricao.trim() || undefined, url, key, tipo, tamanho });
      toast.success('Material publicado');
      onCriado();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'falha'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open onClose={() => !salvando && onClose()} title="Publicar material" subtitle="Arquivo (imagem, vídeo, PDF…) ou link externo — visível pra todos os gestores" footer={
      <>
        <button className="btn btn--secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
        <button className="btn btn--primary" onClick={salvar} disabled={salvando}>{salvando ? 'Publicando…' : 'Publicar'}</button>
      </>
    }>
      <div className="form-grid">
        <div className="field">
          <label className="field__label">Categoria</label>
          <select className="field__select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field__label">Título <span className="field__required">*</span></label>
          <input className="field__input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Criativo carrossel — Conecta ago/26" />
        </div>
        <div className="field field--span-2">
          <label className="field__label">Descrição</label>
          <textarea className="field__textarea" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} style={{ width: '100%', fontFamily: 'inherit' }} />
        </div>
        <div className="field">
          <label className="field__label">Arquivo</label>
          <input type="file" className="field__input" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
        </div>
        <div className="field">
          <label className="field__label">ou Link externo</label>
          <input className="field__input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" disabled={!!arquivo} />
        </div>
      </div>
    </Modal>
  );
}
