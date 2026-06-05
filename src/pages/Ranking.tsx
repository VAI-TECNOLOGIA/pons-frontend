import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { Auth } from '../lib/auth';

type Periodo = 'MES' | 'ANO';
type Aba = 'CORRETORES' | 'FILIAIS' | 'EQUIPES';

export default function Ranking() {
  const [periodo, setPeriodo] = useState<Periodo>('MES');
  const [aba, setAba] = useState<Aba>('CORRETORES');
  const role = Auth.user?.role || '';
  const isGestor = ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'GERENTE_EQUIPE', 'DIRETOR_JURIDICO'].includes(role);

  const { data, loading, error } = useApi<any>(
    () => {
      if (aba === 'CORRETORES') return Api.ranking({ periodo, limit: 20 });
      if (aba === 'FILIAIS') return Api.rankingFiliais({ periodo });
      return Api.rankingEquipes({ periodo });
    },
    [periodo, aba],
  );

  return (
    <>
      <Topbar title="Ranking" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Vendas · Ranking"
          title="Ranking Comercial"
          subtitle={isGestor ? 'Visão completa com VGV, vendas e meta' : 'Sua posição e dos colegas (nomes + colocação apenas)'}
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex" style={{ gap: 8 }}>
            <button className={`btn btn--sm ${aba === 'CORRETORES' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setAba('CORRETORES')}>Corretores</button>
            {isGestor && <button className={`btn btn--sm ${aba === 'FILIAIS' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setAba('FILIAIS')}>Filiais</button>}
            <button className={`btn btn--sm ${aba === 'EQUIPES' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setAba('EQUIPES')}>Equipes</button>
            <div style={{ flex: 1 }} />
            <button className={`btn btn--sm ${periodo === 'MES' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setPeriodo('MES')}>Mês</button>
            <button className={`btn btn--sm ${periodo === 'ANO' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setPeriodo('ANO')}>Ano</button>
          </div>
        </div>

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        {data && aba === 'CORRETORES' && (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Corretor</th><th>Score</th>
                  {data.visaoCompleta && <><th>Vendas</th><th>VGV</th><th>Meta %</th></>}
                </tr>
              </thead>
              <tbody>
                {(data.ranking ?? []).map((r: any) => (
                  <tr key={r.corretorId}>
                    <td style={{ fontWeight: 700, color: r.posicao <= 3 ? 'var(--color-warning)' : 'inherit' }}>
                      {r.posicao}º {r.posicao === 1 ? '🥇' : r.posicao === 2 ? '🥈' : r.posicao === 3 ? '🥉' : ''}
                    </td>
                    <td>
                      <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
                        {r.avatarUrl && <img src={r.avatarUrl} alt={r.nome} style={{ width: 28, height: 28, borderRadius: '50%' }} />}
                        <div>
                          <div style={{ fontWeight: 600 }}>{r.nome}</div>
                          <div className="text-xs text-secondary">{r.equipe || '—'} · {r.filial || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td><strong>{r.score}</strong></td>
                    {data.visaoCompleta && (
                      <>
                        <td>{r.vendas || 0}</td>
                        <td>{(r.vgv || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</td>
                        <td>{r.progressoMeta || 0}%</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && aba === 'FILIAIS' && (
          <div className="card">
            <table className="table">
              <thead><tr><th>#</th><th>Filial</th><th>Score</th><th>Corretores</th><th>Vendas</th><th>VGV</th></tr></thead>
              <tbody>
                {(data.filiais ?? []).map((f: any) => (
                  <tr key={f.unidadeId}>
                    <td>{f.posicao}º</td>
                    <td><strong>{f.nome}</strong><div className="text-xs text-secondary">{f.cidade}</div></td>
                    <td>{f.score}</td>
                    <td>{f.corretores}</td>
                    <td>{f.vendas || 0}</td>
                    <td>{(f.vgv || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && aba === 'EQUIPES' && (
          <div className="card">
            <table className="table">
              <thead><tr><th>#</th><th>Equipe</th><th>Score</th><th>Corretores</th>{isGestor && <><th>Vendas</th><th>VGV</th></>}</tr></thead>
              <tbody>
                {(data.equipes ?? []).map((e: any) => (
                  <tr key={e.equipeId}>
                    <td>{e.posicao}º</td>
                    <td><span style={{ display: 'inline-block', width: 10, height: 10, background: e.cor, borderRadius: 2, marginRight: 6 }}/>{e.nome}</td>
                    <td>{e.score}</td>
                    <td>{e.corretores}</td>
                    {isGestor && <><td>{e.vendas || 0}</td><td>{(e.vgv || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
