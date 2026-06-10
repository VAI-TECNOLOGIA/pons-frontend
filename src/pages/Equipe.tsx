// Equipe — Hierarquia organizacional copiada pixel-perfect do VAI CRM.
// 4 abas: Usuários, Departamentos, Hierarquia (organograma), Níveis.
// Acesso restrito a admin (CEO + Diretores).

import { useState } from 'react';
import { Topbar } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { useApi } from '../lib/useApi';
import { Api } from '../lib/api';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import './equipe.css';

type Tab = 'usuarios' | 'departamentos' | 'hierarquia' | 'niveis';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'usuarios',      label: 'Usuários',      icon: 'users' },
  { id: 'departamentos', label: 'Departamentos', icon: 'building' },
  { id: 'hierarquia',    label: 'Hierarquia',    icon: 'pipeline' },
  { id: 'niveis',        label: 'Níveis',        icon: 'database' },
];

export default function Equipe() {
  const [tab, setTab] = useState<Tab>('usuarios');

  return (
    <>
      <Topbar title="Equipe" />
      <div className="equipe">
        <aside className="equipe__side">
          <div className="equipe__side-title">Equipe</div>
          <nav className="equipe__nav">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={'equipe__nav-item' + (tab === t.id ? ' is-active' : '')}
                onClick={() => setTab(t.id)}
              >
                <Icon name={t.icon} size={18} /> {t.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="equipe__main">
          {tab === 'usuarios' && <AbaUsuarios />}
          {tab === 'departamentos' && <AbaDepartamentos />}
          {tab === 'hierarquia' && <AbaHierarquia />}
          {tab === 'niveis' && <AbaNiveis />}
        </main>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function KpiPills({ users }: { users: any[] }) {
  // Conta usuários por nível (mostra só Dono pra refletir VAI). Em produção
  // mostra cada nível com count > 0.
  const byLevel: Record<string, number> = {};
  users.forEach((u) => {
    const code = u.nivel?.code || '—';
    byLevel[code] = (byLevel[code] || 0) + 1;
  });
  const onlineCount = users.filter((u) => u.online).length;

  return (
    <div className="equipe__kpis">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.entries(byLevel).map(([code, num]) => {
          const u = users.find((x) => x.nivel?.code === code);
          const nome = u?.nivel?.nome || code;
          return (
            <div key={code} className="equipe__kpi">
              <span className="equipe__kpi-star"><Icon name="star" size={12} /></span>
              <span className="equipe__kpi-num">{num}</span>
              <span className="equipe__kpi-label">{nome}</span>
            </div>
          );
        })}
      </div>
      <div className="equipe__kpi equipe__kpi--online">
        <span className="equipe__kpi-num">{onlineCount}</span>
        <span className="equipe__kpi-label">online agora</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA: USUÁRIOS
// ═══════════════════════════════════════════════════════════════════════════

function AbaUsuarios() {
  const [search, setSearch] = useState('');
  const [novoOpen, setNovoOpen] = useState(false);
  const { data: users, loading, reload } = useApi<any[]>(() => Api.equipeUsers(search), [search]);
  const { data: levels } = useApi<any[]>(() => Api.equipeLevels());
  const toast = useToast();

  const toggleAtivo = async (id: number) => {
    try { await Api.equipeUserToggleActive(id); reload(); }
    catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const lista = users || [];

  return (
    <div>
      <div className="equipe__page-head">
        <h1 className="equipe__page-title">Usuários</h1>
        <p className="equipe__page-sub">Gerencie contas, níveis de acesso e departamentos</p>
      </div>

      <div className="equipe__toolbar">
        <div className="equipe__search">
          <Icon name="search" size={14} />
          <input
            type="text"
            placeholder="Buscar por nome, email ou departamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="equipe__filter">Todos <Icon name="arrow_down" size={12} /></button>
        <button className="equipe__filter">Todos <Icon name="arrow_down" size={12} /></button>
        <div className="equipe__count">{lista.length} usuário{lista.length !== 1 ? 's' : ''}</div>
        <button className="btn-novo" onClick={() => setNovoOpen(true)}>
          <Icon name="plus" size={14} /> Novo
        </button>
      </div>

      <KpiPills users={lista} />

      {loading ? (
        <div className="equipe__empty-state"><div className="equipe__empty-sub">Carregando…</div></div>
      ) : (
        <div className="equipe__table-wrap">
          <table className="equipe__table">
            <thead>
              <tr>
                <th>Usuário <span className="sort-arrow"><Icon name="arrow_down" size={10} /></span></th>
                <th>Nível <span className="sort-arrow"><Icon name="arrow_down" size={10} /></span></th>
                <th>Gestor</th>
                <th>Equipes <span className="sort-arrow"><Icon name="arrow_down" size={10} /></span></th>
                <th>Status <span className="sort-arrow"><Icon name="arrow_down" size={10} /></span></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="equipe__user-cell">
                      <div className="equipe__avatar">
                        {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} /> : <span>{u.initials || u.name[0]}</span>}
                        <span className={'equipe__online-dot' + (u.online ? ' equipe__online-dot--on' : '')} />
                      </div>
                      <div>
                        <div className="equipe__user-name">{u.name}</div>
                        <div className="equipe__user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {u.nivel ? (
                      <span className="equipe__nivel-badge">
                        <Icon name="star" size={11} /> {u.nivel.nome}
                      </span>
                    ) : '—'}
                  </td>
                  <td>{u.manager?.name || '—'}</td>
                  <td>
                    {u.equipes?.length ? u.equipes.map((e: any) => (
                      <span key={e.id} className="equipe__dept-chip" style={{ background: e.cor + '22', color: e.cor }}>{e.nome}</span>
                    )) : '—'}
                  </td>
                  <td>
                    <label className="equipe__switch">
                      <input type="checkbox" checked={u.active} onChange={() => toggleAtivo(u.id)} />
                      <span className="equipe__switch-slider" />
                      <span className="equipe__switch-label">{u.active ? 'Ativo' : 'Inativo'}</span>
                    </label>
                  </td>
                  <td>
                    <button className="equipe__icon-btn" title="Editar"><Icon name="pencil" size={14} /></button>
                  </td>
                </tr>
              ))}
              {!lista.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="equipe__pagination" style={{ padding: '16px 18px' }}>
            <span>Página 1 de 1 • {lista.length} resultado{lista.length !== 1 ? 's' : ''} total • {lista.length} na página atual</span>
            <div className="equipe__pagination-btns">
              <button className="equipe__pagination-btn" disabled><Icon name="arrow_left" size={12} /> Anterior</button>
              <button className="equipe__pagination-btn" disabled>Próximo <Icon name="arrow_right" size={12} /></button>
            </div>
          </div>
        </div>
      )}

      {novoOpen && (
        <NovoUsuarioModal
          levels={levels || []}
          onClose={() => setNovoOpen(false)}
          onSaved={() => { setNovoOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

// Side-drawer (não modal centralizado). Visual VAI: header com avatar circular
// + título, scroll interno, footer fixo. Foco no fluxo simplificado: criar
// Gerente (Comercial ou Financeiro) e escolher as equipes que ele gerencia.
function NovoUsuarioModal({ levels, onClose, onSaved }: any) {
  const toast = useToast();
  const { data: equipes } = useApi<any[]>(() => Api.equipeEquipesList());
  const [form, setForm] = useState({
    nome: '', sobrenome: '', email: '', password: '', phone: '',
    role: 'GERENTE_EQUIPE' as 'GERENTE_EQUIPE' | 'DIRETOR_FINANCEIRO',
    hierarchyLevelId: levels.find((l: any) => l.code === 'manager')?.id || null,
    equipeIds: [] as number[],
    active: true,
  });
  const [confirmPass, setConfirmPass] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.nome || !form.email || !form.password) return toast.error('Preencha nome, email e senha.');
    if (form.password !== confirmPass) return toast.error('As senhas não conferem.');
    if (form.role === 'GERENTE_EQUIPE' && !form.equipeIds.length) {
      return toast.error('Selecione pelo menos uma equipe pra esse gestor gerenciar.');
    }
    setSaving(true);
    try {
      await Api.equipeUserCreate({
        name: `${form.nome} ${form.sobrenome}`.trim(),
        email: form.email,
        password: form.password,
        phone: form.phone || null,
        role: form.role,
        hierarchyLevelId: form.hierarchyLevelId,
        equipeIds: form.equipeIds,
        active: form.active,
      });
      toast.success('Usuário criado');
      onSaved();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="user-drawer__overlay" onClick={onClose}>
      <div className="user-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="user-drawer__header">
          <div className="user-drawer__icon">
            <Icon name="users" size={22} />
          </div>
          <h2 className="user-drawer__title">Novo Usuário</h2>
          <button className="user-drawer__close" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="user-drawer__body">
          <section>
            <p className="user-drawer__sec">DADOS PESSOAIS</p>
            <div className="user-drawer__row-2">
              <label className="user-drawer__field">
                <span>Nome *</span>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="João" />
              </label>
              <label className="user-drawer__field">
                <span>Sobrenome *</span>
                <input value={form.sobrenome} onChange={(e) => setForm({ ...form, sobrenome: e.target.value })} placeholder="Silva" />
              </label>
            </div>
            <label className="user-drawer__field">
              <span>E-mail *</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="joao.silva@empresa.com" />
            </label>
            <label className="user-drawer__field">
              <span>Telefone</span>
              <div className="user-drawer__phone">
                <div className="user-drawer__phone-ddi">
                  <span className="user-drawer__flag">🇧🇷</span>
                  <Icon name="arrow_down" size={10} />
                </div>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
            </label>
          </section>

          <section>
            <p className="user-drawer__sec">CARGO</p>
            <div className="user-drawer__role-grid">
              <button
                type="button"
                className={'user-drawer__role' + (form.role === 'GERENTE_EQUIPE' ? ' is-active' : '')}
                onClick={() => setForm({ ...form, role: 'GERENTE_EQUIPE' })}
              >
                <Icon name="users" size={16} />
                <div className="user-drawer__role-name">Gerente Comercial</div>
                <div className="user-drawer__role-sub">Vê as conversas e leads das equipes que gerencia</div>
              </button>
              <button
                type="button"
                className={'user-drawer__role' + (form.role === 'DIRETOR_FINANCEIRO' ? ' is-active' : '')}
                onClick={() => setForm({ ...form, role: 'DIRETOR_FINANCEIRO' })}
              >
                <Icon name="wallet" size={16} />
                <div className="user-drawer__role-name">Gerente Financeiro</div>
                <div className="user-drawer__role-sub">Acesso aos rateios, fechamentos e relatórios financeiros</div>
              </button>
            </div>
          </section>

          {form.role === 'GERENTE_EQUIPE' && (
            <section>
              <p className="user-drawer__sec">EQUIPES QUE VAI GERENCIAR *</p>
              <p className="user-drawer__hint">
                Esse usuário só vai ver dados (leads, atendimento, vendas) das equipes que você selecionar.
              </p>
              <div className="user-drawer__equipes">
                {(equipes || []).length === 0 ? (
                  <p className="user-drawer__warn">Nenhuma equipe cadastrada ainda. Crie em Administração → Equipes.</p>
                ) : (
                  (equipes || []).map((e: any) => (
                    <label key={e.id} className={'user-drawer__equipe' + (form.equipeIds.includes(e.id) ? ' is-selected' : '')}>
                      <input
                        type="checkbox"
                        checked={form.equipeIds.includes(e.id)}
                        onChange={(ev) => {
                          const next = ev.target.checked
                            ? [...form.equipeIds, e.id]
                            : form.equipeIds.filter((x) => x !== e.id);
                          setForm({ ...form, equipeIds: next });
                        }}
                      />
                      <span style={{ background: e.cor }} className="user-drawer__equipe-dot" />
                      <div>
                        <div className="user-drawer__equipe-nome">{e.nome}</div>
                        {e.unidade && <div className="user-drawer__equipe-sub">{e.unidade}</div>}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </section>
          )}

          <section>
            <p className="user-drawer__sec">SENHA DE ACESSO</p>
            <div className="user-drawer__row-2">
              <label className="user-drawer__field">
                <span>Senha *</span>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
              </label>
              <label className="user-drawer__field">
                <span>Confirmar senha *</span>
                <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="Repita a senha" />
              </label>
            </div>
          </section>
        </div>

        <footer className="user-drawer__footer">
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-novo" onClick={submit} disabled={saving}>{saving ? 'Criando…' : 'Criar usuário'}</button>
        </footer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA: DEPARTAMENTOS
// ═══════════════════════════════════════════════════════════════════════════

function AbaDepartamentos() {
  const [search, setSearch] = useState('');
  const { data, reload } = useApi<any[]>(() => Api.equipeDepartments());
  const [novoOpen, setNovoOpen] = useState(false);
  const toast = useToast();

  const submit = async (form: any) => {
    try {
      await Api.equipeDepartmentCreate(form);
      toast.success('Departamento criado');
      setNovoOpen(false);
      reload();
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const lista = (data || []).filter((d) => d.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="equipe__page-head">
        <h1 className="equipe__page-title">Departamentos</h1>
        <p className="equipe__page-sub">Organize equipes e defina capacidades de atendimento</p>
      </div>

      <div className="equipe__toolbar">
        <div className="equipe__search">
          <Icon name="search" size={14} />
          <input type="text" placeholder="Buscar departamento..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="equipe__filter">Todos <Icon name="arrow_down" size={12} /></button>
        <div className="equipe__count">{lista.length} departamento{lista.length !== 1 ? 's' : ''}</div>
        <button className="btn-novo" onClick={() => setNovoOpen(true)}>
          <Icon name="plus" size={14} /> Novo
        </button>
      </div>

      <div className="equipe__panel">
        {lista.length === 0 ? (
          <div className="equipe__empty-state">
            <div className="equipe__empty-icon"><Icon name="building" size={26} /></div>
            <div className="equipe__empty-title">Nenhum departamento encontrado</div>
            <div className="equipe__empty-sub">Crie seu primeiro departamento para organizar sua equipe.</div>
            <button className="btn-novo" onClick={() => setNovoOpen(true)}>
              <Icon name="plus" size={14} /> Novo Departamento
            </button>
          </div>
        ) : (
          <div className="equipe__dep-grid">
            {lista.map((d) => (
              <div key={d.id} className="equipe__dep-card">
                <div className="equipe__dep-cor" style={{ background: d.cor }} />
                <div style={{ flex: 1 }}>
                  <div className="equipe__dep-nome">{d.nome}</div>
                  {d.descricao && <div className="equipe__dep-desc">{d.descricao}</div>}
                  <div className="equipe__dep-meta">{d.usersCount || 0} membro{d.usersCount === 1 ? '' : 's'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {novoOpen && <NovoDeptModal onClose={() => setNovoOpen(false)} onSave={submit} />}
    </div>
  );
}

function NovoDeptModal({ onClose, onSave }: any) {
  const [form, setForm] = useState({ nome: '', descricao: '', cor: '#1258CA' });
  const cores = ['#1258CA', '#22C55E', '#EAB308', '#EF4444', '#A855F7', '#06B6D4'];

  return (
    <Modal open={true} onClose={onClose} title="Novo departamento" size="sm"
      footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-novo" onClick={() => onSave(form)}>Criar</button>
      </div>}>
      <div className="novo-nivel">
        <label className="field">
          <span className="field__label">Nome *</span>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Comercial BC" />
        </label>
        <label className="field">
          <span className="field__label">Descrição (opcional)</span>
          <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        </label>
        <div>
          <span className="field__label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Cor</span>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {cores.map((c) => (
              <button key={c} type="button"
                onClick={() => setForm({ ...form, cor: c })}
                style={{
                  background: c, width: 28, height: 28,
                  border: form.cor === c ? '3px solid var(--text-primary)' : '1px solid var(--border-light)',
                  borderRadius: 6, cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA: HIERARQUIA (organograma)
// ═══════════════════════════════════════════════════════════════════════════

function AbaHierarquia() {
  const { data } = useApi<any>(() => Api.equipeHierarchyTree());
  const { data: users } = useApi<any[]>(() => Api.equipeUsers());
  const roots = data?.roots || [];
  const lista = users || [];

  // Agrupa por nível (ordem)
  const byLevel: Record<string, any[]> = {};
  lista.forEach((u) => {
    const key = u.nivel?.code || 'sem_nivel';
    (byLevel[key] = byLevel[key] || []).push(u);
  });

  return (
    <div>
      <div className="equipe__page-head">
        <h1 className="equipe__page-title">Hierarquia Organizacional</h1>
        <p className="equipe__page-sub">Visualize e gerencie a estrutura de gestão da equipe</p>
      </div>

      <KpiPills users={lista} />

      <div className="equipe__org-card">
        <div className="equipe__org-head">
          <span className="equipe__org-title">Organograma</span>
          <div className="equipe__org-controls">
            <button className="equipe__org-btn" disabled>Expandir</button>
            <button className="equipe__org-btn">Colapsar</button>
            <span className="equipe__org-zoom">
              <button><Icon name="search" size={14} /></button>
              <span>100%</span>
              <button><Icon name="search" size={14} /></button>
            </span>
            <button className="equipe__org-btn">Confortável</button>
          </div>
        </div>
        <div className="equipe__org-canvas">
          {roots.map((r: any) => <OrgNode key={r.id} node={r} />)}
          {!roots.length && <div className="equipe__empty-sub">Nenhum usuário cadastrado ainda.</div>}
        </div>
      </div>

      {/* Lista agrupada por nível */}
      {Object.entries(byLevel).map(([code, members]) => {
        const lv = members[0]?.nivel;
        return (
          <div key={code} className="equipe__level-group">
            <div className="equipe__level-group-head">
              {lv?.nome || 'Sem nível'} <span className="count">{members.length}</span>
            </div>
            {members.map((u) => (
              <div key={u.id} className="equipe__user-row">
                <div className="equipe__avatar">
                  {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} /> : <span>{u.initials || u.name[0]}</span>}
                  <span className={'equipe__online-dot' + (u.online ? ' equipe__online-dot--on' : '')} />
                </div>
                <div>
                  <div className="equipe__user-name">{u.name}</div>
                  <div className="equipe__user-email">{u.email}</div>
                </div>
                {lv && (
                  <span className="equipe__nivel-badge">
                    <Icon name="star" size={11} /> {lv.nome}
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function OrgNode({ node }: { node: any }) {
  return (
    <div>
      <div className="org-node__card">
        <div className="equipe__avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
          {node.avatarUrl ? <img src={node.avatarUrl} alt={node.name} /> : <span>{node.initials}</span>}
          {node.online && <span className="equipe__online-dot equipe__online-dot--on" />}
        </div>
        <div className="org-node__nome">{node.name}</div>
        {node.nivel && (
          <div className="org-node__nivel">
            <Icon name="star" size={11} /> {node.nivel.nome}
          </div>
        )}
      </div>
      {node.children?.length > 0 && (
        <div style={{ marginLeft: 28, paddingLeft: 12, borderLeft: '2px dashed var(--border-light)', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {node.children.map((c: any) => <OrgNode key={c.id} node={c} />)}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA: NÍVEIS
// ═══════════════════════════════════════════════════════════════════════════

function AbaNiveis() {
  const { data: levels, reload } = useApi<any[]>(() => Api.equipeLevels());
  const [novoOpen, setNovoOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const toast = useToast();

  const criar = async (data: any) => {
    try { await Api.equipeLevelCreate(data); toast.success('Nível criado'); setNovoOpen(false); reload(); }
    catch (e: any) { toast.error('Erro: ' + e.message); }
  };
  const salvarEdit = async (data: any) => {
    try { await Api.equipeLevelUpdate(editing.id, data); toast.success('Nível atualizado'); setEditing(null); reload(); }
    catch (e: any) { toast.error('Erro: ' + e.message); }
  };
  const deletar = async (id: number) => {
    if (!confirm('Remover este nível? Só funciona se nenhum usuário estiver vinculado.')) return;
    try { await Api.equipeLevelDelete(id); toast.success('Nível removido'); reload(); }
    catch (e: any) { toast.error('Erro: ' + (e.message || 'falha')); }
  };

  return (
    <div>
      <div className="equipe__page-head">
        <h1 className="equipe__page-title">Níveis de Hierarquia</h1>
        <p className="equipe__page-sub">Renomeie níveis padrão e crie níveis customizados (ex: Analista)</p>
      </div>

      <div className="equipe__panel">
        <div className="equipe__panel-head">
          <div>
            <h2>Níveis de hierarquia</h2>
            <p>
              Os 5 níveis padrão (Dono, Gerente, Coordenador, Supervisor, Agente) podem ser renomeados. Você também pode criar níveis customizados (ex: "Analista") posicionando-os entre os existentes.
            </p>
          </div>
          <button className="btn-novo" onClick={() => setNovoOpen(true)}>
            <Icon name="plus" size={14} /> Novo nível
          </button>
        </div>

        <div className="equipe__level-list">
          {(levels || []).map((lv: any) => (
            <div key={lv.id} className="level-item">
              <div className="level-item__ordem">{lv.ordem}</div>
              <div>
                <div className="level-item__head">
                  <span className="level-item__nome">{lv.nome}</span>
                  <code className="level-item__code">{lv.code}</code>
                  {!lv.custom && <span className="level-item__padrao">Padrão</span>}
                </div>
                <div className="level-item__scope">
                  <Icon name="eye" size={12} /> {scopeLabel(lv.scope)}
                </div>
              </div>
              <div className="level-item__actions">
                <button className="level-item__btn" onClick={() => setEditing(lv)}>
                  <Icon name="pencil" size={13} /> Editar
                </button>
                <button
                  className="level-item__btn"
                  disabled={!lv.custom}
                  title={lv.custom ? 'Remover nível' : 'Níveis padrão não podem ser removidos'}
                  onClick={() => lv.custom && deletar(lv.id)}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="equipe__hint">
          <Icon name="lock" size={13} />
          <span>
            Níveis customizados herdam o comportamento de visibilidade do nível padrão equivalente ao seu <b>scope</b>.
            Por ex., um nível "Analista" com scope "Vê própria árvore" se comporta como o Coordenador para o sistema.
            O <code style={{ fontSize: 11, background: 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: 4 }}>scope</code> dos níveis padrão é fixo para preservar compatibilidade.
          </span>
        </div>
      </div>

      {novoOpen && <NovoNivelModal levels={levels || []} onClose={() => setNovoOpen(false)} onSave={criar} />}
      {editing && <EditNivelModal level={editing} onClose={() => setEditing(null)} onSave={salvarEdit} />}
    </div>
  );
}

function NovoNivelModal({ levels, onClose, onSave }: any) {
  const [nome, setNome] = useState('');
  const supervisorLv = levels.find((l: any) => l.code === 'supervisor');
  const [posicaoAbaixoId, setPosicaoAbaixoId] = useState<number | undefined>(supervisorLv?.id);
  const [scope, setScope] = useState('coord_tree_dept');

  return (
    <Modal open={true} onClose={onClose}
      title="Novo nível customizado"
      subtitle="Defina um nome, posição e regra de visibilidade."
      size="sm"
      footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-novo" onClick={() => onSave({ nome, scope, posicionarAbaixoDeId: posicaoAbaixoId })}>Criar nível</button>
      </div>}>
      <div className="novo-nivel">
        <label className="field">
          <span className="field__label">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Analista de Atendimento" />
        </label>
        <label className="field">
          <span className="field__label">Posicionar abaixo de</span>
          <select value={posicaoAbaixoId || ''} onChange={(e) => setPosicaoAbaixoId(Number(e.target.value))}>
            {levels.map((lv: any) => (
              <option key={lv.id} value={lv.id}>{lv.nome}</option>
            ))}
          </select>
          <p className="field__hint">
            Custom levels são criados sempre do nível Dono pra baixo. Os níveis abaixo desta posição descem 1 lugar automaticamente.
          </p>
        </label>
        <label className="field">
          <span className="field__label">Scope (regra de visibilidade)</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="manager_all">Vê tudo</option>
            <option value="coord_tree_dept">Vê própria árvore + departamentos</option>
            <option value="supervisor_direct_dept">Vê reportes diretos + departamentos</option>
            <option value="agent_self">Vê apenas a si mesmo</option>
          </select>
          <p className="field__hint">{scopeLabel(scope)}</p>
        </label>
      </div>
    </Modal>
  );
}

function EditNivelModal({ level, onClose, onSave }: any) {
  const [nome, setNome] = useState(level.nome);

  return (
    <Modal open={true} onClose={onClose}
      title={`Editar nível: ${level.nome}`}
      subtitle={level.custom ? 'Renomeie o nível ou altere o scope.' : 'Você pode renomear este nível padrão. O scope é fixo para preservar compatibilidade.'}
      size="sm"
      footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-novo" onClick={() => onSave({ nome })}>Salvar</button>
      </div>}>
      <label className="novo-nivel field">
        <span className="field__label">Nome</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function scopeLabel(scope: string): string {
  switch (scope) {
    case 'owner_all':              return 'Vê tudo';
    case 'manager_all':            return 'Vê tudo';
    case 'coord_tree_dept':        return 'Vê própria árvore + departamentos';
    case 'supervisor_direct_dept': return 'Vê reportes diretos + departamentos';
    case 'agent_self':             return 'Vê apenas os próprios chats';
    default:                       return scope;
  }
}
