// Condições de venda (política de rateio) de um empreendimento.
// Reutilizado em: Financeiro → Rateio & Sócios (CRUD) e no cadastro de
// empreendimento (abre logo após criar, já vinculado ao empreendimento novo).
import { Modal } from './Modal';
import { Api } from '../lib/api';
import { useToast } from '../lib/toast';

export function CondicoesVendaModal({
  open,
  onClose,
  onSaved,
  editing,
  empreendimento,
  emps,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: any;
  /** Trava o empreendimento (fluxo pós-cadastro): esconde o seletor. */
  empreendimento?: { id: number; nome: string } | null;
  /** Lista pro seletor quando o empreendimento não está travado. */
  emps?: any[];
}) {
  const toast = useToast();
  const empTravado = !!empreendimento;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const empIdRaw = empTravado ? String(empreendimento!.id) : String(fd.get('empreendimentoId') || '');
    const payload = {
      nome: String(fd.get('nome') || ''),
      descricao: String(fd.get('descricao') || '') || null,
      empreendimentoId: empIdRaw ? Number(empIdRaw) : null,
      percentualComissao: Number(fd.get('percentualComissao') || 5),
      aplicaNotaFiscal: fd.get('aplicaNotaFiscal') === 'on',
      percentualNotaFiscal: Number(fd.get('percentualNotaFiscal') || 16),
      splitCorretorPons: Number(fd.get('splitCorretorPons') || 55),
      splitImobiliariaPons: Number(fd.get('splitImobiliariaPons') || 45),
      percentualGestor: Number(fd.get('percentualGestor') || 10),
      percentualDirecao: Number(fd.get('percentualDirecao') || 5),
      percentualCampanhaCorretor: Number(fd.get('percentualCampanhaCorretor') || 6.5),
      percentualCampanhaImobiliaria: Number(fd.get('percentualCampanhaImobiliaria') || 6.5),
      percentualLazaroCorretor: Number(fd.get('percentualLazaroCorretor') || 3),
      percentualLazaroImobiliaria: Number(fd.get('percentualLazaroImobiliaria') || 1),
      taxaMarketingFixa: Number(fd.get('taxaMarketingFixa') || 199),
      // Condições comerciais do empreendimento (reunião 05/07)
      entradaMinimaPct: fd.get('entradaMinimaPct') ? Number(fd.get('entradaMinimaPct')) : null,
      parcelasMensaisMax: fd.get('parcelasMensaisMax') ? Number(fd.get('parcelasMensaisMax')) : null,
      reforcosAnuaisMax: fd.get('reforcosAnuaisMax') ? Number(fd.get('reforcosAnuaisMax')) : null,
      contatoAdministrativo: String(fd.get('contatoAdministrativo') || '') || null,
      isDefault: fd.get('isDefault') === 'on',
      ativa: true,
    };
    try {
      if (editing) await Api.rateioPoliticaUpdate(editing.id, payload);
      else await Api.rateioPoliticaCreate(payload);
      toast.success('Condições de venda salvas');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const titulo = empTravado
    ? `Condições de venda — ${empreendimento!.nome}`
    : editing ? 'Editar política' : 'Nova política';
  const nomeDefault = editing?.nome ?? (empTravado ? `Condições ${empreendimento!.nome}` : '');

  return (
    <Modal open={open} onClose={onClose} title={titulo} size="lg" footer={
      <>
        <button type="button" className="btn btn--secondary" onClick={onClose}>{empTravado ? 'Pular' : 'Cancelar'}</button>
        <button type="submit" form="cond-venda-form" className="btn btn--primary">Salvar</button>
      </>
    }>
      {empTravado && (
        <div className="text-xs text-secondary" style={{ marginBottom: 12 }}>
          Comissão e rateio que valem para as vendas de <strong>{empreendimento!.nome}</strong>. Pode ajustar depois em Financeiro → Rateio &amp; Sócios.
        </div>
      )}
      <form id="cond-venda-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={nomeDefault} /></div>
          {empTravado ? (
            <div className="field">
              <label className="field__label">Empreendimento</label>
              <input className="field__input" value={empreendimento!.nome} disabled />
            </div>
          ) : (
            <div className="field">
              <label className="field__label">Empreendimento</label>
              <select name="empreendimentoId" className="field__select" defaultValue={editing?.empreendimentoId || ''}>
                <option value="">— Geral (todos) —</option>
                {(emps || []).map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
              <div className="field__hint">Negociação específica deste empreendimento tem prioridade no cálculo.</div>
            </div>
          )}
          <div className="field"><label className="field__label">% que a Pons recebe (sobre a venda)</label><input type="number" step="0.01" name="percentualComissao" className="field__input" defaultValue={editing?.percentualComissao || 5} /><div className="field__hint">Ex.: 7% do valor total da venda.</div></div>
          <div className="field"><label className="field__label">% mínimo de entrada</label><input type="number" step="0.01" min="0" max="100" name="entradaMinimaPct" className="field__input" defaultValue={editing?.entradaMinimaPct ?? ''} placeholder="ex.: 7" /><div className="field__hint">Venda com entrada abaixo disso exige aprovação do Paulo.</div></div>
          <div className="field"><label className="field__label">Parcelas mensais (qtd liberada)</label><input type="number" min="0" name="parcelasMensaisMax" className="field__input" defaultValue={editing?.parcelasMensaisMax ?? ''} placeholder="ex.: 120" /></div>
          <div className="field"><label className="field__label">Balões / reforços anuais (qtd)</label><input type="number" min="0" name="reforcosAnuaisMax" className="field__input" defaultValue={editing?.reforcosAnuaisMax ?? ''} placeholder="ex.: 8" /></div>
          <div className="field"><label className="field__label">WhatsApp do administrativo da construtora</label><input name="contatoAdministrativo" className="field__input" defaultValue={editing?.contatoAdministrativo ?? ''} placeholder="(47) 90000-0000" /><div className="field__hint">Quem recebe o protocolo e os documentos da venda.</div></div>
          <div className="field" style={{ gridColumn: '1/-1' }}><label className="field__label">Descrição</label><input name="descricao" className="field__input" defaultValue={editing?.descricao || ''} /></div>
          <div className="field"><label style={{ display: 'flex', gap: 8 }}><input type="checkbox" name="aplicaNotaFiscal" defaultChecked={editing?.aplicaNotaFiscal ?? true} /> Aplica NF</label></div>
          <div className="field"><label className="field__label">% NF</label><input type="number" step="0.01" name="percentualNotaFiscal" className="field__input" defaultValue={editing?.percentualNotaFiscal || 16} /></div>
          <div className="field"><label className="field__label">Split Corretor (%)</label><input type="number" step="0.01" name="splitCorretorPons" className="field__input" defaultValue={editing?.splitCorretorPons || 55} /></div>
          <div className="field"><label className="field__label">Split Imobiliária (%)</label><input type="number" step="0.01" name="splitImobiliariaPons" className="field__input" defaultValue={editing?.splitImobiliariaPons || 45} /></div>
          <div className="field"><label className="field__label">% Gestor</label><input type="number" step="0.01" name="percentualGestor" className="field__input" defaultValue={editing?.percentualGestor || 10} /></div>
          <div className="field"><label className="field__label">% Direção</label><input type="number" step="0.01" name="percentualDirecao" className="field__input" defaultValue={editing?.percentualDirecao || 5} /></div>
          <div className="field"><label className="field__label">% Campanha — Corretor</label><input type="number" step="0.01" name="percentualCampanhaCorretor" className="field__input" defaultValue={editing?.percentualCampanhaCorretor || 6.5} /></div>
          <div className="field"><label className="field__label">% Campanha — Imobiliária</label><input type="number" step="0.01" name="percentualCampanhaImobiliaria" className="field__input" defaultValue={editing?.percentualCampanhaImobiliaria || 6.5} /></div>
          <div className="field"><label className="field__label">% Lázaro — Corretor</label><input type="number" step="0.01" name="percentualLazaroCorretor" className="field__input" defaultValue={editing?.percentualLazaroCorretor || 3} /></div>
          <div className="field"><label className="field__label">% Lázaro — Imobiliária</label><input type="number" step="0.01" name="percentualLazaroImobiliaria" className="field__input" defaultValue={editing?.percentualLazaroImobiliaria || 1} /></div>
          <div className="field"><label className="field__label">Taxa Marketing (R$ fixa)</label><input type="number" step="0.01" name="taxaMarketingFixa" className="field__input" defaultValue={editing?.taxaMarketingFixa || 199} /></div>
          <div className="field"><label style={{ display: 'flex', gap: 8 }}><input type="checkbox" name="isDefault" defaultChecked={editing?.isDefault} /> Política DEFAULT</label></div>
        </div>
      </form>
    </Modal>
  );
}
