import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

const TIPOS = [
  { v: 'TEXT', l: 'Texto' },
  { v: 'NUMBER', l: 'Número' },
  { v: 'DATE', l: 'Data' },
  { v: 'SELECT', l: 'Lista de opções' },
  { v: 'BOOLEAN', l: 'Sim / Não' },
];
const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.v, t.l]));

export default function CamposCustom() {
  const { data, loading, error, reload } = useApi<any[]>(() => Api.camposCustom());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [tipo, setTipo] = useState('TEXT');
  const toast = useToast();
  const confirm = useConfirm();

  const abrir = (c: any) => { setEditing(c); setTipo(c?.tipo || 'TEXT'); setOpen(true); };

  const salvar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const opcoesRaw = String(fd.get('opcoes') || '').trim();
    const payload: any = {
      nome: String(fd.get('nome') || '').trim(),
      tipo,
      opcoes: tipo === 'SELECT' && opcoesRaw ? opcoesRaw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) : null,
      obrigatorio: fd.get('obrigatorio') === 'on',
      ordem: Number(fd.get('ordem')) || 0,
      ativo: fd.get('ativo') !== null ? fd.get('ativo') === 'on' : true,
    };
    try {
      if (editing) await Api.campoCustomUpdate(editing.id, payload);
      else await Api.campoCustomCreate(payload);
      toast.success('Campo salvo'); setOpen(false); setEditing(null); reload();
    } catch (err: any) {
      toast.error(err.message === 'campo_duplicado' ? 'Já existe um campo com esse nome' : 'Erro: ' + (err.message || 'falha'));
    }
  };

  const excluir = async (c: any) => {
    const ok = await confirm({ title: 'Excluir campo?', message: `"${c.nome}" e todos os valores preenchidos nos leads serão removidos.`, tone: 'danger' });
    if (!ok) return;
    try { await Api.campoCustomDelete(c.id); toast.success('Campo removido'); reload(); }
    catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  return (
    <>
      <Topbar title="Campos Personalizados" right={<button className="btn btn--primary btn--sm" onClick={() => abrir(null)}>+ Novo campo</button>} />
      <div className="main__content page-enter">
        <PageHeader
          breadcrumb="Administração · Dados"
          title="Campos Personalizados"
          subtitle="Crie campos extras (Renda, FGTS, Tipo de imóvel…) — a importação captura colunas com esse nome e o lead exibe os valores"
        />

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : (
          <div className="card fade-in" style={{ padding: 0 }}>
            <table className="table row-hover">
              <thead>
                <tr><th>Campo</th><th>Tipo</th><th>Opções</th><th>Obrigatório</th><th>Ativo</th><th></th></tr>
              </thead>
              <tbody>
                {(data || []).length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Nenhum campo criado ainda — clique em "+ Novo campo"</td></tr>
                ) : (data || []).map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.nome}</strong><div className="text-xs text-secondary" style={{ fontFamily: 'monospace' }}>{c.slug}</div></td>
                    <td><span className="badge badge--neutral">{TIPO_LABEL[c.tipo] || c.tipo}</span></td>
                    <td className="text-xs">{Array.isArray(c.opcoes) ? c.opcoes.join(' · ') : '—'}</td>
                    <td>{c.obrigatorio ? <span className="badge badge--analysis">Sim</span> : <span className="text-xs text-secondary">—</span>}</td>
                    <td>{c.ativo ? <span className="badge badge--signed">Ativo</span> : <span className="badge badge--neutral">Inativo</span>}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn--ghost btn--sm" onClick={() => abrir(c)}>Editar</button>
                        <button className="btn btn--ghost btn--sm" style={{ color: 'var(--color-danger-fg)' }} onClick={() => excluir(c)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? `Editar ${editing.nome}` : 'Novo campo personalizado'}
        footer={<>
          <button className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
          <button type="submit" form="campo-form" className="btn btn--primary">Salvar</button>
        </>}>
        <form id="campo-form" onSubmit={salvar}>
          <div className="form-grid">
            <div className="field field--span-2">
              <label className="field__label">Nome do campo *</label>
              <input name="nome" className="field__input" required defaultValue={editing?.nome} placeholder="Ex: Renda mensal, Tem FGTS, Tipo de imóvel" />
            </div>
            <div className="field">
              <label className="field__label">Tipo</label>
              <select name="tipo" className="field__select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Ordem</label>
              <input name="ordem" type="number" className="field__input" defaultValue={editing?.ordem ?? 0} />
            </div>
            {tipo === 'SELECT' && (
              <div className="field field--span-2">
                <label className="field__label">Opções (uma por linha ou separadas por vírgula)</label>
                <textarea name="opcoes" className="field__input" rows={3} defaultValue={Array.isArray(editing?.opcoes) ? editing.opcoes.join('\n') : ''} placeholder={'Apartamento\nCasa\nTerreno'} />
              </div>
            )}
            <div className="field field--span-2" style={{ display: 'flex', gap: 20 }}>
              <label className="field__label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" name="obrigatorio" defaultChecked={editing?.obrigatorio} /> Obrigatório
              </label>
              <label className="field__label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" name="ativo" defaultChecked={editing ? editing.ativo : true} /> Ativo
              </label>
            </div>
            <div className="field field--span-2">
              <div className="field__hint">Na importação, uma coluna da planilha com o mesmo nome (ex.: "Renda mensal") é capturada automaticamente neste campo.</div>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
