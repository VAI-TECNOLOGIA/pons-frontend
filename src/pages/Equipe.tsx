// Equipe — Hierarquia organizacional copiada pixel-perfect do VAI CRM.
// 4 abas: Usuários, Departamentos, Hierarquia (organograma), Níveis.
// Acesso restrito a admin (CEO + Diretores).

import { useState } from 'react';
import { Topbar } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { useApi } from '../lib/useApi';
import { Api } from '../lib/api';
import { useToast } from '../lib/toast';
import './equipe.css';

type Tab = 'usuarios' | 'hierarquia';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'usuarios',   label: 'Usuários',   icon: 'users_vai' },
  { id: 'hierarquia', label: 'Hierarquia', icon: 'hierarchy' },
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
          {tab === 'hierarquia' && <AbaHierarquia />}
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
  const [filtroNivel, setFiltroNivel] = useState('');   // code do nível, 'sem' (sem nível) ou '' (todos)
  const [filtroStatus, setFiltroStatus] = useState(''); // '' | 'ativo' | 'inativo'
  const [novoOpen, setNovoOpen] = useState(false);
  const { data: users, loading, reload } = useApi<any[]>(() => Api.equipeUsers(search), [search]);
  const { data: levels } = useApi<any[]>(() => Api.equipeLevels());
  const toast = useToast();

  const toggleAtivo = async (id: number) => {
    try { await Api.equipeUserToggleActive(id); reload(); }
    catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const base = users || [];
  const lista = base.filter((u) => {
    if (filtroNivel === 'sem' && u.nivel) return false;
    if (filtroNivel && filtroNivel !== 'sem' && u.nivel?.code !== filtroNivel) return false;
    if (filtroStatus === 'ativo' && !u.active) return false;
    if (filtroStatus === 'inativo' && u.active) return false;
    return true;
  });

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
        <select className="equipe__filter" value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)} title="Filtrar por nível">
          <option value="">Todos os níveis</option>
          {(levels || []).map((l) => <option key={l.id} value={l.code}>{l.nome}</option>)}
          <option value="sem">Sem nível</option>
        </select>
        <select className="equipe__filter" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} title="Filtrar por status">
          <option value="">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </select>
        <div className="equipe__count">{lista.length} usuário{lista.length !== 1 ? 's' : ''}</div>
        <button className="btn-novo" onClick={() => setNovoOpen(true)}>
          <Icon name="plus" size={14} /> Novo
        </button>
      </div>

      <KpiPills users={base} />

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
                    )) : (
                      // Master = sem equipes vinculadas (vê tudo). Mostra badge dourado.
                      ['CEO','DIRETOR_COMERCIAL','DIRETOR_FINANCEIRO','FINANCEIRO','GERENTE_EQUIPE'].includes(u.role)
                        ? <span className="equipe__nivel-badge"><Icon name="star" size={11} /> Master</span>
                        : '—'
                    )}
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
  const { data: unidades } = useApi<any[]>(() => Api.unidadesList());
  const [form, setForm] = useState({
    nome: '', sobrenome: '', email: '', password: '', phone: '',
    role: 'GERENTE_EQUIPE' as 'GERENTE_EQUIPE' | 'FINANCEIRO' | 'SOCIO_UNIDADE',
    hierarchyLevelId: levels.find((l: any) => l.code === 'manager')?.id || null,
    isMaster: false,            // master = vê TODAS as equipes (não escolhe)
    equipeIds: [] as number[],
    unidadeIds: [] as number[],  // sócio → filiais que ele enxerga (multi-filial)
    active: true,
  });
  const [confirmPass, setConfirmPass] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.nome || !form.email || !form.password) return toast.error('Preencha nome, email e senha.');
    if (form.password !== confirmPass) return toast.error('As senhas não conferem.');
    const isSocio = form.role === 'SOCIO_UNIDADE';
    if (isSocio && !form.unidadeIds.length) {
      return toast.error('Selecione ao menos uma filial do sócio.');
    }
    if (!isSocio && !form.isMaster && !form.equipeIds.length) {
      return toast.error('Selecione pelo menos uma equipe — ou marque "Acesso Master".');
    }
    setSaving(true);
    try {
      await Api.equipeUserCreate({
        name: `${form.nome} ${form.sobrenome}`.trim(),
        email: form.email,
        password: form.password,
        phone: form.phone || null,
        role: form.role,
        // Sócio: escopo é por filial (unidadeIds), não por árvore de hierarquia.
        hierarchyLevelId: isSocio ? null : form.hierarchyLevelId,
        unidadeId: isSocio ? (form.unidadeIds[0] ?? null) : null,
        unidadeIds: isSocio ? form.unidadeIds : [],
        // Master = sem equipes vinculadas → backend interpreta como "vê tudo"
        equipeIds: isSocio ? [] : (form.isMaster ? [] : form.equipeIds),
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
                className={'user-drawer__role' + (form.role === 'FINANCEIRO' ? ' is-active' : '')}
                onClick={() => setForm({ ...form, role: 'FINANCEIRO' })}
              >
                <Icon name="wallet" size={16} />
                <div className="user-drawer__role-name">Financeiro</div>
                <div className="user-drawer__role-sub">Acesso a caixa, lançamentos e relatórios financeiros</div>
              </button>
              <button
                type="button"
                className={'user-drawer__role' + (form.role === 'SOCIO_UNIDADE' ? ' is-active' : '')}
                onClick={() => setForm({ ...form, role: 'SOCIO_UNIDADE' })}
              >
                <Icon name="building" size={16} />
                <div className="user-drawer__role-name">Sócio</div>
                <div className="user-drawer__role-sub">Vê as equipes e o financeiro só da própria filial</div>
              </button>
            </div>
          </section>

          <section>
            <p className="user-drawer__sec">ESCOPO DE ACESSO *</p>

            {/* Sócio: escopo é a filial. Vê todas as equipes e o financeiro dela. */}
            {form.role === 'SOCIO_UNIDADE' ? (
              <>
                <p className="user-drawer__hint">
                  O sócio enxerga todas as equipes, leads, vendas e o financeiro das filiais selecionadas. Pode marcar mais de uma.
                </p>
                <div className="user-drawer__field">
                  <span>Filiais *</span>
                  {(unidades || []).map((u: any) => {
                    const checked = form.unidadeIds.includes(u.id);
                    return (
                      <label key={u.id} className="user-drawer__check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              unidadeIds: e.target.checked
                                ? [...form.unidadeIds, u.id]
                                : form.unidadeIds.filter((id) => id !== u.id),
                            })
                          }
                        />
                        <span>{u.nome}{u.cidade ? ` — ${u.cidade}` : ''}</span>
                      </label>
                    );
                  })}
                </div>
                {(unidades || []).length === 0 && (
                  <p className="user-drawer__warn">Nenhuma filial cadastrada ainda. Crie em Administração → Filiais.</p>
                )}
              </>
            ) : (
            <>
            <p className="user-drawer__hint">
              {form.role === 'FINANCEIRO'
                ? 'Master vê rateios, fechamentos e relatórios financeiros de TODAS as equipes. Específico só vê das que você selecionar.'
                : 'Master vê leads, atendimento, vendas e métricas de TODAS as equipes. Específico só vê das que você selecionar.'}
            </p>

            {/* Toggle Master vs Equipes específicas */}
            <div className="user-drawer__role-grid" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={'user-drawer__role' + (form.isMaster ? ' is-active' : '')}
                onClick={() => setForm({ ...form, isMaster: true, equipeIds: [] })}
              >
                <Icon name="star" size={16} />
                <div className="user-drawer__role-name">Master</div>
                <div className="user-drawer__role-sub">
                  {form.role === 'FINANCEIRO'
                    ? 'Vê dados financeiros de TODAS as equipes da empresa'
                    : 'Vê todos os leads e vendas de TODAS as equipes da empresa'}
                </div>
              </button>
              <button
                type="button"
                className={'user-drawer__role' + (!form.isMaster ? ' is-active' : '')}
                onClick={() => setForm({ ...form, isMaster: false })}
              >
                <Icon name="users" size={16} />
                <div className="user-drawer__role-name">Equipes específicas</div>
                <div className="user-drawer__role-sub">Acesso limitado às equipes que você escolher abaixo</div>
              </button>
            </div>

            {/* Lista de equipes (só aparece quando NÃO é master) */}
            {!form.isMaster && (
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
            )}
            </>
            )}
          </section>

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
// ABA: HIERARQUIA (organograma)
// ═══════════════════════════════════════════════════════════════════════════

function AbaHierarquia() {
  const { data } = useApi<any>(() => Api.equipeHierarchyTree());
  const { data: users } = useApi<any[]>(() => Api.equipeUsers());
  const roots = data?.roots || [];
  const lista = users || [];
  // Zoom: 50% ... 200%, passo de 10
  const [zoom, setZoom] = useState(100);
  const zoomIn  = () => setZoom((z) => Math.min(200, z + 10));
  const zoomOut = () => setZoom((z) => Math.max(50,  z - 10));
  const zoomReset = () => setZoom(100);

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
              <button onClick={zoomOut} disabled={zoom <= 50} title="Diminuir zoom">
                <Icon name="zoom_out" size={14} />
              </button>
              <span onClick={zoomReset} style={{ cursor: 'pointer' }} title="Resetar para 100%">{zoom}%</span>
              <button onClick={zoomIn} disabled={zoom >= 200} title="Aumentar zoom">
                <Icon name="zoom_in" size={14} />
              </button>
            </span>
            <button className="equipe__org-btn">Confortável</button>
          </div>
        </div>
        <div className="equipe__org-canvas">
          <div
            className="equipe__org-canvas-inner"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            {roots.map((r: any) => <OrgNode key={r.id} node={r} />)}
            {!roots.length && <div className="equipe__empty-sub">Nenhum usuário cadastrado ainda.</div>}
          </div>
        </div>
      </div>

      {/* Lista agrupada por nível — ordenada pela hierarquia (Dono primeiro), sem nível por último */}
      {Object.entries(byLevel)
        .sort(([, a], [, b]) => {
          const oa = a[0]?.nivel?.ordem ?? Infinity;
          const ob = b[0]?.nivel?.ordem ?? Infinity;
          return oa - ob;
        })
        .map(([code, members]) => {
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
  // Pill VAI-style: avatar (compacto) | separador vertical | estrela + nome
  return (
    <>
      <div className="org-node__card">
        <div className="equipe__avatar">
          {node.avatarUrl ? <img src={node.avatarUrl} alt={node.name} /> : <span>{node.initials}</span>}
          <span className={'equipe__online-dot' + (node.online ? ' equipe__online-dot--on' : '')} />
        </div>
        <div className="org-node__sep" />
        <span className="org-node__star"><Icon name="star" size={12} /></span>
        <span className="org-node__nome">{node.name}</span>
      </div>
      {node.children?.length > 0 && node.children.map((c: any) => <OrgNode key={c.id} node={c} />)}
    </>
  );
}

