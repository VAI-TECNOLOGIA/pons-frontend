import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Auth } from '../lib/auth';
import { initPush } from '../lib/push';
import { Icon } from './Icon';
import { BirthdayGreeter } from './BirthdayGreeter';
import { WelcomeSplash } from './WelcomeSplash';
import { AssistantChat } from './AssistantChat';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('pons.sidebarCollapsed') === '1'; } catch { return false; }
  });
  // No mobile o menu é um drawer que deve mostrar SEMPRE ícone + label. O estado
  // "recolhido" (só-ícones) é do desktop e não pode vazar pro drawer.
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const loc = useLocation();
  const navigate = useNavigate();

  // Push nativa: pede permissão e registra o token do aparelho no 1º render
  // autenticado (no-op no navegador).
  useEffect(() => {
    if (Auth.token) initPush((path) => navigate(path));
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem('pons.sidebarCollapsed', next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  };

  if (!Auth.token) return <Navigate to="/login" replace />;

  // Gate de onboarding: colaborador em contratação fica preso em /onboarding
  // (só a aba Documentos) até onboardingStatus virar ATIVO.
  const onbStatus = Auth.user?.onboardingStatus;
  if (onbStatus && onbStatus !== 'ATIVO') return <Navigate to="/onboarding" replace />;

  // Gate de acesso pendente: cadastro aberto (qualquer pessoa) fica preso na
  // Academia Pons (vídeo aulas) até um Analista liberar o acesso. A segurança
  // real está no backend (middleware acesso_pendente); aqui é só a navegação.
  const statusCad = Auth.user?.statusCadastro;
  if (statusCad === 'AGUARDANDO_APROVACAO' && loc.pathname !== '/treinamentos') {
    return <Navigate to="/treinamentos" replace />;
  }

  // Persona guard: DEV só vê /dev/*; demais NÃO vêem /dev/*.
  const role = Auth.user?.role;
  const onDev = loc.pathname.startsWith('/dev');
  if (role === 'DEV' && !onDev) return <Navigate to="/dev/mensagens" replace />;
  if (role && role !== 'DEV' && onDev) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    setMenuOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <>
      <div className="speed-line" />
      <button
        className="mobile-menu-btn"
        onClick={() => setMenuOpen(true)}
        aria-label="Abrir menu"
      >
        <Icon name="menu" size={22} />
      </button>
      <div className={'app-shell' + (menuOpen ? ' app-shell--menu-open' : '') + (collapsed && !isMobile ? ' app-shell--collapsed' : '')}>
        {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
        <Sidebar
          onClose={menuOpen ? () => setMenuOpen(false) : undefined}
          collapsed={collapsed && !isMobile}
          onToggleCollapse={toggleCollapse}
        />
        <main className="main">
          <Outlet />
        </main>
      </div>
      <WelcomeSplash />
      <BirthdayGreeter />
      <AssistantChat />
    </>
  );
}
