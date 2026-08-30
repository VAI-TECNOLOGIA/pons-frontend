import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { formatRole } from '../lib/auth';
import { Icon } from '../components/Icon';
import './acesso-pendente.css';

type Pendente = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  initials?: string | null;
  createdAt: string;
  origemCadastro?: string | null;
  funcaoCadastro?: string | null;
};

// Tela do ANALISTA: cadastros abertos aguardando liberação. O analista define a
// permissão de cada um (subconjunto seguro, sem financeiro/diretoria) e libera —
// ou recusa. Enquanto pendente, a pessoa só vê a Academia Pons.
export default function AcessoPendente() {
  const [lista, setLista] = useState<Pendente[]>([]);
  const [atribuiveis, setAtribuiveis] = useState<string[]>([]);
  const [escolha, setEscolha] = useState<Record<number, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await Api.acessoPendentes();
      setLista(r.pendentes || []);
      setAtribuiveis(r.atribuiveis || []);
    } catch (e: any) {
      setErro('Não foi possível carregar os cadastros pendentes.');
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); }, []);

  async function aprovar(p: Pendente) {
    const role = escolha[p.id] || atribuiveis[0];
    if (!role) return;
    setOcupado(p.id);
    try {
      await Api.acessoAprovar(p.id, role);
      setLista((l) => l.filter((x) => x.id !== p.id));
    } catch {
      setErro(`Falha ao liberar o acesso de ${p.name}.`);
    } finally {
      setOcupado(null);
    }
  }

  async function recusar(p: Pendente) {
    if (!confirm(`Recusar o cadastro de ${p.name}? A conta será desativada.`)) return;
    setOcupado(p.id);
    try {
      await Api.acessoRecusar(p.id);
      setLista((l) => l.filter((x) => x.id !== p.id));
    } catch {
      setErro(`Falha ao recusar ${p.name}.`);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div style={{ padding: '20px 22px', maxWidth: 920, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Icon name="users" size={22} />
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Liberações de acesso</h1>
      </div>
      <p style={{ color: 'var(--muted, #94a3b8)', margin: '0 0 20px', fontSize: 14 }}>
        Cadastros novos entram com acesso apenas às vídeo aulas (Academia Pons). Defina a permissão
        e libere o acesso ao sistema — ou recuse.
      </p>

      {erro && (
        <div style={{ background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.4)', color: '#fca5a5', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13.5 }}>
          {erro}
        </div>
      )}

      {carregando ? (
        <p style={{ color: 'var(--muted, #94a3b8)' }}>Carregando…</p>
      ) : lista.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted, #94a3b8)' }}>
          <Icon name="check" size={30} />
          <p style={{ marginTop: 10 }}>Nenhum cadastro aguardando liberação.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lista.map((p) => (
            <div key={p.id} className="acesso-card">
              <div className="acesso-card__info">
                <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                <div style={{ color: 'var(--muted, #94a3b8)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.email}{p.phone ? ` · ${p.phone}` : ''}
                </div>
                {p.funcaoCadastro && (
                  <div style={{ color: 'var(--muted, #94a3b8)', fontSize: 12, marginTop: 2 }}>quer entrar como: {p.funcaoCadastro}</div>
                )}
              </div>

              <select
                className="acesso-card__select"
                value={escolha[p.id] || atribuiveis[0] || ''}
                onChange={(e) => setEscolha((s) => ({ ...s, [p.id]: e.target.value }))}
              >
                {atribuiveis.map((r) => (
                  <option key={r} value={r}>{formatRole(r)}</option>
                ))}
              </select>

              <div className="acesso-actions">
                <button className="acesso-btn acesso-btn--liberar" onClick={() => aprovar(p)} disabled={ocupado === p.id}>
                  <Icon name="check" size={15} /> Liberar acesso
                </button>
                <button className="acesso-btn acesso-btn--recusar" onClick={() => recusar(p)} disabled={ocupado === p.id}>
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
