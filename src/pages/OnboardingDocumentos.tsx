// Tela de onboarding de contratação (gating). O colaborador recém-cadastrado
// fica preso aqui (sem sidebar) até concluir documentação + contrato assinado e
// o Financeiro aprovar. Standalone — faz o próprio check de token.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Api } from '../lib/api';
import { Auth } from '../lib/auth';

type Doc = { id: number; tipo: string; url: string; nomeArquivo?: string; status: string; observacao?: string };
type Empresa = { razaoSocial: string; cnpj: string; creci: string; endereco: string };
type Estado = {
  onboardingStatus: string | null;
  modalidade: string | null;
  cadastro: any;
  documentos: Doc[];
  contrato: { modelo: string | null; empresa: Empresa | null; empresaDefinida: boolean; representante: any };
};

const TIPO_LABEL: Record<string, string> = {
  COMPROVANTE_MATRICULA: 'Comprovante de Matrícula',
  ATESTADO_FREQUENCIA: 'Atestado de Frequência',
  CERTIFICADO_TTI: 'Certificado TTI',
  CONTRATO_ASSINADO: 'Contrato assinado',
  OUTRO: 'Outro documento',
};

const C = {
  navy: 'var(--text-primary)', blue: 'var(--pons-blue)', bg: 'var(--bg-app)', chip: 'var(--bg-elevated)', card: 'var(--bg-card)',
  border: 'var(--border-light)', text: 'var(--text-primary)', muted: 'var(--text-secondary)',
  ok: 'var(--color-success-fg)', warn: 'var(--color-warning-fg)', err: 'var(--color-danger-fg)',
};

export default function OnboardingDocumentos() {
  const nav = useNavigate();
  const [st, setSt] = useState<Estado | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState<any>({});

  if (!Auth.token) return <Navigate to="/login" replace />;

  async function load() {
    try {
      const data = await Api.onbMe();
      setSt(data);
      setForm({
        modalidade: data.modalidade || '',
        cpf: data.cadastro?.cpf || '',
        naturalidade: data.cadastro?.naturalidade || '',
        endereco: data.cadastro?.endereco || '',
        pix: data.cadastro?.pix || '',
        creci: data.cadastro?.creci || '',
        estadoCivil: data.cadastro?.estadoCivil || '',
        nomeConjuge: data.cadastro?.nomeConjuge || '',
        contatoSecNome: data.cadastro?.contatoSecNome || '',
        contatoSecCelular: data.cadastro?.contatoSecCelular || '',
        gestorResp: data.cadastro?.gestorResp || '',
      });
    } catch (e: any) {
      setErr(e?.message || 'Erro ao carregar');
    }
  }
  useEffect(() => { load(); }, []);

  // Se já está ATIVO (ou sem gating), não deveria estar aqui.
  if (st && (!st.onboardingStatus || st.onboardingStatus === 'ATIVO')) {
    const u = Auth.user; if (u) Auth.set(Auth.token!, { ...u, onboardingStatus: 'ATIVO' });
    return <Navigate to="/dashboard" replace />;
  }

  const set = (k: string, v: string) => setForm((p: any) => ({ ...p, [k]: v }));

  async function salvarCadastro() {
    setBusy(true); setErr(''); setMsg('');
    try { const d = await Api.onbSaveCadastro(form); setSt(d); setMsg('Dados salvos.'); }
    catch (e: any) { setErr(e?.message || 'Erro ao salvar'); }
    finally { setBusy(false); }
  }

  async function anexar(tipo: string, file: File) {
    setBusy(true); setErr(''); setMsg('');
    try {
      const up = await Api.uploadDocumento(file);
      await Api.onbAddDoc({ tipo, url: up.url, key: up.key, nomeArquivo: file.name, mimeType: up.contentType, tamanho: up.size });
      await load(); setMsg('Documento anexado.');
    } catch (e: any) { setErr(e?.message || 'Erro no upload'); }
    finally { setBusy(false); }
  }

  async function removerDoc(id: number) {
    setBusy(true); setErr('');
    try { await Api.onbDeleteDoc(id); await load(); } catch (e: any) { setErr(e?.message || 'Erro'); }
    finally { setBusy(false); }
  }

  async function enviarDocs() {
    setBusy(true); setErr(''); setMsg('');
    try {
      await Api.onbSaveCadastro(form);
      const d = await Api.onbEnviar();
      setSt(d);
      const u = Auth.user; if (u) Auth.set(Auth.token!, { ...u, onboardingStatus: d.onboardingStatus });
    } catch (e: any) { setErr(e?.message || 'Não foi possível enviar'); }
    finally { setBusy(false); }
  }

  async function enviarContrato(file: File) {
    setBusy(true); setErr(''); setMsg('');
    try {
      const up = await Api.uploadDocumento(file);
      const d = await Api.onbContratoAssinado({ url: up.url, key: up.key, nomeArquivo: file.name, mimeType: up.contentType, tamanho: up.size });
      setSt(d);
      const u = Auth.user; if (u) Auth.set(Auth.token!, { ...u, onboardingStatus: d.onboardingStatus });
    } catch (e: any) { setErr(e?.message || 'Erro ao enviar contrato'); }
    finally { setBusy(false); }
  }

  function sair() { Auth.clear(); nav('/login', { replace: true }); }

  if (!st) {
    return <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center' }}>{err ? <p style={{ color: C.err }}>{err}</p> : <p style={{ color: C.muted }}>Carregando…</p>}</div>;
  }

  const status = st.onboardingStatus;
  const isEstagiario = form.modalidade === 'ESTAGIARIO';
  const isCorretor = form.modalidade === 'CORRETOR';
  const docsMatricula = st.documentos.filter((d) => ['COMPROVANTE_MATRICULA', 'ATESTADO_FREQUENCIA'].includes(d.tipo));
  const contratoAssinado = st.documentos.find((d) => d.tipo === 'CONTRATO_ASSINADO');

  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, color: C.muted }}>Grupo Pons · Contratação</div>
            <h1 style={{ margin: '2px 0 0', fontSize: 22, color: C.navy }}>Olá, {st.cadastro?.nome?.split(' ')[0] || ''}</h1>
          </div>
          <button onClick={sair} style={btnGhost}>Sair</button>
        </header>

        <Stepper status={status} />

        {err && <div style={alert(C.err)}>{err}</div>}
        {msg && <div style={alert(C.ok)}>{msg}</div>}

        {/* PASSO 1 — Documentação */}
        {(status === 'PENDENTE_DOCS') && (
          <div style={card}>
            <h2 style={h2}>1. Sua documentação</h2>
            <p style={pMuted}>Preencha seus dados e anexe os documentos. Depois envie para o Financeiro conferir.</p>

            <label style={lbl}>Você está entrando como</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <Radio checked={isEstagiario} onClick={() => set('modalidade', 'ESTAGIARIO')} label="Estagiário (cursando TTI)" />
              <Radio checked={isCorretor} onClick={() => set('modalidade', 'CORRETOR')} label="Corretor (com CRECI)" />
            </div>

            <div style={grid2}>
              <Field label="CPF" v={form.cpf} on={(v) => set('cpf', v)} />
              <Field label="Naturalidade" v={form.naturalidade} on={(v) => set('naturalidade', v)} />
              <Field label="Endereço completo (c/ CEP)" v={form.endereco} on={(v) => set('endereco', v)} full />
              <Field label="Chave PIX" v={form.pix} on={(v) => set('pix', v)} />
              <Field label={isCorretor ? 'CRECI (obrigatório)' : 'CRECI (se tiver)'} v={form.creci} on={(v) => set('creci', v)} />
              <Field label="Estado civil" v={form.estadoCivil} on={(v) => set('estadoCivil', v)} />
              <Field label="Nome do cônjuge/companheiro(a)" v={form.nomeConjuge} on={(v) => set('nomeConjuge', v)} />
              <Field label="Gestor responsável" v={form.gestorResp} on={(v) => set('gestorResp', v)} />
              <Field label="Contato secundário (nome)" v={form.contatoSecNome} on={(v) => set('contatoSecNome', v)} />
              <Field label="Contato secundário (celular)" v={form.contatoSecCelular} on={(v) => set('contatoSecCelular', v)} />
            </div>

            {isEstagiario && (
              <div style={{ marginTop: 16 }}>
                <label style={lbl}>Comprovante de Matrícula ou Atestado de Frequência (exigência CRECI)</label>
                <DocList docs={docsMatricula} onRemove={removerDoc} busy={busy} />
                <UploadBtn label="Anexar comprovante" busy={busy} onFile={(f) => anexar('COMPROVANTE_MATRICULA', f)} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={salvarCadastro} disabled={busy} style={btnGhost}>Salvar rascunho</button>
              <button onClick={enviarDocs} disabled={busy} style={btnPrimary}>Enviar para aprovação</button>
            </div>
          </div>
        )}

        {/* PASSO 2 — Aguardando aprovação dos docs */}
        {status === 'AGUARDANDO_APROV_DOCS' && (
          <Aviso titulo="Documentação em análise" cor={C.warn}
            texto="Seus dados e documentos foram enviados. O Financeiro vai conferir e liberar o contrato para assinatura. Você será avisado." />
        )}

        {/* PASSO 3 — Contrato para assinar */}
        {status === 'AGUARDANDO_ASSINATURA' && (
          <div style={card}>
            <h2 style={h2}>2. Assine seu contrato</h2>
            {st.contrato.empresaDefinida && st.contrato.empresa ? (
              <div style={{ background: C.chip, borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 14 }}>
                <div style={{ fontWeight: 700, color: C.navy }}>
                  {st.contrato.modelo === 'ESTAGIO' ? 'Contrato de Estágio' : 'Contrato de Corretor'}
                </div>
                <div style={{ color: C.muted, marginTop: 4 }}>{st.contrato.empresa.razaoSocial}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>CNPJ {st.contrato.empresa.cnpj} · {st.contrato.empresa.creci}</div>
                <button
                  onClick={() => Api.finPdf('/onboarding-colaborador/me/contrato.pdf')}
                  style={{ marginTop: 12, background: C.blue, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Baixar contrato preenchido
                </button>
              </div>
            ) : (
              <p style={pMuted}>O Financeiro vai te enviar o contrato correto. Assine e faça o upload do PDF assinado abaixo.</p>
            )}
            <p style={pMuted}>Baixe o contrato preenchido acima, assine e suba o PDF assinado aqui.</p>
            {contratoAssinado && <DocList docs={[contratoAssinado]} onRemove={() => {}} busy />}
            <UploadBtn label="Enviar contrato assinado (PDF)" busy={busy} onFile={enviarContrato} />
          </div>
        )}

        {/* PASSO 4 — Aguardando aprovação do contrato */}
        {status === 'AGUARDANDO_APROV_CONTRATO' && (
          <Aviso titulo="Contrato em análise" cor={C.warn}
            texto="Recebemos seu contrato assinado. Assim que o Financeiro aprovar, seu acesso ao sistema será liberado." />
        )}
      </div>
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────
function Stepper({ status }: { status: string | null }) {
  const steps = ['Documentos', 'Análise', 'Contrato', 'Liberado'];
  const idx = status === 'PENDENTE_DOCS' ? 0
    : status === 'AGUARDANDO_APROV_DOCS' ? 1
    : status === 'AGUARDANDO_ASSINATURA' ? 2
    : status === 'AGUARDANDO_APROV_CONTRATO' ? 3 : 4;
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ height: 4, borderRadius: 2, background: i <= idx ? C.blue : C.border }} />
          <div style={{ fontSize: 11, marginTop: 6, color: i <= idx ? C.navy : C.muted, fontWeight: i === idx ? 700 : 400 }}>{s}</div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, v, on, full }: { label: string; v: string; on: (v: string) => void; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={lbl}>{label}</label>
      <input value={v || ''} onChange={(e) => on(e.target.value)} style={input} />
    </div>
  );
}

function Radio({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
      border: `2px solid ${checked ? C.blue : C.border}`, background: checked ? 'var(--color-info-bg)' : C.card,
      color: checked ? C.navy : C.text, fontWeight: checked ? 700 : 500, fontSize: 14,
    }}>{label}</button>
  );
}

function DocList({ docs, onRemove, busy }: { docs: Doc[]; onRemove: (id: number) => void; busy: boolean }) {
  if (!docs.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
      {docs.map((d) => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.chip, borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
          <a href={d.url} target="_blank" rel="noreferrer" style={{ color: C.blue, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {TIPO_LABEL[d.tipo] || d.tipo}{d.nomeArquivo ? ` — ${d.nomeArquivo}` : ''}
          </a>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: d.status === 'APROVADO' ? C.ok : d.status === 'REPROVADO' ? C.err : C.muted, fontSize: 12 }}>{d.status}</span>
            {d.status === 'PENDENTE' && <button onClick={() => onRemove(d.id)} disabled={busy} style={{ ...btnGhost, padding: '2px 8px', fontSize: 12 }}>remover</button>}
          </span>
        </div>
      ))}
    </div>
  );
}

function UploadBtn({ label, busy, onFile }: { label: string; busy: boolean; onFile: (f: File) => void }) {
  return (
    <label style={{ ...btnGhost, display: 'inline-block', marginTop: 8, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
      {label}
      <input type="file" accept="application/pdf,image/*" disabled={busy} style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ''; }} />
    </label>
  );
}

function Aviso({ titulo, texto, cor }: { titulo: string; texto: string; cor: string }) {
  return (
    <div style={{ ...card, borderLeft: `4px solid ${cor}` }}>
      <h2 style={{ ...h2, color: cor }}>{titulo}</h2>
      <p style={pMuted}>{texto}</p>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const wrap: React.CSSProperties = { minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' };
const card: React.CSSProperties = { background: C.card, borderRadius: 14, padding: 22, border: `1px solid ${C.border}`, boxShadow: '0 4px 24px rgba(11,37,69,.06)' };
const h2: React.CSSProperties = { margin: '0 0 6px', fontSize: 17, color: C.navy };
const pMuted: React.CSSProperties = { margin: '0 0 12px', color: C.muted, fontSize: 14, lineHeight: 1.5 };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, margin: '0 0 4px' };
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--field-bg)', color: C.text, fontSize: 14, boxSizing: 'border-box' };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const btnPrimary: React.CSSProperties = { padding: '11px 20px', borderRadius: 9, border: 'none', background: C.blue, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '11px 16px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const alert = (cor: string): React.CSSProperties => ({ background: cor === C.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: cor, border: `1px solid ${cor === C.ok ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`, borderRadius: 9, padding: '10px 14px', fontSize: 14, marginBottom: 14 });
