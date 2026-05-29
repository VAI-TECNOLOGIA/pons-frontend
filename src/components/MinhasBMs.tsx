import { Link } from 'react-router-dom';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';

// Lista resumida das BMs do corretor logado (Fase A1)
// Embutida no /perfil pra dar acesso rápido sem precisar navegar pra /bm
export function MinhasBMs() {
  const { data: bms } = useApi<any[]>(() => Api.bmList());

  if (!bms) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>🎯 Minhas BMs (Tráfego Próprio)</h3>
        <Link to="/bm" className="btn btn--ghost btn--sm">Gerenciar BMs →</Link>
      </div>

      {bms.length === 0 ? (
        <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 6 }}>
          <div className="text-sm">Você ainda não tem nenhuma BM cadastrada.</div>
          <div className="text-xs text-secondary" style={{ marginTop: 4 }}>
            Cadastre uma BM pra rodar tráfego pago próprio — os leads vão <strong>direto pra você</strong>, sem entrar na roleta.
          </div>
          <Link to="/bm" className="btn btn--primary btn--sm" style={{ marginTop: 10 }}>+ Cadastrar minha BM</Link>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {bms.map((bm) => (
            <div key={bm.id} style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 6 }}>
              <div className="flex-between" style={{ marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>{bm.nome}</strong>
                <span className={`badge ${bm.ativa ? 'badge--launch' : 'badge--neutral'}`} style={{ fontSize: 9 }}>{bm.ativa ? 'Ativa' : 'Pausada'}</span>
              </div>
              <div className="text-xs text-secondary">BM ID: {bm.bmId}</div>
              <div className="text-xs" style={{ marginTop: 4 }}>
                Leads: <strong>{bm.leadsCaptados}</strong>
                {' · '}IA: {bm.iaHabilitadaPadrao ? 'on' : 'off'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
