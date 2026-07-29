// Config: visibilidade do telefone POR FORMULÁRIO (pedido do Vini).
// Por padrão o telefone do lead fica OCULTO pro corretor (conta de anúncios da
// imobiliária → precisa do template). Aqui o gestor marca os formulários que
// devem MOSTRAR o telefone (ex.: quando o corretor botou a grana dele no anúncio).
import { useState, useEffect } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar title="Telefone por formulário" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Marketing · Telefone por formulário"
          title="Telefone por formulário"
          subtitle="Por padrão o telefone fica OCULTO pro corretor. Marque os formulários que devem MOSTRAR o número (ex.: anúncio pago pelo próprio corretor)."
        />
        {children}
      </div>
    </>
  );
}

export default function TelefoneFormularios() {
  const { data, loading, error } = useApi<{ formularios: any[]; visiveis: string[] }>(() => Api.configTelefoneFormularios());
  const [visiveis, setVisiveis] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();

  useEffect(() => { if (data) setVisiveis(new Set(data.visiveis || [])); }, [data]);

  const toggle = (nome: string) => setVisiveis((cur) => {
    const n = new Set(cur);
    n.has(nome) ? n.delete(nome) : n.add(nome);
    return n;
  });

  const salvar = async () => {
    setSalvando(true);
    try {
      await Api.salvarConfigTelefoneFormularios([...visiveis]);
      toast.success('Configuração salva.');
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setSalvando(false);
    }
  };

  if (loading && !data) return <Shell><LoadingBlock /></Shell>;
  if (error && !data) return <Shell><ErrorBlock error={error} label="Erro ao carregar formulários" /></Shell>;
  const q = busca.trim().toLowerCase();
  const forms = (data?.formularios || []).filter((f) => !q || String(f.nome).toLowerCase().includes(q));

  return (
    <Shell>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="field__input" style={{ maxWidth: 320, margin: 0 }} placeholder="Buscar formulário por nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div style={{ flex: 1 }} />
          <span className="text-xs text-secondary">{visiveis.size} formulário(s) com telefone visível</span>
          <button className="btn btn--primary btn--sm" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
        {forms.length === 0 ? (
          <div className="text-sm text-secondary" style={{ padding: 20 }}>Nenhum formulário encontrado.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {forms.map((f) => {
              const on = visiveis.has(f.nome);
              return (
                <label key={f.nome} className="flex-between" style={{ alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="doc" size={13} /> {f.nome}</div>
                    <div className="text-xs text-secondary">{f.leads} lead(s)</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="text-xs" style={{ color: on ? '#16A34A' : 'var(--text-secondary)', fontWeight: 600 }}>{on ? 'Telefone visível' : 'Telefone oculto'}</span>
                    <input type="checkbox" checked={on} onChange={() => toggle(f.nome)} />
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
