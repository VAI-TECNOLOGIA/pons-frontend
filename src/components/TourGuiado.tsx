// Tour guiado das novidades (pedido Elison 10/09). Depois que o usuário atualiza,
// aparece um convite; ele faz o tour clicando em cada item novo — cada passo mostra
// ONDE fica, um resumo de COMO usar, e ele CONFIRMA. Cada confirmação é registrada
// no backend (Api.tourConfirmar) pra gestão saber que a pessoa passou por tudo.
//
// A cada release: atualize TOUR_VERSAO e PASSOS. O tour só aparece pros papéis de
// ALVO e enquanto NÃO foi concluído neste navegador (chave por versão).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Auth } from '../lib/auth';
import { Api } from '../lib/api';

const TOUR_VERSAO = '2026.09.10';
const ALVO_PAPEIS = ['DIRETOR_FINANCEIRO', 'FINANCEIRO', 'ADMINISTRATIVO', 'CEO'];
const chaveFeito = `pons.tour-feito.${TOUR_VERSAO}`;

interface Passo {
  id: string;
  to: string;            // rota que o tour abre nesse passo
  anchor?: string;       // seletor do elemento a destacar (default: item do menu dessa rota)
  titulo: string;
  comoUsar: string;      // resumo curto de como usar
}

// Novidades de 08/09 (Vendas + Administrativo de Vendas) — foco financeiro/adm.
const PASSOS: Passo[] = [
  {
    id: 'vendas-filtros', to: '/vendas',
    titulo: 'Vendas — filtros e busca por contrato',
    comoUsar: 'Combine período, filial, status, corretor, gestor e empreendimento ao mesmo tempo. Busque por código, cliente, unidade ou empreendimento. Os totais no topo (VGV e comissão) recalculam com o filtro, e "Exportar Excel" baixa a lista do jeito que está.',
  },
  {
    id: 'vendas-status', to: '/vendas',
    titulo: 'Vendas — os novos status de contrato',
    comoUsar: '"Análise jurídica" virou "Contrato em conferência". Entrou "Aguardando repasse de comissão da construtora". E "Vencido" é automático: contrato com parcela vencida sem pagamento cai nele sozinho e volta ao fluxo quando você marca a parcela paga.',
  },
  {
    id: 'admin-busca', to: '/admin-vendas',
    titulo: 'Administrativo de Vendas — busca por fase',
    comoUsar: 'Cada fase do contrato tem sua aba. Use a busca dentro da fase para achar o contrato por código, cliente ou unidade, e clique em Auditar para conferir os dados.',
  },
  {
    id: 'admin-parcelas', to: '/admin-vendas',
    titulo: 'Comissão parcelada — marcar pago por parcela',
    comoUsar: 'Na auditoria do contrato, quando a comissão é parcelada, cada parcela aparece com seu próprio "marcar pago". Você quita uma a uma, conforme a construtora repassa — não precisa esperar tudo pra dar baixa.',
  },
  {
    id: 'admin-financeiro', to: '/admin-vendas',
    titulo: 'Diretor Financeiro audita e confirma',
    comoUsar: 'O Diretor Financeiro agora avança as fases do contrato e confirma os pagamentos direto na auditoria — sem depender do CEO ou do administrativo. O "Marcar como pago" está liberado pra você.',
  },
];

function papelElegivel(): boolean {
  const p = Auth.user?.role || '';
  return ALVO_PAPEIS.includes(p);
}
function jaFeito(): boolean {
  try { return localStorage.getItem(chaveFeito) === 'done'; } catch { return false; }
}

export function TourGuiado() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [fase, setFase] = useState<'oculto' | 'convite' | 'pill' | 'rodando'>('oculto');
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const medindo = useRef(false);

  // Decide o estado inicial: convite (se elegível e não concluído).
  useEffect(() => {
    if (!Auth.token || !papelElegivel()) { setFase('oculto'); return; }
    if (jaFeito()) { setFase('oculto'); return; }
    setFase((f) => (f === 'oculto' ? 'convite' : f));
  }, [loc.pathname]);

  const passo = PASSOS[idx];

  // Mede o elemento destacado (após navegar/render). Re-tenta por ~1s.
  const medir = useCallback(() => {
    if (!passo) return;
    const sel = passo.anchor || `[data-tour="nav:${passo.to}"]`;
    let tentativas = 0;
    medindo.current = true;
    const tick = () => {
      if (!medindo.current) return;
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        setRect(el.getBoundingClientRect());
      } else if (tentativas < 20) {
        tentativas += 1;
        setTimeout(tick, 60);
        return;
      } else {
        setRect(null); // sem âncora → tooltip centralizado
      }
    };
    tick();
  }, [passo]);

  // Ao entrar/trocar de passo: navega pra rota do passo e mede.
  useLayoutEffect(() => {
    if (fase !== 'rodando' || !passo) return;
    medindo.current = false;
    if (loc.pathname !== passo.to) navigate(passo.to);
    const t = setTimeout(medir, loc.pathname !== passo.to ? 380 : 60);
    return () => { clearTimeout(t); medindo.current = false; };
  }, [fase, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-mede em scroll/resize enquanto roda.
  useEffect(() => {
    if (fase !== 'rodando') return;
    const re = () => { const sel = passo?.anchor || `[data-tour="nav:${passo?.to}"]`; const el = document.querySelector(sel) as HTMLElement | null; if (el) setRect(el.getBoundingClientRect()); };
    window.addEventListener('resize', re);
    window.addEventListener('scroll', re, true);
    return () => { window.removeEventListener('resize', re); window.removeEventListener('scroll', re, true); };
  }, [fase, idx, passo]);

  const iniciar = () => { setIdx(0); setFase('rodando'); };
  const concluir = () => {
    try { localStorage.setItem(chaveFeito, 'done'); } catch { /* ignore */ }
    Api.tourConfirmar('__fim__', TOUR_VERSAO).catch(() => {});
    medindo.current = false;
    setFase('oculto');
  };
  const confirmarPasso = () => {
    if (passo) Api.tourConfirmar(passo.id, TOUR_VERSAO).catch(() => {});
    if (idx >= PASSOS.length - 1) { concluir(); return; }
    setRect(null);
    setIdx((i) => i + 1);
  };
  const sair = () => { medindo.current = false; setFase('pill'); };

  const rotasPublicas = ['/', '/login', '/redefinir-senha', '/treinamentos', '/painel-tv'];
  if (!Auth.token || rotasPublicas.includes(loc.pathname) || loc.pathname.startsWith('/lp')) return null;
  if (fase === 'oculto') return null;

  // ── Convite ────────────────────────────────────────────────────────────
  if (fase === 'convite') {
    return createPortal(
      <div style={cardWrap}>
        <div style={cardBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={dot} />
            <strong style={{ fontSize: 14 }}>Novidades da versão {TOUR_VERSAO}</strong>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, opacity: 0.85, lineHeight: 1.5 }}>
            Preparamos um tour rápido pelas atualizações de Vendas e Administrativo de Vendas.
            São {PASSOS.length} passos — você confirma cada um e vê como usar.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFase('pill')}>Agora não</button>
            <button type="button" className="btn btn--primary btn--sm" onClick={iniciar}>Fazer o tour</button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ── Pílula (reabrir) ──────────────────────────────────────────────────
  if (fase === 'pill') {
    return createPortal(
      <button type="button" onClick={iniciar} title="Ver o tour das novidades" style={pill}>
        <span style={dot} /> Tour das novidades
      </button>,
      document.body,
    );
  }

  // ── Rodando: spotlight + tooltip ──────────────────────────────────────
  const tip = tooltipPos(rect);
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500 }}>
      {/* Escurece a tela; o "furo" é o box-shadow gigante do retângulo do alvo */}
      {rect ? (
        <div style={{
          position: 'fixed', left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12,
          borderRadius: 10, boxShadow: '0 0 0 9999px rgba(0,0,0,0.66)', border: '2px solid #52f7fe', pointerEvents: 'none',
          transition: 'all .2s ease',
        }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.66)', pointerEvents: 'none' }} />
      )}

      {/* Tooltip */}
      <div style={{ ...tipBase, ...tip }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#52f7fe', letterSpacing: 0.3 }}>PASSO {idx + 1} DE {PASSOS.length}</span>
          <button type="button" onClick={sair} title="Sair do tour" style={xBtn}>✕</button>
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800 }}>{passo.titulo}</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, lineHeight: 1.55, opacity: 0.9 }}>{passo.comoUsar}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {PASSOS.map((_, i) => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: i <= idx ? '#52f7fe' : 'rgba(255,255,255,0.25)' }} />
            ))}
          </div>
          <button type="button" className="btn btn--primary btn--sm" onClick={confirmarPasso}>
            {idx >= PASSOS.length - 1 ? 'Confirmar e concluir' : 'Confirmar e continuar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Posição do tooltip: ao lado do alvo se couber; senão centralizado.
function tooltipPos(rect: DOMRect | null): CSSProperties {
  const W = 340;
  if (!rect) return { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' };
  const espacoDireita = window.innerWidth - rect.right;
  if (espacoDireita > W + 24) {
    return { left: Math.min(rect.right + 16, window.innerWidth - W - 16), top: Math.max(16, Math.min(rect.top, window.innerHeight - 220)) };
  }
  // senão, abaixo do alvo
  return { left: Math.max(16, Math.min(rect.left, window.innerWidth - W - 16)), top: Math.min(rect.bottom + 14, window.innerHeight - 200) };
}

const dot: CSSProperties = { width: 8, height: 8, borderRadius: 999, background: '#52f7fe', boxShadow: '0 0 0 3px rgba(82,247,254,0.25)', flex: 'none' };
const cardWrap: CSSProperties = { position: 'fixed', right: 24, bottom: 84, zIndex: 8200, maxWidth: 340 };
const cardBox: CSSProperties = { background: 'var(--bg-elevated, #111827)', color: 'var(--text-primary, #f3f4f6)', border: '1px solid var(--border, rgba(255,255,255,0.14))', borderRadius: 14, padding: 18, boxShadow: '0 18px 60px rgba(0,0,0,0.5)' };
const pill: CSSProperties = { position: 'fixed', right: 24, bottom: 140, zIndex: 8200, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: 'var(--bg-elevated, #111827)', color: 'var(--text-primary, #f3f4f6)', border: '1px solid var(--border, rgba(255,255,255,0.14))', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 };
const tipBase: CSSProperties = { position: 'fixed', width: 340, maxWidth: 'calc(100vw - 32px)', background: 'var(--bg-elevated, #0f172a)', color: 'var(--text-primary, #f3f4f6)', border: '1px solid var(--border, rgba(255,255,255,0.16))', borderRadius: 14, padding: 18, boxShadow: '0 18px 60px rgba(0,0,0,0.6)', zIndex: 9600 };
const xBtn: CSSProperties = { background: 'transparent', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 };
