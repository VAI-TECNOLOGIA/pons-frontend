import { useEffect, useMemo, useState } from 'react';
import { formatCurrencyShort } from '../lib/format';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Icon } from '../components/Icon';
import { TvEventoOverlay } from '../components/TvEventoOverlay';
import { TVFiltroSelector } from '../components/TVFiltroSelector';

import './painel-tv.css';

// Lê ?unidade=ID e ?equipe=ID na URL pra filtrar o painel.
function useFiltros() {
  return useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const u = sp.get('unidade');
    const e = sp.get('equipe');
    return {
      unidadeId: u ? Number(u) : null,
      equipeId:  e ? Number(e) : null,
    };
  }, []);
}

export default function PainelTV() {
  const [now, setNow] = useState(new Date());
  const { unidadeId, equipeId } = useFiltros();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // State do painel TV (backend já filtra por unidade/equipe e NÃO retorna VGV por corretor)
  const { data: state, reload: reloadState } = useApi<any>(
    () => Api.painelTvState({ ...(unidadeId ? { unidadeId } : {}), ...(equipeId ? { equipeId } : {}) }).catch(() => null),
    [unidadeId, equipeId],
  );
  // Auto-refresh ranking a cada 30s pra TV ficar viva
  useEffect(() => {
    const t = setInterval(() => reloadState(), 30_000);
    return () => clearInterval(t);
  }, [reloadState]);

  const { data: dash } = useApi<any>(() => Api.dashboard());
  const { data: funilEmpresa } = useApi<any>(() => Api.funilEmpresa());
  const { data: corretores } = useApi<any[]>(() => Api.corretores());
  const { data: avisos } = useApi<any[]>(() => Api.avisos());

  // Lookup pra cor da equipe por id (vinda do /api/corretores)
  const corPorEquipe = useMemo(() => {
    const m = new Map<number, string>();
    (corretores || []).forEach((c: any) => {
      if (c.equipe?.id) m.set(c.equipe.id, c.equipe.cor || '#3FB6D4');
    });
    return m;
  }, [corretores]);

  // Ranking SEM VGV — só score + posição (privacidade exigida pelo cliente)
  const rankingTV = (state?.ranking || []).map((r: any) => ({
    id: r.corretorId,
    nome: r.nome,
    initials: r.initials,
    equipe: '',     // a equipe vem implícita pelo filtro (todo o painel é dessa equipe)
    equipeCor: corPorEquipe.get(r.equipeId) || state?.equipeCor || '#3FB6D4',
    scoreMes: r.scoreMes,
  }));
  const top3 = rankingTV.slice(0, 3);
  const resto = rankingTV.slice(3, 10);
  const a = dash?.avanco || { progressoMeta: 0, realizadoMes: 0, metaCasa: 0, noRitmo: false };
  const k = dash?.kpis || {};

  const estagios = funilEmpresa?.estagios || [];
  const funil = estagios.length > 0
    ? estagios.map((e: any) => ({ label: e.label, n: e.n }))
    : [
        { label: 'Novos', n: 0 },
        { label: 'SDR/IA', n: 0 },
        { label: 'Negociando', n: 0 },
        { label: 'Proposta', n: 0 },
        { label: 'Fechado', n: 0 },
      ];
  const max = Math.max(...funil.map((f: any) => f.n), 1);

  // Tacômetro: arco semi-circular de 0 a 100%
  const pct = Math.min(100, Math.max(0, a.progressoMeta || 0));
  const gaugeAngle = (pct / 100) * 180 - 180; // -180 (esquerda) a 0 (direita)
  const gaugeColor = pct >= 80 ? '#88C559' : pct >= 50 ? '#F2B544' : '#E10600';

  const avisosTicker = (avisos || []).filter((a: any) => a.fixado || a.tipo === 'CAMPANHA' || a.tipo === 'URGENTE').slice(0, 5);

  return (
    <div className="tv">
      <TvEventoOverlay />
      <TVFiltroSelector unidadeId={unidadeId} equipeId={equipeId} />
      {avisosTicker.length > 0 && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(225,6,0,0.85)', color: '#fff', padding: '6px 16px',
          fontSize: 13, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          <div style={{ display: 'inline-block', animation: 'tvTicker 30s linear infinite' }}>
            {avisosTicker.map((a: any) => `• ${a.titulo} · ${a.conteudo}`).join('     •     ')}
          </div>
        </div>
      )}
      {(unidadeId || equipeId) && (
        <div style={{
          position: 'fixed', top: avisosTicker.length > 0 ? 36 : 8, right: 16, zIndex: 10,
          fontSize: 12, color: '#fff', fontWeight: 700,
          background: state?.equipeCor ? `${state.equipeCor}cc` : 'rgba(0,0,0,0.5)',
          padding: '4px 10px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)',
        }}>
          {equipeId && (state?.equipeNome ? `Equipe: ${state.equipeNome}` : `Equipe #${equipeId}`)}
          {unidadeId && (equipeId ? ' · ' : '') + `Filial #${unidadeId}`}
        </div>
      )}
      <header className="tvh">
        <div className="tvh__brand">
          <img src="/assets/logo_white.png" alt="Grupo Pons" />
          <span className="tvh__brand-divider" />
          <div className="tvh__brand-meta">
            <div className="tvh__brand-label">VAI Sistema</div>
            <div className="tvh__brand-title">Sala de Guerra · Telemetria</div>
          </div>
        </div>
        <div className="tvh__right">
          <span className="live">
            <i /> AO VIVO
          </span>
          <div className="tvh__time">
            <div className="tvh__date">
              {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </div>
            <div className="tvh__clock">{now.toLocaleTimeString('pt-BR')}</div>
          </div>
        </div>
      </header>

      <div className="hero">
        <div className="kcard kcard--hero">
          <div className="kcard__l">
            <Icon name="dollar" size={14} />
            VGV no mês
          </div>
          <div className="kcard__v">{formatCurrencyShort(a.realizadoMes)}</div>
          <div className="kcard__sub">
            {pct}% da meta · {formatCurrencyShort(a.metaCasa)}
          </div>
        </div>
        <div className="kcard">
          <div className="kcard__l">
            <Icon name="flagCheckered" size={14} />
            Vendas
          </div>
          <div className="kcard__v">{k.vendasMes?.quantidade ?? 0}</div>
          <div className="kcard__sub">contratos no mês</div>
        </div>
        <div className="kcard">
          <div className="kcard__l">
            <Icon name="users" size={14} />
            Leads ativos
          </div>
          <div className="kcard__v">{k.pipelineAtivo ?? 0}</div>
          <div className="kcard__sub">no funil</div>
        </div>
        <div className="kcard">
          <div className="kcard__l">
            <Icon name="doc" size={14} />
            Em assinatura
          </div>
          <div className="kcard__v">{k.contratosEmAssinatura ?? 0}</div>
          <div className="kcard__sub">aguardando cliente</div>
        </div>
      </div>

      <div className="tv-main">
        <div className="panel panel--ranking">
          <div className="panel__t">
            <Icon name="trophy" size={16} />
            Grid de Largada · {state?.equipeNome ? `Equipe ${state.equipeNome}` : 'Pilotos do Mês'}
          </div>

          <div className="podium">
            {top3[1] && <Podium pos={2} medal="P2" piloto={top3[1]} />}
            {top3[0] && <Podium pos={1} medal="P1" piloto={top3[0]} highlight />}
            {top3[2] && <Podium pos={3} medal="P3" piloto={top3[2]} />}
          </div>

          <div className="grid-list">
            {resto.length === 0 && (
              <div className="grid-empty">Aguardando registros de mais pilotos…</div>
            )}
            {/* IMPORTANTE: o cliente proibiu mostrar valor faturado por corretor no painel TV.
                Aqui exibimos APENAS score do mês — sem VGV, sem volume, sem faturamento. */}
            {resto.map((c: any, i: number) => (
              <div className="grid-row" key={c.id} style={{ ['--tc' as any]: c.equipeCor || '#3FB6D4' }}>
                <div className="grid-row__pos">P{i + 4}</div>
                <div className="grid-row__lane" />
                <div className="grid-row__avatar">{c.initials}</div>
                <div className="grid-row__main">
                  <div className="grid-row__name">{c.nome}</div>
                </div>
                <div className="grid-row__stats">
                  <div className="grid-row__val">{c.scoreMes ?? 0} pts</div>
                  <div className="grid-row__sales">score</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="tv-side">
          <div className="panel panel--gauge">
            <div className="panel__t">
              <Icon name="speed" size={16} />
              Meta · RPM
            </div>
            <div className="gauge">
              <svg viewBox="0 0 200 130" width="100%" height="200" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="rpmTrack" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#88C559" />
                    <stop offset="50%" stopColor="#F2B544" />
                    <stop offset="100%" stopColor="#E10600" />
                  </linearGradient>
                </defs>
                {[0, 25, 50, 75, 100].map((mk) => {
                  const ang = (mk / 100) * 180 - 180;
                  const rad = (ang * Math.PI) / 180;
                  const x1 = 100 + Math.cos(rad) * 70;
                  const y1 = 110 + Math.sin(rad) * 70;
                  const x2 = 100 + Math.cos(rad) * 80;
                  const y2 = 110 + Math.sin(rad) * 80;
                  return (
                    <line key={mk} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                  );
                })}
                <path
                  d="M 20 110 A 80 80 0 0 1 180 110"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M 20 110 A 80 80 0 0 1 180 110"
                  fill="none"
                  stroke="url(#rpmTrack)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray="251 251"
                  strokeDashoffset={251 - (pct / 100) * 251}
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
                <line
                  x1="100"
                  y1="110"
                  x2={100 + Math.cos((gaugeAngle * Math.PI) / 180) * 55}
                  y2={110 + Math.sin((gaugeAngle * Math.PI) / 180) * 55}
                  stroke={gaugeColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                  style={{ transition: 'all 1s ease' }}
                />
                <circle cx="100" cy="110" r="5" fill={gaugeColor} />
                {/* Porcentagem dentro do SVG, no centro-baixo do arco onde o ponteiro
                    não alcança. Mantém alinhamento perfeito em qualquer tamanho. */}
                <text
                  x="100"
                  y="128"
                  textAnchor="middle"
                  fontSize="22"
                  fontWeight="900"
                  fontStyle="italic"
                  fill={gaugeColor}
                  style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}
                >
                  {pct}%
                </text>
              </svg>
              <div className="gauge__l">{a.noRitmo ? 'NO RITMO' : 'ABAIXO DO RITMO'}</div>
              <div className="gauge__sub">{formatCurrencyShort(a.realizadoMes)} de {formatCurrencyShort(a.metaCasa)}</div>
            </div>
          </div>

          <div className="panel panel--funil">
            <div className="panel__t">
              <Icon name="chart" size={16} />
              Funil · Telemetria
            </div>
            {funil.map((f: any) => (
              <div className="frow" key={f.label}>
                <div className="flabel">{f.label}</div>
                <div className="ftrack">
                  <div className="ffill" style={{ width: `${(f.n / max) * 100}%` }} />
                </div>
                <div className="fcount">{f.n}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

function Podium({ pos, medal, piloto, highlight }: { pos: number; medal: string; piloto: any; highlight?: boolean }) {
  // IMPORTANTE: cliente proibiu valor faturado por corretor na TV.
  // Mostramos apenas nome + score do mês.
  return (
    <div className={'pod pod--' + pos + (highlight ? ' pod--p1' : '')}>
      <div className="pod__medal">{medal}</div>
      <div className="pod__avatar" style={{ background: piloto.equipeCor + '33', borderColor: piloto.equipeCor }}>
        {piloto.initials}
      </div>
      <div className="pod__name">{piloto.nome}</div>
      <div className="pod__val">{piloto.scoreMes ?? 0}</div>
      <div className="pod__sales">pontos de performance</div>
    </div>
  );
}
