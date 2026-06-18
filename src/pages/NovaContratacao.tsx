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

const C = {
  bg: '#050607',
  surface: '#0E0F13',
  border: 'rgba(255,255,255,0.10)',
  text: '#ffffff',
  muted: '#8c8c8c',
  accent: '#52f7fe',
  blue: '#0E7C9B',
  err: '#ff6b6b',
};

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
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 16px', color: C.text }}>
      <style>{ncCss}</style>
      <form onSubmit={enviar} className="nc-card" style={{ width: '100%', maxWidth: 520, background: C.surface, borderRadius: 18, padding: 0, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,.6), 0 0 60px rgba(82,247,254,.06)' }}>
        <div className="nc-speed" />
        <div style={{ padding: 32 }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <img src="/assets/logo_white.png" alt="Grupo Pons" style={{ height: 40, marginBottom: 16, opacity: 0.95 }} />
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.accent }}>Grupo Pons Imobiliário</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 30, fontFamily: 'var(--font-display)', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>Nova Contratação</h1>
            <p style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>Crie seu acesso para iniciar o processo de contratação.</p>
          </div>

        {formErr && <div style={{ background: 'rgba(255,107,107,.12)', color: C.err, border: `1px solid ${C.err}55`, borderRadius: 9, padding: '10px 14px', fontSize: 14, marginBottom: 14 }}>{formErr}</div>}

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

        <button type="submit" disabled={busy} className="nc-submit" style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '0.02em', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Enviando…' : 'Criar acesso e continuar'}
        </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, v, on, err, type = 'text' }: { label: string; v: string; on: (v: string) => void; err?: string; type?: string }) {
  return (
    <div style={{ marginBottom: err ? 4 : 14 }}>
      <label style={lbl}>{label}</label>
      <input className="nc-input" type={type} value={v} onChange={(e) => on(e.target.value)} style={{ ...input, borderColor: err ? C.err : C.border }} />
      {err && <Err t={err} />}
    </div>
  );
}
function Radio({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', border: `2px solid ${checked ? C.accent : C.border}`, background: checked ? 'rgba(82,247,254,.10)' : 'rgba(255,255,255,.02)', color: checked ? '#fff' : C.muted, fontWeight: checked ? 700 : 500, fontSize: 13, transition: 'border-color .15s, background .15s, color .15s' }}>{label}</button>
  );
}
function Err({ t }: { t: string }) { return <div style={{ color: C.err, fontSize: 12, margin: '0 0 10px' }}>{t}</div>; }

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' };
const input: React.CSSProperties = { width: '100%', padding: '11px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, boxSizing: 'border-box', background: 'rgba(255,255,255,.03)', color: '#fff' };

const ncCss = `
.nc-speed { height: 4px; background: linear-gradient(90deg, #e10600 0%, #f2b544 35%, #88c559 70%, #52f7fe 100%); background-size: 220% 100%; animation: nc-speed 3.2s linear infinite; }
@keyframes nc-speed { from { background-position: 0 0; } to { background-position: 220% 0; } }
.nc-input, .nc-card select { background: rgba(255,255,255,.03); color: #fff; }
.nc-input:focus, .nc-card select:focus { outline: none; border-color: #52f7fe !important; box-shadow: 0 0 0 3px rgba(82,247,254,.15); }
.nc-card select { width: 100%; padding: 11px 12px; border-radius: 9px; border: 1px solid rgba(255,255,255,.10); font-size: 14px; box-sizing: border-box; }
.nc-card select option { background: #0E0F13; color: #fff; }
.nc-input::placeholder { color: #5a5a5e; }
.nc-submit:hover:not(:disabled) { background: #0a6580; }
`;
