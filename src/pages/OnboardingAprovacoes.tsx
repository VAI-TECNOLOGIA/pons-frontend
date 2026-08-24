// Painel do Financeiro: aprova/reprova a contratação dos colaboradores em
// onboarding (documentação → contrato assinado). Acessível a FINANCEIRO,
// DIRETOR_FINANCEIRO, CEO e DEV (gate no backend por requireRole).
import { useEffect, useState } from 'react';
import { Api } from '../lib/api';

type Pendente = {
  id: number; name: string; email: string; role: string; modalidade: string | null;
  onboardingStatus: string; unidade: { id: number; nome: string } | null; enviadoEm: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE_DOCS: 'Preenchendo documentos',
  AGUARDANDO_APROV_DOCS: 'Documentos para conferir',
  AGUARDANDO_ASSINATURA: 'Assinando contrato',
  AGUARDANDO_APROV_CONTRATO: 'Contrato para conferir',
};
const STATUS_COR: Record<string, string> = {
  PENDENTE_DOCS: '#64748b', AGUARDANDO_APROV_DOCS: '#d97706',
  AGUARDANDO_ASSINATURA: '#64748b', AGUARDANDO_APROV_CONTRATO: '#d97706',
};
const TIPO_LABEL: Record<string, string> = {
  COMPROVANTE_MATRICULA: 'Comprovante de Matrícula', ATESTADO_FREQUENCIA: 'Atestado de Frequência',
  CERTIFICADO_TTI: 'Certificado TTI', CONTRATO_ASSINADO: 'Contrato assinado', OUTRO: 'Outro',
};

export default function OnboardingAprovacoes() {
  const [lista, setLista] = useState<Pendente[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [obs, setObs] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function carregar() {
    setErr('');
    try { setLista(await Api.onbPendentes()); } catch (e: any) { setErr(e?.message || 'Erro'); }
  }
  useEffect(() => { carregar(); }, []);

  async function abrir(id: number) {
    setSelId(id); setObs(''); setErr('');
    try { setSel(await Api.onbDetalhe(id)); } catch (e: any) { setErr(e?.message || 'Erro'); }
  }

  async function decidirDocs(aprovar: boolean) {
    if (selId == null) return;
    setBusy(true); setErr('');
    try { await Api.onbDecisaoDocs(selId, { aprovar, observacao: obs || null }); await abrir(selId); await carregar(); }
    catch (e: any) { setErr(e?.message || 'Erro'); } finally { setBusy(false); }
  }
  async function decidirContrato(aprovar: boolean) {
    if (selId == null) return;
    setBusy(true); setErr('');
    try { await Api.onbDecisaoContrato(selId, { aprovar, observacao: obs || null }); await abrir(selId); await carregar(); }
    catch (e: any) { setErr(e?.message || 'Erro'); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Aprovações de Contratação</h1>
        <p className="muted">Confira documentação e contrato dos novos colaboradores.</p>
      </div>
      {err && <div style={{ color: 'var(--color-danger-fg)', marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, alignItems: 'start' }}>
        {/* Lista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.length === 0 && <p className="muted">Nenhum colaborador em onboarding.</p>}
          {lista.map((p) => (
            <button key={p.id} onClick={() => abrir(p.id)} style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${selId === p.id ? 'var(--pons-blue)' : 'var(--border-light)'}`, background: selId === p.id ? 'var(--color-info-bg)' : 'var(--bg-card)',
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.modalidade || '—'} · {p.unidade?.nome || 'sem filial'}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: STATUS_COR[p.onboardingStatus] || 'var(--text-secondary)', fontWeight: 600 }}>
                {STATUS_LABEL[p.onboardingStatus] || p.onboardingStatus}
              </div>
            </button>
          ))}
        </div>

        {/* Detalhe */}
        <div>
          {!sel ? <p className="muted">Selecione um colaborador.</p> : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 14, padding: 22 }}>
              <h2 style={{ margin: '0 0 4px', color: 'var(--text-primary)' }}>{sel.cadastro?.nome}</h2>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                {sel.cadastro?.email} · {sel.modalidade || '—'} · {sel.cadastro?.unidade?.nome || 'sem filial'}
              </div>

              <Grid dados={[
                ['CPF', sel.cadastro?.cpf], ['CRECI', sel.cadastro?.creci], ['PIX', sel.cadastro?.pix],
                ['Endereço', sel.cadastro?.endereco], ['Estado civil', sel.cadastro?.estadoCivil],
                ['Cônjuge', sel.cadastro?.nomeConjuge], ['Gestor resp.', sel.cadastro?.gestorResp],
                ['Contato 2º', sel.cadastro?.contatoSecNome && `${sel.cadastro.contatoSecNome} ${sel.cadastro.contatoSecCelular || ''}`],
              ]} />

              <h3 style={{ margin: '18px 0 8px', fontSize: 14, color: 'var(--text-primary)' }}>Documentos</h3>
              {sel.documentos?.length ? sel.documentos.map((d: any) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--pons-blue)', textDecoration: 'none' }}>
                    {TIPO_LABEL[d.tipo] || d.tipo}{d.nomeArquivo ? ` — ${d.nomeArquivo}` : ''}
                  </a>
                  <span style={{ fontSize: 12, color: d.status === 'APROVADO' ? 'var(--color-success-fg)' : d.status === 'REPROVADO' ? 'var(--color-danger-fg)' : 'var(--text-secondary)' }}>{d.status}</span>
                </div>
              )) : <p className="muted">Sem documentos anexados.</p>}

              {sel.contrato?.empresaDefinida && (
                <button className="btn btn--secondary btn--sm" style={{ marginTop: 12 }}
                  onClick={() => Api.finPdf(`/onboarding-colaborador/${selId}/contrato.pdf`)}>
                  Baixar contrato preenchido ({sel.contrato.modelo === 'ESTAGIO' ? 'Estágio' : 'Corretor'})
                </button>
              )}

              {(sel.onboardingStatus === 'AGUARDANDO_APROV_DOCS' || sel.onboardingStatus === 'AGUARDANDO_APROV_CONTRATO') && (
                <div style={{ marginTop: 16 }}>
                  <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (obrigatória ao reprovar)"
                    style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--field-bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    {sel.onboardingStatus === 'AGUARDANDO_APROV_DOCS' ? (
                      <>
                        <button disabled={busy} onClick={() => decidirDocs(true)} style={btnOk}>Aprovar documentação</button>
                        <button disabled={busy} onClick={() => decidirDocs(false)} style={btnNo}>Reprovar</button>
                      </>
                    ) : (
                      <>
                        <button disabled={busy} onClick={() => decidirContrato(true)} style={btnOk}>Aprovar contrato e liberar</button>
                        <button disabled={busy} onClick={() => decidirContrato(false)} style={btnNo}>Reprovar</button>
                      </>
                    )}
                  </div>
                </div>
              )}
              {sel.onboardingStatus === 'AGUARDANDO_ASSINATURA' && <p className="muted" style={{ marginTop: 14 }}>Aguardando o colaborador subir o contrato assinado.</p>}
              {sel.onboardingStatus === 'PENDENTE_DOCS' && <p className="muted" style={{ marginTop: 14 }}>Colaborador ainda está preenchendo a documentação.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Grid({ dados }: { dados: [string, any][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {dados.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} style={{ fontSize: 13 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{k}: </span><b style={{ color: 'var(--text-primary)' }}>{v}</b>
        </div>
      ))}
    </div>
  );
}

const btnOk: React.CSSProperties = { padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--color-success)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const btnNo: React.CSSProperties = { padding: '10px 18px', borderRadius: 9, border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--color-danger-fg)', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
