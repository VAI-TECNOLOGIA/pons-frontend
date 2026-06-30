import { useState, useEffect } from 'react';
import { Api } from '../lib/api';
import { useToast } from '../lib/toast';

// Exibe + edita os valores dos campos personalizados de um lead.
export function LeadCamposCustom({ leadId }: { leadId: number }) {
  const [campos, setCampos] = useState<any[] | null>(null);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let vivo = true;
    Api.leadCamposCustom(leadId)
      .then((c) => { if (!vivo) return; setCampos(c); setVals(Object.fromEntries(c.map((x: any) => [x.id, x.valor ?? '']))); })
      .catch(() => { if (vivo) setCampos([]); });
    return () => { vivo = false; };
  }, [leadId]);

  if (campos === null) return <div className="text-sm text-secondary">Carregando…</div>;
  if (campos.length === 0) {
    return <div className="text-sm text-secondary">Nenhum campo personalizado criado ainda. Crie em <strong>Campos Personalizados</strong>.</div>;
  }

  const salvar = async () => {
    setSaving(true);
    try { await Api.leadCamposCustomSet(leadId, vals); toast.success('Campos salvos'); }
    catch (e: any) { toast.error('Erro: ' + (e.message || 'falha')); }
    finally { setSaving(false); }
  };

  return (
    <div className="form-grid form-grid--single">
      {campos.map((c) => (
        <div className="field" key={c.id}>
          <label className="field__label">{c.nome}{c.obrigatorio ? ' *' : ''}</label>
          {c.tipo === 'SELECT' ? (
            <select className="field__select" value={vals[c.id] ?? ''} onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })}>
              <option value="">—</option>
              {(c.opcoes || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : c.tipo === 'BOOLEAN' ? (
            <select className="field__select" value={vals[c.id] ?? ''} onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })}>
              <option value="">—</option><option value="Sim">Sim</option><option value="Não">Não</option>
            </select>
          ) : (
            <input
              className="field__input"
              type={c.tipo === 'NUMBER' ? 'number' : c.tipo === 'DATE' ? 'date' : 'text'}
              value={vals[c.id] ?? ''}
              onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })}
            />
          )}
        </div>
      ))}
      <button className="btn btn--primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar campos'}</button>
    </div>
  );
}
