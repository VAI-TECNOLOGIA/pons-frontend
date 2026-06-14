import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Auth } from '../lib/auth';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

const DONO_EMAIL = 'paulo@grupopons.com.br';

const MES_ABREV = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const brl = (n: number | null | undefined) =>
  (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlShort = (n: number | null | undefined) => {
  const v = n || 0;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return brl(v);
};
const fmtCell = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const mKey = (ano: number, mes: number) => `${ano}-${mes}`;
const cellKey = (catId: number, ano: number, mes: number) => `${catId}:${ano}:${mes}`;

export default function Pessoal() {
  const user = Auth.user;
  if (!user || user.email !== DONO_EMAIL) return <Navigate to="/dashboard" replace />;

  return (
    <>
      <Topbar title="Meu Espaço" />

      <div className="main__content">
        <PageHeader
          breadcrumb="Área Pessoal"
          title="Meu Espaço"
          subtitle="Suas finanças pessoais — área privada, visível só pra você."
        />

        <FinancasTab />
      </div>
    </>
  );
}

// ───────────────────────── FINANÇAS ─────────────────────────

interface Categoria {
  id: number;
  nome: string;
  grupo: string | null;
  ordem: number;
  valores: { ano: number; mes: number; valor: number }[];
}

function FinancasTab() {
  const { data, loading, error, reload } = useApi(() => Api.pessoalFinancas());
  const toast = useToast();
  const confirm = useConfirm();

  const [cats, setCats] = useState<Categoria[]>([]);
  const [cells, setCells] = useState<Record<string, number>>({});
  const [extraMonths, setExtraMonths] = useState<{ ano: number; mes: number }[]>([]);
  const [anoFiltro, setAnoFiltro] = useState<number | 'todos'>('todos');
  const initedYear = useRef(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [novaCat, setNovaCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  useEffect(() => {
    if (!data) return;
    setCats(data.categorias as Categoria[]);
    const map: Record<string, number> = {};
    for (const c of data.categorias as Categoria[]) {
      for (const v of c.valores) map[cellKey(c.id, v.ano, v.mes)] = v.valor;
    }
    setCells(map);
    // Abre já filtrado no ano mais recente — evita um paredão de 18 meses no load.
    if (!initedYear.current) {
      const anos = [...new Set((data.meses as { ano: number }[]).map((m) => m.ano))];
      if (anos.length) { setAnoFiltro(Math.max(...anos)); initedYear.current = true; }
    }
  }, [data]);

  // Faixa contínua de meses do menor ao maior presente + meses extras manuais.
  const allMonths = useMemo(() => {
    const base = (data?.meses || []) as { ano: number; mes: number }[];
    const set = new Map<string, { ano: number; mes: number }>();
    for (const m of base) set.set(mKey(m.ano, m.mes), m);
    for (const m of extraMonths) set.set(mKey(m.ano, m.mes), m);
    if (set.size === 0) {
      const now = new Date();
      set.set(mKey(now.getFullYear(), now.getMonth() + 1), { ano: now.getFullYear(), mes: now.getMonth() + 1 });
    }
    const arr = [...set.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes);
    // preenche buracos entre min e max
    const first = arr[0];
    const last = arr[arr.length - 1];
    const out: { ano: number; mes: number }[] = [];
    let y = first.ano, m = first.mes;
    while (y < last.ano || (y === last.ano && m <= last.mes)) {
      out.push({ ano: y, mes: m });
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }, [data, extraMonths]);

  const anosPresentes = useMemo(() => [...new Set(allMonths.map((m) => m.ano))].sort(), [allMonths]);
  const visibleMonths = useMemo(
    () => (anoFiltro === 'todos' ? allMonths : allMonths.filter((m) => m.ano === anoFiltro)),
    [allMonths, anoFiltro],
  );

  const totalCategoria = (catId: number) =>
    visibleMonths.reduce((s, m) => s + (cells[cellKey(catId, m.ano, m.mes)] || 0), 0);
  const totalMes = (ano: number, mes: number) =>
    cats.reduce((s, c) => s + (cells[cellKey(c.id, ano, mes)] || 0), 0);
  const totalGeral = visibleMonths.reduce((s, m) => s + totalMes(m.ano, m.mes), 0);
  const mediaMensal = visibleMonths.length ? totalGeral / visibleMonths.length : 0;
  const maiorCat = useMemo(() => {
    let melhor: { nome: string; total: number } | null = null;
    for (const c of cats) {
      const t = totalCategoria(c.id);
      if (!melhor || t > melhor.total) melhor = { nome: c.nome, total: t };
    }
    return melhor;
  }, [cats, cells, visibleMonths]);

  const startEdit = (catId: number, ano: number, mes: number) => {
    const k = cellKey(catId, ano, mes);
    setEditing(k);
    setEditVal(cells[k] != null ? String(cells[k]) : '');
  };

  const saveEdit = async (catId: number, ano: number, mes: number) => {
    const k = cellKey(catId, ano, mes);
    const raw = editVal.trim().replace(/\./g, '').replace(',', '.');
    const num = raw === '' ? null : Number(raw);
    if (num != null && Number.isNaN(num)) { setEditing(null); return; }
    setEditing(null);
    // otimista
    setCells((prev) => {
      const next = { ...prev };
      if (num == null) delete next[k];
      else next[k] = num;
      return next;
    });
    try {
      await Api.pessoalValorSet({ categoriaId: catId, ano, mes, valor: num });
    } catch {
      toast.error('Não consegui salvar esse valor');
      reload();
    }
  };

  const addCategoria = async () => {
    const nome = novaCat.trim();
    if (!nome) return;
    setAddingCat(true);
    try {
      await Api.pessoalCategoriaCreate({ nome });
      setNovaCat('');
      reload();
      toast.success('Categoria adicionada');
    } catch {
      toast.error('Falha ao adicionar categoria');
    } finally {
      setAddingCat(false);
    }
  };

  const renameCategoria = async (c: Categoria) => {
    const nome = window.prompt('Renomear categoria', c.nome);
    if (nome == null) return;
    const novo = nome.trim();
    if (!novo || novo === c.nome) return;
    setCats((prev) => prev.map((x) => (x.id === c.id ? { ...x, nome: novo } : x)));
    try {
      await Api.pessoalCategoriaUpdate(c.id, { nome: novo });
    } catch {
      toast.error('Falha ao renomear');
      reload();
    }
  };

  const delCategoria = async (c: Categoria) => {
    const ok = await confirm({
      title: 'Remover categoria',
      message: `Remover "${c.nome}" e todos os seus valores?`,
      confirmText: 'Remover',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await Api.pessoalCategoriaDelete(c.id);
      reload();
    } catch {
      toast.error('Falha ao remover');
    }
  };

  const addMes = () => {
    const last = allMonths[allMonths.length - 1];
    let y = last.ano, m = last.mes + 1;
    if (m > 12) { m = 1; y++; }
    setExtraMonths((prev) => [...prev, { ano: y, mes: m }]);
    if (anoFiltro !== 'todos' && y !== anoFiltro) setAnoFiltro(y);
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi__label">Total no período</div>
          <div className="kpi__value">{brlShort(totalGeral)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Média mensal</div>
          <div className="kpi__value">{brlShort(mediaMensal)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Maior categoria</div>
          <div className="kpi__value" style={{ fontSize: 17 }} title={maiorCat?.nome}>{maiorCat?.nome || '—'}</div>
          <div className="kpi__label" style={{ marginTop: 2 }}>{maiorCat ? brlShort(maiorCat.total) : ''}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Categorias</div>
          <div className="kpi__value">{cats.length}</div>
        </div>
      </div>

      <div className="pessoal-toolbar">
        <div className="seg">
          <button className={'seg__btn ' + (anoFiltro === 'todos' ? 'is-active' : '')} onClick={() => setAnoFiltro('todos')}>Tudo</button>
          {anosPresentes.map((a) => (
            <button key={a} className={'seg__btn ' + (anoFiltro === a ? 'is-active' : '')} onClick={() => setAnoFiltro(a)}>{a}</button>
          ))}
        </div>
        <div className="pessoal-toolbar__hint">
          {visibleMonths.length} {visibleMonths.length === 1 ? 'mês' : 'meses'} · clique numa célula pra editar
        </div>
        <button className="btn btn--secondary btn--sm" onClick={addMes}>
          <Icon name="plus" size={13} /> Mês
        </button>
      </div>

      <div className="card pessoal-grid-card">
        <table className="pessoal-grid">
          <thead>
            <tr>
              <th className="sticky-col cat-head">Categoria</th>
              {visibleMonths.map((m) => (
                <th key={mKey(m.ano, m.mes)} className="num">
                  {MES_ABREV[m.mes]}/{String(m.ano).slice(2)}
                </th>
              ))}
              <th className="num col-total">Total</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id}>
                <td className="sticky-col cat-cell">
                  <div className="cat-cell__inner">
                    <span className="cat-cell__nome" title={c.nome}>{c.nome}</span>
                    <span className="cat-cell__acoes">
                      <button onClick={() => renameCategoria(c)} title="Renomear" className="iconbtn"><Icon name="pencil" size={13} /></button>
                      <button onClick={() => delCategoria(c)} title="Remover" className="iconbtn"><Icon name="trash" size={13} /></button>
                    </span>
                  </div>
                </td>
                {visibleMonths.map((m) => {
                  const k = cellKey(c.id, m.ano, m.mes);
                  const v = cells[k];
                  const isEditing = editing === k;
                  return (
                    <td
                      key={k}
                      className={'num cell' + (isEditing ? ' is-editing' : '')}
                      onClick={() => !isEditing && startEdit(c.id, m.ano, m.mes)}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          type="number"
                          step="0.01"
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onBlur={() => saveEdit(c.id, m.ano, m.mes)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(c.id, m.ano, m.mes);
                            if (e.key === 'Escape') setEditing(null);
                          }}
                          className="cell__input"
                        />
                      ) : v != null ? (
                        fmtCell(v)
                      ) : (
                        <span className="cell__empty">–</span>
                      )}
                    </td>
                  );
                })}
                <td className="num col-total">{fmtCell(totalCategoria(c.id))}</td>
              </tr>
            ))}
            {cats.length === 0 && (
              <tr><td colSpan={visibleMonths.length + 2} style={{ textAlign: 'center', padding: 28, color: 'var(--text-secondary)' }}>Nenhuma categoria ainda. Adicione a primeira abaixo.</td></tr>
            )}
          </tbody>
          {cats.length > 0 && (
            <tfoot>
              <tr>
                <td className="sticky-col">Total / mês</td>
                {visibleMonths.map((m) => (
                  <td key={mKey(m.ano, m.mes)} className="num">{fmtCell(totalMes(m.ano, m.mes))}</td>
                ))}
                <td className="num col-total">{fmtCell(totalGeral)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="pessoal-addcat">
        <Icon name="plus" size={14} />
        <input
          className="field__input"
          placeholder="Adicionar categoria (ex: Academia, Streaming…)"
          value={novaCat}
          onChange={(e) => setNovaCat(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addCategoria(); }}
        />
        <button className="btn btn--primary btn--sm" onClick={addCategoria} disabled={addingCat || !novaCat.trim()}>
          Adicionar
        </button>
      </div>

      <style>{gridCss}</style>
    </>
  );
}

const gridCss = `
.pessoal-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 14px 0 12px; }
.pessoal-toolbar__hint { flex: 1; font-size: 12.5px; color: var(--text-secondary); min-width: 120px; }
.seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--bg-app); border: 1px solid var(--border-light); }
.seg__btn { border: none; background: none; padding: 5px 14px; border-radius: 7px; font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: background .12s, color .12s; }
.seg__btn:hover { color: var(--text-primary); }
.seg__btn.is-active { background: var(--bg-card); color: var(--pons-blue); box-shadow: var(--shadow-xs); }

/* .card tem padding !important no responsive.css; sem zerar aqui, as colunas
   roláveis vazam pros 14px de padding e aparecem ao lado da coluna fixa. */
.card.pessoal-grid-card { padding: 0 !important; overflow-x: auto; }
.pessoal-grid { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 13px; }
.pessoal-grid th, .pessoal-grid td { font-variant-numeric: tabular-nums; white-space: nowrap; }
.pessoal-grid .num { text-align: right; }
.pessoal-grid thead th { position: sticky; top: 0; z-index: 1; background: var(--bg-app); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; padding: 11px 14px; border-bottom: 1px solid var(--border-light); min-width: 88px; }
.pessoal-grid tbody td { padding: 10px 14px; border-bottom: 1px solid var(--border-light); }
.pessoal-grid tbody tr:last-child td { border-bottom: none; }
.pessoal-grid tbody tr:hover td { background: var(--bg-card-hover); }

.pessoal-grid .sticky-col { position: sticky; left: 0; z-index: 2; background: var(--bg-card); box-shadow: 1px 0 0 var(--border-light); }
.pessoal-grid thead .sticky-col { z-index: 3; background: var(--bg-app); }
.pessoal-grid tbody tr:hover .sticky-col { background: var(--bg-card-hover); }
.pessoal-grid .cat-head, .pessoal-grid .cat-cell { min-width: 220px; max-width: 220px; }
.cat-cell__inner { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.cat-cell__nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; color: var(--text-primary); }
.cat-cell__acoes { display: inline-flex; gap: 2px; opacity: 0; transition: opacity .12s; flex-shrink: 0; }
.pessoal-grid tbody tr:hover .cat-cell__acoes { opacity: 1; }
.pessoal-grid .iconbtn { background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 3px; border-radius: 5px; display: inline-flex; }
.pessoal-grid .iconbtn:hover { background: var(--color-info-bg); color: var(--pons-blue); }

.pessoal-grid .cell { cursor: text; color: var(--text-primary); }
.pessoal-grid .cell.is-editing { padding: 3px 4px; }
.pessoal-grid .cell:hover { background: var(--color-info-bg); box-shadow: inset 0 0 0 1px var(--color-info-border); }
.pessoal-grid .cell__empty { color: var(--text-disabled); }
.pessoal-grid .cell__input { width: 100%; text-align: right; padding: 5px 7px; background: var(--field-bg); color: var(--text-primary); border: 1px solid var(--pons-blue); border-radius: 5px; font-size: 13px; box-shadow: var(--shadow-focus); outline: none; }
.pessoal-grid .col-total { font-weight: 700; color: var(--text-primary); background: var(--bg-app); box-shadow: inset 1px 0 0 var(--border-light); }
.pessoal-grid thead .col-total { background: var(--bg-app); }

.pessoal-grid tfoot td { padding: 12px 14px; font-weight: 700; color: var(--text-primary); border-top: 2px solid var(--border-light); background: var(--bg-app); }
.pessoal-grid tfoot .sticky-col { background: var(--bg-app); }

.pessoal-addcat { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding: 10px 12px; max-width: 480px; border: 1px dashed var(--border-medium); border-radius: 12px; color: var(--text-secondary); }
.pessoal-addcat .field__input { flex: 1; border: none; background: none; padding: 4px 0; color: var(--text-primary); }
.pessoal-addcat .field__input:focus { outline: none; box-shadow: none; }

@media (max-width: 640px) {
  .pessoal-toolbar { gap: 10px; }
  .pessoal-toolbar__hint { order: 3; flex-basis: 100%; min-width: 0; }
  .pessoal-grid { font-size: 12px; }
  .pessoal-grid thead th { padding: 9px 10px; min-width: 74px; font-size: 10px; }
  .pessoal-grid tbody td { padding: 9px 10px; }
  .pessoal-grid .cat-head, .pessoal-grid .cat-cell { min-width: 148px; max-width: 148px; }
  .cat-cell__nome { font-size: 12.5px; }
  /* Touch não tem hover: ações sempre visíveis e com alvo maior. */
  .cat-cell__acoes { opacity: 1; }
  .pessoal-grid .iconbtn { padding: 5px; }
  .pessoal-addcat { max-width: none; }
}`;
