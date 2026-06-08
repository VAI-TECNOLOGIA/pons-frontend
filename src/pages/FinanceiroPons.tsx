import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { Icon } from '../components/Icon';

type Tab = 'POLITICA' | 'SOCIOS' | 'FECHAMENTO' | 'SICREDI';

const fmt = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

export default function FinanceiroPons() {
  const [tab, setTab] = useState<Tab>('POLITICA');
  return (
    <>
      <Topbar title="Financeiro · Pons" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Sócios · Financeiro Pons"
          title="Financeiro — Regra Pons"
          subtitle="Rateio de comissão, sócios, fechamento mensal e lotes Sicredi"
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex" style={{ gap: 8 }}>
            <button className={`btn btn--sm ${tab === 'POLITICA' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setTab('POLITICA')}>Política de Rateio</button>
            <button className={`btn btn--sm ${tab === 'SOCIOS' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setTab('SOCIOS')}>Sócios</button>
            <button className={`btn btn--sm ${tab === 'FECHAMENTO' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setTab('FECHAMENTO')}>Fechamento Mensal</button>
            <button className={`btn btn--sm ${tab === 'SICREDI' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setTab('SICREDI')}>Lotes Sicredi</button>
          </div>
        </div>

        {tab === 'POLITICA' && <PoliticaTab />}
        {tab === 'SOCIOS' && <SociosTab />}
        {tab === 'FECHAMENTO' && <FechamentoTab />}
        {tab === 'SICREDI' && <SicrediTab />}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Política de rateio + simulador
// ════════════════════════════════════════════════════════════════════════
function PoliticaTab() {
  const { data: politicas, loading, error, reload } = useApi<any[]>(() => Api.rateioPoliticas());
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [sim, setSim] = useState<any>(null);
  const toast = useToast();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nome: String(fd.get('nome') || ''),
      descricao: String(fd.get('descricao') || '') || null,
      percentualComissao: Number(fd.get('percentualComissao') || 5),
      aplicaNotaFiscal: fd.get('aplicaNotaFiscal') === 'on',
      percentualNotaFiscal: Number(fd.get('percentualNotaFiscal') || 16),
      splitCorretorPons: Number(fd.get('splitCorretorPons') || 55),
      splitImobiliariaPons: Number(fd.get('splitImobiliariaPons') || 45),
      percentualGestor: Number(fd.get('percentualGestor') || 10),
      percentualDirecao: Number(fd.get('percentualDirecao') || 5),
      percentualCampanhaCorretor: Number(fd.get('percentualCampanhaCorretor') || 6.5),
      percentualCampanhaImobiliaria: Number(fd.get('percentualCampanhaImobiliaria') || 6.5),
      percentualLazaroCorretor: Number(fd.get('percentualLazaroCorretor') || 3),
      percentualLazaroImobiliaria: Number(fd.get('percentualLazaroImobiliaria') || 1),
      taxaMarketingFixa: Number(fd.get('taxaMarketingFixa') || 199),
      isDefault: fd.get('isDefault') === 'on',
      ativa: true,
    };
    try {
      if (editing) await Api.rateioPoliticaUpdate(editing.id, payload);
      else await Api.rateioPoliticaCreate(payload);
      toast.success('Política salva'); setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const simular = async () => {
    try {
      const valor = Number((document.getElementById('sim-valor') as HTMLInputElement).value);
      const numeroParcelas = Number((document.getElementById('sim-parc') as HTMLInputElement).value);
      const temNotaFiscal = (document.getElementById('sim-nf') as HTMLInputElement).checked;
      const isLead = (document.getElementById('sim-lead') as HTMLInputElement).checked;
      const lazaroEstrategia = (document.getElementById('sim-estr') as HTMLSelectElement).value;
      const splitVariante = (document.getElementById('sim-split') as HTMLSelectElement).value;
      const r = await Api.rateioSimular({ valorComissaoBruta: valor, numeroParcelas, temNotaFiscal, isLead, lazaroEstrategia, splitVariante });
      setSim(r);
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Políticas cadastradas</h3>
          <button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Nova política</button>
        </div>
        <table className="table">
          <thead><tr><th>Nome</th><th>% Comissão</th><th>NF</th><th>Split</th><th>Gestor</th><th>Default</th><th></th></tr></thead>
          <tbody>
            {(politicas || []).map((p: any) => (
              <tr key={p.id}>
                <td><strong>{p.nome}</strong></td>
                <td>{p.percentualComissao}%</td>
                <td>{p.aplicaNotaFiscal ? `${p.percentualNotaFiscal}%` : '—'}</td>
                <td>{p.splitCorretorPons}/{p.splitImobiliariaPons}</td>
                <td>{p.percentualGestor}%</td>
                <td>{p.isDefault ? <span className="badge badge--launch">DEFAULT</span> : '—'}</td>
                <td><button className="btn btn--ghost btn--sm" onClick={() => { setEditing(p); setOpen(true); }}>Editar</button></td>
              </tr>
            ))}
            {politicas?.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma política cadastrada — crie a primeira pra ativar o cálculo Pons</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="calculator" size={16} /> Simulador de rateio
        </h3>
        <div className="form-grid">
          <div className="field"><label className="field__label">Comissão bruta (R$)</label><input id="sim-valor" type="number" className="field__input" defaultValue={50000} step={0.01} /></div>
          <div className="field"><label className="field__label">Parcelas</label><input id="sim-parc" type="number" className="field__input" defaultValue={1} min={1} /></div>
          <div className="field"><label className="field__label">Split</label>
            <select id="sim-split" className="field__select" defaultValue="55_45">
              <option value="55_45">55/45 (corretor &gt; 1 ano de casa)</option>
              <option value="50_50">50/50 (corretor ≤ 1 ano de casa)</option>
            </select>
            <div className="field__hint">Auto-determinado pela data de admissão no cadastro real; aqui só simulação manual.</div>
          </div>
          <div className="field"><label className="field__label">Estratégia (se lead)</label>
            <select id="sim-estr" className="field__select" defaultValue="CAMPANHA">
              <optgroup label="Com desconto">
                <option value="CAMPANHA">Campanha (-6,5% corretor / -6,5% imob)</option>
                <option value="LAZARO">Lázaro (-3% corretor / -1% imob)</option>
              </optgroup>
              <optgroup label="Sem desconto extra">
                <option value="NETWORK">Network</option>
                <option value="CAMPANHA_PRIVADA">Campanha Privada</option>
                <option value="INDICACAO">Indicação</option>
                <option value="PARCERIA">Parceria</option>
                <option value="COMPRA_PROPRIA">Compra Própria</option>
              </optgroup>
            </select>
          </div>
          <div className="field"><label className="field__label" style={{ display: 'flex', gap: 8 }}><input id="sim-nf" type="checkbox" /> Tem Nota Fiscal (-16%)</label></div>
          <div className="field"><label className="field__label" style={{ display: 'flex', gap: 8 }}><input id="sim-lead" type="checkbox" /> É lead (descontos extras)</label></div>
        </div>
        <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={simular}>Calcular</button>

        {sim && !sim.parcelas && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8 }}>
            <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Breakdown</h4>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div><strong>Comissão bruta:</strong> {fmt(sim.valorComissaoBruta)}</div>
                <div>− Nota Fiscal: {fmt(sim.valorNF)}</div>
                <div><strong>Base líquida:</strong> {fmt(sim.baseLiquida)}</div>
              </div>
              <div>
                <div>Split: {sim.splitCorretorPct}% × {sim.splitImobPct}%</div>
              </div>
            </div>
            <hr style={{ margin: '12px 0' }} />
            <h5 style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="users" size={14} /> Corretor
            </h5>
            <div>Bruto: {fmt(sim.corretor.valorBruto)}</div>
            <div>− Marketing: {fmt(sim.corretor.descontoMarketing)}</div>
            <div>− Campanha: {fmt(sim.corretor.descontoCampanha)}</div>
            <div>− Lázaro: {fmt(sim.corretor.descontoLazaro)}</div>
            <div style={{ color: 'var(--color-success)', fontWeight: 700 }}>= Líquido: {fmt(sim.corretor.valorLiquido)}</div>
            <hr style={{ margin: '12px 0' }} />
            <h5 style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="building" size={14} /> Imobiliária
            </h5>
            <div>Bruto: {fmt(sim.imobiliaria.valorBruto)}</div>
            <div>− Gestor: {fmt(sim.imobiliaria.descontoGestor)} <span className="text-xs text-secondary">(10–13% conforme negociação)</span></div>
            <div>− Direção Adm/Financeira: {fmt(sim.imobiliaria.descontoDirecao)} <span className="text-xs text-secondary">(5% fixo)</span></div>
            <div>− Campanha: {fmt(sim.imobiliaria.descontoCampanha)}</div>
            <div>− Lázaro: {fmt(sim.imobiliaria.descontoLazaro)}</div>
            <div style={{ color: 'var(--color-success)', fontWeight: 700 }}>= Líquido: {fmt(sim.imobiliaria.valorLiquido)}</div>
            <div className="text-xs text-secondary" style={{ marginTop: 8 }}>Confere soma: {fmt(sim.confereSomaBeneficiarios)}</div>
          </div>
        )}

        {sim && sim.parcelas && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{sim.parcelas.length} parcelas</h4>
            <table className="table">
              <thead><tr><th>Parc.</th><th>Bruto</th><th>NF</th><th>Corretor</th><th>Imobiliária</th></tr></thead>
              <tbody>
                {sim.parcelas.map((p: any) => (
                  <tr key={p.numero}>
                    <td>{p.numero}{p.numero === 1 ? ' (MKT)' : ''}</td>
                    <td>{fmt(p.valorComissaoBruta)}</td>
                    <td>{fmt(p.valorNF)}</td>
                    <td>{fmt(p.corretor.valorLiquido)}</td>
                    <td>{fmt(p.imobiliaria.valorLiquido)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td>Total</td>
                  <td>{fmt(sim.agregado.valorBrutoTotal)}</td>
                  <td>—</td>
                  <td>{fmt(sim.agregado.corretorTotal)}</td>
                  <td>{fmt(sim.agregado.imobTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? 'Editar política' : 'Nova política'} size="lg" footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
          <button type="submit" form="pol-form" className="btn btn--primary">Salvar</button>
        </>
      }>
        <form id="pol-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} /></div>
            <div className="field"><label className="field__label">% Comissão (sobre venda)</label><input type="number" step="0.01" name="percentualComissao" className="field__input" defaultValue={editing?.percentualComissao || 5} /></div>
            <div className="field" style={{ gridColumn: '1/-1' }}><label className="field__label">Descrição</label><input name="descricao" className="field__input" defaultValue={editing?.descricao || ''} /></div>
            <div className="field"><label style={{ display: 'flex', gap: 8 }}><input type="checkbox" name="aplicaNotaFiscal" defaultChecked={editing?.aplicaNotaFiscal ?? true} /> Aplica NF</label></div>
            <div className="field"><label className="field__label">% NF</label><input type="number" step="0.01" name="percentualNotaFiscal" className="field__input" defaultValue={editing?.percentualNotaFiscal || 16} /></div>
            <div className="field"><label className="field__label">Split Corretor (%)</label><input type="number" step="0.01" name="splitCorretorPons" className="field__input" defaultValue={editing?.splitCorretorPons || 55} /></div>
            <div className="field"><label className="field__label">Split Imobiliária (%)</label><input type="number" step="0.01" name="splitImobiliariaPons" className="field__input" defaultValue={editing?.splitImobiliariaPons || 45} /></div>
            <div className="field"><label className="field__label">% Gestor</label><input type="number" step="0.01" name="percentualGestor" className="field__input" defaultValue={editing?.percentualGestor || 10} /></div>
            <div className="field"><label className="field__label">% Direção</label><input type="number" step="0.01" name="percentualDirecao" className="field__input" defaultValue={editing?.percentualDirecao || 5} /></div>
            <div className="field"><label className="field__label">% Campanha — Corretor</label><input type="number" step="0.01" name="percentualCampanhaCorretor" className="field__input" defaultValue={editing?.percentualCampanhaCorretor || 6.5} /></div>
            <div className="field"><label className="field__label">% Campanha — Imobiliária</label><input type="number" step="0.01" name="percentualCampanhaImobiliaria" className="field__input" defaultValue={editing?.percentualCampanhaImobiliaria || 6.5} /></div>
            <div className="field"><label className="field__label">% Lázaro — Corretor</label><input type="number" step="0.01" name="percentualLazaroCorretor" className="field__input" defaultValue={editing?.percentualLazaroCorretor || 3} /></div>
            <div className="field"><label className="field__label">% Lázaro — Imobiliária</label><input type="number" step="0.01" name="percentualLazaroImobiliaria" className="field__input" defaultValue={editing?.percentualLazaroImobiliaria || 1} /></div>
            <div className="field"><label className="field__label">Taxa Marketing (R$ fixa)</label><input type="number" step="0.01" name="taxaMarketingFixa" className="field__input" defaultValue={editing?.taxaMarketingFixa || 199} /></div>
            <div className="field"><label style={{ display: 'flex', gap: 8 }}><input type="checkbox" name="isDefault" defaultChecked={editing?.isDefault} /> Política DEFAULT</label></div>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Sócios
// ════════════════════════════════════════════════════════════════════════
function SociosTab() {
  const { data, loading, error, reload } = useApi<any>(() => Api.sociosList());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nome: String(fd.get('nome') || ''),
      participacao: Number(fd.get('participacao') || 0),
      observacao: String(fd.get('observacao') || '') || null,
      ativo: true,
    };
    try {
      if (editing) await Api.socioUpdate(editing.id, payload);
      else await Api.socioCreate(payload);
      toast.success('Sócio salvo'); setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const excluir = async (s: any) => {
    const ok = await confirm({ title: 'Desativar sócio?', message: `${s.nome} será marcado como inativo`, tone: 'danger' });
    if (!ok) return;
    await Api.socioDelete(s.id); toast.success('Sócio desativado'); reload();
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;

  const soma = data?.somaParticipacaoAtivos || 0;
  const alertOK = Math.abs(soma - 100) < 0.01;

  return (
    <>
      <div className="card" style={{ marginBottom: 16, background: alertOK ? 'var(--color-success-bg)' : 'var(--color-warning-bg)' }}>
        <div className="flex-between">
          <div><strong>Soma de participação ativos: {soma}%</strong></div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name={alertOK ? 'check' : 'warn'} size={14} />
            {alertOK ? 'OK pra fechar' : 'Deve somar exatamente 100% pra fechar mês'}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Sócios</h3>
          <button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Novo sócio</button>
        </div>
        <table className="table">
          <thead><tr><th>Nome</th><th>Participação</th><th>Observação</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(data?.socios || []).map((s: any) => (
              <tr key={s.id}>
                <td><strong>{s.nome}</strong></td>
                <td>{s.participacao}%</td>
                <td className="text-xs">{s.observacao || '—'}</td>
                <td><span className={`badge ${s.ativo ? 'badge--launch' : 'badge--neutral'}`}>{s.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td className="flex" style={{ gap: 6 }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(s); setOpen(true); }}>Editar</button>
                  {s.ativo && <button className="btn btn--ghost btn--sm" onClick={() => excluir(s)}>×</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? 'Editar sócio' : 'Novo sócio'} footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
          <button type="submit" form="soc-form" className="btn btn--primary">Salvar</button>
        </>
      }>
        <form id="soc-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} /></div>
            <div className="field"><label className="field__label">Participação (%)</label><input type="number" step="0.01" name="participacao" className="field__input" defaultValue={editing?.participacao || 0} /></div>
            <div className="field" style={{ gridColumn: '1/-1' }}><label className="field__label">Observação</label><input name="observacao" className="field__input" defaultValue={editing?.observacao || ''} /></div>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Fechamento mensal
// ════════════════════════════════════════════════════════════════════════
function FechamentoTab() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const { data, loading, error, reload } = useApi<any>(() => Api.fechamentoMes(ano, mes), [ano, mes]);
  const toast = useToast();
  const confirm = useConfirm();

  const gerar = async () => { await Api.fechamentoGerar(ano, mes); toast.success('Fechamento gerado'); reload(); };
  const fechar = async () => {
    const ok = await confirm({ title: 'Fechar mês?', message: 'Vai congelar os números e dividir entre sócios. Não pode desfazer.', tone: 'danger' });
    if (!ok) return;
    try { await Api.fechamentoFechar(data.id); toast.success('Mês fechado'); reload(); }
    catch (err: any) { toast.error(err.message); }
  };

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="field__select" style={{ width: 120 }}>
            {meses.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="field__input" style={{ width: 100 }} />
          <button className="btn btn--secondary btn--sm" onClick={gerar}>Gerar/atualizar</button>
        </div>
      </div>

      {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

      {data && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>{meses[mes-1]}/{ano}</h3>
            <span className={`badge ${data.status === 'FECHADO' ? 'badge--launch' : 'badge--info'}`}>{data.status}</span>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginBottom: 16 }}>
            <Stat label="Receita" value={fmt(data.receitaTotal)} />
            <Stat label="Despesa" value={fmt(data.despesaTotal)} cor="var(--color-danger)" />
            <Stat label="Comissões pagas" value={fmt(data.comissoesPagas)} cor="var(--color-danger)" />
            <Stat label="Lucro bruto" value={fmt(data.lucroBruto)} cor={data.lucroBruto >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
            <Stat label="Lucro líquido" value={fmt(data.lucroLiquido)} cor={data.lucroLiquido >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} highlight />
          </div>

          {data.rateios && data.rateios.length > 0 && (
            <>
              <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Rateio entre sócios</h4>
              <table className="table">
                <thead><tr><th>Sócio</th><th>Participação</th><th>Valor</th><th>Pago em</th><th></th></tr></thead>
                <tbody>
                  {data.rateios.map((r: any) => (
                    <tr key={r.id}>
                      <td><strong>{r.socio?.nome || `Sócio #${r.socioId}`}</strong></td>
                      <td>{r.participacao}%</td>
                      <td>{fmt(r.valor)}</td>
                      <td className="text-xs">{r.pagoEm ? new Date(r.pagoEm).toLocaleDateString('pt-BR') : '—'}</td>
                      <td>{!r.pagoEm && <button className="btn btn--ghost btn--sm" onClick={async () => { await Api.fechamentoPagarRateio(r.id); toast.success('Marcado pago'); reload(); }}>Marcar pago</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {data.status === 'ABERTO' && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn--primary" onClick={fechar}>
                <Icon name="lock" size={14} /> Fechar mês + Dividir entre sócios
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Lotes Sicredi
// ════════════════════════════════════════════════════════════════════════
function SicrediTab() {
  const { data: proxima, reload: reloadProx } = useApi<any>(() => Api.loteSicrediProxima());
  const { data: lotes, reload: reloadLotes } = useApi<any[]>(() => Api.loteSicrediList());
  const toast = useToast();
  const confirm = useConfirm();

  const preparar = async () => {
    try { await Api.loteSicrediPreparar(); toast.success('Lote preparado'); reloadProx(); reloadLotes(); }
    catch (err: any) { toast.error(err.message); }
  };

  const enviar = async (id: number) => {
    const ok = await confirm({ title: 'Enviar pro Sicredi?', message: 'Vai enviar todos os lançamentos do lote pra Sicredi pagar. Irreversível.', tone: 'danger' });
    if (!ok) return;
    try { await Api.loteSicrediEnviar(id); toast.success('Enviado'); reloadLotes(); }
    catch (err: any) { toast.error(err.message); }
  };

  const cancelar = async (id: number) => {
    const ok = await confirm({ title: 'Cancelar lote?', message: 'Vai liberar todos os lançamentos pra voltarem ao estado APROVADO' });
    if (!ok) return;
    await Api.loteSicrediCancelar(id); toast.success('Cancelado'); reloadLotes();
  };

  return (
    <>
      {proxima && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--bg-elevated)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="calendar" size={16} /> Próximo lote — {new Date(proxima.dataExecucao).toLocaleDateString('pt-BR')} (quarta-feira)
          </h3>
          <div>
            <strong>{proxima.total} lançamentos</strong> · Total: <strong>{fmt(proxima.valor)}</strong>
          </div>
          {proxima.total > 0 && <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={preparar}>Preparar lote</button>}
        </div>
      )}

      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Histórico de lotes</h3>
        <table className="table">
          <thead><tr><th>Data</th><th>Status</th><th>Lançamentos</th><th>Valor</th><th>Enviado em</th><th></th></tr></thead>
          <tbody>
            {(lotes || []).map((l: any) => (
              <tr key={l.id}>
                <td>{new Date(l.dataExecucao).toLocaleDateString('pt-BR')}</td>
                <td><span className={`badge ${l.status === 'CONFIRMADO' ? 'badge--launch' : l.status === 'FALHOU' ? 'badge--cancelled' : 'badge--info'}`}>{l.status}</span></td>
                <td>{l.totalLancamentos}</td>
                <td>{fmt(l.totalValor)}</td>
                <td className="text-xs">{l.enviadoEm ? new Date(l.enviadoEm).toLocaleString('pt-BR') : '—'}</td>
                <td className="flex" style={{ gap: 6 }}>
                  {l.status === 'RASCUNHO' && <>
                    <button className="btn btn--primary btn--sm" onClick={() => enviar(l.id)}>Enviar</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => cancelar(l.id)}>Cancelar</button>
                  </>}
                </td>
              </tr>
            ))}
            {lotes?.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum lote criado</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value, cor, highlight }: { label: string; value: any; cor?: string; highlight?: boolean }) {
  return (
    <div className="card" style={{ padding: 12, background: highlight ? 'var(--bg-elevated)' : undefined }}>
      <div className="text-xs text-secondary">{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: cor }}>{value}</div>
    </div>
  );
}
