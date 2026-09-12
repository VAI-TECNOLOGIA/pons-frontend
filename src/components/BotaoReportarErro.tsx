// Botão flutuante "Reportar erro" em TODAS as telas logadas (padrão Breakr,
// pedido Elison 08/09). Abre o modal existente, que tira o print sozinho.
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Auth } from '../lib/auth';
import { ReportarProblemaModal } from './ReportarProblemaModal';

const ROTAS_PUBLICAS = ['/', '/login', '/redefinir-senha', '/privacidade', '/termos', '/excluir-conta', '/excluir-dados', '/painel-tv'];

export function BotaoReportarErro() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  // No /chat some (igual o FAB da IA) — senão fica colado no rodapé do
  // compositor (em cima de "Salvar nota"). Nas outras telas fica empilhado
  // ACIMA do FAB da IA, não em cima dele.
  if (!Auth.token || ROTAS_PUBLICAS.includes(loc.pathname) || loc.pathname.startsWith('/lp') || loc.pathname.startsWith('/chat')) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Reportar um erro desta tela (tira o print sozinho)"
        aria-label="Reportar erro"
        style={{
          position: 'fixed', right: 24, bottom: 80, zIndex: 8000,
          width: 44, height: 44, borderRadius: 999, cursor: 'pointer',
          background: 'var(--bg-elevated, #111827)', color: '#f87171',
          border: '1px solid var(--border, rgba(255,255,255,0.14))', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 2l1.5 1.5M16 2l-1.5 1.5M9 7.5V6a3 3 0 0 1 6 0v1.5" />
          <rect x="7" y="7.5" width="10" height="12" rx="5" />
          <path d="M2 13h5M17 13h5M4 20l3.5-2.5M20 20l-3.5-2.5M4 6.5L7.5 9M20 6.5L16.5 9" />
        </svg>
      </button>
      <ReportarProblemaModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
