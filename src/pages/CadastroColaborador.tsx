// LP pública de Atualização Cadastral Grupo Pons.
// Rota pública (sem auth) → POST /api/grupo-pons/cadastro-colaborador → grava na
// área de usuários do sistema. Identidade corporativa Grupo Pons (navy/branco).
import { useState } from 'react';

import './cadastro-colaborador.css';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : 'https://web-production-e420b.up.railway.app');

const FUNCOES = ['CEO', 'Corretor', 'Gestor Unidade', 'Sócio', 'Marketing', 'Gestor Tráfego', 'Administrativo', 'Financeiro'];
const EQUIPES = ['GPI DELAS BC', 'GPI BC', 'GPI 2ª AVENIDA', 'GPI DALLO 703', 'GPI DALLO 803', 'GPI CAPÃO DA CANOA', 'GPI TRAMANDAÍ', 'GPI DELAS ITAJAÍ', 'GPI ITAJAÍ'];

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, '($1');
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

const pwChecks = (s: string) => ({
  len: s.length >= 8,
  upper: /[A-Z]/.test(s),
  lower: /[a-z]/.test(s),
  num: /[0-9]/.test(s),
  spec: /[^A-Za-z0-9]/.test(s),
});

export default function CadastroColaborador() {
  const [f, setF] = useState({
    funcao: '', equipe: '', nomeCompleto: '', telefone: '', email: '',
    senha: '', dataEntrada: '', endereco: '', pix: '', creci: '',
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ msg: string; novo: boolean; nome: string; funcao: string; equipe: string } | null>(null);
  const [hp, setHp] = useState(''); // honeypot

  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setErros((e) => ({ ...e, [k]: '' })); };
  const pw = pwChecks(f.senha);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!f.funcao) e.funcao = 'Selecione sua função.';
    if (!f.equipe) e.equipe = 'Selecione sua equipe.';
    if (f.nomeCompleto.trim().length < 3) e.nomeCompleto = 'Preencha seu nome completo.';
    if (f.telefone.replace(/\D/g, '').length < 10) e.telefone = 'Informe um telefone válido.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Informe um e-mail válido.';
    if (!Object.values(pw).every(Boolean)) e.senha = 'A senha não atende aos critérios mínimos de segurança.';
    if (!f.dataEntrada) e.dataEntrada = 'Informe a data de entrada.';
    if (f.endereco.trim().length < 3) e.endereco = 'Informe seu endereço.';
    if (f.pix.trim().length < 2) e.pix = 'Informe sua chave PIX.';
    // CRECI é opcional para todos (inclusive corretores).
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setFormErr('');
    if (!validar()) { setFormErr('Revise os campos destacados antes de enviar.'); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/grupo-pons/cadastro-colaborador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, website: hp }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFormErr(j?.message || 'Não foi possível enviar seu cadastro. Tente novamente.');
        setBusy(false);
        return;
      }
      setDone({
        msg: j?.message || 'Cadastro enviado com sucesso. Obrigado por atualizar seus dados no Grupo Pons.',
        novo: j?.novo !== false,
        nome: f.nomeCompleto.trim(),
        funcao: f.funcao,
        equipe: f.equipe,
      });
    } catch {
      setFormErr('Não foi possível enviar seu cadastro. Verifique sua conexão e tente novamente.');
      setBusy(false);
    }
  }

  if (done) {
    const primeiro = done.nome.split(' ')[0] || '';
    const reset = () => {
      setF({ funcao: '', equipe: '', nomeCompleto: '', telefone: '', email: '', senha: '', dataEntrada: '', endereco: '', pix: '', creci: '' });
      setErros({}); setFormErr(''); setBusy(false); setHp(''); setDone(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    return (
      <div className="cad">
        <div className="cad-wel">
          <div className="cad-wel__card">
            <div className="cad-wel__speed" />
            <img className="cad-wel__logo" src="/assets/logo_white.png" alt="Grupo Pons Imobiliário" />
            <div className="cad-wel__check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></div>
            <div className="cad-wel__eyebrow">{done.novo ? 'Cadastro confirmado' : 'Cadastro atualizado'}</div>
            <h1 className="cad-wel__title">Bem-vindo(a)<br/><span>{primeiro}!</span></h1>
            <p className="cad-wel__msg">{done.msg}</p>

            <div className="cad-wel__resumo">
              <div className="cad-wel__row"><span>Função</span><b>{done.funcao}</b></div>
              <div className="cad-wel__row"><span>Equipe</span><b>{done.equipe}</b></div>
            </div>

            {done.novo && (
              <div className="cad-wel__note">
                ⏳ Seu acesso será liberado assim que for aprovado pela administração do Grupo Pons. Você receberá a confirmação em breve.
              </div>
            )}

            <button type="button" className="cad-wel__again" onClick={reset}>+ Cadastrar outra pessoa</button>
          </div>
          <div className="cad__footer">Grupo Pons Imobiliário · Sistema Oficial</div>
        </div>
      </div>
    );
  }

  const inCls = (k: string) => 'cad__input' + (erros[k] ? ' cad__input--err' : '');
  const selCls = (k: string) => 'cad__select' + (erros[k] ? ' cad__select--err' : '');

  return (
    <div className="cad">
      <header className="cad__hero">
        <img className="cad__logo" src="/assets/logo_white.png" alt="Grupo Pons Imobiliário" />
        <h1 className="cad__h1">Atualização Cadastral Grupo Pons</h1>
        <p className="cad__sub">Preencha seus dados para manter seu cadastro atualizado no sistema oficial do Grupo Pons Imobiliário.</p>
      </header>

      <div className="cad__wrap">
        <div className="cad__inst">
          Essa atualização é necessária para organizar nossa <b>operação, equipes, permissões e comunicação interna</b>. Preencha as informações com atenção.
        </div>

        <form className="cad__card" onSubmit={enviar} noValidate>
          {/* honeypot */}
          <div className="cad__hp" aria-hidden="true">
            <label>Não preencha<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></label>
          </div>

          {/* BLOCO 1 — Dados profissionais */}
          <section className="cad__block">
            <div className="cad__block-head"><span className="cad__block-num">1</span><span className="cad__block-title">Dados profissionais</span></div>
            <div className="cad__grid">
              <div className="cad__field">
                <label className="cad__label">Função<span className="req">*</span></label>
                <select className={selCls('funcao')} value={f.funcao} onChange={(e) => set('funcao', e.target.value)}>
                  <option value="">Selecione…</option>
                  {FUNCOES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {erros.funcao && <div className="cad__err">{erros.funcao}</div>}
              </div>
              <div className="cad__field">
                <label className="cad__label">Equipe / Unidade<span className="req">*</span></label>
                <select className={selCls('equipe')} value={f.equipe} onChange={(e) => set('equipe', e.target.value)}>
                  <option value="">Selecione…</option>
                  {EQUIPES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {erros.equipe && <div className="cad__err">{erros.equipe}</div>}
              </div>
              <div className="cad__field">
                <label className="cad__label">Data de entrada<span className="req">*</span></label>
                <input type="date" className={inCls('dataEntrada')} value={f.dataEntrada} onChange={(e) => set('dataEntrada', e.target.value)} />
                {erros.dataEntrada && <div className="cad__err">{erros.dataEntrada}</div>}
              </div>
              <div className="cad__field">
                <label className="cad__label">CRECI <span className="cad__opcional">(opcional)</span></label>
                <input className={inCls('creci')} value={f.creci} onChange={(e) => set('creci', e.target.value)} placeholder="Se tiver, informe seu CRECI" />
                {erros.creci && <div className="cad__err">{erros.creci}</div>}
              </div>
            </div>
          </section>

          {/* BLOCO 2 — Dados pessoais */}
          <section className="cad__block">
            <div className="cad__block-head"><span className="cad__block-num">2</span><span className="cad__block-title">Dados pessoais</span></div>
            <div className="cad__grid">
              <div className="cad__field cad__field--full">
                <label className="cad__label">Nome completo<span className="req">*</span></label>
                <input className={inCls('nomeCompleto')} value={f.nomeCompleto} onChange={(e) => set('nomeCompleto', e.target.value)} placeholder="Seu nome completo" autoComplete="name" />
                {erros.nomeCompleto && <div className="cad__err">{erros.nomeCompleto}</div>}
              </div>
              <div className="cad__field">
                <label className="cad__label">Telefone<span className="req">*</span></label>
                <input className={inCls('telefone')} value={f.telefone} onChange={(e) => set('telefone', maskTelefone(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" />
                {erros.telefone && <div className="cad__err">{erros.telefone}</div>}
              </div>
              <div className="cad__field">
                <label className="cad__label">E-mail<span className="req">*</span></label>
                <input type="email" className={inCls('email')} value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="seu@email.com" autoComplete="email" />
                {erros.email && <div className="cad__err">{erros.email}</div>}
              </div>
              <div className="cad__field cad__field--full">
                <label className="cad__label">Endereço<span className="req">*</span></label>
                <textarea className={'cad__textarea' + (erros.endereco ? ' cad__textarea--err' : '')} value={f.endereco} onChange={(e) => set('endereco', e.target.value)} placeholder="Rua, número, bairro, cidade — UF" />
                {erros.endereco && <div className="cad__err">{erros.endereco}</div>}
              </div>
            </div>
          </section>

          {/* BLOCO 3 — Acesso e pagamento */}
          <section className="cad__block">
            <div className="cad__block-head"><span className="cad__block-num">3</span><span className="cad__block-title">Dados de acesso e pagamento</span></div>
            <div className="cad__grid">
              <div className="cad__field">
                <label className="cad__label">Senha de acesso<span className="req">*</span></label>
                <input type="password" className={inCls('senha')} value={f.senha} onChange={(e) => set('senha', e.target.value)} placeholder="Crie uma senha forte" autoComplete="new-password" />
                <div className="cad__pwreqs">
                  <span className={'cad__pwreq' + (pw.len ? ' cad__pwreq--ok' : '')}>8+ caracteres</span>
                  <span className={'cad__pwreq' + (pw.upper ? ' cad__pwreq--ok' : '')}>1 maiúscula</span>
                  <span className={'cad__pwreq' + (pw.lower ? ' cad__pwreq--ok' : '')}>1 minúscula</span>
                  <span className={'cad__pwreq' + (pw.num ? ' cad__pwreq--ok' : '')}>1 número</span>
                  <span className={'cad__pwreq' + (pw.spec ? ' cad__pwreq--ok' : '')}>1 caractere especial</span>
                </div>
                {erros.senha && <div className="cad__err">{erros.senha}</div>}
              </div>
              <div className="cad__field">
                <label className="cad__label">Chave PIX<span className="req">*</span></label>
                <input className={inCls('pix')} value={f.pix} onChange={(e) => set('pix', e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou aleatória" />
                <div className="cad__hint">Onde você recebe seus pagamentos.</div>
                {erros.pix && <div className="cad__err">{erros.pix}</div>}
              </div>
            </div>
          </section>

          {formErr && <div className="cad__formerr">{formErr}</div>}
          <div className="cad__actions">
            <button type="submit" className="cad__submit" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar cadastro'}
            </button>
          </div>
        </form>

        <div className="cad__footer">Seus dados são tratados com segurança e usados apenas internamente pelo Grupo Pons Imobiliário.</div>
      </div>
    </div>
  );
}
