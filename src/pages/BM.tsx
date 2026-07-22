import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { Auth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

export default function BMPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.bmList());
  const { data: corretores } = useApi<any[]>(() => Api.corretores());
  const toast = useToast();
  const confirm = useConfirm();

  // ── OAuth Facebook ("Conectar com Facebook") ────────────────────────────────
  // Clicar → abre aba do Facebook → cliente autoriza → o callback devolve o
  // `code` por postMessage → troca por token + lista de Páginas → cliente escolhe
  // a Página → cria/conecta a BM (reusa o auto-subscribe do bmCreate). Zero token
  // manual.
  const [fbPages, setFbPages] = useState<any[] | null>(null);
  const [fbBusy, setFbBusy] = useState(false);

  const conectarFacebook = async () => {
    let url = '';
    try {
      const r: any = await Api.fbAuthUrl();
      url = r?.url || '';
    } catch (err: any) {
      const m = String(err?.message || '');
      if (/configurad|503/.test(m)) toast.error('O app Meta não está configurado no servidor (falta META_APP_ID/SECRET). Por enquanto use o Token em "Nova BM".');
      else toast.error('Erro ao iniciar o login do Facebook: ' + (m || 'falha'));
      return;
    }
    if (!url) { toast.error('Não consegui gerar o link do Facebook.'); return; }
    const popup = window.open(url, 'fb-oauth', 'width=600,height=720,menubar=no,toolbar=no');
    if (!popup) { toast.error('Libere o popup do navegador (está bloqueado) pra conectar.'); return; }
    setFbBusy(true);
    const onMsg = async (e: MessageEvent) => {
      // Só aceita o postMessage vindo do callback do Facebook (app ou Vercel).
      if (!/grupopons\.com\.br|pons-frontend\.vercel\.app|localhost/.test(e.origin)) return;
      const d: any = e.data;
      if (!d || typeof d !== 'object' || !String(d.kind || '').startsWith('fb-oauth')) return;
      window.removeEventListener('message', onMsg);
      setFbBusy(false);
      if (d.kind === 'fb-oauth-error') {
        toast.error('Login do Facebook não concluído: ' + (d.description || d.error || 'cancelado'));
        return;
      }
      if (d.kind === 'fb-oauth-success' && d.code) {
        try {
          const r: any = await Api.fbCallback(d.code);
          const pages = r?.pages || [];
          if (!pages.length) { toast.error('Esse login não administra nenhuma Página do Facebook.'); return; }
          setFbPages(pages);
        } catch (err: any) {
          toast.error('Erro ao concluir o login: ' + (err?.message || 'falha'));
        }
      }
    };
    window.addEventListener('message', onMsg);
  };

  const conectarPagina = async (page: any) => {
    try {
      const res: any = await Api.bmCreate({
        nome: page.name || ('Página ' + page.id),
        bmId: String(page.id),
        paginaFbId: String(page.id),
        accessToken: page.access_token,
        ativa: true,
      });
      const cx = res?.conexao;
      if (cx?.ok) toast.success(`"${page.name}" conectada — os leads vão entrar automaticamente.`);
      else if (cx && !cx.ok) toast.error(`"${page.name}" salva, mas não conectou: ${cx.motivo}`);
      else toast.success(`"${page.name}" cadastrada.`);
      setFbPages(null); reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const token = String(fd.get('accessToken') || '').trim();
    const payload: any = {
      nome: String(fd.get('nome') || ''),
      bmId: String(fd.get('bmId') || ''),
      contaAnuncioId: String(fd.get('contaAnuncioId') || '') || null,
      paginaFbId: String(fd.get('paginaFbId') || '') || null,
      instagramId: String(fd.get('instagramId') || '') || null,
      corretorId: fd.get('corretorId') ? Number(fd.get('corretorId')) : null,
      iaHabilitadaPadrao: fd.get('iaHabilitadaPadrao') === 'on',
      ativa: true,
    };
    // Só envia o token quando o usuário digita — não apaga o token já salvo numa edição.
    if (token) payload.accessToken = token;
    try {
      const res: any = editing ? await Api.bmUpdate(editing.id, payload) : await Api.bmCreate(payload);
      const cx = res?.conexao;
      if (cx?.ok) toast.success('Conectado ao Facebook — os leads vão entrar automaticamente.');
      else if (cx && !cx.ok) toast.error('BM salva, mas NÃO conectou: ' + (cx.motivo || 'erro'));
      else toast.success(editing ? 'BM atualizada' : 'BM cadastrada');
      setOpen(false); setEditing(null); reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const excluir = async (bm: any) => {
    const ok = await confirm({ title: 'Desativar BM?', message: `"${bm.nome}" será desativada (leads continuam preservados).`, tone: 'danger' });
    if (!ok) return;
    await Api.bmDelete(bm.id); toast.success('BM desativada'); reload();
  };

  const excluirPermanente = async (bm: any) => {
    const ok = await confirm({ title: 'Excluir permanentemente?', message: `"${bm.nome}" será removida de vez. Esta ação não pode ser desfeita.`, tone: 'danger' });
    if (!ok) return;
    try {
      await Api.bmDeletePermanente(bm.id); toast.success('BM excluída'); reload();
    } catch (err: any) {
      toast.error(err?.message?.includes('tem_leads') ? 'BM tem leads vinculados — desative em vez de excluir.' : 'Erro ao excluir');
    }
  };

  const reativar = async (bm: any) => {
    await Api.bmUpdate(bm.id, { ativa: true }); toast.success('BM reativada'); reload();
  };

  const verDashboard = async (bm: any) => {
    try {
      const dash = await Api.bmDashboard(bm.id);
      setSelected({ bm, dash });
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  return (
    <>
      <Topbar
        title="Business Managers"
        right={
          <div className="flex" style={{ gap: 8 }}>
            <button className="btn btn--secondary btn--sm" onClick={conectarFacebook} disabled={fbBusy}>
              {fbBusy ? 'Aguardando Facebook…' : 'Conectar com Facebook'}
            </button>
            <button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Nova BM</button>
          </div>
        }
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Administração · Tráfego"
          title="Central de BMs"
          subtitle="Cadastre BMs e vincule a corretores — leads dessas BMs vão direto pra eles (bypass da roleta)"
        />

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {(data || []).map((bm) => (
            <div
              key={bm.id}
              className="card"
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                padding: 18,
                opacity: bm.ativa ? 1 : 0.72,
                borderColor: bm.ativa ? undefined : 'var(--border-medium)',
              }}
            >
              {/* Cabeçalho: ícone + nome + status */}
              <div className="flex" style={{ alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    display: 'grid', placeItems: 'center',
                    background: bm.ativa ? 'var(--color-info-bg)' : 'var(--bg-elevated)',
                    color: 'var(--pons-blue)', fontSize: 18, fontWeight: 700,
                  }}
                >
                  {(bm.nome || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bm.nome}</h3>
                  <div className="text-xs text-secondary" style={{ fontFamily: 'monospace' }}>BM {bm.bmId}</div>
                  {(() => {
                    const ok = bm.paginaFbId && bm.temToken;
                    const cor = ok ? 'var(--color-success-fg)' : (bm.paginaFbId ? 'var(--color-warning-fg)' : 'var(--text-tertiary)');
                    const txt = ok ? 'Facebook conectado' : (bm.paginaFbId ? 'Falta o token' : 'Sem página/token');
                    return (
                      <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, color: cor }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: cor, flexShrink: 0 }} />
                        {txt}
                      </div>
                    );
                  })()}
                </div>
                <span className={`badge ${bm.ativa ? 'badge--launch' : 'badge--neutral'}`}>{bm.ativa ? 'Ativa' : 'Inativa'}</span>
              </div>

              {/* Vínculo */}
              {bm.corretor ? (
                <div className="flex" style={{ alignItems: 'center', gap: 8, background: 'var(--color-success-bg)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-success-border)' }}>
                  <span style={{ color: 'var(--color-success-fg)', fontSize: 16 }}>→</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{bm.corretor.nome}</div>
                    <div className="text-xs" style={{ color: 'var(--color-success-fg)' }}>Leads vão direto (bypass roleta)</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-secondary" style={{ background: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: 8 }}>
                  BM da empresa — leads entram na roleta
                </div>
              )}

              {/* Métricas */}
              <div className="flex" style={{ gap: 10 }}>
                <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
                  <div className="text-xs text-secondary">Leads captados</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{bm.leadsCaptados}</div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex" style={{ gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
                {bm.ativa ? (
                  <>
                    <button className="btn btn--ghost btn--sm" onClick={() => verDashboard(bm)}>Dashboard</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(bm); setOpen(true); }}>Editar</button>
                    <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto', color: 'var(--color-danger-fg)' }} onClick={() => excluir(bm)}>Desativar</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn--ghost btn--sm" onClick={() => reativar(bm)}>Reativar</button>
                    <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto', color: 'var(--color-danger-fg)' }} onClick={() => excluirPermanente(bm)}>Excluir</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {data?.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>Nenhuma BM cadastrada ainda</div>
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? `Editar ${editing.nome}` : 'Nova Business Manager'}
        subtitle="Vincule a um corretor pra leads bypass roleta, ou deixe vazio pra entrar na roleta padrão"
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
            <button type="submit" form="bm-form" className="btn btn--primary">{editing ? 'Salvar' : 'Cadastrar'}</button>
          </>
        }
      >
        <form id="bm-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} /></div>
            <div className="field"><label className="field__label">BM ID (Meta) *</label><input name="bmId" className="field__input" required defaultValue={editing?.bmId} /></div>
            <div className="field"><label className="field__label">Conta de Anúncios (act_xxx)</label><input name="contaAnuncioId" className="field__input" defaultValue={editing?.contaAnuncioId || ''} /></div>
            <div className="field"><label className="field__label">Página Facebook ID</label><input name="paginaFbId" className="field__input" defaultValue={editing?.paginaFbId || ''} placeholder="ID da Página que roda os anúncios" /></div>
            <div className="field"><label className="field__label">Instagram ID</label><input name="instagramId" className="field__input" defaultValue={editing?.instagramId || ''} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Token de acesso (System User ou Página)</label>
              <input
                name="accessToken"
                type="password"
                autoComplete="off"
                className="field__input"
                placeholder={editing?.temToken ? '•••••• já salvo — deixe vazio pra manter' : 'Cole o token com leads_retrieval + pages_manage_metadata'}
              />
              <div className="text-xs text-secondary">
                Ao salvar com <strong>Página + Token</strong>, o sistema <strong>assina a página no Facebook automaticamente</strong> e os leads passam a entrar sozinhos.
              </div>
            </div>
            {Auth.user?.role === 'CORRETOR' ? (
              <div className="field">
                <label className="field__label">Vínculo</label>
                <div className="field__hint">Esta BM fica vinculada a você — os leads dela caem direto na sua carteira, sem passar pela roleta.</div>
              </div>
            ) : (
            <div className="field">
              <label className="field__label">Vincular a corretor</label>
              <select name="corretorId" className="field__select" defaultValue={editing?.corretor?.id || ''}>
                <option value="">— Sem vínculo (BM da empresa, vai pra roleta) —</option>
                {(corretores || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            )}
            <div className="field">
              <label className="field__label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" name="iaHabilitadaPadrao" defaultChecked={editing?.iaHabilitadaPadrao} />
                Habilitar IA por padrão pros leads dessa BM
              </label>
              <div className="text-xs text-secondary">Por padrão, leads de BM de corretor NÃO usam IA (pra preservar o contato pessoal)</div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Seletor de Página do OAuth Facebook — aparece depois que o cliente autoriza */}
      <Modal
        open={!!fbPages}
        onClose={() => setFbPages(null)}
        title="Escolha a Página pra conectar"
        subtitle="Estas são as Páginas que esse login administra no Facebook. Conectar = os leads dessa Página entram sozinhos."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(fbPages || []).map((p: any) => (
            <button
              key={p.id}
              type="button"
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, textAlign: 'left', cursor: 'pointer', width: '100%' }}
              onClick={() => conectarPagina(p)}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: 'var(--color-info-bg)', color: 'var(--pons-blue)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                {(p.name || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || 'Página'}</div>
                <div className="text-xs text-secondary" style={{ fontFamily: 'monospace' }}>{p.id}{p.category ? ' · ' + p.category : ''}</div>
              </div>
              <span className="btn btn--primary btn--sm" style={{ pointerEvents: 'none' }}>Conectar</span>
            </button>
          ))}
          {fbPages && fbPages.length === 0 && (
            <div className="text-secondary" style={{ padding: 12 }}>Nenhuma Página encontrada nesse login.</div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Dashboard · ${selected?.bm?.nome || ''}`}
        size="lg"
      >
        {selected && (() => {
          const d = selected.dash;
          const brl = (v: number, frac = 0) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: frac });
          const conv = Number(d.conversaoPct) || 0;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Hero — destaque de leads + conversão */}
              <div
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 14,
                  padding: '20px 22px',
                  color: '#fff',
                  background: 'linear-gradient(135deg, #16243D 0%, var(--pons-blue) 100%)',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute', top: -40, right: -30, width: 160, height: 160,
                    borderRadius: '50%', background: 'rgba(255,255,255,.08)',
                  }}
                />
                <div className="flex" style={{ gap: 24, flexWrap: 'wrap', position: 'relative' }}>
                  <div>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', opacity: .8 }}>Leads captados</div>
                    <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-display)' }}>{d.leadsTotal}</div>
                    <div style={{ fontSize: 12, opacity: .85, marginTop: 4 }}>{d.leadsMes} no mês · {d.leadsFechados} fechados</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', opacity: .8 }}>Conversão</div>
                    <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-display)' }}>{conv}%</div>
                    {/* barra de progresso */}
                    <div style={{ width: 140, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.2)', marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(conv, 100)}%`, height: '100%', borderRadius: 3, background: 'var(--pons-cyan)', transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid de métricas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StatCard icon="users" tone="info" label="Leads Total" value={d.leadsTotal} />
                <StatCard icon="calendar" tone="info" label="Leads (mês)" value={d.leadsMes} />
                <StatCard icon="checkCircle" tone="success" label="Fechados" value={d.leadsFechados} />
                <StatCard icon="target" tone="success" label="Conversão" value={conv + '%'} />
                <StatCard icon="trophy" tone="warning" label="VGV total" value={brl(d.vgvTotal)} />
                <StatCard icon="wallet" tone="danger" label="Custo (mês)" value={brl(d.custoMes, 2)} />
                <StatCard icon="chat" tone="info" label="Conversas (mês)" value={d.conversasMes} />
                <StatCard icon="gauge" tone="warning" label="Custo/Lead" value={brl(d.custoPorLead, 2)} />
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}

const TONES: Record<string, { bg: string; fg: string; border: string }> = {
  info: { bg: 'var(--color-info-bg)', fg: 'var(--color-info-fg)', border: 'var(--color-info-border)' },
  success: { bg: 'var(--color-success-bg)', fg: 'var(--color-success-fg)', border: 'var(--color-success-border)' },
  warning: { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning-fg)', border: 'var(--color-warning-border)' },
  danger: { bg: 'var(--color-danger-bg)', fg: 'var(--color-danger-fg)', border: 'var(--color-danger-border)' },
};

function StatCard({ icon, label, value, tone = 'info' }: { icon: string; label: string; value: any; tone?: keyof typeof TONES }) {
  const [hover, setHover] = useState(false);
  const t = TONES[tone] || TONES.info;
  return (
    <div
      className="card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'default',
        transform: hover ? 'translateY(-3px)' : 'none',
        boxShadow: hover ? 'var(--shadow-lg)' : 'var(--shadow-xs)',
        borderColor: hover ? t.border : undefined,
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
      }}
    >
      <div
        style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          display: 'grid', placeItems: 'center',
          background: t.bg, color: t.fg,
          transform: hover ? 'scale(1.08)' : 'none',
          transition: 'transform .18s ease',
        }}
      >
        <Icon name={icon} size={17} />
      </div>
      <div>
        <div className="text-xs text-secondary" style={{ marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 21, fontWeight: 700, fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}
