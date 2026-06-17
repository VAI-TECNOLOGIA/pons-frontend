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
      {err && <div style={{ color: '#dc2626', marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, alignItems: 'start' }}>
        {/* Lista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.length === 0 && <p className="muted">Nenhum colaborador em onboarding.</p>}
          {lista.map((p) => (
            <button key={p.id} onClick={() => abrir(p.id)} style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${selId === p.id ? '#1258CA' : '#e2e8f0'}`, background: selId === p.id ? '#eef4ff' : '#fff',
            }}>
              <div style={{ fontWeight: 700, color: '#0b2545' }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{p.modalidade || '—'} · {p.unidade?.nome || 'sem filial'}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: STATUS_COR[p.onboardingStatus] || '#64748b', fontWeight: 600 }}>
                {STATUS_LABEL[p.onboardingStatus] || p.onboardingStatus}
              </div>
            </button>
          ))}
        </div>

        {/* Detalhe */}
        <div>
          {!sel ? <p className="muted">Selecione um colaborador.</p> : (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 22 }}>
              <h2 style={{ margin: '0 0 4px', color: '#0b2545' }}>{sel.cadastro?.nome}</h2>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                {sel.cadastro?.email} · {sel.modalidade || '—'} · {sel.cadastro?.unidade?.nome || 'sem filial'}
              </div>

              <Grid dados={[
                ['CPF', sel.cadastro?.cpf], ['CRECI', sel.cadastro?.creci], ['PIX', sel.cadastro?.pix],
                ['Endereço', sel.cadastro?.endereco], ['Estado civil', sel.cadastro?.estadoCivil],
                ['Cônjuge', sel.cadastro?.nomeConjuge], ['Gestor resp.', sel.cadastro?.gestorResp],
                ['Contato 2º', sel.cadastro?.contatoSecNome && `${sel.cadastro.contatoSecNome} ${sel.cadastro.contatoSecCelular || ''}`],
              ]} />

              <h3 style={{ margin: '18px 0 8px', fontSize: 14, color: '#0b2545' }}>Documentos</h3>
              {sel.documentos?.length ? sel.documentos.map((d: any) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f4f6fb', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: '#1258CA', textDecoration: 'none' }}>
                    {TIPO_LABEL[d.tipo] || d.tipo}{d.nomeArquivo ? ` — ${d.nomeArquivo}` : ''}
                  </a>
                  <span style={{ fontSize: 12, color: d.status === 'APROVADO' ? '#16a34a' : d.status === 'REPROVADO' ? '#dc2626' : '#64748b' }}>{d.status}</span>
                </div>
              )) : <p className="muted">Sem documentos anexados.</p>}

              {(sel.onboardingStatus === 'AGUARDANDO_APROV_DOCS' || sel.onboardingStatus === 'AGUARDANDO_APROV_CONTRATO') && (
                <div style={{ marginTop: 16 }}>
                  <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (obrigatória ao reprovar)"
                    style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
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
          <span style={{ color: '#64748b' }}>{k}: </span><b style={{ color: '#1e293b' }}>{v}</b>
        </div>
      ))}
    </div>
  );
}

const btnOk: React.CSSProperties = { padding: '10px 18px', borderRadius: 9, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const btnNo: React.CSSProperties = { padding: '10px 18px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#dc2626', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
