import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';

// Sprint 1 M21 — Preferências do App do corretor (Imobilead-style)
export function PreferenciasCard() {
  const { data, reload } = useApi<any>(() => Api.preferencesMe().catch(() => null));
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);

  if (!form) return null;

  const salvar = async () => {
    setSaving(true);
    try {
      await Api.preferencesUpdate({
        interessePrincipalCampo: form.interessePrincipalCampo,
        exibirFollowupNaLista: form.exibirFollowupNaLista,
        notificarLeadNovo: form.notificarLeadNovo,
        notificarFollowup: form.notificarFollowup,
        layoutDensidade: form.layoutDensidade,
      });
      toast.success('Preferências salvas');
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  const upd = (campo: string, v: any) => setForm((f: any) => ({ ...f, [campo]: v }));

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>⚙️ Preferências do App</h3>

      <div className="form-grid">
        <div className="field">
          <label className="field__label">Exibir como interesse principal na listagem</label>
          <select className="field__select" value={form.interessePrincipalCampo} onChange={(e) => upd('interessePrincipalCampo', e.target.value)}>
            <option value="produto">Produto</option>
            <option value="empreendimento">Empreendimento</option>
            <option value="cidade">Cidade</option>
            <option value="campanha">Campanha</option>
          </select>
        </div>

        <div className="field">
          <label className="field__label">Densidade do layout</label>
          <select className="field__select" value={form.layoutDensidade} onChange={(e) => upd('layoutDensidade', e.target.value)}>
            <option value="compacta">Compacta</option>
            <option value="normal">Normal</option>
            <option value="confortavel">Confortável</option>
          </select>
        </div>

        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="field__label">Notificações</label>
          <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!form.exibirFollowupNaLista} onChange={(e) => upd('exibirFollowupNaLista', e.target.checked)} />
              Exibir follow-ups na listagem de leads
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!form.notificarLeadNovo} onChange={(e) => upd('notificarLeadNovo', e.target.checked)} />
              Notificar quando receber novo lead
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!form.notificarFollowup} onChange={(e) => upd('notificarFollowup', e.target.checked)} />
              Notificar quando follow-up estiver agendado
            </label>
          </div>
        </div>
      </div>

      <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn--primary" onClick={salvar} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar preferências'}
        </button>
      </div>
    </div>
  );
}
