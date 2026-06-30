import { useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useToast } from '../lib/toast';

// Fase B3 — Big Data Imobiliária: importação CSV/XLSX
export default function ImportarLeads() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [reparando, setReparando] = useState(false);
  const toast = useToast();

  // Conserta leads importados em versões antigas que ficaram sem mensagem e por
  // isso não apareciam no Atendimento/bolsão. Idempotente — pode rodar à vontade.
  const repararBolsao = async () => {
    setReparando(true);
    try {
      const r = await Api.importLeadsReparar();
      toast.success(`Reparados ${r.reparados} leads (agora aparecem no Atendimento/bolsão)${r.normalizados ? ` · ${r.normalizados} status corrigidos` : ''}.`);
    } catch (err: any) {
      toast.error('Erro ao reparar: ' + (err.message || 'falha'));
    } finally {
      setReparando(false);
    }
  };

  const escolherArquivo = () => fileRef.current?.click();

  const trocarArquivo = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setResultado(null);
  };

  const fazerPreview = async () => {
    if (!file) return;
    setCarregando(true);
    try {
      const r = await Api.importLeadsPreview(file);
      setPreview(r);
    } catch (err: any) {
      toast.error('Preview falhou: ' + (err.message || 'erro'));
    } finally {
      setCarregando(false);
    }
  };

  const executar = async () => {
    if (!file) return;
    setCarregando(true);
    try {
      const r = await Api.importLeadsExecutar(file);
      setResultado(r);
      toast.success(`${r.criados} criados (${r.distribuidos} na roleta · ${r.bolsao} no bolsão), ${r.duplicados} duplicados, ${r.erros} erros`);
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      <Topbar title="Importar Leads" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Administração · Big Data"
          title="Importar Leads em Massa"
          subtitle="Suba CSV ou Excel. Colunas aceitas: nome, telefone, email, origem, campanha, status, tags, notas. Tags são inferidas automaticamente quando ausentes."
        />

        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: 14 }}>Leads importados não aparecem no Atendimento / bolsão?</strong>
            <div className="text-xs text-secondary">Conserta os leads importados que ficaram sem mensagem inicial — eles voltam a aparecer e ficam distribuíveis. Pode rodar quantas vezes quiser.</div>
          </div>
          <button className="btn btn--secondary" onClick={repararBolsao} disabled={reparando}>
            {reparando ? 'Reparando…' : 'Reparar leads importados'}
          </button>
        </div>

        <div className="card">
          <div style={{ border: '2px dashed var(--border-light)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <Icon name="users" size={40} />
            <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
              {file ? <strong>{file.name}</strong> : 'Nenhum arquivo selecionado'}
            </div>
            <div className="flex" style={{ gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className="btn btn--primary" onClick={escolherArquivo}>Escolher arquivo</button>
              {file && <button className="btn btn--secondary" onClick={() => trocarArquivo(null)}>Remover</button>}
              {file && <button className="btn btn--ghost" onClick={fazerPreview} disabled={carregando}>{carregando ? 'Carregando…' : 'Preview'}</button>}
              {file && preview && <button className="btn btn--primary" onClick={executar} disabled={carregando}>{carregando ? 'Importando…' : `Importar ${preview.total}`}</button>}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              hidden
              onChange={(e) => trocarArquivo(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        {preview && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Pré-visualização ({preview.total} linhas detectadas)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>{(preview.headers || []).map((h: string) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(preview.sample || []).map((row: any, i: number) => (
                    <tr key={i}>
                      {(preview.headers || []).map((h: string) => <td key={h} className="text-xs">{String(row[h] || '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-secondary" style={{ marginTop: 8 }}>Mostrando os primeiros 5 registros. Aperte "Importar" pra processar o arquivo completo.</div>
          </div>
        )}

        {resultado && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Resultado da importação</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <Stat label="Recebidos" value={resultado.recebidos} />
              <Stat label="Criados" value={resultado.criados} cor="var(--color-success)" />
              <Stat label="Distribuídos" value={resultado.distribuidos} cor="var(--color-success)" />
              <Stat label="No bolsão" value={resultado.bolsao} cor="var(--color-warning)" />
              <Stat label="Duplicados" value={resultado.duplicados} cor="var(--color-warning)" />
              <Stat label="Erros" value={resultado.erros} cor="var(--color-danger)" />
            </div>
            {resultado.erros > 0 && resultado.erros_lista?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700 }}>Primeiros erros:</h4>
                <ul style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {resultado.erros_lista.slice(0, 5).map((e: any, i: number) => <li key={i}>{e.err} — {JSON.stringify(e.row).slice(0, 80)}…</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="card" style={{ marginTop: 16, background: 'var(--bg-elevated)' }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="doc" size={14} /> Formato esperado
          </h4>
          <pre style={{ fontSize: 11, fontFamily: 'monospace', overflow: 'auto', background: 'var(--bg-card)', padding: 10, borderRadius: 6 }}>
{`nome,telefone,email,origem,campanha,status,tags,notas
João Silva,+55 47 99999-1111,joao@email.com,META_ADS,Verão 2026,NOVO,investidor;quente,Quer 2 dorms
Maria Costa,(47) 98888-2222,maria@email.com,SITE,,NEGOCIANDO,,
`}
          </pre>
          <div className="text-xs text-secondary">Origens válidas: META_ADS, GOOGLE, SITE, INDICACAO, WHATSAPP, MANUAL, IMPORTACAO · Status: NOVO, SDR, NEGOCIANDO, PROPOSTA, FECHADO, PERDIDO · Tags separadas por <code>;</code></div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, cor }: { label: string; value: any; cor?: string }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="text-xs text-secondary">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{value}</div>
    </div>
  );
}
