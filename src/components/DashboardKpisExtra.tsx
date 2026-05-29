import { Link } from 'react-router-dom';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Auth } from '../lib/auth';

// KPIs extras das Fases A-G plugados no Dashboard (vendas hoje, leads hoje, ROI, score corretor)
export function DashboardKpisExtra() {
  const user = Auth.user;
  const isCorretor = user?.role === 'CORRETOR';

  const { data: tvState } = useApi<any>(() => Api.painelTvState().catch(() => null));
  const { data: meta } = useApi<any>(() => Api.metaCustosResumo(7).catch(() => null));
  const { data: rankingMe } = useApi<any>(() => isCorretor ? Api.rankingMe({ periodo: 'MES' }).catch(() => null) : Promise.resolve(null));

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16, marginBottom: 16 }}>
      {tvState?.metricas && (
        <>
          <MiniCard label="Leads hoje" value={tvState.metricas.leadsHoje} link="/leads" />
          <MiniCard label="Vendas hoje" value={tvState.metricas.vendasHoje} cor="var(--color-success)" link="/vendas" />
          <MiniCard label="Contratos hoje" value={tvState.metricas.contratosHoje} link="/vendas" />
          <MiniCard label="VGV hoje" value={fmt(tvState.metricas.vgvHoje || 0)} cor="var(--color-success)" link="/painel-executivo" />
        </>
      )}
      {meta && (
        <>
          <MiniCard label="Custo Meta (7d)" value={fmt(meta.custoTotal || 0)} link="/meta-custos" />
          <MiniCard label="ROI tráfego" value={meta.roi ? `${meta.roi}x` : '—'} cor="var(--color-success)" link="/meta-custos" />
        </>
      )}
      {isCorretor && rankingMe && (
        <>
          <MiniCard label="Minha posição" value={`${rankingMe.posicao}º`} cor="var(--color-warning)" link="/ranking" />
          <MiniCard label="Meu score (mês)" value={rankingMe.score} cor="var(--color-info, #1258CA)" link="/perfil" />
        </>
      )}
    </div>
  );
}

function MiniCard({ label, value, cor, link }: { label: string; value: any; cor?: string; link?: string }) {
  const content = (
    <div className="card" style={{ padding: 12, cursor: link ? 'pointer' : 'default' }}>
      <div className="text-xs text-secondary">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: cor }}>{value}</div>
    </div>
  );
  return link ? <Link to={link} style={{ textDecoration: 'none', color: 'inherit' }}>{content}</Link> : content;
}
