import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Auth, formatRole, type Role } from '../lib/auth';
import { useUser } from '../lib/userContext';
import { Icon } from './Icon';
import { ReportarProblemaModal } from './ReportarProblemaModal';

// Sidebar minimalista — inspirada em CRMs modernos (Kairos / Chatwoot).
// Top level: 8-9 itens essenciais sempre visíveis (operação diária).
// Grupos colapsáveis pra menos atrito visual.
// Permissões: cada item declara seus roles; sem roles = todos veem.

const COMERCIAL: Role[] = ['CEO', 'DIRETOR_COMERCIAL', 'GERENTE_EQUIPE'];
const FINANCE: Role[] = ['CEO', 'DIRETOR_FINANCEIRO'];
const RELATORIOS: Role[] = ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO'];
const SOCIO: Role = 'SOCIO_UNIDADE';

type NavItem = {
  to: string;
  label: string;
  icon: string;
  badge?: number;
  blank?: boolean;
  roles?: Role[];
};

type NavGroup = {
  key: string;
  label: string;
  icon: string;
  items: NavItem[];
};

// ── TOP (sempre visível) ──────────────────────────────────────────────────
const TOP_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/chat', label: 'Atendimento', icon: 'chat', roles: [...COMERCIAL, 'CORRETOR', SOCIO] },
  { to: '/leads', label: 'Leads', icon: 'users', roles: [...COMERCIAL, 'CORRETOR', SOCIO] },
  { to: '/pipeline', label: 'Funil', icon: 'pipeline', roles: [...COMERCIAL, 'CORRETOR', SOCIO] },
  { to: '/vendas', label: 'Vendas', icon: 'sales', roles: [...COMERCIAL, 'CORRETOR', 'DIRETOR_FINANCEIRO', 'DIRETOR_JURIDICO', SOCIO] },
  { to: '/empreendimentos', label: 'Empreendimentos', icon: 'building' },
  { to: '/ranking', label: 'Ranking', icon: 'trophy' },
  { to: '/executivo', label: 'Agenda', icon: 'calendar', roles: ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'DIRETOR_JURIDICO', 'MARKETING', 'ASSESSORA'] },
];

// ── GRUPOS COLAPSÁVEIS ────────────────────────────────────────────────────
const GROUPS: NavGroup[] = [
  {
    key: 'equipe',
    label: 'Equipe',
    icon: 'users',
    items: [
      { to: '/corretores', label: 'Corretores', icon: 'users', roles: ['CEO', 'DIRETOR_COMERCIAL', SOCIO] },
      { to: '/equipes', label: 'Equipes', icon: 'team', roles: ['CEO', 'DIRETOR_COMERCIAL', SOCIO] },
      { to: '/distribuicao', label: 'Distribuição', icon: 'clock', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
      { to: '/roletas', label: 'Roletas', icon: 'roulette', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
      { to: '/bolsoes', label: 'Bolsões', icon: 'database', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
      { to: '/transferencias', label: 'Transferências', icon: 'arrow_right', roles: ['CEO', 'DIRETOR_COMERCIAL', 'GERENTE_EQUIPE'] },
      { to: '/tarefas', label: 'Tarefas', icon: 'tasks', roles: ['CEO', 'DIRETOR_JURIDICO', 'MARKETING', 'ASSESSORA', 'CORRETOR', 'GERENTE_EQUIPE'] },
    ],
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    icon: 'wallet',
    items: [
      { to: '/financeiro-pons', label: 'Rateio & Sócios', icon: 'wallet', roles: FINANCE },
      { to: '/financeiro', label: 'Caixa & Lançamentos', icon: 'dollar', roles: FINANCE },
      { to: '/meta-custos', label: 'Custos Meta', icon: 'target', roles: ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'MARKETING'] },
      { to: '/relatorios', label: 'Relatórios', icon: 'chart', roles: RELATORIOS },
      { to: '/painel-executivo', label: 'Painel Executivo', icon: 'activity', roles: RELATORIOS },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: 'megafone',
    items: [
      { to: '/trafego', label: 'Tráfego Pago', icon: 'target', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
      { to: '/bm', label: 'Business Managers', icon: 'facebook', roles: ['CEO', 'DIRETOR_COMERCIAL', 'CORRETOR', 'GERENTE_EQUIPE'] },
      { to: '/remarketing', label: 'Remarketing', icon: 'megafone', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
      { to: '/landing-pages', label: 'Landing Pages', icon: 'globe', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
      { to: '/heatmap', label: 'Heatmap', icon: 'fire', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
      { to: '/cadencias', label: 'Cadências', icon: 'clock', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
      { to: '/importar', label: 'Importar Leads', icon: 'plus', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
    ],
  },
  {
    key: 'conteudo',
    label: 'Conteúdo',
    icon: 'play',
    items: [
      { to: '/avisos', label: 'Avisos', icon: 'bell' },
      { to: '/videos', label: 'Vídeos', icon: 'play' },
      { to: '/painel-tv', label: 'Painel TV', icon: 'tv', blank: true, roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
    ],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    icon: 'settings',
    items: [
      { to: '/configuracoes', label: 'Configurações', icon: 'settings', roles: ['CEO'] },
      { to: '/agente-ia', label: 'Agentes IA', icon: 'bot', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
      { to: '/regras', label: 'Regras Automáticas', icon: 'zap', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
      { to: '/campos-custom', label: 'Campos Custom', icon: 'pencil', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
      { to: '/webhook-saidas', label: 'Webhooks', icon: 'webhook', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
      { to: '/auditoria', label: 'Auditoria', icon: 'lock', roles: ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'DIRETOR_JURIDICO'] },
    ],
  },
];

const DEV_ITEMS: NavItem[] = [
  { to: '/dev/mensagens', label: 'Escala de envios', icon: 'warn' },
  { to: '/dev/feedback', label: 'Bug Reports', icon: 'bug' },
  { to: '/dev/logs', label: 'Audit Logs', icon: 'scroll' },
  { to: '/dev/metrics', label: 'Métricas', icon: 'gauge' },
];

// Adiciona chevron-right ao Icon component lá embaixo só pra esse Sidebar.

function canSee(it: NavItem, role: Role): boolean {
  if (!it.roles) return true;
  return it.roles.includes(role);
}

export function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const navigate = useNavigate();
  const { user: ctxUser, setUser } = useUser();
  const [reportOpen, setReportOpen] = useState(false);
  // Estado de quais grupos estão expandidos. Persiste em localStorage.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('pons.sidebarGroups') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('pons.sidebarGroups', JSON.stringify(openGroups));
  }, [openGroups]);

  const user = ctxUser || Auth.user;
  if (!user) return null;

  const isDev = user.role === 'DEV';
  const role = user.role;

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  const toggleGroup = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <img src="/assets/logo_white.png" alt="Grupo Pons Imobiliário" />
      </div>

      <nav className="sidebar__nav">
        {isDev ? (
          DEV_ITEMS.map((it) => <NavItemLink key={it.to} item={it} />)
        ) : (
          <>
            {/* Top items sem header — primeiro contato é direto */}
            {TOP_ITEMS.filter((it) => canSee(it, role)).map((it) => (
              <NavItemLink key={it.to} item={it} />
            ))}

            {/* Grupos colapsáveis */}
            {GROUPS.map((g) => {
              const visible = g.items.filter((it) => canSee(it, role));
              if (visible.length === 0) return null;
              const open = !!openGroups[g.key];
              return (
                <div key={g.key} className="sidebar__group">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.key)}
                    className={'sidebar__group-trigger' + (open ? ' is-open' : '')}
                  >
                    <Icon name={g.icon} />
                    <span className="sidebar__group-label">{g.label}</span>
                    <Icon name="chevron-right" className="sidebar__group-chevron" />
                  </button>
                  {open && (
                    <div className="sidebar__group-children">
                      {visible.map((it) => (
                        <NavItemLink key={it.to} item={it} nested />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </nav>

      <div className="sidebar__footer">
        <NavLink to="/perfil" className="sidebar__user-link" title="Meu perfil">
          <div className="sidebar__user-avatar">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} />
            ) : (
              <span>{user.initials || '?'}</span>
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
          className="sidebar__footer-btn"
          title="Reportar problema"
          aria-label="Reportar problema"
        >
          <Icon name="bug" />
        </button>
        <button
          onClick={handleLogout}
          className="sidebar__footer-btn"
          title="Sair"
          aria-label="Sair"
        >
          <Icon name="logout" />
        </button>
      </div>

      <ReportarProblemaModal open={reportOpen} onClose={() => setReportOpen(false)} />
      {onClose && (
        <button onClick={onClose} aria-label="Fechar menu" className="sidebar__close">
          <Icon name="x" size={20} />
        </button>
      )}
    </aside>
  );
}

function NavItemLink({ item, nested }: { item: NavItem; nested?: boolean }) {
  if (item.blank) {
    return (
      <a
        className={'sidebar__item' + (nested ? ' sidebar__item--nested' : '')}
        href={item.to}
        target="_blank"
        rel="noopener"
      >
        <Icon name={item.icon} />
        <span className="sidebar__item-label">{item.label}</span>
        <Icon name="external" className="sidebar__item-meta" />
      </a>
    );
  }
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        'sidebar__item' + (nested ? ' sidebar__item--nested' : '') + (isActive ? ' sidebar__item--active' : '')
      }
    >
      <Icon name={item.icon} />
      <span className="sidebar__item-label">{item.label}</span>
      {typeof item.badge === 'number' && item.badge > 0 && (
        <span className="sidebar__item-badge">{item.badge}</span>
      )}
    </NavLink>
  );
}
