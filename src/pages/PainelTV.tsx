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


  return (
    <div className="tv">
      <TvEventoOverlay />
      <TVFiltroSelector unidadeId={unidadeId} equipeId={equipeId} />
      {(unidadeId || equipeId) && (
        <div style={{
          position: 'fixed', top: 8, right: 16, zIndex: 10,
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
            <div className="tvh__brand-title">Sala de Guerra - Telemetria</div>
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
            VGV Mensal
          </div>
          <div className="kcard__v">{formatCurrencyShort(a.realizadoMes)}</div>
          <div className="kcard__sub">
            {pct}% da meta - {formatCurrencyShort(a.metaCasa)}
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
            Grid de Largada - {state?.equipeNome ? `Equipe ${state.equipeNome}` : 'Piloto do Mês'}
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
            {resto.map((c: any, i: number) => {
              const partes = String(c.nome || '').trim().split(' ');
              const sobrenome = partes.length > 1 ? partes.pop() : '';
              return (
                <div className="grid-row" key={c.id} style={{ ['--tc' as any]: c.equipeCor || '#3FB6D4' }}>
                  <div className="grid-row__pos">P{i + 4}</div>
                  <div className="grid-row__lane" />
                  <div className="grid-row__avatar">{c.initials}</div>
                  <div className="grid-row__main">
                    <div className="grid-row__name">{partes.join(' ')} {sobrenome && <em>{sobrenome}</em>}</div>
                  </div>
                  <div className="grid-row__stats">
                    <div className="grid-row__val">{c.scoreMes ?? 0} pts</div>
                    <div className="grid-row__sales">score</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tv-side">
          <div className="panel panel--gauge">
            <div className="panel__t">
              <Icon name="speed" size={16} />
              Meta - RPM
            </div>
            <div className="gauge">
              {/* Anel circular (280°) com gradiente ciano — desenho do layout aprovado */}
              <svg viewBox="0 0 220 220" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="rpmTrack" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="45%" stopColor="#52f7fe" />
                    <stop offset="100%" stopColor="#0E7C9B" />
                  </linearGradient>
                </defs>
                {(() => {
                  const R = 88;
                  const CIRC = 2 * Math.PI * R;
                  const ARCO = 280 / 360; // anel aberto embaixo
                  return (
                    <g transform="rotate(130 110 110)">
                      <circle
                        cx="110" cy="110" r={R} fill="none"
                        stroke="rgba(255,255,255,0.08)" strokeWidth="16" strokeLinecap="round"
                        strokeDasharray={`${CIRC * ARCO} ${CIRC}`}
                      />
                      <circle
                        cx="110" cy="110" r={R} fill="none"
                        stroke="url(#rpmTrack)" strokeWidth="16" strokeLinecap="round"
                        strokeDasharray={`${CIRC * ARCO * (pct / 100)} ${CIRC}`}
                        style={{ transition: 'stroke-dasharray 1s ease' }}
                      />
                    </g>
                  );
                })()}
                <text x="110" y="118" textAnchor="middle" fontSize="44" fontWeight="900" fontStyle="italic" fill="#fff">
                  {pct}
                  <tspan fontSize="22" fontWeight="800">%</tspan>
                </text>
              </svg>
              <div className="gauge__l">{a.noRitmo ? 'NO RITMO' : 'ABAIXO DO RITMO'}</div>
              <div className="gauge__sub">{formatCurrencyShort(a.realizadoMes)} de {formatCurrencyShort(a.metaCasa)}</div>
            </div>
          </div>

          <div className="panel panel--funil">
            <div className="panel__t">
              <Icon name="chart" size={16} />
              Funil - Telemetria
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
  // Mostramos apenas nome + score do mês. (Fotos dos pilotos entram depois.)
  return (
    <div className={'pod pod--' + pos + (highlight ? ' pod--p1' : '')}>
      <div className="pod__p">{medal}</div>
      <div className="pod__badge">{piloto.nome}</div>
      <div className="pod__pts">
        <b>{piloto.scoreMes ?? 0}</b>
        <span>Pontos</span>
      </div>
    </div>
  );
}
