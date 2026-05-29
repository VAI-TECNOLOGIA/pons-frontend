import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';

// Fase F2 — Verificação Meta Premium (checklist)
export default function MetaVerificacao() {
  const [url, setUrl] = useState('https://grupopons.com.br');
  const [cnpj, setCnpj] = useState('');
  const [razao, setRazao] = useState('Grupo Pons Imobiliário');
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const toast = useToast();

  const { data: ultima } = useApi<any>(() => Api.metaAuditoriaUltima());

  const auditar = async () => {
    setCarregando(true);
    try {
      const r = await Api.metaAuditar(url, cnpj || undefined, razao || undefined);
      setResultado(r);
      toast.success(`Auditoria concluída: ${r.auditoria.totais.aprovados}/${r.auditoria.totais.total} itens OK`);
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      <Topbar title="Verificação Meta Premium" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Marketing · Conformidade"
          title="Verificação Meta Premium"
          subtitle="Audita seu site contra checklist da Meta — quanto mais OK, maior os limites e menor risco de bloqueio."
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">URL do site *</label>
              <input className="field__input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://grupopons.com.br" />
            </div>
            <div className="field">
              <label className="field__label">CNPJ (pra match)</label>
              <input className="field__input" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
            </div>
            <div className="field">
              <label className="field__label">Razão social (pra match)</label>
              <input className="field__input" value={razao} onChange={(e) => setRazao(e.target.value)} placeholder="Grupo Pons Imobiliário Ltda" />
            </div>
          </div>
          <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn--primary" onClick={auditar} disabled={carregando || !url}>
              {carregando ? 'Auditando…' : 'Rodar auditoria'}
            </button>
          </div>
        </div>

        {ultima && !resultado && (
          <div className="card" style={{ marginBottom: 16, background: 'var(--bg-elevated)' }}>
            <div className="text-xs text-secondary">Última auditoria: {ultima.executadoEm && new Date(ultima.executadoEm).toLocaleString('pt-BR')}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{ultima.url}</div>
            <div>{ultima.aprovados}/{ultima.total} itens OK ({ultima.percentual}%)</div>
          </div>
        )}

        {resultado && (
          <>
            <div className="card" style={{ marginBottom: 16, background: resultado.auditoria.totais.percentual >= 80 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)' }}>
              <div className="flex-between">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Resultado da auditoria</div>
                  <div className="text-xs text-secondary">{resultado.url}</div>
                </div>
                <div style={{ fontSize: 32, fontWeight: 900 }}>{resultado.auditoria.totais.percentual}%</div>
              </div>
              <div className="text-sm" style={{ marginTop: 6 }}>{resultado.auditoria.totais.aprovados} de {resultado.auditoria.totais.total} itens aprovados</div>
              {cnpj && resultado.auditoria.cnpjBate != null && (
                <div className="text-xs" style={{ marginTop: 4 }}>
                  CNPJ {resultado.auditoria.cnpjBate ? '✅ bate' : '❌ não bate'} com o do site
                </div>
              )}
              {razao && resultado.auditoria.razaoSocialBate != null && (
                <div className="text-xs">Razão social {resultado.auditoria.razaoSocialBate ? '✅ bate' : '❌ não bate'} com o do site</div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Checklist</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {resultado.auditoria.itens.map((item: any) => (
                  <div key={item.chave} style={{
                    padding: 10,
                    borderRadius: 6,
                    background: item.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <Icon name={item.ok ? 'checkCircle' : 'x'} size={20} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{item.titulo}</div>
                      {item.detalhe && <div className="text-xs text-secondary">{item.detalhe}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {resultado.auditoria.snippetRodape && (
              <div className="card">
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📋 Snippet sugerido pro rodapé</h3>
                <div className="text-xs text-secondary" style={{ marginBottom: 8 }}>Cole isso no rodapé do site grupopons.com.br pra subir o score (não é nosso escopo de dev — peça pra equipe de site).</div>
                <pre style={{ fontSize: 11, fontFamily: 'monospace', background: 'var(--bg-elevated)', padding: 12, borderRadius: 6, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
{resultado.auditoria.snippetRodape}
                </pre>
                <button className="btn btn--secondary btn--sm" style={{ marginTop: 8 }} onClick={() => {
                  navigator.clipboard.writeText(resultado.auditoria.snippetRodape);
                  toast.success('Snippet copiado');
                }}>Copiar</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
