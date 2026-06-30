import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Auth, formatRole, type Role } from '../lib/auth';
import { useUser } from '../lib/userContext';
import { Icon } from './Icon';
import { ReportarProblemaModal } from './ReportarProblemaModal';

// Sidebar estilo BRK: perfil no topo, favoritos com estrela, grupos
// colapsáveis e modo recolhido (só-ícones). Mantém as rotas/permissões da Pons.
// Cores do sistema: cinza #8c8c8c (texto neutro) + azul-ciano #52f7fe (acento).

const COMERCIAL: Role[] = ['CEO', 'DIRETOR_COMERCIAL', 'GERENTE_EQUIPE'];
const DIR_FINANCE: Role[] = ['CEO', 'DIRETOR_FINANCEIRO'];
const FINANCE: Role[] = ['CEO', 'DIRETOR_FINANCEIRO', 'FINANCEIRO'];
const RELATORIOS: Role[] = ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'FINANCEIRO'];
const SOCIO: Role = 'SOCIO_UNIDADE';

type NavItem = {
  to: string;
  label: string;
  icon: string;
  badge?: number;
  blank?: boolean;
  roles?: Role[];
  emails?: string[]; // gate por pessoa (área privada) — tem prioridade sobre roles
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
  { to: '/vendas', label: 'Vendas', icon: 'sales', roles: [...COMERCIAL, 'CORRETOR', 'DIRETOR_FINANCEIRO', 'FINANCEIRO', 'DIRETOR_JURIDICO', SOCIO] },
  { to: '/empreendimentos', label: 'Empreendimentos', icon: 'building' },
  { to: '/ranking', label: 'Ranking', icon: 'trophy' },
  { to: '/executivo', label: 'Agenda', icon: 'calendar', roles: ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'FINANCEIRO', 'DIRETOR_JURIDICO', 'MARKETING', 'ASSESSORA'] },
  { to: '/pessoal', label: 'Meu Espaço', icon: 'crown', emails: ['paulo@grupopons.com.br'] },
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
      { to: '/financeiro-pons', label: 'Rateio & Sócios', icon: 'wallet', roles: [...DIR_FINANCE, 'FINANCEIRO'] },
      { to: '/onboarding-aprovacoes', label: 'Contratações', icon: 'users', roles: FINANCE },
      { to: '/financeiro', label: 'Caixa & Lançamentos', icon: 'dollar', roles: FINANCE },
      { to: '/meta-custos', label: 'Custos Meta', icon: 'target', roles: ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'FINANCEIRO', 'MARKETING'] },
      { to: '/relatorios', label: 'Relatórios', icon: 'chart', roles: RELATORIOS },
      { to: '/painel-executivo', label: 'Painel Executivo', icon: 'activity', roles: ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'FINANCEIRO'] },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: 'megafone',
    items: [
      // Aba "Tráfego Pago" removida do menu a pedido — rota /trafego e a página seguem existindo.
      // { to: '/trafego', label: 'Tráfego Pago', icon: 'target', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
      { to: '/inteligencia-leads', label: 'Inteligência de Leads', icon: 'chart', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING', 'DIRETOR_FINANCEIRO'] },
      { to: '/bm', label: 'Business Managers', icon: 'facebook', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING', 'CORRETOR', 'GERENTE_EQUIPE'] },
      { to: '/remarketing', label: 'Remarketing', icon: 'megafone', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
      { to: '/campanhas', label: 'Campanhas', icon: 'chat', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
      { to: '/distribuicao', label: 'Distribuição', icon: 'clock', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
      { to: '/importar', label: 'Importar Leads', icon: 'plus', roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
    ],
  },
  {
    key: 'conteudo',
    label: 'Conteúdo',
    icon: 'book-open',
    items: [
      { to: '/avisos', label: 'Avisos', icon: 'bell' },
      { to: '/videos', label: 'Vídeos', icon: 'video' },
      { to: '/reuniao', label: 'Reunião', icon: 'users', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
      { to: '/painel-tv', label: 'Painel TV', icon: 'tv', blank: true, roles: ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'] },
    ],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    icon: 'settings',
    items: [
      { to: '/configuracoes', label: 'Configurações', icon: 'settings', roles: ['CEO'] },
      { to: '/equipe', label: 'Equipe', icon: 'team', roles: ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_JURIDICO'] },
      { to: '/agente-ia', label: 'Agentes IA', icon: 'bot', roles: ['CEO', 'DIRETOR_COMERCIAL'] },
      { to: '/auditoria', label: 'Auditoria', icon: 'lock', roles: ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_JURIDICO'] },
    ],
  },
];

const DEV_ITEMS: NavItem[] = [
  { to: '/dev/mensagens', label: 'Escala de envios', icon: 'warn' },
  { to: '/dev/feedback', label: 'Bug Reports', icon: 'bug' },
  { to: '/dev/logs', label: 'Audit Logs', icon: 'scroll' },
  { to: '/dev/metrics', label: 'Métricas', icon: 'gauge' },
];

const TODOS_ITENS: NavItem[] = [...TOP_ITEMS, ...GROUPS.flatMap((g) => g.items)];

// GESTOR = "tudo menos Financeiro + gestão de usuários/sistema". Espelha a
// blindagem do backend (requireRoleExato): vê tudo, menos estes destinos.
const GESTOR_BLOQUEADO = new Set([
  // Seção Financeiro inteira
  '/financeiro-pons', '/onboarding-aprovacoes', '/financeiro', '/meta-custos', '/relatorios', '/painel-executivo',
  // Gestão de usuários + sistema (só CEO)
  '/equipe', '/configuracoes', '/auditoria',
]);

function canSee(it: NavItem, role: Role, email?: string): boolean {
  if (it.emails) return !!email && it.emails.includes(email);
  // Equipe Financeiro = perfil restrito: vê só o Dashboard + os itens do Financeiro.
  if (role === 'FINANCEIRO') return it.to === '/dashboard' || (!!it.roles && it.roles.includes('FINANCEIRO'));
  // Gestor: vê tudo, exceto os destinos bloqueados acima.
  if (role === 'GESTOR') return !GESTOR_BLOQUEADO.has(it.to);
  if (!it.roles) return true;
  return it.roles.includes(role);
}

// ── Favoritos (persistidos em localStorage) ────────────────────────────────
const FAV_KEY = 'pons.sidebarFavoritos';
function useFavoritos() {
  const [favoritos, setFavoritos] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favoritos)); } catch { /* noop */ }
  }, [favoritos]);
  const toggleFav = (to: string) =>
    setFavoritos((cur) => (cur.includes(to) ? cur.filter((x) => x !== to) : [...cur, to]));
  return { favoritos, toggleFav };
}

export function Sidebar({
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
} = {}) {
  const navigate = useNavigate();
  const { user: ctxUser, setUser } = useUser();
  const { favoritos, toggleFav } = useFavoritos();
  const [reportOpen, setReportOpen] = useState(false);
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

  // Itens visíveis ao usuário (pra resolver favoritos e o modo recolhido).
  const itensVisiveis = isDev
    ? DEV_ITEMS
    : TODOS_ITENS.filter((it) => canSee(it, role, user.email));
  const favItems = favoritos
    .map((to) => itensVisiveis.find((i) => i.to === to))
    .filter(Boolean) as NavItem[];

  return (
    <aside className={'sidebar' + (collapsed ? ' sidebar--collapsed' : '')}>
      <div className="sidebar__logo">
        <img className="sidebar__logo-dark" src="/assets/logo_white.png" alt="Grupo Pons Imobiliário" />
        <img className="sidebar__logo-light" src="/assets/logo_black.png" alt="Grupo Pons Imobiliário" />
      </div>

      {/* Perfil no topo (estilo BRK) */}
      <NavLink to="/perfil" className="sidebar__profile" title="Meu perfil">
        <div className="sidebar__profile-avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} /> : <span>{user.initials || '?'}</span>}
          <span className="sidebar__profile-status" title="Online" />
        </div>
        {!collapsed && (
          <div className="sidebar__profile-info">
            <span className="sidebar__profile-name">{user.name}</span>
            <span className="sidebar__profile-role">
              {formatRole(user.role)}
              {user.unidade ? ' · ' + user.unidade.nome : ''}
            </span>
          </div>
        )}
      </NavLink>

      <nav className="sidebar__nav">
        {isDev ? (
          DEV_ITEMS.map((it) => (
            <NavItemLink key={it.to} item={it} collapsed={collapsed} />
          ))
        ) : collapsed ? (
          // Modo recolhido: tudo plano, só-ícones.
          itensVisiveis.map((it) => <NavItemLink key={it.to} item={it} collapsed />)
        ) : (
          <>
            {/* Favoritos */}
            {favItems.length > 0 && (
              <div className="sidebar__group sidebar__group--fav">
                <span className="sidebar__group-label sidebar__group-label--standalone">Favoritos</span>
                {favItems.map((it) => (
                  <NavItemLink
                    key={it.to}
                    item={it}
                    favorito
                    onToggleFav={() => toggleFav(it.to)}
                  />
                ))}
              </div>
            )}

            {/* Top items sem header */}
            {TOP_ITEMS.filter((it) => canSee(it, role, user.email)).map((it) => (
              <NavItemLink
                key={it.to}
                item={it}
                favorito={favoritos.includes(it.to)}
                onToggleFav={() => toggleFav(it.to)}
              />
            ))}

            {/* Grupos colapsáveis */}
            {GROUPS.map((g) => {
              const visible = g.items.filter((it) => canSee(it, role, user.email));
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
                        <NavItemLink
                          key={it.to}
                          item={it}
                          nested
                          favorito={favoritos.includes(it.to)}
                          onToggleFav={() => toggleFav(it.to)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </nav>

      {!collapsed && <AppDownloadBlock />}

      <div className="sidebar__footer">
        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar__collapse-toggle"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <Icon name="chevron-right" className={'sidebar__collapse-chevron' + (collapsed ? '' : ' flip')} />
            {!collapsed && <span className="sidebar__footer-label">Recolher</span>}
          </button>
        )}
        {!collapsed && (
          <button
            onClick={() => setReportOpen(true)}
            className="sidebar__footer-btn"
            title="Reportar problema"
            aria-label="Reportar problema"
          >
            <Icon name="bug" />
          </button>
        )}
        <button
          onClick={handleLogout}
          className={'sidebar__footer-btn' + (collapsed ? ' sidebar__footer-btn--block' : '')}
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

function NavItemLink({
  item,
  nested,
  collapsed,
  favorito,
  onToggleFav,
}: {
  item: NavItem;
  nested?: boolean;
  collapsed?: boolean;
  favorito?: boolean;
  onToggleFav?: () => void;
}) {
  const inner = (
    <>
      <Icon name={item.icon} />
      {!collapsed && <span className="sidebar__item-label">{item.label}</span>}
      {!collapsed && item.blank && <Icon name="external" className="sidebar__item-meta" />}
      {!collapsed && typeof item.badge === 'number' && item.badge > 0 && (
        <span className="sidebar__item-badge">{item.badge}</span>
      )}
    </>
  );

  const cls = (active = false) =>
    'sidebar__item' +
    (nested ? ' sidebar__item--nested' : '') +
    (collapsed ? ' sidebar__item--icon' : '') +
    (active ? ' sidebar__item--active' : '');

  const link = item.blank ? (
    <a className={cls()} href={item.to} target="_blank" rel="noopener" title={item.label}>
      {inner}
    </a>
  ) : (
    <NavLink to={item.to} className={({ isActive }) => cls(isActive)} title={item.label}>
      {inner}
    </NavLink>
  );

  // No modo recolhido não há wrapper de favorito (sem espaço pra estrela).
  if (collapsed || !onToggleFav) return collapsed ? link : <div className="sidebar__item-wrap">{link}</div>;

  return (
    <div className="sidebar__item-wrap">
      {link}
      <button
        type="button"
        className={'sidebar__fav' + (favorito ? ' on' : '')}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(); }}
        title={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      >
        <Icon name="star" />
      </button>
    </div>
  );
}

// Bloco "Baixe o aplicativo" — Google Play + App Store em cinza com tooltip "Em breve".
function AppDownloadBlock() {
  return (
    <div className="sidebar__app-download">
      <div className="sidebar__app-download-title">Baixe o aplicativo</div>
      <div className="sidebar__app-download-row">
        <div className="sidebar__app-badge" title="Em breve">
          <img src="/assets/apple.png" alt="App Store" />
          <span>App Store</span>
        </div>
        <div className="sidebar__app-badge" title="Em breve">
          <img src="/assets/android.png" alt="Google Play" />
          <span>Google Play</span>
        </div>
      </div>
    </div>
  );
}
