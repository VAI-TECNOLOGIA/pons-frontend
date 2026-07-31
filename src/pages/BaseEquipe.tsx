import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { Icon } from '../components/Icon';
import { timeAgo } from '../lib/format';

// Temperatura do lead (classificacao) — mesma paleta do Atendimento.
const TEMP: Record<string, { label: string; cor: string; bg: string }> = {
  QUENTE: { label: 'Quente', cor: '#DC2626', bg: 'rgba(220,38,38,0.15)' },
  MORNO: { label: 'Morno', cor: '#D97706', bg: 'rgba(245,158,11,0.18)' },
  FRIO: { label: 'Frio', cor: '#2563EB', bg: 'rgba(37,99,235,0.15)' },
};
const temp = (c?: string) => TEMP[c || 'FRIO'] || TEMP.FRIO;

export default function BaseEquipe() {
  const [filtroEquipe, setFiltroEquipe] = useState<number | ''>('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [alvo, setAlvo] = useState<number | ''>('');
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const params = useMemo(() => (filtroEquipe ? { equipeId: Number(filtroEquipe) } : {}), [filtroEquipe]);
  const { data, loading, reload } = useApi<{ bases: any[]; leads: any[] }>(() => Api.baseEquipe(params), [JSON.stringify(params)]);
  const { data: corretores } = useApi<any[]>(() => Api.corretores());

  const leads = data?.leads || [];
  const bases = data?.bases || [];
  const temMultiEquipe = bases.length > 1;

  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTodos = () => setSel((s) => (s.size === leads.length ? new Set() : new Set(leads.map((l) => l.id))));

  const transferir = async () => {
    if (!sel.size || !alvo) return;
    setEnviando(true);
    try {
      const r = await Api.bolsaoDirecionar({ leadIds: [...sel], corretorId: Number(alvo) });
      toast.success(`${r.direcionados} lead(s) transferido(s).${r.jaAtribuidos ? ` ${r.jaAtribuidos} já estavam com corretor.` : ''}`);
      setSel(new Set()); setAlvo('');
      reload();
    } catch (e: any) {
      toast.error('Erro ao transferir: ' + (e?.message || 'falha'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Topbar title="Base da Equipe" />
      <div className="main">
        <PageHeader
          breadcrumb="Equipe · Base de Leads"
          title="Base da Equipe"
          subtitle="Leads de corretores desativados da sua equipe. Escolha pra quem transferir — a data vira o dia da transferência e o histórico da conversa é preservado."
        />

        {/* Filtro por equipe (quando o gestor tem mais de uma base) */}
        {temMultiEquipe && (
          <div style={{ margin: '8px 0 12px' }}>
            <select className="field__select" style={{ maxWidth: 260 }} value={filtroEquipe} onChange={(e) => { setFiltroEquipe(e.target.value ? Number(e.target.value) : ''); setSel(new Set()); }}>
              <option value="">Todas as equipes</option>
              {bases.map((b) => <option key={b.id} value={b.equipeId}>{b.equipe || `Base ${b.id}`}</option>)}
            </select>
          </div>
        )}

        {/* Barra de transferência */}
        {sel.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, flexWrap: 'wrap' }}>
            <strong>{sel.size} selecionado(s)</strong>
            <span className="text-secondary">→ transferir para:</span>
            <select className="field__select" style={{ maxWidth: 240 }} value={alvo} onChange={(e) => setAlvo(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Escolha o corretor…</option>
              {(corretores || []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}{c.equipe ? ` · ${c.equipe}` : ''}</option>)}
            </select>
            <button className="btn btn--primary btn--sm" onClick={transferir} disabled={!alvo || enviando}>
              {enviando ? 'Transferindo…' : 'Transferir'}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setSel(new Set())}>Limpar seleção</button>
          </div>
        )}

        <div className="card" style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Carregando…</div>
          ) : leads.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
              Nenhum lead na base da equipe. Quando um corretor for desativado, os leads dele caem aqui.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" checked={sel.size === leads.length && leads.length > 0} onChange={toggleTodos} /></th>
                  <th>Temperatura</th>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Origem</th>
                  <th>Status</th>
                  {temMultiEquipe && <th>Equipe</th>}
                  <th>Na base há</th>
                  <th>Conversa</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const t = temp(l.classificacao);
                  return (
                    <tr key={l.id}>
                      <td><input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} /></td>
                      <td>
                        <span className="badge" style={{ background: t.bg, color: t.cor, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.cor, display: 'inline-block' }} />
                          {t.label}
                        </span>
                      </td>
                      <td className="font-semibold">{l.nome || '—'}</td>
                      <td className="text-xs">{l.telefone || l.telefoneMasked || '—'}</td>
                      <td className="text-xs">{l.origem || '—'}</td>
                      <td className="text-xs">{l.status || '—'}</td>
                      {temMultiEquipe && <td className="text-xs text-secondary">{l.equipe || '—'}</td>}
                      <td className="text-xs text-secondary">{timeAgo(l.distribuidoEm || l.createdAt)}</td>
                      <td>
                        <button className="btn btn--ghost btn--sm" onClick={() => navigate(`/chat?lead=${l.id}`)} title="Ver histórico da conversa">
                          <Icon name="chat" size={12} /> Ver{l.temHistorico ? '' : ''}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
