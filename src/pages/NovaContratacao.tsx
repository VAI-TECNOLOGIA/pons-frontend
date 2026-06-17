// LP pública de NOVA CONTRATAÇÃO (corretor/estagiário). Cria o login do
// candidato já em onboarding e, no sucesso, autentica e leva para /onboarding
// (onde ele completa documentação + contrato). Rota pública, sem auth.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Api } from '../lib/api';
import { Auth } from '../lib/auth';

const EQUIPES = ['GPI DELAS BC', 'GPI BC', 'GPI 2ª AVENIDA', 'GPI DALLO 703', 'GPI DALLO 803', 'GPI CAPÃO DA CANOA', 'GPI TRAMANDAÍ', 'GPI DELAS ITAJAÍ', 'GPI ITAJAÍ'];

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, '($1');
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}
const pwChecks = (s: string) => ({ len: s.length >= 8, upper: /[A-Z]/.test(s), lower: /[a-z]/.test(s), num: /[0-9]/.test(s), spec: /[^A-Za-z0-9]/.test(s) });

const C = { navy: '#0b2545', blue: '#1258CA', bg: '#f4f6fb', border: '#e2e8f0', text: '#1e293b', muted: '#64748b', err: '#dc2626' };

export default function NovaContratacao() {
  const nav = useNavigate();
  const [f, setF] = useState({ nomeCompleto: '', email: '', telefone: '', senha: '', modalidade: '', unidade: '', creci: '' });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [hp, setHp] = useState('');

  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setErros((e) => ({ ...e, [k]: '' })); };
  const pw = pwChecks(f.senha);
  const isCorretor = f.modalidade === 'CORRETOR';

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!f.modalidade) e.modalidade = 'Selecione estagiário ou corretor.';
    if (f.nomeCompleto.trim().length < 3) e.nomeCompleto = 'Preencha seu nome completo.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Informe um e-mail válido.';
    if (f.telefone.replace(/\D/g, '').length < 10) e.telefone = 'Informe um telefone válido.';
    if (!Object.values(pw).every(Boolean)) e.senha = 'A senha não atende aos critérios mínimos.';
    if (!f.unidade) e.unidade = 'Selecione sua unidade.';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setFormErr('');
    if (!validar()) { setFormErr('Revise os campos destacados.'); return; }
    setBusy(true);
    try {
      const r = await Api.novaContratacao({ ...f, website: hp });
      Auth.set(r.token, r.user);
      nav('/onboarding', { replace: true });
    } catch (err: any) {
      setFormErr(err?.message || 'Não foi possível iniciar sua contratação. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '32px 16px' }}>
      <form onSubmit={enviar} style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 16, padding: 28, border: `1px solid ${C.border}`, boxShadow: '0 8px 40px rgba(11,37,69,.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: C.muted }}>Grupo Pons Imobiliário</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 24, color: C.navy }}>Nova Contratação</h1>
          <p style={{ color: C.muted, fontSize: 14, marginTop: 6 }}>Crie seu acesso para iniciar o processo de contratação.</p>
        </div>

        {formErr && <div style={{ background: '#fef2f2', color: C.err, border: `1px solid ${C.err}33`, borderRadius: 9, padding: '10px 14px', fontSize: 14, marginBottom: 14 }}>{formErr}</div>}

        <label style={lbl}>Você está entrando como</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: erros.modalidade ? 4 : 14 }}>
          <Radio checked={f.modalidade === 'ESTAGIARIO'} onClick={() => set('modalidade', 'ESTAGIARIO')} label="Estagiário (cursando TTI)" />
          <Radio checked={isCorretor} onClick={() => set('modalidade', 'CORRETOR')} label="Corretor (com CRECI)" />
        </div>
        {erros.modalidade && <Err t={erros.modalidade} />}

        <Field label="Nome completo" v={f.nomeCompleto} on={(v) => set('nomeCompleto', v)} err={erros.nomeCompleto} />
        <Field label="E-mail" v={f.email} on={(v) => set('email', v)} err={erros.email} type="email" />
        <Field label="Celular" v={f.telefone} on={(v) => set('telefone', maskTelefone(v))} err={erros.telefone} />

        <label style={lbl}>Unidade</label>
        <select value={f.unidade} onChange={(e) => set('unidade', e.target.value)} style={{ ...input, marginBottom: erros.unidade ? 4 : 14 }}>
          <option value="">Selecione…</option>
          {EQUIPES.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        {erros.unidade && <Err t={erros.unidade} />}

        {isCorretor && <Field label="CRECI" v={f.creci} on={(v) => set('creci', v)} />}

        <Field label="Senha" v={f.senha} on={(v) => set('senha', v)} err={erros.senha} type="password" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 16px', fontSize: 12 }}>
          {([['len', '8+ caracteres'], ['upper', 'maiúscula'], ['lower', 'minúscula'], ['num', 'número'], ['spec', 'especial']] as const).map(([k, label]) => (
            <span key={k} style={{ color: (pw as any)[k] ? '#16a34a' : C.muted }}>{(pw as any)[k] ? '✓' : '○'} {label}</span>
          ))}
        </div>

        {/* honeypot */}
        <input type="text" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} aria-hidden />

        <button type="submit" disabled={busy} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 700, fontSize: 15, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Enviando…' : 'Criar acesso e continuar'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, v, on, err, type = 'text' }: { label: string; v: string; on: (v: string) => void; err?: string; type?: string }) {
  return (
    <div style={{ marginBottom: err ? 4 : 14 }}>
      <label style={lbl}>{label}</label>
      <input type={type} value={v} onChange={(e) => on(e.target.value)} style={{ ...input, borderColor: err ? C.err : C.border }} />
      {err && <Err t={err} />}
    </div>
  );
}
function Radio({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', border: `2px solid ${checked ? C.blue : C.border}`, background: checked ? '#eef4ff' : '#fff', color: checked ? C.navy : C.text, fontWeight: checked ? 700 : 500, fontSize: 13 }}>{label}</button>
  );
}
function Err({ t }: { t: string }) { return <div style={{ color: C.err, fontSize: 12, margin: '0 0 10px' }}>{t}</div>; }

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, margin: '0 0 4px' };
const input: React.CSSProperties = { width: '100%', padding: '11px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, boxSizing: 'border-box' };
