import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

export default function BMPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.bmList());
  const { data: corretores } = useApi<any[]>(() => Api.corretores());
  const toast = useToast();
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nome: String(fd.get('nome') || ''),
      bmId: String(fd.get('bmId') || ''),
      contaAnuncioId: String(fd.get('contaAnuncioId') || '') || null,
      paginaFbId: String(fd.get('paginaFbId') || '') || null,
      instagramId: String(fd.get('instagramId') || '') || null,
      corretorId: fd.get('corretorId') ? Number(fd.get('corretorId')) : null,
      iaHabilitadaPadrao: fd.get('iaHabilitadaPadrao') === 'on',
      ativa: true,
    };
    try {
      if (editing) await Api.bmUpdate(editing.id, payload);
      else await Api.bmCreate(payload);
      toast.success(editing ? 'BM atualizada' : 'BM cadastrada');
      setOpen(false); setEditing(null); reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const excluir = async (bm: any) => {
    const ok = await confirm({ title: 'Desativar BM?', message: `"${bm.nome}" será desativada (leads continuam preservados).`, tone: 'danger' });
    if (!ok) return;
    await Api.bmDelete(bm.id); toast.success('BM desativada'); reload();
  };

  const verDashboard = async (bm: any) => {
    try {
      const dash = await Api.bmDashboard(bm.id);
      setSelected({ bm, dash });
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  return (
    <>
      <Topbar
        title="Business Managers"
        right={<button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Nova BM</button>}
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Administração · Tráfego"
          title="Central de BMs"
          subtitle="Cadastre BMs e vincule a corretores — leads dessas BMs vão direto pra eles (bypass da roleta)"
        />

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {(data || []).map((bm) => (
            <div key={bm.id} className="card" style={{ position: 'relative' }}>
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{bm.nome}</h3>
                <span className={`badge ${bm.ativa ? 'badge--launch' : 'badge--neutral'}`}>{bm.ativa ? 'Ativa' : 'Inativa'}</span>
              </div>
              <div className="text-xs text-secondary" style={{ marginBottom: 8 }}>BM ID: {bm.bmId}</div>
              {bm.corretor ? (
                <div style={{ background: 'var(--bg-elevated)', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                  <div className="text-xs text-secondary">Vinculada a:</div>
                  <div style={{ fontWeight: 600 }}>{bm.corretor.nome}</div>
                  <div className="text-xs" style={{ color: 'var(--color-success)' }}>Leads vão direto (sem roleta)</div>
                </div>
              ) : (
                <div className="text-xs text-secondary" style={{ marginBottom: 8 }}>BM da empresa — leads entram na roleta</div>
              )}
              <div className="text-xs">
                <div>Leads captados: <strong>{bm.leadsCaptados}</strong></div>
                <div>IA padrão: {bm.iaHabilitadaPadrao ? 'Sim' : 'Não'}</div>
              </div>
              <div className="flex" style={{ gap: 6, marginTop: 12 }}>
                <button className="btn btn--ghost btn--sm" onClick={() => verDashboard(bm)}>Dashboard</button>
                <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(bm); setOpen(true); }}>Editar</button>
                <button className="btn btn--ghost btn--sm" onClick={() => excluir(bm)}>Desativar</button>
              </div>
            </div>
          ))}
          {data?.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma BM cadastrada ainda</div>
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? `Editar ${editing.nome}` : 'Nova Business Manager'}
        subtitle="Vincule a um corretor pra leads bypass roleta, ou deixe vazio pra entrar na roleta padrão"
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
            <button type="submit" form="bm-form" className="btn btn--primary">{editing ? 'Salvar' : 'Cadastrar'}</button>
          </>
        }
      >
        <form id="bm-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} /></div>
            <div className="field"><label className="field__label">BM ID (Meta) *</label><input name="bmId" className="field__input" required defaultValue={editing?.bmId} /></div>
            <div className="field"><label className="field__label">Conta de Anúncios (act_xxx)</label><input name="contaAnuncioId" className="field__input" defaultValue={editing?.contaAnuncioId || ''} /></div>
            <div className="field"><label className="field__label">Página Facebook ID</label><input name="paginaFbId" className="field__input" defaultValue={editing?.paginaFbId || ''} /></div>
            <div className="field"><label className="field__label">Instagram ID</label><input name="instagramId" className="field__input" defaultValue={editing?.instagramId || ''} /></div>
            <div className="field">
              <label className="field__label">Vincular a corretor</label>
              <select name="corretorId" className="field__select" defaultValue={editing?.corretor?.id || ''}>
                <option value="">— Sem vínculo (BM da empresa, vai pra roleta) —</option>
                {(corretores || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" name="iaHabilitadaPadrao" defaultChecked={editing?.iaHabilitadaPadrao} />
                Habilitar IA por padrão pros leads dessa BM
              </label>
              <div className="text-xs text-secondary">Por padrão, leads de BM de corretor NÃO usam IA (pra preservar o contato pessoal)</div>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Dashboard · ${selected?.bm?.nome || ''}`}
        size="lg"
      >
        {selected && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Stat label="Leads Total" value={selected.dash.leadsTotal} />
            <Stat label="Leads (mês)" value={selected.dash.leadsMes} />
            <Stat label="Fechados" value={selected.dash.leadsFechados} />
            <Stat label="Conversão" value={selected.dash.conversaoPct + '%'} />
            <Stat label="VGV total" value={(selected.dash.vgvTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} />
            <Stat label="Custo (mês)" value={(selected.dash.custoMes || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
            <Stat label="Conversas (mês)" value={selected.dash.conversasMes} />
            <Stat label="Custo/Lead" value={'R$ ' + (selected.dash.custoPorLead || 0).toFixed(2)} />
          </div>
        )}
      </Modal>
    </>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="text-xs text-secondary">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
