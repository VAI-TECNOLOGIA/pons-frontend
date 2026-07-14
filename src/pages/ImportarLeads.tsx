import { useEffect, useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { Auth } from '../lib/auth';
import { useToast } from '../lib/toast';

// Fase B3 — Big Data Imobiliária: importação CSV/XLSX
export default function ImportarLeads() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [reparando, setReparando] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [baixando, setBaixando] = useState<number | null>(null);
  const [lotes, setLotes] = useState<any[] | null>(null);
  const [limpando, setLimpando] = useState<string | null>(null);
  const isCEO = Auth.user?.role === 'CEO';
  const toast = useToast();

  // Lotes de importação — pra zerar um import inteiro (ex.: import que entrou errado).
  const verLotes = async () => {
    try {
      setLotes(await Api.importLeadsLotes());
    } catch (err: any) {
      toast.error('Erro ao carregar lotes: ' + (err.message || 'falha'));
    }
  };

  // Limpa um lote: 1º dry-run (só conta), confirma com os números, aí apaga.
  const limparLote = async (lote: string, qtd: number) => {
    setLimpando(lote);
    try {
      const dry = await Api.importLeadsLimparLote(lote, false);
      const quando = new Date(lote).toLocaleString('pt-BR');
      const ok = window.confirm(
        `Import de ${quando}\n\n` +
        `• ${dry.noLote} leads no lote\n` +
        `• ${dry.apagaveis} serão APAGADOS\n` +
        `• ${dry.protegidos} protegidos (viraram venda ou têm conversa real)\n\n` +
        `Isso é irreversível. Confirmar a exclusão de ${dry.apagaveis} leads?`,
      );
      if (!ok) { setLimpando(null); return; }
      const r = await Api.importLeadsLimparLote(lote, true);
      toast.success(`${r.apagados} leads apagados (${r.protegidos} protegidos). Pode reimportar limpo agora.`);
      await verLotes();
      carregarHistorico();
    } catch (err: any) {
      toast.error('Erro ao limpar: ' + (err.message || 'falha'));
    } finally {
      setLimpando(null);
    }
    void qtd;
  };

  // Histórico de planilhas já importadas — sempre disponível pra repuxar.
  const carregarHistorico = async () => {
    try {
      setHistorico(await Api.importLeadsArquivos());
    } catch { /* silencioso — histórico é secundário */ }
  };
  useEffect(() => { carregarHistorico(); }, []);

  const baixarArquivo = async (id: number, nome: string) => {
    setBaixando(id);
    try {
      await Api.importLeadsBaixar(id, nome);
    } catch {
      toast.error('Não foi possível baixar o arquivo.');
    } finally {
      setBaixando(null);
    }
  };

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
      carregarHistorico(); // arquivo recém-subido aparece no histórico
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      <Topbar title="Importar Leads" />
      <div className="main__content page-enter">
        <PageHeader
          breadcrumb="Administração · Big Data"
          title="Importar Leads em Massa"
          subtitle="Suba CSV ou Excel. Colunas: nome, telefone, email, cidade, origem, campanha, empreendimento, corretor, status, tags, notas. Telefone é padronizado, duplicados removidos, e colunas com nomes diferentes são mapeadas por IA automaticamente."
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

        {isCEO && (
          <div className="card" style={{ marginBottom: 16, borderColor: 'var(--color-danger, #e5484d)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: lotes ? 12 : 0 }}>
              <div>
                <strong style={{ fontSize: 14 }}>Zerar um import inteiro</strong>
                <div className="text-xs text-secondary">Apaga todos os leads de um import específico pra reimportar do zero. Não toca em leads que viraram venda nem que já têm conversa real.</div>
              </div>
              <button className="btn btn--secondary" onClick={verLotes}>{lotes ? 'Recarregar lotes' : 'Ver lotes importados'}</button>
            </div>
            {lotes && (
              lotes.length === 0 ? (
                <div className="text-xs text-secondary">Nenhum lote de importação encontrado.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Import (data/hora)</th>
                        <th className="text-right">Leads</th>
                        <th className="text-right">Sem produto</th>
                        <th className="text-right">Com corretor</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lotes.map((l) => (
                        <tr key={l.lote}>
                          <td className="text-xs"><strong>{new Date(l.lote).toLocaleString('pt-BR')}</strong></td>
                          <td className="text-right text-xs">{Number(l.qtd).toLocaleString('pt-BR')}</td>
                          <td className="text-right text-xs">{Number(l.semProduto).toLocaleString('pt-BR')}</td>
                          <td className="text-right text-xs">{Number(l.comCorretor).toLocaleString('pt-BR')}</td>
                          <td className="text-right">
                            <button className="btn btn--ghost btn--sm" style={{ color: 'var(--color-danger, #e5484d)' }} onClick={() => limparLote(l.lote, l.qtd)} disabled={limpando === l.lote}>
                              {limpando === l.lote ? 'Limpando…' : 'Zerar este import'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

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
          <div className="card fade-in" style={{ marginTop: 16 }}>
            {/* Hero: número grande de criados + métricas inline */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Importação concluída</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 700, color: 'var(--color-success)', lineHeight: 1.05 }}>
                  {Number(resultado.criados).toLocaleString('pt-BR')}
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 8 }}>leads criados</span>
                </div>
              </div>
              <div className="stagger" style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Pill label="Recebidos" value={resultado.recebidos} />
                <Pill label="Distribuídos" value={resultado.distribuidos} cor="var(--color-success)" />
                <Pill label="No bolsão" value={resultado.bolsao} cor="var(--blue-500)" />
                <Pill label="Duplicados" value={resultado.duplicados} cor="var(--color-warning)" />
                <Pill label="Erros" value={resultado.erros} cor="var(--color-danger)" />
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border-light)', margin: '18px 0' }} />

            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>Tratamento da base</div>
            <div className="stagger" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Pill label="Sem telefone" value={resultado.semTelefone ?? 0} cor="var(--color-warning)" />
              <Pill label="Telefone inválido" value={resultado.telefoneInvalido ?? 0} cor="var(--color-warning)" />
              <Pill label="Sem e-mail" value={resultado.semEmail ?? 0} cor="var(--color-warning)" />
              <Pill label="Sem cidade" value={resultado.semCidade ?? 0} cor="var(--color-warning)" />
              <Pill label="Com empreendimento" value={resultado.comEmpreendimento ?? 0} cor="var(--color-success)" />
              <Pill label="Com corretor" value={resultado.comCorretor ?? 0} cor="var(--color-success)" />
              <Pill label="Campos custom" value={resultado.camposCustom ?? 0} cor="var(--blue-500)" />
            </div>

            {resultado.mapeamentoIA && Object.keys(resultado.mapeamentoIA).length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="sparkles" size={14} /> Colunas mapeadas por IA
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(resultado.mapeamentoIA).map(([h, c]: any) => (
                    <span key={h} className="map-chip"><span style={{ opacity: 0.75 }}>{h}</span><Icon name="arrow_right" size={12} /><strong>{c}</strong></span>
                  ))}
                </div>
              </div>
            )}

            {resultado.erros > 0 && resultado.erros_lista?.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Primeiros erros</div>
                <ul style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, paddingLeft: 18 }}>
                  {resultado.erros_lista.slice(0, 5).map((e: any, i: number) => <li key={i}>{e.err} — {JSON.stringify(e.row).slice(0, 80)}…</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {historico.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="doc" size={16} />
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Arquivos importados</h4>
              <span className="text-xs text-secondary" style={{ marginLeft: 'auto' }}>{historico.length} arquivo(s) guardados</span>
            </div>
            <div className="text-xs text-secondary" style={{ marginBottom: 12 }}>
              Toda planilha subida fica guardada aqui — baixe o original quando quiser conferir ou reimportar.
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Arquivo</th>
                    <th>Data</th>
                    <th>Quem subiu</th>
                    <th className="text-right">Linhas</th>
                    <th className="text-right">Criados</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id}>
                      <td><strong style={{ fontSize: 13 }}>{h.nomeArquivo}</strong>{h.tamanho ? <span className="text-xs text-secondary"> · {(h.tamanho / 1024).toFixed(0)} KB</span> : null}</td>
                      <td className="text-xs">{new Date(h.createdAt).toLocaleString('pt-BR')}</td>
                      <td className="text-xs">{h.userNome || '—'}</td>
                      <td className="text-right text-xs">{h.totalLinhas != null ? Number(h.totalLinhas).toLocaleString('pt-BR') : '—'}</td>
                      <td className="text-right text-xs">{h.stats?.criados != null ? Number(h.stats.criados).toLocaleString('pt-BR') : '—'}</td>
                      <td className="text-right">
                        {h.temArquivo ? (
                          <button className="btn btn--ghost btn--sm" onClick={() => baixarArquivo(h.id, h.nomeArquivo)} disabled={baixando === h.id}>
                            {baixando === h.id ? 'Baixando…' : <><Icon name="arrow_down" size={12} /> Baixar</>}
                          </button>
                        ) : <span className="text-xs text-secondary">indisponível</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          <div className="text-xs text-secondary">Origens válidas: META_ADS, GOOGLE, SITE, INDICACAO, WHATSAPP, MANUAL, IMPORTACAO · Status: NOVO, NAO_RESPONDE, LISTA_VIP, EM_ATENDIMENTO, FLUXO, POS_FLUXO, VISITA, NEGOCIANDO, FECHADO, PERDIDO · Tags separadas por <code>;</code></div>
        </div>
      </div>
    </>
  );
}

function Pill({ label, value, cor }: { label: string; value: any; cor?: string }) {
  return (
    <div className="metric-pill">
      <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: cor || 'var(--text-primary)', lineHeight: 1 }}>
        {Number(value ?? 0).toLocaleString('pt-BR')}
      </span>
      <span className="text-xs text-secondary">{label}</span>
    </div>
  );
}
