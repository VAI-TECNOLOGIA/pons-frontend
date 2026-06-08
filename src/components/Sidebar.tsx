import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Auth, formatRole, type Role } from '../lib/auth';
import { useUser } from '../lib/userContext';
import { Icon } from './Icon';
import { ReportarProblemaModal } from './ReportarProblemaModal';

const COMERCIAL: Role[] = ['CEO', 'DIRETOR_COMERCIAL', 'GERENTE_EQUIPE'];
const FINANCE: Role[] = ['CEO', 'DIRETOR_FINANCEIRO'];
const RELATORIOS: Role[] = ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO'];
const EXEC: Role[] = ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'DIRETOR_JURIDICO', 'MARKETING'];
const SOCIO: Role = 'SOCIO_UNIDADE';

type NavItem = {
  to: string;
  label: string;
  section: string;
  icon: string;
  roles?: Role[];
  blank?: boolean;
};

const ALL_ITEMS: NavItem[] = [
  // SÓCIOS
  { to: '/dashboard', label: 'Dashboard', section: 'Sócios', icon: 'dashboard' },
  { to: '/relatorios', label: 'Relatórios', section: 'Sócios', icon: 'chart', roles: RELATORIOS },
  { to: '/painel-executivo', label: 'Painel Executivo', section: 'Sócios', icon: 'chart', roles: RELATORIOS },
  { to: '/executivo', label: 'Agenda Executiva', section: 'Sócios', icon: 'crown', roles: [...EXEC, 'ASSESSORA'] },
  { to: '/roletas', label: 'Roletas', section: 'Sócios', icon: 'roulette', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
  { to: '/distribuicao', label: 'Distribuição Agendada', section: 'Sócios', icon: 'clock', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
  { to: '/vendas', label: 'Vendas', section: 'Sócios', icon: 'sales', roles: [...COMERCIAL, 'CORRETOR', 'DIRETOR_FINANCEIRO', 'DIRETOR_JURIDICO', SOCIO] },
  // MÓDULO FINANCEIRO
  { to: '/financeiro-pons', label: 'Rateio & Sócios', section: 'Módulo Financeiro', icon: 'wallet', roles: FINANCE },
  { to: '/financeiro', label: 'Caixa & Lançamentos', section: 'Módulo Financeiro', icon: 'dollar', roles: FINANCE },
  { to: '/meta-custos', label: 'Custos Meta', section: 'Módulo Financeiro', icon: 'target', roles: ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'MARKETING'] },
  // VENDAS
  { to: '/leads', label: 'Leads', section: 'Vendas', icon: 'users', roles: [...COMERCIAL, 'CORRETOR', SOCIO] },
  { to: '/chat', label: 'Atendimento', section: 'Vendas', icon: 'chat', roles: [...COMERCIAL, 'CORRETOR', SOCIO] },
  { to: '/pipeline', label: 'Funil', section: 'Vendas', icon: 'pipeline', roles: [...COMERCIAL, 'CORRETOR', SOCIO] },
  { to: '/empreendimentos', label: 'Empreendimentos', section: 'Vendas', icon: 'building' },
  { to: '/ranking', label: 'Ranking', section: 'Vendas', icon: 'crown' },
  // ADMINISTRAÇÃO
  { to: '/corretores', label: 'Corretores', section: 'Administração', icon: 'team', roles: ['CEO', 'DIRETOR_COMERCIAL', SOCIO] },
  { to: '/equipes', label: 'Equipes', section: 'Administração', icon: 'shield', roles: ['CEO', 'DIRETOR_COMERCIAL', SOCIO] },
  { to: '/trafego', label: 'Tráfego Pago', section: 'Administração', icon: 'target', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
  { to: '/bm', label: 'Business Managers', section: 'Administração', icon: 'target', roles: ['CEO', 'DIRETOR_COMERCIAL', 'CORRETOR', 'GERENTE_EQUIPE'] },
  { to: '/tarefas', label: 'Tarefas', section: 'Administração', icon: 'tasks', roles: ['CEO', 'DIRETOR_JURIDICO', 'MARKETING', 'ASSESSORA', 'CORRETOR', 'GERENTE_EQUIPE'] },
  { to: '/importar', label: 'Importar Leads', section: 'Administração', icon: 'plus', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
  { to: '/transferencias', label: 'Transferências', section: 'Administração', icon: 'pipeline', roles: ['CEO', 'DIRETOR_COMERCIAL', 'GERENTE_EQUIPE'] },
  // MARKETING
  { to: '/remarketing', label: 'Remarketing', section: 'Marketing', icon: 'megafone', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
  { to: '/landing-pages', label: 'Landing Pages', section: 'Marketing', icon: 'target', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
  { to: '/heatmap', label: 'Heatmap', section: 'Marketing', icon: 'fire', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
  // CONTEÚDO
  { to: '/avisos', label: 'Avisos', section: 'Conteúdo', icon: 'megafone' },
  { to: '/videos', label: 'Vídeos', section: 'Conteúdo', icon: 'play' },
  { to: '/painel-tv', label: 'Painel TV', section: 'Conteúdo', icon: 'tv', blank: true, roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
  // SISTEMA
  { to: '/configuracoes', label: 'Configurações', section: 'Sistema', icon: 'settings', roles: ['CEO'] },
  { to: '/auditoria', label: 'Auditoria · Exclusões', section: 'Sistema', icon: 'lock', roles: ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'DIRETOR_JURIDICO'] },
  { to: '/bolsoes', label: 'Bolsões', section: 'Sócios', icon: 'roulette', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
  { to: '/cadencias', label: 'Cadências', section: 'Marketing', icon: 'clock', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
  { to: '/webhook-saidas', label: 'Webhooks Saída', section: 'Administração', icon: 'webhook', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
  { to: '/campos-custom', label: 'Campos Custom', section: 'Sistema', icon: 'settings', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
  { to: '/regras', label: 'Regras Automáticas', section: 'Sistema', icon: 'lightbulb', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
];

// Sidebar separado pro persona DEV — login DEV NÃO vê nada do CRM, só sistema.
const DEV_ITEMS: NavItem[] = [
  { to: '/dev/mensagens', label: 'Escala de envios', section: 'Painel DEV', icon: 'warn', roles: ['DEV'] },
  { to: '/dev/feedback', label: 'Bug Reports', section: 'Painel DEV', icon: 'bug', roles: ['DEV'] },
  { to: '/dev/logs', label: 'Audit Logs', section: 'Painel DEV', icon: 'scroll', roles: ['DEV'] },
  { to: '/dev/metrics', label: 'Métricas', section: 'Painel DEV', icon: 'gauge', roles: ['DEV'] },
];

export function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const navigate = useNavigate();
  const { user: ctxUser, setUser } = useUser();
  const [reportOpen, setReportOpen] = useState(false);
  // Prefere o user do contexto (atualiza ao trocar login).
  // Fallback Auth.user pra caso de race em montagem inicial.
  const user = ctxUser || Auth.user;
  if (!user) return null;

  const isDev = user.role === 'DEV';
  const items = isDev
    ? DEV_ITEMS
    : ALL_ITEMS.filter((it) => !it.roles || it.roles.includes(user.role));
  const sections: Record<string, NavItem[]> = {};
  items.forEach((it) => {
    (sections[it.section] = sections[it.section] || []).push(it);
  });

  const handleLogout = () => {
    setUser(null); // limpa localStorage + state React em uma chamada
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <img src="/assets/logo_white.png" alt="Grupo Pons Imobiliário" />
      </div>

      {Object.entries(sections).map(([title, secItems]) => (
        <div className="sidebar__section" key={title}>
          <div className="sidebar__section-title">{title}</div>
          <nav className="sidebar__nav">
            {secItems.map((it) =>
              it.blank ? (
                <a
                  key={it.to}
                  className="sidebar__nav-item"
                  href={it.to}
                  target="_blank"
                  rel="noopener"
                >
                  <Icon name={it.icon} />
                  {it.label}
                  <Icon name="external" className="icon" style={{ width: 12, height: 12, marginLeft: 'auto', opacity: 0.5 }} />
                </a>
              ) : (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={({ isActive }) =>
                    'sidebar__nav-item' + (isActive ? ' sidebar__nav-item--active' : '')
                  }
                >
                  <Icon name={it.icon} />
                  {it.label}
                </NavLink>
              ),
            )}
          </nav>
        </div>
      ))}

      <AppDownloadBlock />

      <div className="sidebar__footer">
        <NavLink to="/perfil" className="sidebar__user-link" title="Meu perfil">
          <div className="sidebar__user-avatar">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              user.initials || '?'
            )}
          </div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{user.name}</div>
            <div className="sidebar__user-role">
              {formatRole(user.role)}
              {user.unidade ? ' · ' + user.unidade.nome : ''}
            </div>
          </div>
        </NavLink>
        <button
          onClick={() => setReportOpen(true)}
          className="icon-button"
          title="Reportar problema"
          aria-label="Reportar problema"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.55)',
            width: 32,
            height: 32,
            cursor: 'pointer',
          }}
        >
          <Icon name="bug" />
        </button>
        <button
          onClick={handleLogout}
          className="icon-button"
          title="Sair"
          aria-label="Sair"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.55)',
            width: 32,
            height: 32,
            cursor: 'pointer',
          }}
        >
          <Icon name="logout" />
        </button>
      </div>
      <ReportarProblemaModal open={reportOpen} onClose={() => setReportOpen(false)} />
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Fechar menu"
          className="sidebar__close"
        >
          <Icon name="x" size={20} />
        </button>
      )}
    </aside>
  );
}

// Bloco "Baixe o aplicativo" — Google Play + App Store em cinza com tooltip "Em breve".
// Aparece no rodapé da sidebar antes do user-chip.
function AppDownloadBlock() {
  return (
    <div style={{ padding: '12px 14px 4px', marginTop: 'auto' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: 'rgba(255,255,255,0.55)',
          marginBottom: 8,
        }}
      >
        Baixe o aplicativo
      </div>
      <StoreButton label="Google Play" imgSrc="/assets/android.png" />
      <StoreButton label="App Store" imgSrc="/assets/apple.png" />
    </div>
  );
}

function StoreButton({ label, imgSrc }: { label: string; imgSrc: string }) {
  const [imgErr, setImgErr] = useState(false);
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'not-allowed',
        opacity: 0.55,
        color: 'rgba(255,255,255,0.65)',
        fontWeight: 700,
        fontSize: 13,
        userSelect: 'none',
        transition: 'opacity 200ms',
      }}
    >
      {imgErr ? (
        <Icon name={label.includes('Play') ? 'play' : 'phone'} size={18} />
      ) : (
        <img
          src={imgSrc}
          alt={label}
          onError={() => setImgErr(true)}
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      )}
      <span>{label}</span>
      {hover && (
        <span
          style={{
            position: 'absolute',
            top: '50%',
            right: 8,
            transform: 'translateY(-50%)',
            background: '#1E40AF',
            color: '#fff',
            padding: '4px 9px',
            borderRadius: 5,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          EM BREVE
        </span>
      )}
    </div>
  );
}
