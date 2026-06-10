import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Auth } from '../lib/auth';
import { Icon } from './Icon';
import { BirthdayGreeter } from './BirthdayGreeter';
import { AssistantChat } from './AssistantChat';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const loc = useLocation();

  if (!Auth.token) return <Navigate to="/login" replace />;

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
      <div className={'app-shell' + (menuOpen ? ' app-shell--menu-open' : '')}>
        {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
        <Sidebar onClose={menuOpen ? () => setMenuOpen(false) : undefined} />
        <main className="main">
          <Outlet />
        </main>
      </div>
      <BirthdayGreeter />
      <AssistantChat />
    </>
  );
}
