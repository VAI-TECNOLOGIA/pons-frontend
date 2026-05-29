import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

const PRESETS: { label: string; expr: string }[] = [
  { label: 'Segunda 9h', expr: '0 9 * * 1' },
  { label: 'Quinta 18h', expr: '0 18 * * 4' },
  { label: 'Sexta 17h', expr: '0 17 * * 5' },
  { label: 'Todo dia útil 8h', expr: '0 8 * * 1-5' },
  { label: 'Toda manhã 10h', expr: '0 10 * * *' },
];

export default function Distribuicao() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.distribuicaoList());
  const toast = useToast();
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nome: String(fd.get('nome') || ''),
      cronExpr: String(fd.get('cronExpr') || ''),
      qtdPorCorretor: Number(fd.get('qtdPorCorretor') || 10),
      cidade: String(fd.get('cidade') || '') || null,
      origemLead: String(fd.get('origemLead') || '') || null,
      statusLead: String(fd.get('statusLead') || '') || null,
      ativa: true,
    };
    try {
      if (editing) await Api.distribuicaoUpdate(editing.id, payload);
      else await Api.distribuicaoCreate(payload);
      toast.success('Salvo'); setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const executar = async (d: any) => {
    const ok = await confirm({ title: 'Executar agora?', message: `Disparar "${d.nome}" agora?` });
    if (!ok) return;
    try {
      const r = await Api.distribuicaoExecutar(d.id);
      toast.success(`Distribuídos ${r.resultado.leadsDistribuidos} leads pra ${r.resultado.corretoresAtendidos} corretores`);
      reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const excluir = async (d: any) => {
    const ok = await confirm({ title: 'Excluir?', message: `"${d.nome}" será removido.`, tone: 'danger' });
    if (!ok) return;
    await Api.distribuicaoDelete(d.id); toast.success('Removido'); reload();
  };

  const toggle = async (d: any) => {
    await Api.distribuicaoUpdate(d.id, { ativa: !d.ativa });
    reload();
  };

  return (
    <>
      <Topbar
        title="Distribuição Agendada"
        right={<button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Nova regra</button>}
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Sócios · Distribuição"
          title="Distribuição Automática"
          subtitle="Ex: toda segunda 9h, distribuir 20 leads pra cada corretor de Itapema"
        />

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Cron</th><th>Qtd/corretor</th><th>Filtros</th><th>Última exec.</th><th></th></tr>
            </thead>
            <tbody>
              {(data || []).map((d: any) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.nome}</strong>
                    <span className={`badge badge--sm ${d.ativa ? 'badge--launch' : 'badge--neutral'}`} style={{ marginLeft: 6 }}>{d.ativa ? 'ativa' : 'pausada'}</span>
                  </td>
                  <td><code>{d.cronExpr}</code></td>
                  <td>{d.qtdPorCorretor}</td>
                  <td className="text-xs">
                    {[d.cidade && `cidade=${d.cidade}`, d.origemLead && `origem=${d.origemLead}`, d.statusLead && `status=${d.statusLead}`].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="text-xs text-secondary">{d.ultimaExecucaoAt ? new Date(d.ultimaExecucaoAt).toLocaleString('pt-BR') : '—'}</td>
                  <td>
                    <div className="flex" style={{ gap: 4 }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => executar(d)}>▶ Executar</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => toggle(d)}>{d.ativa ? '⏸' : '▶'}</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(d); setOpen(true); }}>Editar</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => excluir(d)}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma regra criada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? 'Editar regra' : 'Nova regra de distribuição'}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
            <button type="submit" form="dist-form" className="btn btn--primary">Salvar</button>
          </>
        }
      >
        <form id="dist-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} placeholder="Ex: Itapema toda segunda" /></div>
            <div className="field">
              <label className="field__label">Cron expression *</label>
              <input name="cronExpr" className="field__input" required defaultValue={editing?.cronExpr || '0 9 * * 1'} />
              <div className="flex" style={{ gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {PRESETS.map((p) => (
                  <button key={p.expr} type="button" className="btn btn--ghost btn--sm" onClick={(e) => {
                    (e.currentTarget.closest('form')!.querySelector('[name="cronExpr"]') as HTMLInputElement).value = p.expr;
                  }}>{p.label}</button>
                ))}
              </div>
            </div>
            <div className="field"><label className="field__label">Qtd leads por corretor</label><input type="number" name="qtdPorCorretor" className="field__input" defaultValue={editing?.qtdPorCorretor || 10} min={1} /></div>
            <div className="field"><label className="field__label">Cidade (opcional)</label><input name="cidade" className="field__input" defaultValue={editing?.cidade || ''} placeholder="Itapema, Balneário Camboriú..." /></div>
            <div className="field">
              <label className="field__label">Origem (opcional)</label>
              <select name="origemLead" className="field__select" defaultValue={editing?.origemLead || ''}>
                <option value="">Qualquer</option>
                <option>META_ADS</option><option>GOOGLE</option><option>SITE</option><option>WHATSAPP</option><option>INDICACAO</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">Status do lead (opcional)</label>
              <select name="statusLead" className="field__select" defaultValue={editing?.statusLead || ''}>
                <option value="">Qualquer não fechado/perdido</option>
                <option>NOVO</option><option>SDR</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
