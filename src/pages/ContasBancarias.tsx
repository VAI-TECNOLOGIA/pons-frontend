import { useState, useEffect } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';

// Cadastro das contas bancárias por empresa/CNPJ. O protocolo da venda mostra a
// conta conforme a unidade (empresa) do corretor. Cresce conforme a rede.
export default function ContasBancarias() {
  const { data, loading, error, reload } = useApi<any[]>(() => Api.contasBancarias());
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  useEffect(() => { if (data) setRows(data); }, [data]);

  const setField = (key: string, campo: string, valor: string) =>
    setRows((cur) => cur.map((r) => (r.empresaKey === key ? { ...r, [campo]: valor } : r)));

  const salvar = async (row: any) => {
    setSavingKey(row.empresaKey);
    try {
      await Api.contaBancariaSave(row.empresaKey, {
        razaoSocial: row.razaoSocial, cnpj: row.cnpj, banco: row.banco,
        agencia: row.agencia, conta: row.conta, pix: row.pix,
      });
      toast.success(`Conta de ${row.razaoSocial} salva.`);
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível salvar.');
    } finally {
      setSavingKey(null);
    }
  };

  const novaEmpresa = () => {
    const key = prompt('Chave da empresa (ex.: MATRIZ, SEGUNDA_AVENIDA, ou uma nova):');
    if (!key) return;
    const k = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (rows.some((r) => r.empresaKey === k)) { toast.info('Essa empresa já está na lista.'); return; }
    setRows((cur) => [...cur, { empresaKey: k, razaoSocial: '', cnpj: '', banco: '', agencia: '', conta: '', pix: '' }]);
  };

  return (
    <>
      <Topbar title="Contas Bancárias" right={<button className="btn btn--secondary btn--sm" onClick={novaEmpresa}>+ Empresa</button>} />
      <div className="main__content">
        <PageHeader breadcrumb="Financeiro · Contas Bancárias" title="Contas por empresa / CNPJ" subtitle="A conta que aparece no protocolo da venda é a da unidade (empresa) do corretor titular." />
        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : (
          <div style={{ display: 'grid', gap: 14 }}>
            {rows.map((row) => (
              <div key={row.empresaKey} className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>{row.empresaKey}</div>
                <div className="form-grid">
                  <div className="field field--span-2"><label className="field__label">Razão social</label><input className="field__input" value={row.razaoSocial || ''} onChange={(e) => setField(row.empresaKey, 'razaoSocial', e.target.value)} /></div>
                  <div className="field"><label className="field__label">CNPJ</label><input className="field__input" value={row.cnpj || ''} onChange={(e) => setField(row.empresaKey, 'cnpj', e.target.value)} /></div>
                  <div className="field"><label className="field__label">Banco</label><input className="field__input" placeholder="Sicredi (748)" value={row.banco || ''} onChange={(e) => setField(row.empresaKey, 'banco', e.target.value)} /></div>
                  <div className="field"><label className="field__label">Agência</label><input className="field__input" value={row.agencia || ''} onChange={(e) => setField(row.empresaKey, 'agencia', e.target.value)} /></div>
                  <div className="field"><label className="field__label">Conta</label><input className="field__input" value={row.conta || ''} onChange={(e) => setField(row.empresaKey, 'conta', e.target.value)} /></div>
                  <div className="field field--span-2"><label className="field__label">PIX</label><input className="field__input" value={row.pix || ''} onChange={(e) => setField(row.empresaKey, 'pix', e.target.value)} /></div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <button className="btn btn--primary btn--sm" onClick={() => salvar(row)} disabled={savingKey === row.empresaKey}>{savingKey === row.empresaKey ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
