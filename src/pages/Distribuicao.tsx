import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

const PRESETS: { label: string; expr: string }[] = [
  { label: 'Segunda 9h',       expr: '0 9 * * 1' },
  { label: 'Quinta 18h',       expr: '0 18 * * 4' },
  { label: 'Sexta 10h',        expr: '0 10 * * 5' },
  { label: 'Sexta 17h',        expr: '0 17 * * 5' },
  { label: 'Todo dia útil 8h', expr: '0 8 * * 1-5' },
  { label: 'Toda manhã 10h',   expr: '0 10 * * *' },
];

export default function Distribuicao() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  // Escopo: 'sistema' (sem filtro de equipe) | 'equipes' (filtra pelas equipes selecionadas)
  const [escopo, setEscopo] = useState<'sistema' | 'equipes'>('sistema');
  const [equipesSel, setEquipesSel] = useState<number[]>([]);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.distribuicaoList());
  const { data: equipes } = useApi<any[]>(() => Api.equipes());
  const toast = useToast();
  const confirm = useConfirm();

  // Abre o modal já com o escopo correto baseado na regra sendo editada
  const abrirCriar = () => {
    setEditing(null);
    setEscopo('sistema');
    setEquipesSel([]);
    setOpen(true);
  };
  const abrirEditar = (d: any) => {
    setEditing(d);
    const ids: number[] = Array.isArray(d.equipeIds) ? d.equipeIds : (d.equipeId ? [d.equipeId] : []);
    setEscopo(ids.length > 0 ? 'equipes' : 'sistema');
    setEquipesSel(ids);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (escopo === 'equipes' && equipesSel.length === 0) {
      toast.error('Selecione pelo menos 1 equipe — ou troque o escopo pra "Sistema todo".');
      return;
    }
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      nome: String(fd.get('nome') || ''),
      cronExpr: String(fd.get('cronExpr') || ''),
      qtdPorCorretor: Number(fd.get('qtdPorCorretor') || 10),
      cidade: String(fd.get('cidade') || '') || null,
      origemLead: String(fd.get('origemLead') || '') || null,
      statusLead: String(fd.get('statusLead') || '') || null,
      ativa: editing?.ativa ?? true,
      // Escopo: sistema → equipeIds null + equipeId null. Equipes → equipeIds = sel
      equipeIds: escopo === 'equipes' ? equipesSel : null,
      equipeId: null, // sempre limpa legado quando salvamos pelo modal novo
    };
    try {
      if (editing) await Api.distribuicaoUpdate(editing.id, payload);
      else await Api.distribuicaoCreate(payload);
      toast.success('Salvo'); setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const toggleEquipe = (id: number) => {
    setEquipesSel((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  // Mostra o escopo da regra na tabela ("Sistema" ou "Equipes: A, B")
  const escopoLabel = (d: any) => {
    const ids: number[] = Array.isArray(d.equipeIds) ? d.equipeIds : (d.equipeId ? [d.equipeId] : []);
    if (ids.length === 0) return 'Sistema todo';
    const nomes = ids.map((id) => (equipes || []).find((e: any) => e.id === id)?.nome || `#${id}`);
    return nomes.join(', ');
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
        right={<button className="btn btn--primary btn--sm" onClick={abrirCriar}>+ Nova regra</button>}
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
              <tr><th>Nome</th><th>Cron</th><th>Qtd/corretor</th><th>Escopo</th><th>Filtros</th><th>Última exec.</th><th></th></tr>
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
                  <td className="text-xs">{escopoLabel(d)}</td>
                  <td className="text-xs">
                    {[d.cidade && `cidade=${d.cidade}`, d.origemLead && `origem=${d.origemLead}`, d.statusLead && `status=${d.statusLead}`].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="text-xs text-secondary">{d.ultimaExecucaoAt ? new Date(d.ultimaExecucaoAt).toLocaleString('pt-BR') : '—'}</td>
                  <td>
                    <div className="flex" style={{ gap: 4 }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => executar(d)}>▶ Executar</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => toggle(d)}>{d.ativa ? '⏸' : '▶'}</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => abrirEditar(d)}>Editar</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => excluir(d)}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma regra criada</td></tr>
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

            {/* ─── Escopo (sistema todo vs equipes específicas) ─── */}
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Atribuir regra a *</label>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="escopo"
                    checked={escopo === 'sistema'}
                    onChange={() => { setEscopo('sistema'); setEquipesSel([]); }}
                  />
                  <span>Sistema todo <span className="text-xs text-secondary">(corretores de qualquer equipe)</span></span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="escopo"
                    checked={escopo === 'equipes'}
                    onChange={() => setEscopo('equipes')}
                  />
                  <span>Equipes específicas</span>
                </label>
              </div>

              {escopo === 'equipes' && (
                <div style={{
                  border: '1px solid var(--border-light)', borderRadius: 8, padding: 10,
                  display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 180, overflowY: 'auto',
                }}>
                  {(equipes || []).length === 0 && (
                    <span className="text-xs text-secondary">Nenhuma equipe cadastrada — crie em Equipes primeiro.</span>
                  )}
                  {(equipes || []).map((eq: any) => {
                    const sel = equipesSel.includes(eq.id);
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => toggleEquipe(eq.id)}
                        className="btn btn--sm"
                        style={{
                          background: sel ? eq.cor || '#0E7C9B' : 'transparent',
                          color: sel ? '#fff' : 'var(--text-primary)',
                          border: `1px solid ${sel ? (eq.cor || '#0E7C9B') : 'var(--border-light)'}`,
                        }}
                      >
                        {sel && '✓ '}{eq.nome}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

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
