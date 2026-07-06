import { useState, useRef, useEffect } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Auth } from '../lib/auth';
import { Icon } from '../components/Icon';
import { formatCurrencyShort, initials } from '../lib/format';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useKanbanDnd } from '../lib/useKanbanDnd';
import { CampoCnpj } from '../components/CampoCnpj';
import type { CnpjInfo } from '../lib/consultaCnpj';

const STATUS_MAP: Record<string, [string, string]> = {
 PRE_ANALISE: ['analysis', 'Contrato em análise'],
 ANALISE_JURIDICA: ['analysis', 'Análise jurídica'],
 EM_ASSINATURA: ['signature', 'Em assinatura'],
 ASSINADO: ['signed', 'Assinado'],
 ASSINADO_AGUARDANDO_PAGAMENTO: ['signature', 'Assinado — aguardando pagamento'],
 INADIMPLENTE: ['cancelled', 'Inadimplente'],
 PAGO: ['signed', 'Pago'],
 AGUARDANDO_REPASSE: ['analysis', 'Aguardando repasse'],
 CANCELADO: ['cancelled', 'Cancelado'],
};

const ESTADO_CIVIL = [
 'Solteiro(a)',
 'Casado(a)',
 'Casado(a) — separação de bens',
 'Casado(a) — separação total de bens',
 'União estável',
 'Divorciado(a)',
 'Viúvo(a)',
];

// Estados civis que exigem dados do cônjuge/companheiro(a) no protocolo.
// Separação TOTAL de bens: o cônjuge não anui na compra — não preenche.
const EXIGE_CONJUGE = new Set(['Casado(a)', 'Casado(a) — separação de bens', 'União estável']);

// Origem gravada no lead → rótulo humano + classificação de comissão.
// Tráfego pago/portais = LEAD (desconto campanha); campanha WhatsApp/base = BASE; resto = orgânica.
const ORIGEM_LEAD_INFO: Record<string, { rotulo: string; comissao: 'LEAD' | 'BASE' | 'ORGANICA' }> = {
 META_ADS: { rotulo: 'Tráfego pago (Meta Ads)', comissao: 'LEAD' },
 GOOGLE: { rotulo: 'Tráfego pago (Google)', comissao: 'LEAD' },
 SITE: { rotulo: 'Site Grupo Pons', comissao: 'LEAD' },
 LANDING_PAGE: { rotulo: 'Landing page', comissao: 'LEAD' },
 SIMULADOR: { rotulo: 'Simulador do site', comissao: 'LEAD' },
 AVALIACAO: { rotulo: 'Avaliação do site', comissao: 'LEAD' },
 ZAP: { rotulo: 'ZAP Imóveis', comissao: 'LEAD' },
 WHATSAPP: { rotulo: 'Campanha WhatsApp (base)', comissao: 'BASE' },
 CAMPANHA: { rotulo: 'Campanha (base)', comissao: 'BASE' },
 IMPORTACAO: { rotulo: 'Base importada', comissao: 'BASE' },
 BASE: { rotulo: 'Base da casa', comissao: 'BASE' },
};
function origemDoLead(origem?: string | null) {
 if (!origem) return null;
 return ORIGEM_LEAD_INFO[origem] || { rotulo: origem, comissao: 'ORGANICA' as const };
}

// Origem manual (venda sem lead vinculado)
const ORIGENS_MANUAIS: { rotulo: string; comissao: 'LEAD' | 'BASE' | 'ORGANICA' }[] = [
 { rotulo: 'Tráfego pago (Meta/Google)', comissao: 'LEAD' },
 { rotulo: 'Campanha WhatsApp / Base da casa', comissao: 'BASE' },
 { rotulo: 'Indicação', comissao: 'ORGANICA' },
 { rotulo: 'Orgânico / walk-in', comissao: 'ORGANICA' },
];

// Documentos exigidos — padrão imobiliária, por tipo de comprador e estado civil.
function docsNecessarios(tipo: 'PF' | 'PJ', estadoCivil: string): string[] {
 if (tipo === 'PJ') {
 return [
 'Cartão CNPJ',
 'Contrato social e últimas alterações',
 'RG e CPF dos sócios-administradores',
 'Comprovante de endereço da empresa',
 'Comprovante do Arras (sinal)',
 ];
 }
 const base = ['RG e CPF (ou CNH) — frente e verso', 'Comprovante de residência atualizado', 'Comprovante do Arras (sinal)'];
 switch (estadoCivil) {
 case 'Casado(a)':
 return [...base, 'Certidão de casamento', 'RG e CPF (ou CNH) do cônjuge', 'Pacto antenupcial registrado (se houver)'];
 case 'Casado(a) — separação de bens':
 return [...base, 'Certidão de casamento', 'RG e CPF (ou CNH) do cônjuge', 'Pacto antenupcial de separação de bens registrado'];
 case 'Casado(a) — separação total de bens':
 return [...base, 'Certidão de casamento', 'Pacto antenupcial de separação total de bens registrado'];
 case 'União estável':
 return [...base, 'Declaração ou escritura de união estável', 'RG e CPF (ou CNH) do(a) companheiro(a)'];
 case 'Divorciado(a)':
 return [...base, 'Certidão de casamento com averbação do divórcio'];
 case 'Viúvo(a)':
 return [...base, 'Certidão de casamento', 'Certidão de óbito do cônjuge'];
 case 'Solteiro(a)':
 return [...base, 'Certidão de nascimento'];
 default:
 return base;
 }
}

export default function Vendas() {
 const [selected, setSelected] = useState<number | null>(null);
 const [openNew, setOpenNew] = useState(false);
 const [tipoComprador, setTipoComprador] = useState<'PF' | 'PJ'>('PF');
 const [step, setStep] = useState(0);
 const formRef = useRef<HTMLFormElement>(null);
 const [view, setView] = useState<'lista' | 'kanban'>('lista');
 const { data: vendas, loading, error, reload } = useApi<any[]>(() => Api.vendas());
 const { data: emps } = useApi<any[]>(() => Api.empreendimentos());
 const { data: corretores } = useApi<any[]>(() => Api.corretores());
 const toast = useToast();
 const role = Auth.user?.role;
 const isCorretor = role === 'CORRETOR';
 const podeEditarStatus = role === 'CEO' || role === 'DIRETOR_FINANCEIRO';

 // ── Lead vinculado: origem vem do banco (corretor não escolhe; pode contestar) ──
 const { data: leadsDisponiveis } = useApi<any[]>(() => Api.leads());
 const [leadBusca, setLeadBusca] = useState('');
 const [leadSel, setLeadSel] = useState<any>(null);
 const [contestarOpen, setContestarOpen] = useState(false);
 const [contestacao, setContestacao] = useState('');
 const [origemManualIdx, setOrigemManualIdx] = useState(0);
 const origemInfo = leadSel ? origemDoLead(leadSel.origem) : null;

 // ── Comprador (controlados pra receber os dados do lead) ──
 const [cliente, setCliente] = useState({ nome: '', email: '', telefone: '' });
 const [estadoCivil, setEstadoCivil] = useState('');
 const temConjuge = EXIGE_CONJUGE.has(estadoCivil);

 // ── Imóvel: seleção puxa unidades e valores do cadastro ──
 const [empSelId, setEmpSelId] = useState('');
 const [unidades, setUnidades] = useState<any[]>([]);
 const [unidadeSelId, setUnidadeSelId] = useState('');
 const empSel = (emps || []).find((e: any) => String(e.id) === empSelId) || null;
 const unidadeSel = unidades.find((u: any) => String(u.id) === unidadeSelId) || null;
 useEffect(() => {
 setUnidades([]); setUnidadeSelId('');
 if (!empSelId) return;
 Api.empreendimentoUnidades(Number(empSelId))
 .then((r: any) => setUnidades(r?.unidades || []))
 .catch(() => setUnidades([]));
 }, [empSelId]);

 // ── Negociação: valores herdados do imóvel; "especial" destrava a edição ──
 const [negEspecial, setNegEspecial] = useState(false);
 const [valorVenda, setValorVenda] = useState('');
 useEffect(() => {
 const v = unidadeSel?.valor || empSel?.valorInicial || '';
 setValorVenda(v ? String(v) : '');
 }, [unidadeSelId, empSelId]); // eslint-disable-line react-hooks/exhaustive-deps

 // ── Comissão: herdada da política do empreendimento; "especial" destrava ──
 const [comEspecial, setComEspecial] = useState(false);
 const { data: politicas } = useApi<any[]>(() => Api.rateioPoliticas());
 const politicaEmp = empSel ? (politicas || []).find((p: any) => p.empreendimento?.id === empSel.id) : null;
 const politicaDefault = (politicas || []).find((p: any) => p.isDefault) || null;
 const politicaVigente = politicaEmp || politicaDefault;
 const pctPonsHerdado = politicaVigente?.percentualComissao ?? 5;

 // ── Confirmação: snapshot do form pro resumo final ──
 const [resumo, setResumo] = useState<any>(null);

 // Reabrir o modal zera o fluxo inteiro
 useEffect(() => {
 if (!openNew) return;
 setStep(0); setTipoComprador('PF');
 setLeadSel(null); setLeadBusca(''); setContestarOpen(false); setContestacao('');
 setCliente({ nome: '', email: '', telefone: '' }); setEstadoCivil('');
 setEmpSelId(''); setUnidadeSelId(''); setUnidades([]);
 setNegEspecial(false); setValorVenda(''); setComEspecial(false);
 setResumo(null); setOrigemManualIdx(0);
 }, [openNew]);

 // Vincular lead: preenche comprador + origem automática
 const vincularLead = (l: any) => {
 setLeadSel(l);
 setCliente({ nome: l?.nome || '', email: l?.email || '', telefone: l?.telefone || '' });
 setContestarOpen(false); setContestacao('');
 };

 // CNPJ consultado na Receita → auto-preenche razão social, contato, endereço e sócio-adm.
 const preencherDaReceita = (info: CnpjInfo) => {
 setCliente((c) => ({
 nome: c.nome || info.razaoSocial || '',
 email: c.email || info.email || '',
 telefone: c.telefone || info.telefone || '',
 }));
 const form = formRef.current;
 if (!form) return;
 const setNativo = (nomeCampo: string, v: string) => {
 const el = form.querySelector(`[name="${nomeCampo}"]`) as HTMLInputElement | null;
 if (el && !el.value && v) {
 const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
 setter.call(el, v);
 el.dispatchEvent(new Event('input', { bubbles: true }));
 }
 };
 // Branch PJ usa inputs não-controlados — preenche direto (só quando vazios)
 setNativo('clienteNome', info.razaoSocial || '');
 setNativo('clienteEmail', info.email || '');
 setNativo('clienteTelefone', info.telefone || '');
 const endereco = [
 [info.logradouro, info.numero].filter(Boolean).join(', '),
 info.bairro,
 info.municipio && `${info.municipio}/${info.uf}`,
 info.cep && `CEP ${info.cep}`,
 ].filter(Boolean).join(' — ');
 setNativo('clienteEndereco', endereco);
 const socioAdm = info.socios.find((s) => /adminis/i.test(s.qualificacao || '')) || info.socios[0];
 if (socioAdm) setNativo('socioNome', socioAdm.nome);
 };

 // Etapas — a última é sempre a CONFIRMAÇÃO; corretor não vê a de comissão
 const PASSOS = isCorretor
 ? ['Comprador', 'Imóvel & corretor', 'Negociação', 'Confirmação']
 : ['Comprador', 'Imóvel & corretor', 'Negociação', 'Comissão & rateio', 'Confirmação'];
 const stepConfirma = PASSOS.length - 1;

 // Valida só os campos visíveis da etapa atual antes de avançar
 const proximaEtapa = () => {
 const cur = formRef.current?.querySelector(`[data-step="${step}"]`);
 const bad = cur?.querySelector(':invalid') as HTMLInputElement | null;
 if (bad) { bad.reportValidity(); return; }
 const prox = Math.min(step + 1, stepConfirma);
 // Entrando na confirmação: tira o snapshot dos campos pro resumo
 if (prox === stepConfirma && formRef.current) {
 const fd = new FormData(formRef.current);
 setResumo(Object.fromEntries(fd.entries()));
 }
 setStep(prox);
 };

 const submit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 // Enter antes da última etapa só avança — não cria a venda sem querer
 if (step < PASSOS.length - 1) { proximaEtapa(); return; }
 // Com noValidate, valida na mão: pula pra etapa do primeiro campo inválido
 const invalido = formRef.current?.querySelector(':invalid') as HTMLInputElement | null;
 if (invalido) {
 const st = Number(invalido.closest('[data-step]')?.getAttribute('data-step') || 0);
 setStep(st);
 setTimeout(() => invalido.reportValidity(), 80);
 return;
 }
 const fd = new FormData(e.currentTarget);
 const num = (v: FormDataEntryValue | null) =>
 Number(String(v || '').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
 const str = (k: string) => { const v = fd.get(k); return v ? String(v) : undefined; };
 const optNum = (k: string) => (fd.get(k) ? num(fd.get(k)) : undefined);
 try {
 // Origem da comissão: negociação especial (admin) > lead vinculado (banco) > manual
 const origemComissaoFinal = (!isCorretor && comEspecial && fd.get('origemComissao'))
 ? String(fd.get('origemComissao'))
 : origemInfo?.comissao ?? ORIGENS_MANUAIS[origemManualIdx].comissao;
 const origemLeadTexto = origemInfo?.rotulo ?? ORIGENS_MANUAIS[origemManualIdx].rotulo;
 const r = await Api.vendaCreate({
 clienteNome: String(fd.get('clienteNome') || ''),
 clienteCpf: fd.get('clienteCpf') ? String(fd.get('clienteCpf')) : undefined,
 clienteEmail: fd.get('clienteEmail') ? String(fd.get('clienteEmail')) : undefined,
 clienteTelefone: fd.get('clienteTelefone') ? String(fd.get('clienteTelefone')) : undefined,
 empreendimentoId: Number(fd.get('empreendimentoId')),
 corretorTitularId: Number(fd.get('corretorTitularId') || 0),
 leadId: leadSel?.id ?? undefined,
 // Unidade selecionada do estoque preenche identificação/tipologia sozinha
 unidade: unidadeSel
 ? [unidadeSel.identificacao, unidadeSel.torre].filter(Boolean).join(' · ')
 : String(fd.get('unidade') || ''),
 tipologia: unidadeSel?.tipologia || (fd.get('tipologia') ? String(fd.get('tipologia')) : undefined),
 valorVenda: num(valorVenda),
 entradaTotal: num(fd.get('entradaTotal')),
 entradaParcelas: Number(fd.get('entradaParcelas')) || 1,
 // Comissão: herdada da política do empreendimento; especial sobrescreve
 percentualComissao: !isCorretor && comEspecial ? num(fd.get('percentualComissao')) : pctPonsHerdado,
 splitCorretor: 55, splitGerente: 15, splitCasa: 30, // legacy (ignorado pela regra Pons)
 temNotaFiscal: !isCorretor && comEspecial ? fd.get('temNotaFiscal') === 'on' : false,
 origemComissao: origemComissaoFinal,
 origemLead: origemLeadTexto,
 ...(contestacao.trim() ? { origemLeadContestacao: contestacao.trim() } : {}),
 extraIndicacoes: !isCorretor && comEspecial ? num(fd.get('extraIndicacoes')) : 0,
 // splitVariante só na negociação especial — sem ela o motor usa o rateio do
 // corretor (negociado no cadastro ou automático por tempo de casa)
 ...(!isCorretor && comEspecial && fd.get('splitVariante') ? { splitVariante: String(fd.get('splitVariante')) } : {}),
 percentualGestor: !isCorretor && comEspecial ? Number(fd.get('percentualGestorPons') || 10) : 10,
 aplicarGestorTrafego: false,
 // Formulário oficial GPI (protocolo PF/PJ)
 tipoComprador,
 salaGpi: str('salaGpi'),
 clienteRg: str('clienteRg'),
 clienteNascimento: str('clienteNascimento'),
 clienteProfissao: str('clienteProfissao'),
 clienteEstadoCivil: str('clienteEstadoCivil'),
 clienteEndereco: str('clienteEndereco'),
 clienteCnpj: str('clienteCnpj'),
 conjugeNome: str('conjugeNome'),
 conjugeCpf: str('conjugeCpf'),
 conjugeRg: str('conjugeRg'),
 conjugeNascimento: str('conjugeNascimento'),
 conjugeProfissao: str('conjugeProfissao'),
 conjugeEmail: str('conjugeEmail'),
 conjugeTelefone: str('conjugeTelefone'),
 socioNome: str('socioNome'),
 socioCpf: str('socioCpf'),
 socioRg: str('socioRg'),
 socioNascimento: str('socioNascimento'),
 socioProfissao: str('socioProfissao'),
 socioEmail: str('socioEmail'),
 socioTelefone: str('socioTelefone'),
 socioEstadoCivil: str('socioEstadoCivil'),
 socioEndereco: str('socioEndereco'),
 construtora: str('construtora'),
 arrasValor: optNum('arrasValor'),
 arrasVencimento: str('arrasVencimento'),
 mensaisValor: optNum('mensaisValor'),
 mensaisMelhorDia: fd.get('mensaisMelhorDia') ? Number(fd.get('mensaisMelhorDia')) : undefined,
 anuaisValor: optNum('anuaisValor'),
 anuaisInicio: str('anuaisInicio'),
 chavesValor: optNum('chavesValor'),
 });
 toast.success(r?.aguardandoAprovacao
 ? 'Venda registrada — parcelamento 4x+ enviado pro Paulo aprovar.'
 : 'Venda registrada');
 setOpenNew(false);
 await reload();
 if (r?.id) setSelected(r.id);
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || err.details?.message || 'falha'));
 }
 };

 const atualizarStatus = async (id: number, status: string) => {
 try {
 await Api.vendaUpdateStatus(id, status);
 toast.success('Status atualizado');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 if (loading) return <Shell onNew={() => setOpenNew(true)}><LoadingBlock /></Shell>;
 if (error) return <Shell onNew={() => setOpenNew(true)}><ErrorBlock error={error} /></Shell>;
 if (!vendas) return null;
 const sel = selected ? vendas.find((v: any) => v.id === selected) : null;

 return (
 <>
 <Topbar
 title="Vendas"
 right={
 <button className="btn btn--primary btn--sm" onClick={() => setOpenNew(true)}>
 + Nova Venda
 </button>
 }
 />
 <div className="main__content">
 <PageHeader
 breadcrumb="Comercial · Vendas"
 title={`${vendas.length} vendas`}
 subtitle="Clique numa venda para ver comissão, rateio e plano de recebimento"
 />

 <ParcelasAtrasadas onSelect={setSelected} />

 <div className="flex gap-2" style={{ marginBottom: 12 }}>
 <button
 className={`btn btn--sm ${view === 'lista' ? 'btn--primary' : 'btn--secondary'}`}
 onClick={() => setView('lista')}
 >
 Lista
 </button>
 <button
 className={`btn btn--sm ${view === 'kanban' ? 'btn--primary' : 'btn--secondary'}`}
 onClick={() => setView('kanban')}
 >
 Kanban
 </button>
 </div>

 {view === 'kanban' ? (
 <VendaKanban onSelect={setSelected} podeMover={podeEditarStatus} />
 ) : (
 <div className="card" style={{ padding: 0 }}>
 <table className="table">
 <thead>
 <tr>
 <th>Código</th>
 <th>Cliente</th>
 <th>Empreendimento</th>
 <th>Corretor</th>
 <th className="numeric">Valor</th>
 <th>Status</th>
 </tr>
 </thead>
 <tbody>
 {vendas.map((v: any) => {
 const [k, lbl] = STATUS_MAP[v.status] || ['neutral', v.status];
 const cliente = v.clienteNome || v.cliente || '—';
 const empNome = typeof v.empreendimento === 'string' ? v.empreendimento : v.empreendimento?.nome || '';
 const corrNome = typeof v.corretor === 'string' ? v.corretor : v.corretor?.nome || v.corretorTitular?.user?.name || '—';
 const corrInit = v.corretor?.initials || initials(corrNome);
 const valor = v.valorVenda ?? v.valor ?? 0;
 return (
 <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(v.id)}>
 <td className="font-semibold">#{v.codigo || String(v.id).padStart(5, '0')}</td>
 <td>{cliente}</td>
 <td>
 {empNome} · {v.unidade}
 </td>
 <td>
 <div className="flex gap-2" style={{ alignItems: 'center' }}>
 <div className="avatar avatar--sm">{corrInit}</div>
 {corrNome.split(' ')[0]}
 </div>
 </td>
 <td className="numeric money">{formatCurrencyShort(valor)}</td>
 <td>
 <span className={`badge badge--${k}`}>{lbl}</span>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}

 {sel && (
 <div
 role="dialog"
 onClick={(e) => {
 if (e.target === e.currentTarget) setSelected(null);
 }}
 style={{
 position: 'fixed',
 inset: 0,
 background: 'rgba(38,54,84,0.5)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 zIndex: 500,
 }}
 >
 <div style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 14, maxWidth: 720, width: '96%', boxShadow: 'var(--shadow-xl)' }}>
 <div style={{ background: 'linear-gradient(135deg,#15171C,#0B0C10)', color: '#fff', padding: '24px 28px', borderRadius: '14px 14px 0 0' }}>
 <div className="flex-between" style={{ alignItems: 'flex-start' }}>
 <div>
 <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
 Venda #{String(sel.id).padStart(5, '0')}
 </div>
 <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{sel.clienteNome || sel.cliente}</div>
 <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
 {(typeof sel.empreendimento === 'string' ? sel.empreendimento : sel.empreendimento?.nome) || ''} · {sel.unidade} · {sel.corretorTitular?.user?.name || sel.corretor?.nome || sel.corretor}
 </div>
 </div>
 <div style={{ textAlign: 'right' }}>
 <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
 Valor da venda
 </div>
 <div style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#88C559' }}>
 {formatCurrencyShort(sel.valorVenda ?? sel.valor)}
 </div>
 </div>
 </div>
 </div>
 <div style={{ padding: '24px 28px' }}>
 <div className="text-secondary text-sm" style={{ marginBottom: 16 }}>
 Comissão estimada: <strong>{formatCurrencyShort(sel.comissao ?? (sel.valorVenda ?? sel.valor) * 0.05)}</strong>
 </div>
 <div style={{ margin: '16px 0', padding: '14px 16px', background: 'var(--bg-card-hover)', borderRadius: 10 }}>
 <div className="uppercase-tag" style={{ marginBottom: 8 }}>Status da venda</div>
 {podeEditarStatus ? (
 <select
 className="field__select"
 value={sel.status}
 onChange={(e) => atualizarStatus(sel.id, e.target.value)}
 style={{ width: 'auto', minWidth: 200 }}
 >
 {Object.entries(STATUS_MAP).map(([val, [, lbl]]) => (
 <option key={val} value={val}>{lbl}</option>
 ))}
 </select>
 ) : (
 <div className="text-xs text-secondary">Somente Financeiro/CEO altera o status.</div>
 )}
 </div>

 {sel.aguardandoAprovacao && (
 <div style={{ margin: '16px 0', padding: '14px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 10 }}>
 <div style={{ fontWeight: 700, fontSize: 13, color: '#B45309', marginBottom: 4 }}>
 Parcelamento {sel.entradaParcelas}x aguardando aprovação do Paulo
 </div>
 {role === 'CEO' ? (
 <button
 className="btn btn--primary btn--sm"
 style={{ marginTop: 6 }}
 onClick={async () => {
 try {
 await Api.vendaAprovar(sel.id);
 toast.success('Parcelamento aprovado.');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 }}
 >
 Aprovar parcelamento
 </button>
 ) : (
 <div className="text-xs text-secondary">Só o Paulo (CEO) libera esse parcelamento.</div>
 )}
 </div>
 )}

 <FormularioGpi f={sel.formulario} />

 <VendaParcelas vendaId={sel.id} podeConfirmar={podeEditarStatus} />

 <VendaDocumentos vendaId={sel.id} podeRemover={podeEditarStatus} />

 <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
 <button className="btn btn--secondary" onClick={() => setSelected(null)}>
 Fechar
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 <Modal open={openNew} onClose={() => setOpenNew(false)} title="Nova Venda" subtitle="Formulário oficial GPI — preencha etapa por etapa" size="lg">
 <form ref={formRef} onSubmit={submit} noValidate>
 <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
 {PASSOS.map((p, i) => {
 const ativo = i === step;
 const feito = i < step;
 return (
 <button
 key={p}
 type="button"
 onClick={() => feito && setStep(i)}
 style={{
 display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px 6px 7px', borderRadius: 999,
 border: '1px solid ' + (ativo ? 'var(--blue-500)' : 'var(--border-light)'),
 background: ativo ? 'var(--bg-elevated)' : 'transparent',
 color: ativo ? 'var(--text-primary)' : 'var(--text-secondary)',
 fontSize: 12, fontWeight: 700, cursor: feito ? 'pointer' : 'default',
 }}
 title={feito ? 'Voltar pra esta etapa' : undefined}
 >
 <span style={{
 width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 800,
 background: feito ? 'var(--color-success)' : ativo ? 'var(--blue-500)' : 'var(--bg-elevated)',
 color: feito || ativo ? '#fff' : 'var(--text-secondary)',
 }}>
 {feito ? <Icon name="check" size={11} /> : i + 1}
 </span>
 {p}
 </button>
 );
 })}
 </div>

 <div data-step="0" style={{ display: step === 0 ? 'block' : 'none' }} className="fade-in">
 <div className="text-xs text-secondary" style={{ marginBottom: 10 }}>Dados do comprador conforme o formulário oficial do protocolo GPI.</div>

 {/* Vincular lead: puxa nome/contato e a ORIGEM oficial do banco */}
 <div className="card" style={{ padding: '12px 14px', marginBottom: 14, background: 'var(--bg-elevated)' }}>
 <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
 <Icon name="users" size={13} /> Vincular lead (recomendado)
 </div>
 {leadSel ? (
 <div className="flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
 <div className="avatar avatar--sm">{initials(leadSel.nome)}</div>
 <div style={{ flex: 1, minWidth: 180 }}>
 <div className="font-semibold" style={{ fontSize: 13 }}>{leadSel.nome}</div>
 <div className="text-xs text-secondary">
 Origem: <strong>{origemDoLead(leadSel.origem)?.rotulo}</strong>
 {leadSel.campanha ? ` · ${leadSel.campanha}` : ''}
 </div>
 </div>
 <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setLeadSel(null); setContestarOpen(false); setContestacao(''); }}>Desvincular</button>
 </div>
 ) : (
 <>
 <input
 className="field__input"
 placeholder="Buscar lead por nome ou telefone…"
 value={leadBusca}
 onChange={(e) => setLeadBusca(e.target.value)}
 style={{ marginBottom: 8 }}
 />
 {leadBusca.trim().length >= 2 && (
 <div style={{ maxHeight: 168, overflowY: 'auto', display: 'grid', gap: 4 }}>
 {(leadsDisponiveis || [])
 .filter((l: any) => {
 const q = leadBusca.trim().toLowerCase();
 return (l.nome || '').toLowerCase().includes(q) || String(l.telefone || '').includes(q);
 })
 .slice(0, 8)
 .map((l: any) => (
 <button key={l.id} type="button" className="btn btn--secondary btn--sm" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => vincularLead(l)}>
 <strong>{l.nome}</strong>
 <span className="text-xs text-secondary" style={{ marginLeft: 8 }}>{origemDoLead(l.origem)?.rotulo}</span>
 </button>
 ))}
 </div>
 )}
 <div className="field__hint">A origem do lead (tráfego pago, campanha, base) entra sozinha no cálculo da comissão.</div>
 </>
 )}
 </div>

 <div className="flex gap-2" style={{ marginBottom: 14 }}>
 <button type="button" className={'btn btn--sm ' + (tipoComprador === 'PF' ? 'btn--primary' : 'btn--secondary')} onClick={() => setTipoComprador('PF')}>Pessoa Física</button>
 <button type="button" className={'btn btn--sm ' + (tipoComprador === 'PJ' ? 'btn--primary' : 'btn--secondary')} onClick={() => setTipoComprador('PJ')}>Pessoa Jurídica</button>
 </div>
 {tipoComprador === 'PF' ? (
 <>
 <div className="form-grid" style={{ marginBottom: 16 }}>
 <div className="field field--span-2">
 <label className="field__label">Nome completo <span className="field__required">*</span></label>
 <input name="clienteNome" className="field__input" required value={cliente.nome} onChange={(e) => setCliente((c) => ({ ...c, nome: e.target.value }))} />
 </div>
 <div className="field">
 <label className="field__label">CPF</label>
 <input name="clienteCpf" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">RG (c/ órgão expedidor)</label>
 <input name="clienteRg" className="field__input" placeholder="1234567 SSP/SC" />
 </div>
 <div className="field">
 <label className="field__label">Data de nascimento</label>
 <input name="clienteNascimento" type="date" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Profissão</label>
 <input name="clienteProfissao" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">E-mail</label>
 <input name="clienteEmail" type="email" className="field__input" value={cliente.email} onChange={(e) => setCliente((c) => ({ ...c, email: e.target.value }))} />
 </div>
 <div className="field">
 <label className="field__label">Telefone</label>
 <input name="clienteTelefone" className="field__input" value={cliente.telefone} onChange={(e) => setCliente((c) => ({ ...c, telefone: e.target.value }))} />
 </div>
 <div className="field">
 <label className="field__label">Estado civil <span className="field__required">*</span></label>
 <select name="clienteEstadoCivil" className="field__select" required value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)}>
 <option value="">— Selecionar —</option>
 {ESTADO_CIVIL.map((e) => <option key={e} value={e}>{e}</option>)}
 </select>
 <div className="field__hint">Define os documentos exigidos e os dados do cônjuge.</div>
 </div>
 <div className="field field--span-2">
 <label className="field__label">Endereço completo (c/ CEP)</label>
 <input name="clienteEndereco" className="field__input" placeholder="Rua, nº, bairro, cidade/UF, CEP" />
 </div>
 </div>

 {/* Cônjuge: só quando o estado civil exige (casado/união estável) */}
 {temConjuge && (
 <div style={{ borderLeft: '3px solid var(--blue-500)', paddingLeft: 14, marginTop: 6 }} className="fade-in">
 <div className="uppercase-tag" style={{ marginBottom: 8 }}>
 {estadoCivil === 'União estável' ? 'Companheiro(a)' : 'Cônjuge'} — obrigatório para {estadoCivil.toLowerCase()}
 </div>
 <div className="form-grid" style={{ marginBottom: 4 }}>
 <div className="field field--span-2">
 <label className="field__label">Nome completo <span className="field__required">*</span></label>
 <input name="conjugeNome" className="field__input" required={temConjuge} />
 </div>
 <div className="field">
 <label className="field__label">CPF</label>
 <input name="conjugeCpf" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">RG (c/ órgão expedidor)</label>
 <input name="conjugeRg" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Data de nascimento</label>
 <input name="conjugeNascimento" type="date" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Profissão</label>
 <input name="conjugeProfissao" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">E-mail</label>
 <input name="conjugeEmail" type="email" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Telefone</label>
 <input name="conjugeTelefone" className="field__input" />
 </div>
 </div>
 </div>
 )}

 </>
 ) : (
 <>
 <div className="form-grid" style={{ marginBottom: 16 }}>
 <div className="field field--span-2">
 <label className="field__label">Razão social <span className="field__required">*</span></label>
 <input name="clienteNome" className="field__input" required />
 </div>
 <div className="field">
 <CampoCnpj name="clienteCnpj" label="CNPJ" onInfo={preencherDaReceita} />
 </div>
 <div className="field">
 <label className="field__label">Telefone</label>
 <input name="clienteTelefone" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">E-mail</label>
 <input name="clienteEmail" type="email" className="field__input" />
 </div>
 <div className="field field--span-2">
 <label className="field__label">Endereço completo (c/ CEP)</label>
 <input name="clienteEndereco" className="field__input" placeholder="Rua, nº, bairro, cidade/UF, CEP" />
 </div>
 </div>
 <div style={{ borderLeft: '3px solid var(--border-light)', paddingLeft: 14, marginTop: 6 }}>
 <div className="uppercase-tag" style={{ marginBottom: 8 }}>Sócio-administrador</div>
 <div className="form-grid" style={{ marginBottom: 4 }}>
 <div className="field field--span-2">
 <label className="field__label">Nome completo</label>
 <input name="socioNome" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">CPF</label>
 <input name="socioCpf" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">RG (c/ órgão expedidor)</label>
 <input name="socioRg" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Data de nascimento</label>
 <input name="socioNascimento" type="date" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Profissão</label>
 <input name="socioProfissao" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">E-mail</label>
 <input name="socioEmail" type="email" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Telefone</label>
 <input name="socioTelefone" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Estado civil</label>
 <select name="socioEstadoCivil" className="field__select" defaultValue="">
 <option value="">—</option>
 {ESTADO_CIVIL.map((e) => <option key={e} value={e}>{e}</option>)}
 </select>
 </div>
 <div className="field field--span-2">
 <label className="field__label">Endereço completo (c/ CEP)</label>
 <input name="socioEndereco" className="field__input" placeholder="Rua, nº, bairro, cidade/UF, CEP" />
 </div>
 </div>
 </div>
 </>
 )}

 {/* Documentos exigidos — muda conforme PF/PJ e o estado civil selecionado */}
 {(tipoComprador === 'PJ' || estadoCivil) && (
 <div className="card fade-in" style={{ marginTop: 14, padding: '12px 16px', background: 'var(--bg-elevated)' }}>
 <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
 <Icon name="doc" size={13} /> Documentos exigidos — {tipoComprador === 'PJ' ? 'Pessoa Jurídica' : estadoCivil}
 </div>
 <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
 {docsNecessarios(tipoComprador, estadoCivil).map((d) => <li key={d}>{d}</li>)}
 </ul>
 <div className="text-xs text-secondary" style={{ marginTop: 6 }}>Anexe na venda depois de criar (seção Documentos do protocolo).</div>
 </div>
 )}
 </div>

 <div data-step="1" style={{ display: step === 1 ? 'block' : 'none' }} className="fade-in">
 <div className="text-xs text-secondary" style={{ marginBottom: 10 }}>Selecione o empreendimento — os dados do imóvel vêm do cadastro.</div>
 <div className="form-grid" style={{ marginBottom: 12 }}>
 <div className="field">
 <label className="field__label">Empreendimento <span className="field__required">*</span></label>
 <select name="empreendimentoId" className="field__select" required value={empSelId} onChange={(e) => setEmpSelId(e.target.value)}>
 <option value="">— Selecionar —</option>
 {(emps || []).map((e: any) => (
 <option key={e.id} value={e.id}>{e.nome}</option>
 ))}
 </select>
 </div>
 {unidades.length > 0 ? (
 <div className="field">
 <label className="field__label">Unidade (do estoque) <span className="field__required">*</span></label>
 <select className="field__select" required value={unidadeSelId} onChange={(e) => setUnidadeSelId(e.target.value)}>
 <option value="">— Selecionar —</option>
 {unidades.map((u: any) => (
 <option key={u.id} value={u.id} disabled={u.status && u.status !== 'DISPONIVEL'}>
 {[u.identificacao, u.torre].filter(Boolean).join(' · ')}
 {u.tipologia ? ` — ${u.tipologia}` : ''}
 {u.valor ? ` — R$ ${Number(u.valor).toLocaleString('pt-BR')}` : ''}
 {u.status && u.status !== 'DISPONIVEL' ? ` (${u.status})` : ''}
 </option>
 ))}
 </select>
 <div className="field__hint">Tipologia e valor entram sozinhos.</div>
 </div>
 ) : (
 <>
 <div className="field">
 <label className="field__label">Unidade <span className="field__required">*</span></label>
 <input name="unidade" className="field__input" required placeholder="Apt 1207 · Torre A" />
 </div>
 <div className="field">
 <label className="field__label">Tipologia</label>
 <input name="tipologia" className="field__input" placeholder="3 suítes" />
 </div>
 </>
 )}
 <div className="field">
 <label className="field__label">Corretor titular <span className="field__required">*</span></label>
 {isCorretor ? (
 <>
 <input className="field__input" value={Auth.user?.name || ''} disabled />
 <input type="hidden" name="corretorTitularId" value="0" />
 <div className="field__hint">A venda é registrada no seu nome.</div>
 </>
 ) : (
 <select name="corretorTitularId" className="field__select" required>
 {(corretores || []).map((c: any) => (
 <option key={c.id} value={c.id}>{c.nome}</option>
 ))}
 </select>
 )}
 </div>
 <div className="field">
 <label className="field__label">Sala GPI</label>
 <input name="salaGpi" className="field__input" placeholder="Sala 12" />
 </div>
 </div>

 {/* Card do imóvel selecionado — dados vêm do cadastro */}
 {empSel && (
 <div className="card fade-in" style={{ padding: '12px 16px', marginBottom: 14, background: 'var(--bg-elevated)' }}>
 <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
 <Icon name="building" size={13} /> {empSel.nome}
 </div>
 <div className="text-xs text-secondary">
 {empSel.construtora?.nome ? `Construtora ${empSel.construtora.nome} · ` : ''}
 {empSel.cidade}{empSel.estado ? `/${empSel.estado}` : ''}
 {empSel.status ? ` · ${String(empSel.status).replace('_', '-').toLowerCase()}` : ''}
 {unidadeSel?.valor
 ? ` · Unidade R$ ${Number(unidadeSel.valor).toLocaleString('pt-BR')}`
 : empSel.valorInicial ? ` · a partir de R$ ${Number(empSel.valorInicial).toLocaleString('pt-BR')}` : ''}
 </div>
 </div>
 )}

 {/* Origem: vem do lead vinculado (banco). Corretor não escolhe — contesta. */}
 <div className="card" style={{ padding: '12px 16px', marginBottom: 4, background: 'var(--bg-elevated)' }}>
 <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
 <Icon name="target" size={13} /> Origem do lead
 </div>
 {leadSel ? (
 <>
 <div className="flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
 <span className="badge badge--info">{origemInfo?.rotulo}</span>
 <span className="text-xs text-secondary">registrada no sistema — entra no cálculo da comissão</span>
 {!contestarOpen && (
 <button type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setContestarOpen(true)}>
 Contestar origem
 </button>
 )}
 </div>
 {contestarOpen && (
 <div style={{ marginTop: 10 }} className="fade-in">
 <label className="field__label">Por que você não concorda com essa origem?</label>
 <textarea
 className="field__input"
 rows={2}
 maxLength={600}
 value={contestacao}
 onChange={(e) => setContestacao(e.target.value)}
 placeholder="Ex.: o cliente veio por indicação do proprietário da unidade 302, não pela campanha."
 />
 <div className="flex" style={{ gap: 8, marginTop: 6 }}>
 <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setContestarOpen(false); setContestacao(''); }}>Cancelar contestação</button>
 <span className="text-xs text-secondary" style={{ alignSelf: 'center' }}>A contestação vai junto com a venda pro financeiro analisar.</span>
 </div>
 </div>
 )}
 </>
 ) : (
 <div className="field" style={{ marginBottom: 0 }}>
 <select className="field__select" value={origemManualIdx} onChange={(e) => setOrigemManualIdx(Number(e.target.value))}>
 {ORIGENS_MANUAIS.map((o, i) => <option key={o.rotulo} value={i}>{o.rotulo}</option>)}
 </select>
 <div className="field__hint">Sem lead vinculado — informe a origem manualmente (vincule o lead na etapa 1 pra origem automática).</div>
 </div>
 )}
 </div>
 </div>

 <div data-step="2" style={{ display: step === 2 ? 'block' : 'none' }} className="fade-in">
 <div className="text-xs text-secondary" style={{ marginBottom: 10 }}>Valores e condições de pagamento — arras, mensais, anuais e chaves.</div>

 {/* Valor herdado do imóvel; negociação especial destrava a edição */}
 <div className="card" style={{ padding: '12px 16px', marginBottom: 14, background: 'var(--bg-elevated)' }}>
 <div className="flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
 <div style={{ flex: 1, minWidth: 200 }}>
 <div style={{ fontSize: 12, fontWeight: 700 }}>Valor do imóvel (tabela)</div>
 <div className="text-xs text-secondary">
 {unidadeSel?.valor || empSel?.valorInicial
 ? 'Preenchido pelo cadastro do empreendimento.'
 : 'Sem valor de tabela no cadastro — informe abaixo.'}
 </div>
 </div>
 <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
 <input type="checkbox" checked={negEspecial} onChange={(e) => setNegEspecial(e.target.checked)} style={{ width: 'auto' }} />
 Negociação especial (valor diferente da tabela)
 </label>
 </div>
 </div>

 <div className="form-grid" style={{ marginBottom: 16 }}>
 <div className="field">
 <label className="field__label">Valor da venda <span className="field__required">*</span></label>
 <input
 className="field__input"
 required
 placeholder="780000"
 value={valorVenda}
 onChange={(e) => setValorVenda(e.target.value)}
 readOnly={!negEspecial && !!(unidadeSel?.valor || empSel?.valorInicial)}
 style={!negEspecial && (unidadeSel?.valor || empSel?.valorInicial) ? { opacity: 0.75 } : undefined}
 />
 {!negEspecial && !!(unidadeSel?.valor || empSel?.valorInicial) && (
 <div className="field__hint">Travado no valor de tabela — marque "Negociação especial" pra alterar.</div>
 )}
 </div>
 <div className="field">
 <label className="field__label">Entrada total</label>
 <input name="entradaTotal" className="field__input" placeholder="156000" />
 </div>
 <div className="field">
 <label className="field__label">Parcelas da entrada</label>
 <input name="entradaParcelas" type="number" min={1} className="field__input" defaultValue="5" />
 </div>
 <div className="field">
 <label className="field__label">Arras (R$)</label>
 <input name="arrasValor" className="field__input" placeholder="20000" />
 </div>
 <div className="field">
 <label className="field__label">Vencimento das arras</label>
 <input name="arrasVencimento" type="date" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Mensais (R$)</label>
 <input name="mensaisValor" className="field__input" placeholder="4500" />
 </div>
 <div className="field">
 <label className="field__label">Melhor dia do mês</label>
 <input name="mensaisMelhorDia" type="number" min={1} max={31} className="field__input" placeholder="10" />
 </div>
 <div className="field">
 <label className="field__label">Anuais (R$)</label>
 <input name="anuaisValor" className="field__input" placeholder="30000" />
 </div>
 <div className="field">
 <label className="field__label">Início dos anuais</label>
 <input name="anuaisInicio" type="month" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Chaves (R$)</label>
 <input name="chavesValor" className="field__input" placeholder="150000" />
 </div>
 </div>

 <div className="card" style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-elevated)' }}>
 <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Dados bancários — Grupo Pons Imobiliário (manter no protocolo)</div>
 <div className="text-xs text-secondary">
 Titular: Pons Assessoria Imobiliária Ltda. · CNPJ: 05.198.406/0001-44 · Banco: Sicredi (748) · Agência: 2606 · Conta: 49602-1 · PIX: 05.198.406/0001-44
 </div>
 </div>
 </div>

 {!isCorretor && (
 <div data-step="3" style={{ display: step === 3 ? 'block' : 'none' }} className="fade-in">
 <div className="text-xs text-secondary" style={{ marginBottom: 10 }}>O rateio é travado na criação da venda e não muda depois.</div>

 {/* Herdado: política do empreendimento + negociação do corretor */}
 <div className="card" style={{ padding: '12px 16px', marginBottom: 14, background: 'var(--bg-elevated)' }}>
 <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Comissão herdada</div>
 <div className="text-xs text-secondary" style={{ display: 'grid', gap: 3 }}>
 <div>• Pons recebe <strong>{pctPonsHerdado}%</strong> da venda {politicaEmp ? `(política do empreendimento "${politicaEmp.nome}")` : politicaDefault ? `(política padrão "${politicaDefault.nome}")` : '(padrão)'}</div>
 <div>• Split do corretor: <strong>rateio do cadastro dele</strong> (negociado ou automático 50% → 55% após 12 meses)</div>
 <div>• Origem: <strong>{origemInfo?.rotulo ?? ORIGENS_MANUAIS[origemManualIdx].rotulo}</strong> {leadSel ? '(do lead vinculado)' : '(manual)'}</div>
 </div>
 <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 10 }}>
 <input type="checkbox" checked={comEspecial} onChange={(e) => setComEspecial(e.target.checked)} style={{ width: 'auto' }} />
 Negociação especial da comissão (editar valores)
 </label>
 </div>

 {comEspecial && (
 <div className="fade-in">
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
 <div className="field">
 <label className="field__label">% Comissão (sobre venda)</label>
 <input type="number" step="0.01" name="percentualComissao" className="field__input" defaultValue={pctPonsHerdado} />
 </div>
 <div className="field">
 <label className="field__label">Split (override)</label>
 <select name="splitVariante" className="field__select" defaultValue="">
 <option value="">Automático (cadastro do corretor)</option>
 <option value="55_45">Corretor 55% / Imob. 45%</option>
 <option value="50_50">Corretor 50% / Imob. 50%</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">% Gestor</label>
 <select name="percentualGestorPons" className="field__select" defaultValue="10">
 <option value="10">10%</option><option value="13">13%</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Origem (override)</label>
 <select name="origemComissao" className="field__select" defaultValue={origemInfo?.comissao ?? ORIGENS_MANUAIS[origemManualIdx].comissao}>
 <option value="LEAD">Lead (campanha −6,5% / −6,5%)</option>
 <option value="BASE">Base (−3% corretor / −1% imob.)</option>
 <option value="ORGANICA">Orgânica (sem desconto)</option>
 </select>
 <div className="field__hint">Define os descontos do Gestor de Tráfego.</div>
 </div>
 <div className="field">
 <label className="field__label">Extra indicações (R$)</label>
 <input type="number" step="0.01" min="0" name="extraIndicacoes" className="field__input" defaultValue="0" />
 <div className="field__hint">Bônus somado ao corretor (sai da parte da casa).</div>
 </div>
 </div>
 <div className="flex" style={{ gap: 16, marginBottom: 4, flexWrap: 'wrap' }}>
 <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" name="temNotaFiscal" /> Tem Nota Fiscal (-16%)</label>
 </div>
 </div>
 )}
 </div>
 )}

 {/* ── CONFIRMAÇÃO: conferir tudo antes de enviar pro contrato ── */}
 <div data-step={stepConfirma} style={{ display: step === stepConfirma ? 'block' : 'none' }} className="fade-in">
 <div className="text-xs text-secondary" style={{ marginBottom: 12 }}>Confira os dados — ao confirmar, a venda entra como <strong>"Contrato em análise"</strong>.</div>

 <div style={{ display: 'grid', gap: 12 }}>
 <div className="card" style={{ padding: '12px 16px' }}>
 <div className="uppercase-tag" style={{ marginBottom: 6 }}>Comprador</div>
 <div className="text-xs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px 16px' }}>
 <div><span className="text-secondary">Nome:</span> <strong>{cliente.nome || '—'}</strong></div>
 <div><span className="text-secondary">{tipoComprador === 'PJ' ? 'CNPJ' : 'CPF'}:</span> <strong>{String(resumo?.[tipoComprador === 'PJ' ? 'clienteCnpj' : 'clienteCpf'] || '—')}</strong></div>
 {tipoComprador === 'PF' && <div><span className="text-secondary">Estado civil:</span> <strong>{estadoCivil || '—'}</strong></div>}
 {temConjuge && <div><span className="text-secondary">Cônjuge:</span> <strong>{String(resumo?.conjugeNome || '—')}</strong></div>}
 <div><span className="text-secondary">Telefone:</span> <strong>{cliente.telefone || '—'}</strong></div>
 <div><span className="text-secondary">E-mail:</span> <strong>{cliente.email || '—'}</strong></div>
 </div>
 </div>

 <div className="card" style={{ padding: '12px 16px' }}>
 <div className="uppercase-tag" style={{ marginBottom: 6 }}>Imóvel & origem</div>
 <div className="text-xs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px 16px' }}>
 <div><span className="text-secondary">Empreendimento:</span> <strong>{empSel?.nome || '—'}</strong></div>
 <div><span className="text-secondary">Unidade:</span> <strong>{unidadeSel ? [unidadeSel.identificacao, unidadeSel.torre].filter(Boolean).join(' · ') : String(resumo?.unidade || '—')}</strong></div>
 <div><span className="text-secondary">Corretor:</span> <strong>{isCorretor ? (Auth.user?.name || 'você') : ((corretores || []).find((c: any) => String(c.id) === String(resumo?.corretorTitularId))?.nome || '—')}</strong></div>
 <div><span className="text-secondary">Origem:</span> <strong>{origemInfo?.rotulo ?? ORIGENS_MANUAIS[origemManualIdx].rotulo}</strong></div>
 {contestacao.trim() && <div style={{ gridColumn: '1/-1' }}><span className="badge badge--cancelled" style={{ fontSize: 10 }}>ORIGEM CONTESTADA</span> <span className="text-secondary">{contestacao}</span></div>}
 </div>
 </div>

 <div className="card" style={{ padding: '12px 16px' }}>
 <div className="uppercase-tag" style={{ marginBottom: 6 }}>Valores</div>
 <div className="text-xs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px 16px' }}>
 <div><span className="text-secondary">Valor da venda:</span> <strong>R$ {(Number(String(valorVenda).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0).toLocaleString('pt-BR')}</strong>{negEspecial && <span className="badge badge--info" style={{ fontSize: 10, marginLeft: 6 }}>NEGOCIAÇÃO ESPECIAL</span>}</div>
 <div><span className="text-secondary">Entrada:</span> <strong>{resumo?.entradaTotal ? `R$ ${Number(String(resumo.entradaTotal).replace(/[^0-9.,]/g, '').replace(',', '.')).toLocaleString('pt-BR')} em ${resumo?.entradaParcelas || 1}x` : '—'}</strong></div>
 {resumo?.arrasValor ? <div><span className="text-secondary">Arras:</span> <strong>R$ {Number(String(resumo.arrasValor).replace(/[^0-9.,]/g, '').replace(',', '.')).toLocaleString('pt-BR')}</strong></div> : null}
 {resumo?.mensaisValor ? <div><span className="text-secondary">Mensais:</span> <strong>R$ {Number(String(resumo.mensaisValor).replace(/[^0-9.,]/g, '').replace(',', '.')).toLocaleString('pt-BR')}{resumo?.mensaisMelhorDia ? ` · dia ${resumo.mensaisMelhorDia}` : ''}</strong></div> : null}
 {resumo?.anuaisValor ? <div><span className="text-secondary">Anuais:</span> <strong>R$ {Number(String(resumo.anuaisValor).replace(/[^0-9.,]/g, '').replace(',', '.')).toLocaleString('pt-BR')}</strong></div> : null}
 {resumo?.chavesValor ? <div><span className="text-secondary">Chaves:</span> <strong>R$ {Number(String(resumo.chavesValor).replace(/[^0-9.,]/g, '').replace(',', '.')).toLocaleString('pt-BR')}</strong></div> : null}
 </div>
 </div>

 {!isCorretor && (
 <div className="card" style={{ padding: '12px 16px' }}>
 <div className="uppercase-tag" style={{ marginBottom: 6 }}>Comissão</div>
 <div className="text-xs text-secondary">
 Pons recebe <strong>{comEspecial && resumo?.percentualComissao ? resumo.percentualComissao : pctPonsHerdado}%</strong> da venda · split do corretor {comEspecial && resumo?.splitVariante ? `override ${String(resumo.splitVariante).replace('_', '/')}` : 'pelo cadastro (automático/negociado)'} · origem {origemInfo?.rotulo ?? ORIGENS_MANUAIS[origemManualIdx].rotulo}
 {comEspecial && <span className="badge badge--info" style={{ fontSize: 10, marginLeft: 6 }}>NEGOCIAÇÃO ESPECIAL</span>}
 </div>
 </div>
 )}

 <div className="card" style={{ padding: '12px 16px', background: 'var(--bg-elevated)' }}>
 <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
 <Icon name="doc" size={13} /> Documentos a anexar depois de criar
 </div>
 <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
 {docsNecessarios(tipoComprador, estadoCivil).map((d) => <li key={d}>{d}</li>)}
 </ul>
 </div>
 </div>
 </div>

 <div className="flex" style={{ justifyContent: 'space-between', marginTop: 20, gap: 8 }}>
 <button type="button" className="btn btn--secondary" onClick={() => setOpenNew(false)}>Cancelar</button>
 <div className="flex gap-2">
 {step > 0 && (
 <button type="button" className="btn btn--secondary" onClick={() => setStep((s) => s - 1)}>
 <Icon name="arrow_left" size={13} /> Voltar
 </button>
 )}
 {step < stepConfirma ? (
 <button type="button" className="btn btn--primary" onClick={proximaEtapa}>
 Avançar <Icon name="arrow_right" size={13} />
 </button>
 ) : (
 <button type="submit" className="btn btn--primary">
 <Icon name="check" size={14} /> Confirmar e enviar para contrato
 </button>
 )}
 </div>
 </div>
 </form>
 </Modal>
 </div>
 </>
 );
}

// Dados do formulário oficial GPI (protocolo PF/PJ) preenchidos na criação da
// venda — só renderiza o que foi preenchido; some se a venda for anterior ao form.
function FormularioGpi({ f }: { f: any }) {
 if (!f) return null;
 const brl = (v: any) => (v || v === 0 ? 'R$ ' + Number(v).toLocaleString('pt-BR') : null);
 const rows: [string, any][] = ([
 ['Tipo de comprador', f.tipoComprador === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'],
 ['Sala GPI', f.salaGpi],
 ['CPF', f.clienteCpf],
 ['CNPJ', f.clienteCnpj],
 ['RG', f.clienteRg],
 ['Nascimento', f.clienteNascimento],
 ['Profissão', f.clienteProfissao],
 ['Estado civil', f.clienteEstadoCivil],
 ['E-mail', f.clienteEmail],
 ['Telefone', f.clienteTelefone],
 ['Endereço', f.clienteEndereco],
 ['Cônjuge', f.conjugeNome],
 ['CPF do cônjuge', f.conjugeCpf],
 ['RG do cônjuge', f.conjugeRg],
 ['Sócio-administrador', f.socioNome],
 ['CPF do sócio', f.socioCpf],
 ['Origem do lead', f.origemLead],
 ['Construtora (form)', f.construtora],
 ['Arras', f.arrasValor ? `${brl(f.arrasValor)} · venc. ${f.arrasVencimento || '—'}` : null],
 ['Mensais', f.mensaisValor ? `${brl(f.mensaisValor)} · dia ${f.mensaisMelhorDia || '—'}` : null],
 ['Anuais', f.anuaisValor ? `${brl(f.anuaisValor)} · início ${f.anuaisInicio || '—'}` : null],
 ['Chaves', brl(f.chavesValor)],
 ] as [string, any][]).filter(([, v]) => v !== null && v !== undefined && v !== '');
 // Só o tipo preenchido (venda antiga) não justifica o bloco
 if (rows.length <= 1) return null;
 return (
 <div style={{ margin: '16px 0', padding: '14px 16px', background: 'var(--bg-card-hover)', borderRadius: 10 }}>
 <div className="uppercase-tag" style={{ marginBottom: 8 }}>Formulário GPI</div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px 16px' }}>
 {rows.map(([k, v]) => (
 <div key={k} style={{ fontSize: 12 }}>
 <span className="text-secondary">{k}:</span> <strong>{String(v)}</strong>
 </div>
 ))}
 </div>
 </div>
 );
}

// Kanban comercial/financeiro: colunas por fase da venda (contrato em análise →
// assinatura → assinado aguardando pagamento → inadimplente → pago → repasse).
function VendaKanban({ onSelect, podeMover }: { onSelect: (id: number) => void; podeMover: boolean }) {
 // Hooks ANTES de qualquer return condicional (Rules of Hooks).
 const { data, loading, error } = useApi<{ colunas: any[] }>(() => Api.vendaKanban());
 const [colunas, setColunas] = useState<any[]>([]);
 const toast = useToast();
 useEffect(() => { if (data) setColunas(data.colunas); }, [data]);

 // Move otimista: tira o card da coluna de origem, joga na de destino, ajusta
 // totais. Em erro, reverte. Só dispara pra quem pode editar status.
 const moveVenda = async (id: number, toFase: string) => {
 let card: any = null;
 let fromFase: string | undefined;
 for (const col of colunas) {
 const found = col.cards.find((c: any) => c.id === id);
 if (found) { card = found; fromFase = col.fase; break; }
 }
 if (!card || fromFase === toFase) return;
 const prev = colunas;
 const valor = card.valorVenda || 0;
 setColunas((cur) => cur.map((col) => {
 if (col.fase === fromFase) return { ...col, cards: col.cards.filter((c: any) => c.id !== id), total: col.total - 1, valorTotal: col.valorTotal - valor };
 if (col.fase === toFase) return { ...col, cards: [card, ...col.cards], total: col.total + 1, valorTotal: col.valorTotal + valor };
 return col;
 }));
 try {
 await Api.vendaUpdateStatus(id, toFase);
 toast.success(`Venda movida para "${STATUS_MAP[toFase]?.[1] || toFase}"`);
 } catch (err: any) {
 setColunas(prev);
 toast.error('Erro ao mover: ' + (err?.message || 'falha'));
 }
 };

 const dnd = useKanbanDnd(moveVenda);

 if (loading) return <LoadingBlock />;
 if (error) return <ErrorBlock error={error} />;
 return (
 <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
 {colunas.map((col) => {
 const [k] = STATUS_MAP[col.fase] || ['neutral'];
 const isDropTarget = podeMover && dnd.hoverCol === col.fase;
 return (
 <div
 key={col.fase}
 data-kanban-col={col.fase}
 style={{
 minWidth: 260,
 flex: '0 0 260px',
 borderRadius: 10,
 padding: 4,
 outline: isDropTarget ? '2px dashed var(--pons-blue, #2563eb)' : '2px dashed transparent',
 background: isDropTarget ? 'var(--bg-card-hover)' : 'transparent',
 transition: 'outline-color .12s, background .12s',
 }}
 onDragOver={podeMover ? dnd.onDragOver(col.fase) : undefined}
 onDragLeave={podeMover ? dnd.onDragLeave(col.fase) : undefined}
 onDrop={podeMover ? dnd.onDrop(col.fase) : undefined}
 >
 <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
 <span className={`badge badge--${k}`}>{col.label}</span>
 <span className="text-xs text-secondary">
 {col.total} · {formatCurrencyShort(col.valorTotal)}
 </span>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
 {col.cards.map((c: any) => (
 <div
 key={c.id}
 className="card"
 draggable={podeMover}
 onDragStart={podeMover ? dnd.onDragStart(c.id) : undefined}
 onDragEnd={podeMover ? dnd.onDragEnd : undefined}
 onPointerDown={podeMover ? dnd.onPointerDown(c.id) : undefined}
 style={{
 padding: 12,
 cursor: podeMover ? 'grab' : 'pointer',
 opacity: dnd.draggingId === c.id ? 0.45 : 1,
 }}
 onClick={() => onSelect(c.id)}
 >
 <div className="font-semibold">{c.clienteNome}</div>
 <div className="text-xs text-secondary">
 #{c.codigo} · {c.empreendimento}
 </div>
 <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
 <span className="money">{formatCurrencyShort(c.valorVenda)}</span>
 <div className="avatar avatar--sm" title={c.corretor?.nome}>
 {c.corretor?.initials || initials(c.corretor?.nome || '')}
 </div>
 </div>
 {c.aguardandoAprovacao && (
 <div className="text-xs" style={{ color: 'var(--warning, #b45309)', marginTop: 6 }}>
 Aguardando aprovação {c.entradaParcelas}x
 </div>
 )}
 </div>
 ))}
 {!col.cards.length && (
 <div className="text-xs text-secondary" style={{ textAlign: 'center', padding: 8 }}>
 {isDropTarget ? 'Soltar aqui' : '—'}
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 );
}

// Documentos do protocolo (fotos/PDFs) anexados à venda.
function VendaDocumentos({ vendaId, podeRemover }: { vendaId: number; podeRemover?: boolean }) {
 const toast = useToast();
 const [docs, setDocs] = useState<any[]>([]);
 const [busy, setBusy] = useState(false);
 const fileRef = useRef<HTMLInputElement>(null);

 const load = async () => {
 try { setDocs(await Api.vendaDocumentos(vendaId)); } catch { /* ignore */ }
 };
 useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendaId]);

 const upload = async (files: FileList | File[]) => {
 const list = Array.from(files);
 if (!list.length) return;
 setBusy(true);
 try {
 await Api.vendaDocumentoUpload(vendaId, list);
 toast.success(`${list.length} arquivo(s) anexado(s).`);
 await load();
 } catch (err: any) {
 toast.error('Erro ao anexar: ' + (err?.message || 'falha'));
 } finally {
 setBusy(false);
 if (fileRef.current) fileRef.current.value = '';
 }
 };

 const remover = async (docId: number) => {
 try {
 await Api.vendaDocumentoDelete(vendaId, docId);
 await load();
 } catch (err: any) {
 toast.error('Erro: ' + (err?.message || 'falha'));
 }
 };

 return (
 <div style={{ margin: '16px 0', padding: '14px 16px', background: 'var(--bg-card-hover)', borderRadius: 10 }}>
 <div className="flex-between" style={{ marginBottom: 8, alignItems: 'center' }}>
 <div className="uppercase-tag">Documentos do protocolo</div>
 <label className="btn btn--secondary btn--sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
 <Icon name="plus" size={13} /> {busy ? 'Enviando…' : 'Anexar'}
 <input
 ref={fileRef}
 type="file"
 multiple
 accept="image/*,application/pdf"
 style={{ display: 'none' }}
 disabled={busy}
 onChange={(e) => e.target.files && upload(e.target.files)}
 />
 </label>
 </div>
 {docs.length === 0 ? (
 <div className="text-xs text-secondary">Nenhum documento anexado. Fotos e PDFs até 15MB.</div>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
 {docs.map((d) => (
 <div key={d.id} className="flex-between" style={{ alignItems: 'center', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 8 }}>
 <a href={d.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--pons-blue, #2563eb)', textDecoration: 'none', overflow: 'hidden' }}>
 <Icon name="doc" size={14} />
 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nome}</span>
 </a>
 {podeRemover && (
 <button className="btn btn--ghost btn--sm" onClick={() => remover(d.id)} title="Remover">
 <Icon name="trash" size={12} />
 </button>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

function ParcelasAtrasadas({ onSelect }: { onSelect: (id: number) => void }) {
 const { data, loading } = useApi<any[]>(() => Api.parcelasAtrasadas());
 const [aberto, setAberto] = useState(false);
 if (loading || !data || data.length === 0) return null;
 const totalValor = data.reduce((s, p) => s + (p.valor || 0), 0);
 return (
 <div style={{ margin: '0 0 12px', padding: '12px 16px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: 10 }}>
 <div className="flex-between" style={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => setAberto((v) => !v)}>
 <div style={{ fontWeight: 700, fontSize: 13, color: '#B91C1C' }}>
 {data.length} parcela(s) em atraso · {formatCurrencyShort(totalValor)}
 </div>
 <button className="btn btn--ghost btn--sm">{aberto ? 'Ocultar' : 'Ver'}</button>
 </div>
 {aberto && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
 {data.map((p) => (
 <div key={p.id} className="flex-between" style={{ alignItems: 'center', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 8, cursor: 'pointer' }} onClick={() => onSelect(p.vendaId)}>
 <div style={{ fontSize: 13 }}>
 <strong>#{p.codigo}</strong> · {p.clienteNome} · parcela {p.numero}/{p.total}
 <div className="text-xs text-secondary">{p.corretor || '—'} · {p.unidade}</div>
 </div>
 <div style={{ textAlign: 'right' }}>
 <div style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrencyShort(p.valor)}</div>
 <div className="text-xs" style={{ color: '#B91C1C' }}>{p.diasAtraso} dia(s)</div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

const PARCELA_BADGE: Record<string, [string, string]> = {
 AGENDADO: ['neutral', 'Agendado'],
 ABERTO: ['analysis', 'Aberto'],
 PAGO: ['signed', 'Pago'],
 ATRASADO: ['cancelled', 'Atrasado'],
};

function VendaParcelas({ vendaId, podeConfirmar }: { vendaId: number; podeConfirmar?: boolean }) {
 const toast = useToast();
 const [parcelas, setParcelas] = useState<any[]>([]);
 const [busy, setBusy] = useState<number | null>(null);

 const load = async () => {
 try {
 const v = await Api.venda(vendaId);
 setParcelas(v?.pagamentos || []);
 } catch { /* ignore */ }
 };
 useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendaId]);

 const mudarStatus = async (pagamentoId: number, status: string) => {
 setBusy(pagamentoId);
 try {
 await Api.vendaParcelaStatus(vendaId, pagamentoId, status);
 toast.success(status === 'PAGO' ? 'Pagamento confirmado.' : 'Parcela atualizada.');
 await load();
 } catch (err: any) {
 toast.error('Erro: ' + (err?.message || 'falha'));
 } finally {
 setBusy(null);
 }
 };

 if (parcelas.length === 0) return null;
 return (
 <div style={{ margin: '16px 0', padding: '14px 16px', background: 'var(--bg-card-hover)', borderRadius: 10 }}>
 <div className="uppercase-tag" style={{ marginBottom: 8 }}>Plano de recebimento (entrada)</div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
 {parcelas.map((p) => {
 const [k, lbl] = PARCELA_BADGE[p.status] || ['neutral', p.status];
 const venc = p.vencimento ? new Date(p.vencimento).toLocaleDateString('pt-BR') : '—';
 return (
 <div key={p.id} className="flex-between" style={{ alignItems: 'center', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 8 }}>
 <div style={{ fontSize: 13 }}>
 <strong>{p.numero}/{p.total}</strong> · {formatCurrencyShort(p.valor)} · vence {venc}
 </div>
 <div className="flex gap-2" style={{ alignItems: 'center' }}>
 <span className={`badge badge--${k}`}>{lbl}</span>
 {podeConfirmar && p.status !== 'PAGO' && (
 <button className="btn btn--primary btn--sm" disabled={busy === p.id} onClick={() => mudarStatus(p.id, 'PAGO')}>
 {busy === p.id ? '…' : 'Confirmar'}
 </button>
 )}
 {podeConfirmar && p.status === 'PAGO' && (
 <button className="btn btn--ghost btn--sm" disabled={busy === p.id} onClick={() => mudarStatus(p.id, 'ABERTO')} title="Desfazer">
 Desfazer
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
}

function Shell({ children, onNew }: { children: React.ReactNode; onNew?: () => void }) {
 return (
 <>
 <Topbar
 title="Vendas"
 right={<button className="btn btn--primary btn--sm" onClick={onNew}>+ Nova Venda</button>}
 />
 <div className="main__content">
 <PageHeader breadcrumb="Comercial · Vendas" title="Vendas" />
 {children}
 </div>
 </>
 );
}
