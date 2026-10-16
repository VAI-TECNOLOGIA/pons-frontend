// Gestão de filiais + empresas (CNPJ/CRECI) + participação dos sócios por
// unidade. Componente COMPARTILHADO: renderizado em Configurações (CEO) e em
// Rateio & Sócios (Financeiro) — o Marcelo (FINANCEIRO) precisa alcançar isso,
// e Configurações é só do CEO. Toda a config que o Financeiro preenche vive aqui.
import { useState } from 'react';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { EmptyState } from './EmptyState';
import { Modal } from './Modal';
import { Auth } from '../lib/auth';

export function GestaoFiliais() {
  const { data, loading, error, reload } = useApi<any[]>(() => Api.unidadesList());
  const { data: empresas } = useApi<{ key: string; razaoSocial: string; cnpj: string }[]>(() => Api.unidadeEmpresas());
  const [saving, setSaving] = useState<number | null>(null);
  const toast = useToast();

  const vincular = async (unidade: any, empresaKey: string) => {
    setSaving(unidade.id);
    try {
      await Api.unidadeUpdate(unidade.id, { empresaKey: empresaKey || null });
      toast.success('Filial vinculada ao CNPJ');
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setSaving(null);
    }
  };

  // Filial sem gestor (o sócio toca direto): venda daqui não tem parcela de gestor.
  const [previa, setPrevia] = useState<{ unidade: any; vendas: any[] } | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const podeAjustarVendas = ['CEO', 'DIRETOR_FINANCEIRO'].includes(Auth.user?.role || '');
  const abrirPrevia = async (unidadeId: number) => {
    try { setPrevia(await Api.semGestorPrevia(unidadeId)); }
    catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };
  const mudarGestor = async (unidade: any, semGestor: boolean) => {
    setSaving(unidade.id);
    try {
      await Api.unidadeUpdate(unidade.id, { semGestor });
      toast.success(semGestor ? `${unidade.nome}: vendas novas sem parcela de gestor` : `${unidade.nome}: volta a ter gestor nas vendas novas`);
      reload();
      if (semGestor && podeAjustarVendas) await abrirPrevia(unidade.id);
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setSaving(null);
    }
  };
  const aplicarSemGestor = async () => {
    if (!previa) return;
    setAplicando(true);
    try {
      const r = await Api.semGestorAplicar(previa.unidade.id);
      toast.success(r.ajustadas ? `${r.ajustadas} venda(s) ajustada(s): a parte do gestor voltou para a imobiliária` : 'Nenhuma venda para ajustar');
      setPrevia(null);
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setAplicando(false);
    }
  };

  const [novoNome, setNovoNome] = useState('');
  const [novaCidade, setNovaCidade] = useState('');
  const [novaEmpresa, setNovaEmpresa] = useState('');
  const [criando, setCriando] = useState(false);
  const criar = async () => {
    if (novoNome.trim().length < 2) { toast.error('Informe o nome da filial'); return; }
    setCriando(true);
    try {
      await Api.unidadeCreate({ nome: novoNome.trim(), cidade: novaCidade.trim() || null, empresaKey: novaEmpresa || null });
      toast.success('Filial criada');
      setNovoNome(''); setNovaCidade(''); setNovaEmpresa(''); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
    finally { setCriando(false); }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  const unidades = data || [];
  const opts = empresas || [];
  const semVinculo = unidades.filter((u: any) => !u.empresaKey).length;

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 className="card__title mb-4">Nova filial</h3>
        <div className="flex gap-2" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="field" style={{ flex: '2 1 180px' }}><span className="field__label">Nome da filial</span><input className="field__input" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: GPI Itajaí Rafael" /></label>
          <label className="field" style={{ flex: '1 1 130px' }}><span className="field__label">Cidade</span><input className="field__input" value={novaCidade} onChange={(e) => setNovaCidade(e.target.value)} /></label>
          <label className="field" style={{ flex: '2 1 200px' }}><span className="field__label">CNPJ (empresa)</span>
            <select className="field__input" value={novaEmpresa} onChange={(e) => setNovaEmpresa(e.target.value)}>
              <option value="">— definir depois —</option>
              {opts.map((emp) => <option key={emp.key} value={emp.key}>{emp.razaoSocial} · {emp.cnpj}</option>)}
            </select>
          </label>
          <button className="btn btn--primary btn--sm" disabled={criando} onClick={criar} style={{ marginBottom: 2 }}>{criando ? 'Criando…' : 'Adicionar filial'}</button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <p className="text-sm text-secondary" style={{ margin: 0 }}>
          Conecte cada sala/filial ao CNPJ que assina os contratos. É esse vínculo
          que libera o contrato certo (estágio ou corretor, com o cabeçalho da
          empresa correta) no onboarding de novos colaboradores.
          {semVinculo > 0 && (
            <> <strong>{semVinculo}</strong> {semVinculo === 1 ? 'filial ainda sem CNPJ' : 'filiais ainda sem CNPJ'} — nesses casos o Financeiro escolhe a empresa manualmente.</>
          )}
        </p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Filial</th>
              <th>Cidade</th>
              <th className="numeric">Corretores</th>
              <th style={{ minWidth: 190 }} title="Filial sem gestor: o sócio toca direto e a venda não tem parcela de gestor">Gestor nas vendas</th>
              <th style={{ minWidth: 240 }}>CNPJ (empresa do contrato)</th>
            </tr>
          </thead>
          <tbody>
            {unidades.map((u: any) => (
              <tr key={u.id}>
                <td className="font-semibold">{u.nome}{!u.ativo && <span className="text-secondary"> (inativa)</span>}</td>
                <td>{u.cidade || '—'}</td>
                <td className="numeric">{u.corretores ?? 0}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select
                      className="field__input"
                      value={u.semGestor ? 'sem' : 'com'}
                      disabled={saving === u.id}
                      onChange={(ev) => mudarGestor(u, ev.target.value === 'sem')}
                    >
                      <option value="com">Tem gestor (líder da sala)</option>
                      <option value="sem">Sem gestor (o sócio toca)</option>
                    </select>
                    {u.semGestor && podeAjustarVendas && (
                      <button className="btn btn--ghost btn--sm" onClick={() => abrirPrevia(u.id)} title="Vendas já lançadas desta filial que ainda têm parcela de gestor">Vendas</button>
                    )}
                  </div>
                </td>
                <td>
                  <select
                    className="field__input"
                    value={u.empresaKey || ''}
                    disabled={saving === u.id}
                    onChange={(ev) => vincular(u, ev.target.value)}
                  >
                    <option value="">— Sem vínculo (Financeiro decide) —</option>
                    {opts.map((emp) => (
                      <option key={emp.key} value={emp.key}>{emp.razaoSocial} · {emp.cnpj}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {unidades.length === 0 && (
              <tr><td colSpan={5}><EmptyState size="sm" title="Nenhuma filial cadastrada" /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!previa} onClose={() => setPrevia(null)} title={previa ? `${previa.unidade.nome}: vendas com parcela de gestor` : ''} size="lg">
        {previa && (() => {
          const ajustaveis = previa.vendas.filter((v: any) => v.podeAjustar);
          const moeda = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          return (
            <div style={{ display: 'grid', gap: 12 }}>
              <p className="text-sm text-secondary" style={{ margin: 0 }}>
                As vendas novas desta filial já saem sem gestor. Abaixo, as vendas já lançadas que ainda têm parcela de gestor.
                Ao aplicar, a parte do gestor volta para a imobiliária <strong>só nas vendas em que essa comissão ainda não foi paga</strong>;
                o resto do rateio não muda e cada venda guarda no histórico o valor de antes.
              </p>
              {previa.vendas.length === 0 ? <div className="text-secondary">Nenhuma venda com parcela de gestor nesta filial.</div> : (
                <table className="table">
                  <thead><tr><th>Venda</th><th>Corretor</th><th>Gestor</th><th className="numeric">Parcela do gestor</th><th>Situação</th></tr></thead>
                  <tbody>
                    {previa.vendas.map((v: any) => (
                      <tr key={v.id} style={v.podeAjustar ? undefined : { opacity: 0.55 }}>
                        <td><strong>{v.codigo}</strong><div className="text-xs text-secondary">{v.cliente}{v.sala ? ` · ${v.sala}` : ''}</div></td>
                        <td>{v.corretor || '—'}</td>
                        <td>{v.gestor}</td>
                        <td className="numeric">{moeda(v.valorGestor)}</td>
                        <td className="text-xs">{v.podeAjustar ? 'Será ajustada' : `Fica como está (${v.motivo})`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex-between" style={{ alignItems: 'center' }}>
                <span className="text-sm">{ajustaveis.length} venda(s) para ajustar · {moeda(ajustaveis.reduce((s: number, v: any) => s + v.valorGestor, 0))} voltam para a imobiliária</span>
                <div className="flex gap-2">
                  <button className="btn btn--secondary" onClick={() => setPrevia(null)}>Agora não</button>
                  <button className="btn btn--primary" disabled={aplicando || ajustaveis.length === 0} onClick={aplicarSemGestor}>{aplicando ? 'Ajustando…' : `Tirar o gestor de ${ajustaveis.length} venda(s)`}</button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <EmpresasEditor empresas={opts} onSalvo={reload} />
      <ParticipacaoUnidades unidades={unidades} />
    </>
  );
}

// Participação dos sócios POR UNIDADE — a sociedade varia por filial (RS tem
// Gutierri, Itajaí Delas tem Ana Carolina, Itajaí Rafael tem Rafael 51/49...).
// Cada filial tem sua lista de sócios (nome + % + PIX). Vazio = usa o rateio
// global. O fechamento por unidade usa esta config.
function ParticipacaoUnidades({ unidades }: { unidades: any[] }) {
  const [abertaId, setAbertaId] = useState<number | null>(null);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 className="card__title mb-4">Participação dos sócios por unidade</h3>
      <p className="text-sm text-secondary" style={{ marginTop: -6, marginBottom: 12 }}>
        A sociedade pode variar por filial (pessoas e percentuais diferentes). Preencha a de cada unidade — se deixar vazio, aquela filial usa o rateio global dos sócios. O fechamento por unidade usa o que estiver aqui.
      </p>
      <div className="list">
        {(unidades || []).map((u: any) => (
          <div key={u.id} style={{ borderBottom: '1px solid var(--border-light)', padding: '8px 0' }}>
            <div className="flex-between" style={{ alignItems: 'center' }}>
              <span className="font-semibold">{u.nome}{!u.ativo && <span className="text-secondary"> (inativa)</span>}</span>
              <button className="btn btn--secondary btn--sm" onClick={() => setAbertaId(abertaId === u.id ? null : u.id)}>{abertaId === u.id ? 'Fechar' : 'Editar sócios'}</button>
            </div>
            {abertaId === u.id && <ParticipacaoEditor unidadeId={u.id} onFechar={() => setAbertaId(null)} />}
          </div>
        ))}
        {unidades.length === 0 && <div className="text-secondary" style={{ padding: 12 }}>Cadastre as filiais primeiro.</div>}
      </div>
    </div>
  );
}

function ParticipacaoEditor({ unidadeId, onFechar }: { unidadeId: number; onFechar: () => void }) {
  const { data, loading } = useApi<{ itens: any[] }>(() => Api.participacaoGet(unidadeId));
  const [itens, setItens] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const lista = itens ?? data?.itens ?? [];
  const soma = lista.reduce((s: number, i: any) => s + (Number(i.participacao) || 0), 0);

  const set = (idx: number, campo: string, valor: any) => setItens(lista.map((it: any, i: number) => i === idx ? { ...it, [campo]: valor } : it));
  const add = () => setItens([...lista, { nome: '', participacao: 0, pixKey: '' }]);
  const del = (idx: number) => setItens(lista.filter((_: any, i: number) => i !== idx));
  const salvar = async () => {
    if (lista.length && Math.abs(soma - 100) >= 0.5) { toast.error(`A soma precisa ser 100% (está em ${soma.toFixed(2)}%)`); return; }
    setSaving(true);
    try {
      await Api.participacaoSet(unidadeId, lista.map((i: any) => ({ nome: String(i.nome).trim(), participacao: Number(i.participacao) || 0, pixKey: i.pixKey || null })));
      toast.success('Participação salva'); onFechar();
    } catch (e: any) { toast.error(e?.message || 'Falha ao salvar'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-secondary" style={{ padding: 8 }}>Carregando…</div>;
  return (
    <div style={{ padding: '10px 0 4px', display: 'grid', gap: 8 }}>
      {lista.map((it: any, idx: number) => (
        <div key={idx} className="flex gap-2" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="field" style={{ flex: '2 1 160px' }}><span className="field__label">Sócio</span><input className="field__input" value={it.nome ?? ''} onChange={(e) => set(idx, 'nome', e.target.value)} placeholder="Nome" /></label>
          <label className="field" style={{ flex: '0 1 90px' }}><span className="field__label">%</span><input className="field__input" type="number" step="0.01" value={it.participacao ?? 0} onChange={(e) => set(idx, 'participacao', Number(e.target.value))} /></label>
          <label className="field" style={{ flex: '2 1 160px' }}><span className="field__label">Chave PIX (opcional)</span><input className="field__input" value={it.pixKey ?? ''} onChange={(e) => set(idx, 'pixKey', e.target.value)} /></label>
          <button className="btn btn--ghost btn--sm" onClick={() => del(idx)} style={{ marginBottom: 2 }}>Remover</button>
        </div>
      ))}
      <div className="flex-between" style={{ alignItems: 'center' }}>
        <div className="flex gap-2">
          <button className="btn btn--ghost btn--sm" onClick={add}>+ Sócio</button>
          <span className="text-sm" style={{ color: lista.length && Math.abs(soma - 100) >= 0.5 ? 'var(--color-danger)' : 'var(--text-secondary)', alignSelf: 'center' }}>Soma: {soma.toFixed(2)}%{lista.length === 0 && ' (vazio = usa rateio global)'}</span>
        </div>
        <button className="btn btn--primary btn--sm" disabled={saving} onClick={salvar}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </div>
  );
}

// Editor dos dados jurídicos de cada empresa (razão social, CNPJ, CRECI,
// endereço) — o que sai no cabeçalho dos contratos. Parametriza as pendências
// (ex.: preencher o CRECI da empresa de Capão que faltava).
function EmpresasEditor({ empresas, onSalvo }: { empresas: any[]; onSalvo: () => void }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const abrir = (e: any) => { setForm({ razaoSocial: e.razaoSocial || '', cnpj: e.cnpj || '', creci: e.creci || '', endereco: e.endereco || '' }); setEditando(e.key); };
  const salvar = async () => {
    setSaving(true);
    try { await Api.empresaUpdate(editando!, form); toast.success('Dados da empresa salvos'); setEditando(null); onSalvo(); }
    catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
    finally { setSaving(false); }
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 className="card__title mb-4">Dados jurídicos das empresas (cabeçalho dos contratos)</h3>
      <p className="text-sm text-secondary" style={{ marginTop: -6, marginBottom: 12 }}>Editável — o que você preencher aqui vale no contrato gerado. Ex.: o CRECI da empresa de Capão.</p>
      <div className="list">
        {(empresas || []).map((e: any) => (
          <div key={e.key} style={{ borderBottom: '1px solid var(--border-light)', padding: '10px 0' }}>
            {editando === e.key ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {[['razaoSocial', 'Razão social'], ['cnpj', 'CNPJ'], ['creci', 'CRECI'], ['endereco', 'Endereço']].map(([k, label]) => (
                  <label key={k} className="field">
                    <span className="field__label">{label}</span>
                    <input className="field__input" value={form[k] ?? ''} onChange={(ev) => setForm((s: any) => ({ ...s, [k]: ev.target.value }))} />
                  </label>
                ))}
                <div className="flex gap-2">
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditando(null)}>Cancelar</button>
                  <button className="btn btn--primary btn--sm" disabled={saving} onClick={salvar}>{saving ? 'Salvando…' : 'Salvar'}</button>
                </div>
              </div>
            ) : (
              <div className="flex-between" style={{ alignItems: 'center', gap: 12 }}>
                <div>
                  <div className="font-semibold">{e.razaoSocial}</div>
                  <div className="text-sm text-secondary">CNPJ {e.cnpj || '—'} · CRECI {e.creci || <span style={{ color: 'var(--color-danger)' }}>não preenchido</span>}</div>
                  <div className="text-xs text-secondary">{e.endereco || '—'}</div>
                </div>
                <button className="btn btn--secondary btn--sm" onClick={() => abrir(e)}>Editar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
