import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { Icon } from './Icon';
import { useUser } from '../lib/userContext';

// Sprint 1 M21 — Preferências do App do corretor (Imobilead-style)
// Avisos por assunto (reunião Pons 19/10): a gestão escolhe o que quer receber no
// celular e no sino — o Paulo desliga Leads no dia a dia e liga quando quiser mostrar
// o movimento. Salva na hora, sem botão. Corretor não vê: o aviso de lead é trabalho.
const ASSUNTOS: { campo: string; titulo: string; texto: string }[] = [
  { campo: 'notificarLeadNovo', titulo: 'Leads', texto: 'Lead novo, distribuição, transferência e leads da equipe.' },
  { campo: 'notificarVendas', titulo: 'Vendas e contratos', texto: 'Venda registrada, aprovação, assinatura, mudança de etapa e cancelamento.' },
  { campo: 'notificarFinanceiro', titulo: 'Financeiro', texto: 'Lançamentos, pagamentos, lotes enviados ao banco e recusas.' },
];

function NotificacoesPorAssunto({ prefs, onSalvo }: { prefs: any; onSalvo: (p: any) => void }) {
  const toast = useToast();
  const [salvando, setSalvando] = useState<string | null>(null);
  const trocar = async (campo: string, valor: boolean) => {
    setSalvando(campo);
    try {
      const r = await Api.preferencesUpdate({ [campo]: valor });
      onSalvo(r);
      toast.success(valor ? 'Avisos ligados.' : 'Avisos desligados.');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setSalvando(null);
    }
  };
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="bell" size={16} /> Notificações
      </h3>
      <p className="text-sm text-secondary" style={{ margin: '0 0 12px' }}>Escolha o que chega no seu celular e no sino. Liga e desliga quando quiser.</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {ASSUNTOS.map((a) => {
          const ligado = prefs[a.campo] !== false;
          return (
            <label key={a.campo} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" style={{ marginTop: 3, width: 18, height: 18 }} checked={ligado} disabled={salvando === a.campo} onChange={(e) => trocar(a.campo, e.target.checked)} />
              <span>
                <strong>{a.titulo}</strong> <span className="text-xs text-secondary">{ligado ? 'ligado' : 'desligado'}</span>
                <span className="text-sm text-secondary" style={{ display: 'block' }}>{a.texto}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function PreferenciasCard() {
  const { user } = useUser();
  const gestao = !!user && user.role !== 'CORRETOR';
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
    <>
    {gestao && <NotificacoesPorAssunto prefs={form} onSalvo={(p) => setForm((f: any) => ({ ...f, ...p }))} />}
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="settings" size={16} /> Preferências do App
      </h3>

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
          <label className="field__label">Listagem</label>
          <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!form.exibirFollowupNaLista} onChange={(e) => upd('exibirFollowupNaLista', e.target.checked)} />
              Exibir follow-ups na listagem de leads
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
    </>
  );
}
