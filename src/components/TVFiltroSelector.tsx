import { useEffect, useRef, useState } from 'react';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';

// Selector flutuante de filtros do Painel TV (canto inferior esquerdo).
// Permite trocar entre TODAS / por filial / por equipe sem editar URL.
// Mantém estado na query string pra deeplink funcionar.
export function TVFiltroSelector({ unidadeId, equipeId }: { unidadeId: number | null; equipeId: number | null }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: equipes } = useApi<any[]>(() => Api.painelTvEquipes().catch(() => []));
  const { data: unidades } = useApi<any[]>(() => Api.painelTvUnidades().catch(() => []));

  // Fecha ao clicar fora
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const aplicar = (params: Record<string, string | number | null>) => {
    const sp = new URLSearchParams(location.search);
    Object.entries(params).forEach(([k, v]) => {
      if (v == null || v === '') sp.delete(k);
      else sp.set(k, String(v));
    });
    location.search = sp.toString();
  };

  const labelAtual = (() => {
    if (equipeId) {
      const e = equipes?.find((x) => x.id === equipeId);
      return e ? `Equipe: ${e.nome}` : `Equipe #${equipeId}`;
    }
    if (unidadeId) {
      const u = unidades?.find((x) => x.id === unidadeId);
      return u ? `Filial: ${u.nome}` : `Filial #${unidadeId}`;
    }
    return 'Todas equipes & filiais';
  })();

  return (
    <div ref={ref} style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 20 }}>
      <button
        onClick={() => setAberto((a) => !a)}
        style={{
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '8px 14px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
      >
        🔍 {labelAtual}
      </button>

      {aberto && (
        <div style={{
          position: 'absolute',
          bottom: 44,
          left: 0,
          background: 'rgba(10,16,32,0.95)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12,
          padding: 16,
          width: 280,
          maxHeight: '60vh',
          overflowY: 'auto',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Mostrar</div>
          <button onClick={() => aplicar({ unidade: null, equipe: null })} style={btnStyle(equipeId === null && unidadeId === null)}>
            Todas equipes & filiais
          </button>

          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginTop: 12, marginBottom: 8 }}>Por equipe</div>
          {(equipes || []).map((e) => (
            <button key={e.id} onClick={() => aplicar({ equipe: e.id, unidade: null })} style={btnStyle(equipeId === e.id)}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: e.cor, marginRight: 8 }} />
              {e.nome}
            </button>
          ))}

          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginTop: 12, marginBottom: 8 }}>Por filial</div>
          {(unidades || []).map((u) => (
            <button key={u.id} onClick={() => aplicar({ unidade: u.id, equipe: null })} style={btnStyle(unidadeId === u.id)}>
              {u.nome} <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{u.cidade}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const btnStyle = (ativo: boolean): React.CSSProperties => ({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: ativo ? 'rgba(225,6,0,0.3)' : 'transparent',
  color: '#fff',
  border: ativo ? '1px solid #E10600' : '1px solid transparent',
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
  marginBottom: 2,
});
