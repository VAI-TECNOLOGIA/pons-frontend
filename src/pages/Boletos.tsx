// Cobrança — emissão de boletos Sicredi + geração do arquivo de remessa (CNAB 400).
// Financeiro emite o boleto (calcula nosso número/linha digitável no backend),
// baixa o PDF e, quando quiser, gera o .rem pra enviar ao banco.
import { useState } from 'react';
import { Api } from '../lib/api';
import { Auth } from '../lib/auth';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';

const brl = (c: number) => `R$ ${((c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const dt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const STATUS_LABEL: Record<string, string> = {
  EMITIDO: 'Emitido', NA_REMESSA: 'Na remessa', ENVIADO: 'Enviado', PAGO: 'Pago', CANCELADO: 'Cancelado',
};

const CAMPO_VAZIO = {
  pagadorNome: '', pagadorTipoPessoa: '1', pagadorCpfCnpj: '', pagadorEndereco: '',
  pagadorCep: '', seuNumero: '', valor: '', vencimento: '',
};

export default function Boletos() {
  const toast = useToast();
  const podeConfig = ['CEO', 'DIRETOR_FINANCEIRO'].includes(Auth.user?.role || '');
  const { data: lista, loading, error, reload } = useApi<any[]>(() => Api.boletosList());
  const { data: pend, reload: reloadPend } = useApi<{ total: number; valorCentavos: number }>(() => Api.boletosPendentes());
  const { data: cfg, reload: reloadCfg } = useApi<any>(() => Api.boletoCobrancaConfig());

  const [form, setForm] = useState<any>(CAMPO_VAZIO);
  const [emitindo, setEmitindo] = useState(false);
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const emitir = async () => {
    const valorCentavos = Math.round(parseFloat(String(form.valor).replace(/\./g, '').replace(',', '.')) * 100);
    if (!form.pagadorNome.trim()) return toast.error('Informe o nome do pagador');
    if (String(form.pagadorCpfCnpj).replace(/\D/g, '').length < 11) return toast.error('CPF/CNPJ do pagador inválido');
    if (!valorCentavos || valorCentavos <= 0) return toast.error('Informe o valor');
    if (!form.vencimento) return toast.error('Informe o vencimento');
    setEmitindo(true);
    try {
      await Api.boletoEmitir({
        seuNumero: form.seuNumero.trim() || undefined,
        pagadorNome: form.pagadorNome.trim(),
        pagadorTipoPessoa: form.pagadorTipoPessoa,
        pagadorCpfCnpj: String(form.pagadorCpfCnpj).replace(/\D/g, ''),
        pagadorEndereco: form.pagadorEndereco.trim() || undefined,
        pagadorCep: form.pagadorCep ? String(form.pagadorCep).replace(/\D/g, '') : undefined,
        valorCentavos,
        vencimento: form.vencimento,
      });
      toast.success('Boleto emitido');
      setForm(CAMPO_VAZIO);
      reload(); reloadPend();
    } catch (err: any) {
      toast.error('Erro ao emitir: ' + (err.message || 'falha'));
    } finally {
      setEmitindo(false);
    }
  };

  const gerarRemessa = async () => {
    try {
      const r = await Api.boletoRemessaBaixar();
      toast.success(`Remessa gerada: ${r.nome} (${r.total} boleto${r.total > 1 ? 's' : ''})`);
      reload(); reloadPend();
    } catch (err: any) {
      toast.error(err.message === 'sem_boletos_pendentes' ? 'Nenhum boleto aguardando remessa' : 'Erro ao gerar remessa');
    }
  };

  const abrirPdf = async (id: number) => {
    try { await Api.boletoPdf(id); } catch { toast.error('Erro ao abrir o PDF'); }
  };
  const mudarStatus = async (id: number, status: string) => {
    try { await Api.boletoStatus(id, status); reload(); reloadPend(); toast.success('Status atualizado'); }
    catch { toast.error('Erro ao atualizar'); }
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h1 className="card__title">Cobrança — Boletos</h1>
          <p className="text-sm text-secondary">Emita boletos Sicredi e gere o arquivo de remessa para enviar ao banco.</p>
        </div>
      </div>

      {/* Emissão */}
      <div className="card mb-4">
        <div className="card__title mb-4">Emitir boleto</div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '2 1 220px' }}>
            <label className="field__label">Pagador (nome)</label>
            <input className="field__input" value={form.pagadorNome} onChange={(e) => set('pagadorNome', e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div className="field" style={{ flex: '0 1 130px' }}>
            <label className="field__label">Tipo</label>
            <select className="field__input" value={form.pagadorTipoPessoa} onChange={(e) => set('pagadorTipoPessoa', e.target.value)}>
              <option value="1">CPF</option>
              <option value="2">CNPJ</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 180px' }}>
            <label className="field__label">{form.pagadorTipoPessoa === '2' ? 'CNPJ' : 'CPF'}</label>
            <input className="field__input" value={form.pagadorCpfCnpj} onChange={(e) => set('pagadorCpfCnpj', e.target.value)} placeholder="Só números" />
          </div>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '2 1 260px' }}>
            <label className="field__label">Endereço do pagador (opcional)</label>
            <input className="field__input" value={form.pagadorEndereco} onChange={(e) => set('pagadorEndereco', e.target.value)} placeholder="Rua, número, bairro, cidade/UF" />
          </div>
          <div className="field" style={{ flex: '0 1 120px' }}>
            <label className="field__label">CEP</label>
            <input className="field__input" value={form.pagadorCep} onChange={(e) => set('pagadorCep', e.target.value)} placeholder="00000000" />
          </div>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label className="field__label">Nº do documento (opcional)</label>
            <input className="field__input" value={form.seuNumero} onChange={(e) => set('seuNumero', e.target.value)} placeholder="NF / contrato" maxLength={10} />
          </div>
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label className="field__label">Valor (R$)</label>
            <input className="field__input" value={form.valor} onChange={(e) => set('valor', e.target.value)} placeholder="0,00" inputMode="decimal" />
          </div>
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label className="field__label">Vencimento</label>
            <input className="field__input" type="date" value={form.vencimento} onChange={(e) => set('vencimento', e.target.value)} />
          </div>
          <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn--primary" onClick={emitir} disabled={emitindo}>{emitindo ? 'Emitindo…' : 'Emitir boleto'}</button>
          </div>
        </div>
      </div>

      {/* Remessa */}
      <div className="card mb-4 flex-between" style={{ alignItems: 'center' }}>
        <div>
          <div className="font-semibold">Arquivo de remessa</div>
          <div className="text-sm text-secondary">
            {pend && pend.total > 0
              ? `${pend.total} boleto${pend.total > 1 ? 's' : ''} aguardando envio — ${brl(pend.valorCentavos)}`
              : 'Nenhum boleto aguardando remessa'}
          </div>
        </div>
        <button className="btn btn--secondary" onClick={gerarRemessa} disabled={!pend || pend.total === 0}>
          Gerar arquivo de remessa
        </button>
      </div>

      {/* Lista */}
      <div className="card">
        <div className="card__title mb-4">Boletos emitidos</div>
        {loading && <LoadingBlock />}
        {error && <ErrorBlock error={error} />}
        {lista && lista.length === 0 && <p className="text-sm text-secondary">Nenhum boleto emitido ainda.</p>}
        {lista && lista.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Nosso número</th><th>Pagador</th><th className="numeric">Valor</th>
                <th>Vencimento</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((b) => (
                <tr key={b.id}>
                  <td className="text-sm">{b.nossoNumero}</td>
                  <td className="text-sm">{b.pagadorNome}</td>
                  <td className="numeric">{brl(b.valorCentavos)}</td>
                  <td className="text-sm">{dt(b.vencimento)}</td>
                  <td className="text-sm">{STATUS_LABEL[b.status] || b.status}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn--ghost btn--sm" onClick={() => abrirPdf(b.id)}>PDF</button>
                      {b.status !== 'PAGO' && b.status !== 'CANCELADO' && (
                        <>
                          <button className="btn btn--ghost btn--sm" onClick={() => mudarStatus(b.id, 'PAGO')}>Marcar pago</button>
                          <button className="btn btn--ghost btn--sm" onClick={() => mudarStatus(b.id, 'CANCELADO')}>Cancelar</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Config da conta (CEO / Diretor Financeiro) */}
      {podeConfig && cfg && (
        <ConfigConta cfg={cfg} onSave={reloadCfg} />
      )}
    </div>
  );
}

function ConfigConta({ cfg, onSave }: { cfg: any; onSave: () => void }) {
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<any>(cfg);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const salvar = async () => {
    setSalvando(true);
    try { await Api.boletoCobrancaConfigSet(form); toast.success('Conta de cobrança atualizada'); onSave(); }
    catch { toast.error('Erro ao salvar'); }
    finally { setSalvando(false); }
  };
  return (
    <div className="card mt-4">
      <div className="flex-between">
        <div className="card__title">Conta de cobrança (Sicredi)</div>
        <button className="btn btn--ghost btn--sm" onClick={() => setAberto((a) => !a)}>{aberto ? 'Fechar' : 'Editar'}</button>
      </div>
      {!aberto && (
        <p className="text-sm text-secondary">
          Coop {cfg.cooperativa} / posto {cfg.posto} · beneficiário {cfg.cedente} · CNPJ {cfg.cnpj}
        </p>
      )}
      {aberto && (
        <>
          <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
            {[
              ['cooperativa', 'Cooperativa'], ['posto', 'Posto'], ['cedente', 'Beneficiário/convênio'],
              ['byte', 'Byte'], ['cnpj', 'CNPJ (só números)'],
            ].map(([k, label]) => (
              <div className="field" key={k} style={{ flex: '1 1 140px' }}>
                <label className="field__label">{label}</label>
                <input className="field__input" value={form[k] || ''} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
            <div className="field" style={{ flex: '2 1 260px' }}>
              <label className="field__label">Razão social (beneficiário)</label>
              <input className="field__input" value={form.beneficiarioNome || ''} onChange={(e) => set('beneficiarioNome', e.target.value)} />
            </div>
          </div>
          <button className="btn btn--primary btn--sm mt-4" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar conta'}</button>
        </>
      )}
    </div>
  );
}
