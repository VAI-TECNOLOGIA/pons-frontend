// Equipe — Hierarquia organizacional inspirada no VAI CRM.
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
  { id: 'departamentos', label: 'Departamentos', icon: 'team' },
  { id: 'hierarquia',    label: 'Hierarquia',    icon: 'pipeline' },
  { id: 'niveis',        label: 'Níveis',        icon: 'shield' },
];

export default function Equipe() {
  const [tab, setTab] = useState<Tab>('usuarios');

  return (
    <>
      <Topbar title="Equipe" />
      <div className="equipe">
        <aside className="equipe__side">
          <h3 className="equipe__side-title">Equipe</h3>
          <nav className="equipe__nav">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={'equipe__nav-item' + (tab === t.id ? ' is-active' : '')}
                onClick={() => setTab(t.id)}
              >
                <Icon name={t.icon} size={16} /> {t.label}
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
// ABA: USUÁRIOS
// ═══════════════════════════════════════════════════════════════════════════

function AbaUsuarios() {
  const [search, setSearch] = useState('');
  const [novoOpen, setNovoOpen] = useState(false);
  const { data: users, loading, reload } = useApi<any[]>(() => Api.equipeUsers(search), [search]);
  const { data: levels } = useApi<any[]>(() => Api.equipeLevels());
  const { data: departments } = useApi<any[]>(() => Api.equipeDepartments());
  const toast = useToast();

  const toggleAtivo = async (id: number) => {
    try {
      await Api.equipeUserToggleActive(id);
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const lista = users || [];
  const onlineCount = lista.filter((u) => u.online).length;

  return (
    <div className="equipe__page">
      <div className="equipe__page-head">
        <h1 className="equipe__page-title">Usuários</h1>
        <p className="equipe__page-sub">Gerencie contas, níveis de acesso e departamentos</p>
      </div>

      <div className="equipe__panel">
        <div className="equipe__toolbar">
          <div className="equipe__search">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="Buscar por nome, email ou departamento…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="equipe__toolbar-right">
            <span className="equipe__count">{lista.length} usuário{lista.length !== 1 ? 's' : ''}</span>
            <button className="btn btn--primary btn--sm" onClick={() => setNovoOpen(true)}>
              <Icon name="plus" size={14} /> Novo
            </button>
          </div>
        </div>

        <div className="equipe__kpis">
          {(levels || []).map((lv) => {
            const count = lista.filter((u) => u.nivel?.code === lv.code).length;
            if (count === 0) return null;
            return (
              <div key={lv.id} className="equipe__kpi">
                <Icon name="shield" size={14} />
                <div className="equipe__kpi-num">{count}</div>
                <div className="equipe__kpi-label">{lv.nome}</div>
              </div>
            );
          })}
          <div className="equipe__kpi equipe__kpi--online">
            <div className="equipe__kpi-num">{onlineCount}</div>
            <div className="equipe__kpi-label">online agora</div>
          </div>
        </div>

        {loading ? (
          <div className="equipe__loading">Carregando…</div>
        ) : (
          <table className="equipe__table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Nível</th>
                <th>Gestor</th>
                <th>Departamentos</th>
                <th>Status</th>
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
                        {u.online && <span className="equipe__online-dot" />}
                      </div>
                      <div>
                        <div className="equipe__user-name">{u.name}</div>
                        <div className="equipe__user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="equipe__badge">
                      <Icon name="shield" size={12} /> {u.nivel?.nome || '—'}
                    </span>
                  </td>
                  <td>{u.manager?.name || '—'}</td>
                  <td>
                    {u.departments?.length
                      ? u.departments.map((d: any) => (
                          <span key={d.id} className="equipe__dept-chip" style={{ background: d.cor + '22', color: d.cor }}>
                            {d.nome}
                          </span>
                        ))
                      : '—'}
                  </td>
                  <td>
                    <label className="equipe__switch">
                      <input type="checkbox" checked={u.active} onChange={() => toggleAtivo(u.id)} />
                      <span className="equipe__switch-slider" />
                      <span className="equipe__switch-label">{u.active ? 'Ativo' : 'Inativo'}</span>
                    </label>
                  </td>
                  <td>
                    <button className="equipe__icon-btn" title="Editar">
                      <Icon name="pencil" size={14} />
                    </button>
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
        )}
      </div>

      {novoOpen && (
        <NovoUsuarioModal
          levels={levels || []}
          departments={departments || []}
          users={lista}
          onClose={() => setNovoOpen(false)}
          onSaved={() => { setNovoOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

function NovoUsuarioModal({ levels, departments, users, onClose, onSaved }: any) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    hierarchyLevelId: null as number | null,
    managerId: null as number | null,
    departmentIds: [] as number[],
    active: true,
  });
  const [confirmPass, setConfirmPass] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedLevel = levels.find((l: any) => l.id === form.hierarchyLevelId);
  // Pra Agente: precisa Supervisor. Pra Supervisor: precisa Coordenador. Etc.
  const needManager = selectedLevel && selectedLevel.ordem > 0;
  const managerLevel = selectedLevel ? levels.find((l: any) => l.ordem === selectedLevel.ordem - 1) : null;
  const managerCandidates = managerLevel ? users.filter((u: any) => u.nivel?.code === managerLevel.code) : [];

  const submit = async () => {
    if (!form.name || !form.email || !form.password) return toast.error('Preencha nome, email e senha.');
    if (form.password !== confirmPass) return toast.error('As senhas não conferem.');
    if (needManager && !form.managerId) return toast.error(`Selecione um ${managerLevel?.nome} como gestor.`);
    setSaving(true);
    try {
      await Api.equipeUserCreate(form);
      toast.success('Usuário criado');
      onSaved();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Novo Usuário"
      subtitle="Cadastra um novo membro da equipe com nível e departamento"
      size="lg"
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>{saving ? 'Criando…' : 'Criar usuário'}</button>
        </div>
      }
    >
      <div className="novo-user">
        <section>
          <h4 className="novo-user__sec">Dados pessoais</h4>
          <div className="novo-user__grid">
            <label>
              <span>Nome completo *</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="João Silva" />
            </label>
            <label>
              <span>E-mail *</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="joao.silva@empresa.com" />
            </label>
            <label>
              <span>Telefone</span>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(48) 99999-9999" />
            </label>
          </div>
        </section>

        <section>
          <h4 className="novo-user__sec">Hierarquia</h4>
          <div className="novo-user__levels">
            {levels.map((lv: any) => (
              <button
                key={lv.id}
                type="button"
                className={'novo-user__level' + (form.hierarchyLevelId === lv.id ? ' is-active' : '')}
                onClick={() => setForm({ ...form, hierarchyLevelId: lv.id, managerId: null })}
              >
                <Icon name="shield" size={14} />
                <div className="novo-user__level-name">{lv.nome}</div>
                <div className="novo-user__level-sub">{scopeLabel(lv.scope)}</div>
              </button>
            ))}
          </div>

          {needManager && (
            <div className="novo-user__manager">
              <label>
                <span>{managerLevel?.nome} (gestor) *</span>
                <select value={form.managerId || ''} onChange={(e) => setForm({ ...form, managerId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Selecione…</option>
                  {managerCandidates.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </label>
              {!managerCandidates.length && (
                <p className="novo-user__warn">
                  Você ainda não tem nenhum <b>{managerLevel?.nome}</b> cadastrado. Pra criar um <b>{selectedLevel?.nome}</b>, cria um {managerLevel?.nome} primeiro.
                </p>
              )}
            </div>
          )}
        </section>

        <section>
          <h4 className="novo-user__sec">Departamentos</h4>
          <div className="novo-user__deps">
            {departments.length === 0 ? (
              <p className="text-sm text-secondary">Nenhum departamento cadastrado ainda.</p>
            ) : (
              departments.map((d: any) => (
                <label key={d.id} className={'novo-user__dep' + (form.departmentIds.includes(d.id) ? ' is-selected' : '')}>
                  <input
                    type="checkbox"
                    checked={form.departmentIds.includes(d.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.departmentIds, d.id]
                        : form.departmentIds.filter((x) => x !== d.id);
                      setForm({ ...form, departmentIds: next });
                    }}
                  />
                  <span style={{ background: d.cor }} className="novo-user__dep-dot" />
                  {d.nome}
                </label>
              ))
            )}
          </div>
        </section>

        <section>
          <h4 className="novo-user__sec">Senha de acesso</h4>
          <div className="novo-user__grid">
            <label>
              <span>Senha *</span>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
            </label>
            <label>
              <span>Confirmar senha *</span>
              <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="Repita a senha" />
            </label>
          </div>
        </section>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA: DEPARTAMENTOS
// ═══════════════════════════════════════════════════════════════════════════

function AbaDepartamentos() {
  const { data, reload } = useApi<any[]>(() => Api.equipeDepartments());
  const [novoOpen, setNovoOpen] = useState(false);
  const toast = useToast();

  const submit = async (form: any) => {
    try {
      await Api.equipeDepartmentCreate(form);
      toast.success('Departamento criado');
      setNovoOpen(false);
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  return (
    <div className="equipe__page">
      <div className="equipe__page-head">
        <h1 className="equipe__page-title">Departamentos</h1>
        <p className="equipe__page-sub">Agrupa pessoas por área (ex: Comercial BC, Comercial Itapema)</p>
      </div>

      <div className="equipe__panel">
        <div className="equipe__toolbar">
          <div className="equipe__count">{data?.length || 0} departamento{(data?.length || 0) !== 1 ? 's' : ''}</div>
          <button className="btn btn--primary btn--sm" onClick={() => setNovoOpen(true)}>
            <Icon name="plus" size={14} /> Novo departamento
          </button>
        </div>

        <div className="equipe__dep-grid">
          {(data || []).map((d: any) => (
            <div key={d.id} className="equipe__dep-card">
              <div className="equipe__dep-cor" style={{ background: d.cor }} />
              <div className="equipe__dep-info">
                <div className="equipe__dep-nome">{d.nome}</div>
                {d.descricao && <div className="equipe__dep-desc">{d.descricao}</div>}
                <div className="equipe__dep-meta">{d.usersCount || 0} membro{d.usersCount === 1 ? '' : 's'}</div>
              </div>
            </div>
          ))}
          {!data?.length && <div className="equipe__empty">Nenhum departamento ainda. Clica em <b>Novo</b> pra criar o primeiro.</div>}
        </div>
      </div>

      {novoOpen && <NovoDeptModal onClose={() => setNovoOpen(false)} onSave={submit} />}
    </div>
  );
}

function NovoDeptModal({ onClose, onSave }: any) {
  const [form, setForm] = useState({ nome: '', descricao: '', cor: '#1258CA' });
  const cores = ['#1258CA', '#22C55E', '#EAB308', '#EF4444', '#A855F7', '#06B6D4'];

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Novo departamento"
      size="sm"
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => onSave(form)}>Criar</button>
        </div>
      }
    >
      <label className="novo-user__grid">
        <span>Nome *</span>
        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Comercial BC" />
      </label>
      <label className="novo-user__grid" style={{ marginTop: 12 }}>
        <span>Descrição (opcional)</span>
        <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
      </label>
      <div style={{ marginTop: 12 }}>
        <span className="field__label">Cor</span>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {cores.map((c) => (
            <button key={c} type="button"
              onClick={() => setForm({ ...form, cor: c })}
              style={{
                background: c, width: 28, height: 28, border: form.cor === c ? '3px solid var(--text-primary)' : '1px solid var(--border-light)',
                borderRadius: 6, cursor: 'pointer'
              }}
            />
          ))}
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
  const roots = data?.roots || [];

  return (
    <div className="equipe__page">
      <div className="equipe__page-head">
        <h1 className="equipe__page-title">Hierarquia Organizacional</h1>
        <p className="equipe__page-sub">Visualize e gerencie a estrutura de gestão da equipe</p>
      </div>

      <div className="equipe__panel">
        <div className="equipe__org">
          {roots.map((r: any) => <OrgNode key={r.id} node={r} />)}
          {!roots.length && <div className="equipe__empty">Nenhum usuário cadastrado.</div>}
        </div>
      </div>
    </div>
  );
}

function OrgNode({ node }: { node: any }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="org-node">
      <div className="org-node__card">
        <div className="equipe__avatar">
          {node.avatarUrl ? <img src={node.avatarUrl} alt={node.name} /> : <span>{node.initials}</span>}
          {node.online && <span className="equipe__online-dot" />}
        </div>
        <div className="org-node__info">
          <div className="org-node__name">{node.name}</div>
          <div className="org-node__role">{node.nivel?.nome || '—'}</div>
        </div>
        {!!node.children.length && (
          <button className="org-node__toggle" onClick={() => setOpen(!open)} title={open ? 'Colapsar' : 'Expandir'}>
            <Icon name={open ? 'arrow_down' : 'arrow_right'} size={14} />
          </button>
        )}
      </div>
      {open && !!node.children.length && (
        <div className="org-node__children">
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
    <div className="equipe__page">
      <div className="equipe__page-head">
        <h1 className="equipe__page-title">Níveis de Hierarquia</h1>
        <p className="equipe__page-sub">Renomeie níveis padrão e crie níveis customizados (ex: Analista)</p>
      </div>

      <div className="equipe__panel">
        <div className="equipe__toolbar">
          <div>
            <h2 className="equipe__sec-title">Níveis de hierarquia</h2>
            <p className="equipe__sec-sub">
              Os 5 níveis padrão (Dono, Gerente, Coordenador, Supervisor, Agente) podem ser renomeados. Você também pode criar níveis customizados (ex: "Analista") posicionando-os entre os existentes.
            </p>
          </div>
          <button className="btn btn--primary btn--sm" onClick={() => setNovoOpen(true)}>
            <Icon name="plus" size={14} /> Novo nível
          </button>
        </div>

        <div className="equipe__level-list">
          {(levels || []).map((lv: any) => (
            <div key={lv.id} className="level-item">
              <div className="level-item__ordem">{lv.ordem}</div>
              <div className="level-item__body">
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
                <button className="btn btn--ghost btn--sm" onClick={() => setEditing(lv)}>
                  <Icon name="pencil" size={12} /> Editar
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={!lv.custom}
                  title={lv.custom ? 'Remover nível' : 'Níveis padrão não podem ser removidos'}
                  onClick={() => lv.custom && deletar(lv.id)}
                >
                  <Icon name="trash" size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="equipe__hint">
          <Icon name="lightbulb" size={14} />
          <span>
            Níveis customizados herdam o comportamento de visibilidade do nível padrão equivalente ao seu <b>scope</b>.
            Por ex., um nível "Analista" com scope "Vê própria árvore" se comporta como o Coordenador para o sistema.
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
  const [posicaoAbaixoId, setPosicaoAbaixoId] = useState(levels.find((l: any) => l.code === 'supervisor')?.id);
  const [scope, setScope] = useState('coord_tree_dept');

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Novo nível customizado"
      subtitle="Defina um nome, posição e regra de visibilidade."
      size="sm"
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => onSave({ nome, scope, posicionarAbaixoDeId: posicaoAbaixoId })}>Criar nível</button>
        </div>
      }
    >
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
    <Modal
      open={true}
      onClose={onClose}
      title={`Editar nível: ${level.nome}`}
      subtitle={level.custom ? 'Renomeie o nível ou altere o scope.' : 'Você pode renomear este nível padrão. O scope é fixo para preservar compatibilidade.'}
      size="sm"
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => onSave({ nome })}>Salvar</button>
        </div>
      }
    >
      <label className="field">
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
    case 'agent_self':             return 'Vê apenas a si mesmo';
    default:                       return scope;
  }
}
