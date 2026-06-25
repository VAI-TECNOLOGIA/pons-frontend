import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Icon } from './Icon';

// Painel de score com breakdown de eventos (Fase A2)
// Usado em Perfil do corretor logado e em Corretores detail (gestor)
export function ScorePanel({ corretorId, scoreMes, scoreAno, scoreAtual, posicaoMes }: {
  corretorId: number;
  scoreMes?: number;
  scoreAno?: number;
  scoreAtual?: number;
  posicaoMes?: number;
}) {
  const { data } = useApi<any>(() => Api.corretorScoreEventos(corretorId), [corretorId]);

  const REGRAS: Array<[string, number, string]> = [
    ['RESPOSTA_RAPIDA', 10, 'Resposta em <5 min'],
    ['NEGOCIANDO',      15, 'Lead → Negociando'],
    ['CONTRATO',        20, 'Contrato enviado'],
    ['VENDA',           50, 'Venda fechada'],
    ['SEM_RESPOSTA',   -20, 'Sem resposta em 10 min'],
  ];

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="trophy" size={16} /> Score de Performance
        </h3>
        {posicaoMes != null && <span className="badge badge--launch">{posicaoMes}º no mês</span>}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
        <Big label="Mês" value={scoreMes ?? 0} cor="var(--color-success)" />
        <Big label="Ano" value={scoreAno ?? 0} cor="var(--color-info, #0E7C9B)" />
        <Big label="Total" value={scoreAtual ?? 0} cor="var(--text-primary)" />
      </div>

      <div style={{ background: 'var(--bg-elevated)', padding: 10, borderRadius: 6, marginBottom: 12 }}>
        <div className="text-xs text-secondary" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="chart" size={12} /> Como ganhar pontos:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 4 }}>
          {REGRAS.map(([k, pts, txt]) => (
            <div key={k} className="text-xs" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{txt}</span>
              <strong style={{ color: pts > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {pts > 0 ? '+' : ''}{pts}
              </strong>
            </div>
          ))}
        </div>
      </div>

      {data?.eventos && data.eventos.length > 0 ? (
        <>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Últimos eventos:</h4>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {data.eventos.slice(0, 15).map((e: any) => (
              <div key={e.id} className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span>{e.descricao || e.tipo}</span>
                <span style={{ color: e.pontos > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700, marginLeft: 8 }}>
                  {e.pontos > 0 ? '+' : ''}{e.pontos}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-xs text-secondary">Sem eventos ainda. Comece a responder leads rapidamente pra subir o score.</div>
      )}
    </div>
  );
}

function Big({ label, value, cor }: { label: string; value: number; cor?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 8 }}>
      <div className="text-xs text-secondary">{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: cor }}>{value}</div>
    </div>
  );
}
