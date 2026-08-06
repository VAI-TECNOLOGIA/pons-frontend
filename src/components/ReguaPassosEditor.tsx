import { useState } from 'react';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { Icon } from './Icon';

interface PassoForm {
  atrasoHoras: number;
  nomeExibicao: string;
  templateName: string;
  mensagemTexto: string;
}

interface ReguaPassosEditorProps {
  regua: any; // { id, tipo, passos: [{ordem, atrasoHoras, nomeExibicao, templateName, mensagemTexto}] }
  onSaved: () => void;
  onCancel: () => void;
}

function passosFromRegua(regua: any): PassoForm[] {
  return (regua.passos || []).map((p: any) => ({
    atrasoHoras: p.atrasoHoras,
    nomeExibicao: p.nomeExibicao,
    templateName: p.templateName || '',
    mensagemTexto: p.mensagemTexto || '',
  }));
}

// Lista de passos sempre editável (sem modal) — atraso em horas, nome de
// exibição e, conforme o tipo da régua, um select de template aprovado
// (NAO_RESPONDEU) ou um textarea livre (RESPONDEU_24H). `key={regua.id}` no
// componente pai força remount ao trocar de régua, então o estado inicial
// (useState com initializer) já nasce correto sem precisar de useEffect.
export function ReguaPassosEditor({ regua, onSaved, onCancel }: ReguaPassosEditorProps) {
  const [passos, setPassos] = useState<PassoForm[]>(() => passosFromRegua(regua));
  const [saving, setSaving] = useState(false);
  const isTemplate = regua.tipo === 'NAO_RESPONDEU';
  const { data: templatesData } = useApi(
    () => (isTemplate ? Api.whatsappTemplates() : Promise.resolve({ items: [], cached: true })),
    [isTemplate],
  );
  const templates = templatesData?.items || [];
  const toast = useToast();

  const update = (i: number, patch: Partial<PassoForm>) => {
    setPassos((cur) => cur.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };
  const remover = (i: number) => setPassos((cur) => cur.filter((_, idx) => idx !== i));
  const adicionar = () => {
    const ultimo = passos[passos.length - 1];
    setPassos((cur) => [...cur, {
      atrasoHoras: ultimo ? ultimo.atrasoHoras + 3 : 3,
      nomeExibicao: '',
      templateName: '',
      mensagemTexto: '',
    }]);
  };

  const salvar = async () => {
    if (!passos.length) { toast.error('Adicione ao menos 1 passo'); return; }
    for (let i = 0; i < passos.length; i++) {
      const p = passos[i];
      if (!p.nomeExibicao.trim()) { toast.error(`Passo ${i + 1}: nome de exibição obrigatório`); return; }
      if (isTemplate && !p.templateName) { toast.error(`Passo ${i + 1}: selecione um template aprovado`); return; }
      if (!isTemplate && !p.mensagemTexto.trim()) { toast.error(`Passo ${i + 1}: escreva a mensagem`); return; }
      if (i > 0 && p.atrasoHoras <= passos[i - 1].atrasoHoras) {
        toast.error(`Passo ${i + 1}: atraso precisa ser maior que o do passo anterior`);
        return;
      }
    }
    setSaving(true);
    try {
      await Api.reguaSetPassos(regua.id, passos.map((p) => ({
        atrasoHoras: p.atrasoHoras,
        nomeExibicao: p.nomeExibicao,
        templateName: isTemplate ? p.templateName : null,
        mensagemTexto: isTemplate ? null : p.mensagemTexto,
      })));
      toast.success('Passos salvos');
      onSaved();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {passos.map((p, i) => (
        <div key={i} className="card" style={{ marginBottom: 12, padding: 16, background: 'var(--bg-elevated)' }}>
          <div className="flex-between" style={{ marginBottom: 10 }}>
            <strong style={{ fontSize: 13 }}>Passo {i + 1}</strong>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => remover(i)} aria-label="Remover passo">
              <Icon name="trash" size={14} />
            </button>
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Disparar após (horas) *</label>
              <input
                type="number" min={0} step={0.5} className="field__input"
                value={p.atrasoHoras}
                onChange={(e) => update(i, { atrasoHoras: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label className="field__label">Nome de exibição *</label>
              <input
                className="field__input" value={p.nomeExibicao}
                onChange={(e) => update(i, { nomeExibicao: e.target.value })}
                placeholder="Ex: Lembrete +3h"
              />
            </div>
            {isTemplate ? (
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="field__label">Template aprovado *</label>
                <select
                  className="field__select" value={p.templateName}
                  onChange={(e) => update(i, { templateName: e.target.value })}
                >
                  <option value="">Selecione…</option>
                  {templates.map((t: any) => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
                {!templates.length && (
                  <div className="field__hint">Nenhum template aprovado encontrado na WABA.</div>
                )}
              </div>
            ) : (
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="field__label">Mensagem *</label>
                <textarea
                  className="field__textarea" rows={3} value={p.mensagemTexto}
                  onChange={(e) => update(i, { mensagemTexto: e.target.value })}
                  placeholder="Texto livre — só é enviado dentro da janela de 24h, sem aprovação da Meta"
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <button type="button" className="btn btn--ghost btn--sm" onClick={adicionar}>
        <Icon name="plus" size={12} /> Adicionar passo
      </button>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="button" className="btn btn--primary btn--sm" disabled={saving} onClick={salvar}>
          {saving ? 'Salvando…' : 'Salvar passos'}
        </button>
      </div>
    </div>
  );
}
