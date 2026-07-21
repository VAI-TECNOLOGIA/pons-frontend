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
import { maskCPF, validaCPF, maskTelefone, validaTelefone, validaEmail, idadeEmAnos, maskMoedaBR, formatMoedaBR, parseMoedaBR, maskCEP, buscaCEP } from '../lib/mascaras';

export const STATUS_MAP: Record<string, [string, string]> = {
 PRE_ANALISE: ['analysis', 'Contrato em análise'],
 ANALISE_JURIDICA: ['analysis', 'Análise jurídica'],
 AGUARDANDO_CONSTRUTORA: ['analysis', 'Aguardando construtora'],
 CONTRATO_EM_CONFECCAO: ['analysis', 'Contrato em confecção'],
 CONTRATO_EM_CONFERENCIA: ['signature', 'Contrato em conferência'],
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
 'Casado(a) — comunhão total de bens',
 'Casado(a) — separação total de bens',
 'União estável',
 'Divorciado(a)',
 'Viúvo(a)',
];

// Estados civis que exigem dados do cônjuge/companheiro(a) no protocolo.
// Separação TOTAL de bens: o cônjuge não anui na compra — não preenche.
// Comunhão total de bens: dados do cônjuge são OPCIONAIS (regra do financeiro 21/07)
const EXIGE_CONJUGE = new Set(['Casado(a)', 'União estável']);

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
 { rotulo: 'Network', comissao: 'ORGANICA' },
 { rotulo: 'Campanha Particular', comissao: 'ORGANICA' },
 { rotulo: 'Compra Própria', comissao: 'ORGANICA' },
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
 case 'Casado(a) — comunhão total de bens':
 return [...base, 'Certidão de casamento', 'RG e CPF (ou CNH) do cônjuge', 'Pacto antenupcial de comunhão total de bens registrado'];
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
 // Rateio/comissão (incl. % do gestor) só pode ser editado por Administrativo,
 // Financeiro e Paulo (CEO). Quem cadastra (corretor/gerente/diretor comercial)
 // usa o rateio herdado da política — sem editar e sem ver a % do gestor.
 const podeEditarRateio = role === 'CEO' || role === 'DIRETOR_FINANCEIRO' || role === 'FINANCEIRO' || role === 'ADMINISTRATIVO';
 const podeEditarStatus = role === 'CEO' || role === 'DIRETOR_FINANCEIRO';

 // ── Lead vinculado: origem vem do banco (corretor não escolhe; pode contestar) ──
 const { data: leadsDisponiveis } = useApi<any[]>(() => Api.leads());
 const [leadBusca, setLeadBusca] = useState('');
 const [leadSel, setLeadSel] = useState<any>(null);
 const [contestarOpen, setContestarOpen] = useState(false);
 const [contestacao, setContestacao] = useState('');
 const [origemManualIdx, setOrigemManualIdx] = useState(0);
 // Busca automática de lead na base (por nome/telefone/email) enquanto preenche o comprador.
 const [leadAutoSug, setLeadAutoSug] = useState<any[]>([]);
 const [leadSugDispensada, setLeadSugDispensada] = useState(false);
 // Corretor disse "não é o mesmo cliente" pra um lead da base → venda vai pra
 // aprovação do Gestor de Tráfego (guarda o id do lead negado pra mandar no POST).
 const [leadNegadoId, setLeadNegadoId] = useState<number | null>(null);
 const origemInfo = leadSel ? origemDoLead(leadSel.origem) : null;

 // ── Comprador (controlados pra receber os dados do lead) ──
 const [cliente, setCliente] = useState({ nome: '', email: '', telefone: '' });
 const [estadoCivil, setEstadoCivil] = useState('');
 // Telefone internacional: marcação extra que desliga a máscara nacional.
 const [telIntl, setTelIntl] = useState(false);
 // Sala GPI pré-preenchida com a da última venda do corretor (editável).
 const [salaGpi, setSalaGpi] = useState('');
 const temConjuge = EXIGE_CONJUGE.has(estadoCivil);
 const [emancipado, setEmancipado] = useState(false);
 const nascimentoRef = useRef<HTMLInputElement>(null);

 // Busca automática do lead na base enquanto o corretor preenche nome/telefone/email.
 // Se já vinculou ou dispensou a sugestão, não busca. Debounce de 400ms.
 useEffect(() => {
 if (leadSel || leadSugDispensada) { setLeadAutoSug([]); return; }
 const nome = cliente.nome.trim();
 const tel = (cliente.telefone || '').replace(/\D/g, '');
 const email = cliente.email.trim();
 const q = tel.length >= 4 ? tel : email.length >= 3 ? email : nome.length >= 3 ? nome : '';
 if (!q) { setLeadAutoSug([]); return; }
 const t = setTimeout(() => {
 Api.leadsBuscar(q).then((r) => setLeadAutoSug(Array.isArray(r) ? r : [])).catch(() => setLeadAutoSug([]));
 }, 400);
 return () => clearTimeout(t);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [cliente.nome, cliente.telefone, cliente.email, leadSel, leadSugDispensada]);

 // Endereço estruturado do cliente PF (busca CEP + campos separados). Montado
 // num input oculto clienteEndereco pro submit (que lê via FormData).
 const [endPF, setEndPF] = useState({ cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' });
 const [buscandoCep, setBuscandoCep] = useState(false);
 const enderecoPFStr = [
 [endPF.logradouro, endPF.numero].filter(Boolean).join(', '),
 endPF.complemento, endPF.bairro,
 endPF.cidade && `${endPF.cidade}/${endPF.uf}`,
 endPF.cep && `CEP ${endPF.cep}`,
 ].filter(Boolean).join(' — ');
 const onBuscarCep = async () => {
 if (endPF.cep.replace(/\D/g, '').length !== 8) { toast.error('CEP incompleto.'); return; }
 setBuscandoCep(true);
 const r = await buscaCEP(endPF.cep);
 setBuscandoCep(false);
 if (!r) { toast.error('CEP não encontrado.'); return; }
 setEndPF((e) => ({ ...e, logradouro: r.logradouro, bairro: r.bairro, cidade: r.cidade, uf: r.uf }));
 };

 // ── Validações de campo (plugam no :invalid do form → bloqueiam avançar) ──
 const validaNascimento = (el: HTMLInputElement | null) => {
 if (!el) return;
 const anos = idadeEmAnos(el.value);
 let msg = '';
 if (anos != null && anos < 16) msg = 'Comprador menor de 16 anos não é permitido.';
 else if (anos != null && anos < 18 && !emancipado) msg = 'Entre 16 e 18 anos só com emancipação — marque a opção abaixo.';
 el.setCustomValidity(msg);
 };
 const onCpf = (e: React.FormEvent<HTMLInputElement>) => {
 const el = e.currentTarget;
 el.value = maskCPF(el.value);
 el.setCustomValidity(el.value && !validaCPF(el.value) ? 'CPF inválido — confira os números.' : '');
 };
 const onRg = (e: React.FormEvent<HTMLInputElement>) => {
 const el = e.currentTarget;
 el.setCustomValidity(el.value && !/\d.*[A-Za-z]{2,}/.test(el.value) ? 'Inclua o órgão expedidor (ex.: 1234567 SSP/SC).' : '');
 };
 const onTelefoneCtrl = (e: React.ChangeEvent<HTMLInputElement>) => {
 // Modo internacional: sem máscara BR — aceita +, dígitos, espaços e hífens.
 if (telIntl) {
 const limpo = e.target.value.replace(/[^\d+()\- ]/g, '');
 e.target.setCustomValidity(limpo && limpo.replace(/\D/g, '').length < 7 ? 'Número internacional muito curto.' : '');
 setCliente((c) => ({ ...c, telefone: limpo }));
 return;
 }
 const masked = maskTelefone(e.target.value);
 e.target.setCustomValidity(masked && !validaTelefone(masked) ? 'Telefone incompleto (DDD + número).' : '');
 setCliente((c) => ({ ...c, telefone: masked }));
 };
 // Versão não-controlada (comprador PJ) — mesma regra do internacional.
 const onTelefoneCliente = (e: React.FormEvent<HTMLInputElement>) => {
 const el = e.currentTarget;
 if (telIntl) {
 el.value = el.value.replace(/[^\d+()\- ]/g, '');
 el.setCustomValidity(el.value && el.value.replace(/\D/g, '').length < 7 ? 'Número internacional muito curto.' : '');
 return;
 }
 el.value = maskTelefone(el.value);
 el.setCustomValidity(el.value && !validaTelefone(el.value) ? 'Telefone incompleto (DDD + número).' : '');
 };
 const onTelefone = (e: React.FormEvent<HTMLInputElement>) => {
 const el = e.currentTarget;
 el.value = maskTelefone(el.value);
 el.setCustomValidity(el.value && !validaTelefone(el.value) ? 'Telefone incompleto (DDD + número).' : '');
 };
 const onEmailCtrl = (e: React.ChangeEvent<HTMLInputElement>) => {
 e.target.setCustomValidity(e.target.value && !validaEmail(e.target.value) ? 'E-mail inválido.' : '');
 setCliente((c) => ({ ...c, email: e.target.value }));
 };
 const onEmail = (e: React.FormEvent<HTMLInputElement>) => {
 const el = e.currentTarget;
 el.setCustomValidity(el.value && !validaEmail(el.value) ? 'E-mail inválido.' : '');
 };
 // Reavalia a idade quando marca/desmarca emancipado.
 useEffect(() => { validaNascimento(nascimentoRef.current); }, [emancipado]);

 // Backspace fora de campo de texto NÃO pode voltar a página (perde o formulário).
 useEffect(() => {
 const onKey = (ev: KeyboardEvent) => {
 if (ev.key !== 'Backspace') return;
 const t = ev.target as HTMLElement | null;
 const editavel = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
 if (!editavel) ev.preventDefault();
 };
 window.addEventListener('keydown', onKey);
 return () => window.removeEventListener('keydown', onKey);
 }, []);

 // ── Imóvel: seleção puxa unidades e valores do cadastro ──
 const [empSelId, setEmpSelId] = useState('');
 const [unidades, setUnidades] = useState<any[]>([]);
 const [unidadeSelId, setUnidadeSelId] = useState('');
 const [unidadeLivre, setUnidadeLivre] = useState('');
 const [unidadeOcupadaCod, setUnidadeOcupadaCod] = useState<string | null>(null);
 const empSel = (emps || []).find((e: any) => String(e.id) === empSelId) || null;
 const unidadeSel = unidades.find((u: any) => String(u.id) === unidadeSelId) || null;
 useEffect(() => {
 setUnidades([]); setUnidadeSelId('');
 if (!empSelId) return;
 Api.empreendimentoUnidades(Number(empSelId))
 .then((r: any) => setUnidades(r?.unidades || []))
 .catch(() => setUnidades([]));
 }, [empSelId]);

 // Unidade já vendida por nós? Checa em tempo real (venda CANCELADA não conta —
 // a unidade volta a ficar livre quando a venda cai).
 const unidadeStr = unidadeSel ? [unidadeSel.identificacao, unidadeSel.torre].filter(Boolean).join(' · ') : unidadeLivre.trim();
 useEffect(() => {
 setUnidadeOcupadaCod(null);
 const emp = Number(empSelId);
 if (!emp || !unidadeStr) return;
 const t = setTimeout(() => {
 Api.unidadeStatus(emp, unidadeStr)
 .then((r) => setUnidadeOcupadaCod(r.ocupada ? r.codigo : null))
 .catch(() => setUnidadeOcupadaCod(null));
 }, 400);
 return () => clearTimeout(t);
 }, [empSelId, unidadeStr]);

 // ── Negociação: valor sugerido pela tabela do imóvel, editável pelo corretor ──
 const [valorVenda, setValorVenda] = useState('');
 const [entradaTotal, setEntradaTotal] = useState(''); // controlado p/ validar % mínimo da política
 const [chavesValor, setChavesValor] = useState(''); // controlado p/ espelhar o % do empreendimento
 // Negociação (controlados p/ reconciliar com o VGV ao vivo)
 const [entradaParcelas, setEntradaParcelas] = useState('1');
 const [entradaData, setEntradaData] = useState(''); // 1º vencimento das parcelas
 const [arrasValor, setArrasValor] = useState('');
 // Parcelas da entrada: valor+vencimento por parcela, pré-preenchidas e editáveis.
 const [parcelasEntrada, setParcelasEntrada] = useState<{ valor: string; venc: string }[]>([]);
 const [parcelasTocadas, setParcelasTocadas] = useState(false);
 const [mensaisValor, setMensaisValor] = useState('');
 const [mensaisQtd, setMensaisQtd] = useState('');
 const [mensaisDia, setMensaisDia] = useState('');
 const [anuaisValor, setAnuaisValor] = useState('');
 const [anuaisQtd, setAnuaisQtd] = useState('');
 const [anuaisMes, setAnuaisMes] = useState('');
 // ── Reconciliação com o VGV ──────────────────────────────────────────────
 const recon = (() => {
 const vgv = parseMoedaBR(valorVenda);
 const entrada = parseMoedaBR(entradaTotal);
 const arras = parseMoedaBR(arrasValor);
 const mensaisTot = parseMoedaBR(mensaisValor) * (Number(mensaisQtd) || 0);
 const anuaisTot = parseMoedaBR(anuaisValor) * (Number(anuaisQtd) || 0);
 const chaves = parseMoedaBR(chavesValor);
 const soma = entrada + mensaisTot + anuaisTot + chaves;
 const saldo = vgv - soma; // > 0 = a financiar; < 0 = excede o VGV
 const nParc = Math.max(1, Number(entradaParcelas) || 1);
 const parcela = Math.max(0, (entrada - arras)) / nParc;
 return { vgv, entrada, arras, mensaisTot, anuaisTot, chaves, soma, saldo, parcela, nParc, excede: saldo < -1, fecha: vgv > 0 && Math.abs(saldo) <= 1 };
 })();
 const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

 // Pré-preenche as parcelas da entrada (base = entrada/nParc; arras sai da 1ª;
 // a última acerta o arredondamento pra soma fechar com entrada − arras).
 // Enquanto o corretor não editar, recalcula ao mudar entrada/arras/nº/1º venc.
 useEffect(() => {
 const entradaV = parseMoedaBR(entradaTotal);
 const arrasV = parseMoedaBR(arrasValor);
 const n = Math.max(1, Number(entradaParcelas) || 1);
 if (parcelasTocadas) {
 // Usuário editou: só ajusta o TAMANHO da lista se o nº de parcelas mudou.
 setParcelasEntrada((cur) => {
 if (cur.length === n) return cur;
 const arr = cur.slice(0, n);
 while (arr.length < n) arr.push({ valor: '', venc: '' });
 return arr;
 });
 return;
 }
 if (entradaV <= 0) { setParcelasEntrada([]); return; }
 const base = Math.round(entradaV / n);
 const vals = Array.from({ length: n }, () => base);
 vals[0] = base - arrasV;
 const alvo = Math.round(entradaV - arrasV);
 vals[n - 1] += alvo - vals.reduce((a, b) => a + b, 0);
 const baseDate = entradaData ? new Date(entradaData + 'T00:00:00') : (() => { const dd = new Date(); dd.setMonth(dd.getMonth() + 1); return dd; })();
 const arr = vals.map((v, i) => {
 const dd = new Date(baseDate); dd.setMonth(dd.getMonth() + i);
 return { valor: formatMoedaBR(Math.max(0, v)), venc: dd.toISOString().slice(0, 10) };
 });
 setParcelasEntrada(arr);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [entradaTotal, arrasValor, entradaParcelas, entradaData, parcelasTocadas]);
 // Conta bancária do protocolo: resolvida pela unidade do corretor titular.
 const [corretorTitularId, setCorretorTitularId] = useState('');
 const [contaBanco, setContaBanco] = useState<any>(null);
 const corretorParaConta = isCorretor ? (Auth.user?.corretor?.id || 0) : Number(corretorTitularId || 0);
 useEffect(() => {
 if (!corretorParaConta) { setContaBanco(null); return; }
 Api.contaBancariaResolver(corretorParaConta).then((r) => setContaBanco(r.conta)).catch(() => setContaBanco(null));
 }, [corretorParaConta]);
 useEffect(() => {
 if (!isCorretor && !corretorTitularId && corretores?.length) setCorretorTitularId(String(corretores[0].id));
 }, [corretores]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(() => {
 const v = unidadeSel?.valor || empSel?.valorInicial || '';
 setValorVenda(v ? formatMoedaBR(Number(v)) : '');
 }, [unidadeSelId, empSelId]); // eslint-disable-line react-hooks/exhaustive-deps

 // ── Comissão: herdada da política do empreendimento; "especial" destrava ──
 const [comEspecial, setComEspecial] = useState(false);
 // NF: alíquota global (config) + valor desta venda (pode personalizar) + controlado.
 const [nfAliquotaGlobal, setNfAliquotaGlobal] = useState(16.83);
 const [nfAliquota, setNfAliquota] = useState('16.83');
 const [temNf, setTemNf] = useState(false);
 const [salvandoNfGlobal, setSalvandoNfGlobal] = useState(false);
 useEffect(() => { Api.nfAliquota().then((r) => { setNfAliquotaGlobal(r.pct); setNfAliquota(String(r.pct)); }).catch(() => {}); }, []);
 const { data: politicas } = useApi<any[]>(() => Api.rateioPoliticas());
 const politicaEmp = empSel ? (politicas || []).find((p: any) => p.empreendimento?.id === empSel.id) : null;
 const politicaDefault = (politicas || []).find((p: any) => p.isDefault) || null;
 const politicaVigente = politicaEmp || politicaDefault;
 // A comissão cadastrada no financeiro do empreendimento manda; senão a política; senão 5%.
 const pctPonsHerdado = empSel?.comissaoPct ?? politicaVigente?.percentualComissao ?? 5;

 // ESPELHO do empreendimento: sugere entrada (mínimo %) e valor na chave (%)
 // calculados sobre o valor da venda — só quando o campo ainda está vazio.
 useEffect(() => {
 const vv = parseMoedaBR(valorVenda);
 if (!vv || !politicaVigente) return;
 if (!entradaTotal && politicaVigente.entradaMinimaPct) {
 setEntradaTotal(formatMoedaBR(Math.round(vv * (politicaVigente.entradaMinimaPct / 100))));
 }
 if (!chavesValor && politicaVigente.chavesPct) {
 setChavesValor(formatMoedaBR(Math.round(vv * (politicaVigente.chavesPct / 100))));
 }
 }, [valorVenda, politicaVigente?.id]); // eslint-disable-line react-hooks/exhaustive-deps

 // ── Confirmação: snapshot do form pro resumo final ──
 const [resumo, setResumo] = useState<any>(null);

 // Reabrir o modal zera o fluxo inteiro
 useEffect(() => {
 if (!openNew) return;
 setStep(0); setTipoComprador('PF');
 setLeadSel(null); setLeadBusca(''); setContestarOpen(false); setContestacao('');
 setLeadNegadoId(null); setLeadSugDispensada(false); setLeadAutoSug([]);
 setCliente({ nome: '', email: '', telefone: '' }); setEstadoCivil('');
 setEmpSelId(''); setUnidadeSelId(''); setUnidades([]); setUnidadeLivre(''); setUnidadeOcupadaCod(null);
 setValorVenda(''); setEntradaTotal(''); setChavesValor(''); setComEspecial(false); setTemNf(false); setNfAliquota(String(nfAliquotaGlobal));
 setEmancipado(false); setEndPF({ cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' });
 setEntradaParcelas('1'); setEntradaData(''); setArrasValor(''); setParcelasEntrada([]); setParcelasTocadas(false); setMensaisValor(''); setMensaisQtd(''); setMensaisDia(''); setAnuaisValor(''); setAnuaisQtd(''); setAnuaisMes('');
 setResumo(null); setOrigemManualIdx(0);
 setTelIntl(false); setSalaGpi('');
 }, [openNew]);

 // Sala GPI sugerida: a da última venda do corretor (dele mesmo quando é
 // CORRETOR; do titular selecionado quando é gestão). Só preenche se vazio.
 useEffect(() => {
 if (!openNew) return;
 const cid = isCorretor ? undefined : (corretorTitularId ? Number(corretorTitularId) : undefined);
 if (!isCorretor && !cid) return;
 Api.vendaSalaSugerida(cid)
 .then((r) => { if (r.salaGpi) setSalaGpi((s) => s || r.salaGpi!); })
 .catch(() => {});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [openNew, corretorTitularId]);

 // Preenche um campo nativo do formulário SEM sobrescrever o que já foi digitado
 // (o usuário sempre pode clicar e alterar depois).
 const preencherCampoNativo = (nomeCampo: string, v?: string | null) => {
 const el = formRef.current?.querySelector(`[name="${nomeCampo}"]`) as HTMLInputElement | null;
 if (el && !el.value && v) {
 const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
 setter.call(el, v);
 el.dispatchEvent(new Event('input', { bubbles: true }));
 }
 };

 // Vincular lead: preenche o comprador com TUDO que o sistema já sabe do lead
 // (nome, telefone, e-mail, CPF, cidade) + origem automática. Campos seguem editáveis.
 const vincularLead = (l: any) => {
 setLeadSel(l);
 setLeadNegadoId(null); setLeadSugDispensada(false); setLeadAutoSug([]);
 setCliente((c) => ({
 nome: l?.nome || c.nome || '',
 email: l?.email || c.email || '',
 telefone: l?.telefone || c.telefone || '',
 }));
 preencherCampoNativo('clienteCpf', l?.cpf);
 if (l?.cidade) setEndPF((c) => ({ ...c, cidade: c.cidade || l.cidade }));
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
 // Unidade já vendida por nós: não deixa avançar (a anterior tem que cair antes).
 if (step === 1 && unidadeOcupadaCod) { toast.error(`Esta unidade já tem uma venda ativa (${unidadeOcupadaCod}). Cancele a anterior para liberá-la.`); return; }
 // Reconciliação: na Negociação, os valores preenchidos têm que FECHAR EXATO com
 // o VGV pra avançar (sem saldo em aberto). Nas outras etapas não trava.
 if (step === 2 && !recon.fecha) { toast.error('Os valores preenchidos precisam fechar com o valor da venda (VGV). Ajuste antes de avançar.'); return; }
 // Entrada abaixo do mínimo do empreendimento: NÃO avança (regra 21/07 — antes
 // só alertava e a venda seguia pra aprovação).
 if (step === 2 && politicaVigente?.entradaMinimaPct != null) {
 const vvNum = parseMoedaBR(valorVenda);
 const etNum = parseMoedaBR(entradaTotal);
 if (vvNum > 0 && (etNum / vvNum) * 100 < politicaVigente.entradaMinimaPct - 0.01) {
 toast.error(`Entrada de ${((etNum / vvNum) * 100).toFixed(1)}% — o mínimo do empreendimento é ${politicaVigente.entradaMinimaPct}%. Aumente a entrada pra avançar.`);
 return;
 }
 }
 // Parcelas da entrada: a soma tem que fechar com (entrada − arras).
 if (step === 2 && parcelasEntrada.length > 0) {
 const somaP = parcelasEntrada.reduce((a, p) => a + parseMoedaBR(p.valor), 0);
 const alvoP = parseMoedaBR(entradaTotal) - parseMoedaBR(arrasValor);
 if (Math.abs(somaP - alvoP) > 1) { toast.error('A soma das parcelas da entrada precisa fechar com (entrada − arras). Ajuste antes de avançar.'); return; }
 }
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
 const num = (v: FormDataEntryValue | null) => parseMoedaBR(String(v || ''));
 const str = (k: string) => { const v = fd.get(k); return v ? String(v) : undefined; };
 const optNum = (k: string) => (fd.get(k) ? num(fd.get(k)) : undefined);
 // Entrada abaixo do mínimo do empreendimento NÃO prossegue (antes só alertava
 // e mandava pra aprovação — regra endurecida em 21/07).
 if (politicaVigente?.entradaMinimaPct != null) {
 const vvNum = num(valorVenda);
 const etNum = num(fd.get('entradaTotal'));
 if (vvNum > 0) {
 const pctEntrada = (etNum / vvNum) * 100;
 if (pctEntrada < politicaVigente.entradaMinimaPct - 0.01) {
 toast.error(`Entrada de ${pctEntrada.toFixed(1)}% — o mínimo do empreendimento é ${politicaVigente.entradaMinimaPct}%. Aumente a entrada pra registrar a venda.`);
 return;
 }
 }
 }
 try {
 // Origem da comissão: negociação especial (admin) > lead vinculado (banco) > manual
 const origemComissaoFinal = (podeEditarRateio && comEspecial && fd.get('origemComissao'))
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
 // Corretor negou um lead da base → venda vai pra aprovação do Gestor de Tráfego.
 ...(leadNegadoId && !leadSel ? { leadNegadoId } : {}),
 // Unidade selecionada do estoque preenche identificação/tipologia sozinha
 unidade: unidadeSel
 ? [unidadeSel.identificacao, unidadeSel.torre].filter(Boolean).join(' · ')
 : String(fd.get('unidade') || ''),
 // Tipologia vem SÓ do cadastro da unidade (sem digitação livre)
 tipologia: unidadeSel?.tipologia || undefined,
 valorVenda: num(valorVenda),
 entradaTotal: num(fd.get('entradaTotal')),
 entradaParcelas: Number(fd.get('entradaParcelas')) || 1,
 // Valores/vencimentos individuais das parcelas da entrada (editados pelo corretor).
 ...(parcelasEntrada.length ? { entradaParcelasDetalhe: parcelasEntrada.map((p) => ({ valor: parseMoedaBR(p.valor), vencimento: p.venc })) } : {}),
 // Comissão: herdada da política do empreendimento; especial sobrescreve
 percentualComissao: podeEditarRateio && comEspecial ? num(fd.get('percentualComissao')) : pctPonsHerdado,
 splitCorretor: 55, splitGerente: 15, splitCasa: 30, // legacy (ignorado pela regra Pons)
 temNotaFiscal: podeEditarRateio && comEspecial ? temNf : false,
 // Alíquota NF desta venda (personalizada ou o padrão global) — só de quem edita rateio.
 ...(podeEditarRateio && comEspecial && temNf && Number(nfAliquota) > 0 ? { percentualNotaFiscal: Number(nfAliquota) } : {}),
 origemComissao: origemComissaoFinal,
 origemLead: origemLeadTexto,
 ...(contestacao.trim() ? { origemLeadContestacao: contestacao.trim() } : {}),
 extraIndicacoes: podeEditarRateio && comEspecial ? num(fd.get('extraIndicacoes')) : 0,
 // splitVariante só na negociação especial — sem ela o motor usa o rateio do
 // corretor (negociado no cadastro ou automático por tempo de casa)
 ...(podeEditarRateio && comEspecial && fd.get('splitVariante') ? { splitVariante: String(fd.get('splitVariante')) } : {}),
 percentualGestor: podeEditarRateio && comEspecial ? Number(fd.get('percentualGestorPons') || 10) : 10,
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
 mensaisValor: optNum('mensaisValor'),
 mensaisMelhorDia: fd.get('mensaisMelhorDia') ? Number(fd.get('mensaisMelhorDia')) : undefined,
 mensaisQtd: fd.get('mensaisQtd') ? Number(fd.get('mensaisQtd')) : undefined,
 anuaisValor: optNum('anuaisValor'),
 anuaisInicio: str('anuaisInicio'),
 anuaisQtd: fd.get('anuaisQtd') ? Number(fd.get('anuaisQtd')) : undefined,
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
 <Modal
 open={!!sel}
 onClose={() => setSelected(null)}
 size="lg"
 title={String(sel.clienteNome || sel.cliente || 'Venda')}
 subtitle={`Venda #${String(sel.id).padStart(5, '0')} · ${(typeof sel.empreendimento === 'string' ? sel.empreendimento : sel.empreendimento?.nome) || ''} · ${sel.unidade || ''} · ${sel.corretorTitular?.user?.name || sel.corretor?.nome || sel.corretor || ''}`}
 footer={
 <>
 <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
 <strong style={{ fontSize: 18, color: 'var(--color-success, #4C9A2A)' }}>{formatCurrencyShort(sel.valorVenda ?? sel.valor)}</strong>
 <span className="text-xs text-secondary">Comissão estimada: <strong>{formatCurrencyShort(sel.comissao ?? (sel.valorVenda ?? sel.valor) * 0.05)}</strong></span>
 </div>
 <button className="btn btn--secondary" onClick={() => setSelected(null)}>Fechar</button>
 </>
 }
 >
 <div style={{ padding: '12px 16px', background: 'var(--bg-card-hover)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
 <span className={`badge badge--${(STATUS_MAP[sel.status] || ['neutral'])[0]}`}>{(STATUS_MAP[sel.status] || [, sel.status])[1]}</span>
 <div className="uppercase-tag">Status da venda</div>
 {podeEditarStatus ? (
 <select
 className="field__select"
 value={sel.status}
 onChange={(e) => atualizarStatus(sel.id, e.target.value)}
 style={{ width: 'auto', minWidth: 200, height: 34 }}
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

 {sel.aguardandoAprovacaoTrafego && (
 <div style={{ margin: '16px 0', padding: '14px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 10 }}>
 <div style={{ fontWeight: 700, fontSize: 13, color: '#B45309', marginBottom: 4 }}>
 Aguardando aprovação do Gestor de Tráfego — o corretor negou um lead da base
 </div>
 {role === 'GESTOR_TRAFEGO' ? (
 <button
 className="btn btn--primary btn--sm"
 style={{ marginTop: 6 }}
 onClick={async () => {
 try {
 await Api.vendaAprovarTrafego(sel.id);
 toast.success('Venda liberada (tráfego).');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 }}
 >
 Aprovar (tráfego)
 </button>
 ) : (
 <div className="text-xs text-secondary">Só o Gestor de Tráfego libera essa venda.</div>
 )}
 </div>
 )}

 <FormularioGpi f={sel.formulario} />

 <VendaParcelas vendaId={sel.id} podeConfirmar={podeEditarStatus} />

 <VendaDocumentos vendaId={sel.id} podeRemover={podeEditarStatus} />
 </Modal>
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

 {/* Sugestão automática: achou lead na base pelo nome/telefone/email digitado */}
 {!leadSel && !leadSugDispensada && leadAutoSug.length > 0 && (
 <div className="card" style={{ padding: '12px 14px', marginBottom: 14, background: 'var(--color-info-bg, #eaf4ff)', border: '1px solid var(--pons-blue)' }}>
 <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
 <Icon name="search" size={13} /> Encontramos {leadAutoSug.length > 1 ? 'leads' : 'este lead'} na base — é o mesmo cliente?
 </div>
 <div style={{ display: 'grid', gap: 6 }}>
 {leadAutoSug.slice(0, 4).map((l: any) => (
 <div key={l.id} className="flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
 <div style={{ flex: 1, minWidth: 180 }}>
 <div className="font-semibold" style={{ fontSize: 13 }}>{l.nome} <span className="text-xs text-secondary">· {l.telefone || l.email || ''}</span></div>
 <div className="text-xs text-secondary">Origem: <strong>{origemDoLead(l.origem)?.rotulo || l.origem}</strong>{l.campanha ? ` · ${l.campanha}` : ''}{l.corretorNome ? ` · corretor: ${l.corretorNome}` : ''}</div>
 </div>
 <button type="button" className="btn btn--primary btn--sm" onClick={() => vincularLead(l)}>Vincular</button>
 </div>
 ))}
 </div>
 <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={() => { setLeadNegadoId(leadAutoSug[0]?.id ?? null); setLeadSugDispensada(true); }}>Não é o mesmo cliente</button>
 </div>
 )}

 {/* Corretor negou um lead da base → aviso de que vai pra aprovação do Gestor de Tráfego */}
 {leadNegadoId && !leadSel && (
 <div className="card" style={{ padding: '10px 14px', marginBottom: 14, background: 'var(--color-warning-bg, #fff6e6)', border: '1px solid var(--color-warning, #f5a623)' }}>
 <div className="text-xs" style={{ fontWeight: 600 }}>
 ⚠️ Você indicou que o cliente <strong>não é</strong> um lead da base. A venda entra <strong>pendente</strong> até a aprovação do <strong>Gestor de Tráfego</strong>.
 <button type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: 8 }} onClick={() => { setLeadNegadoId(null); setLeadSugDispensada(false); }}>Desfazer</button>
 </div>
 </div>
 )}

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
 <input name="clienteCpf" className="field__input" inputMode="numeric" placeholder="000.000.000-00" onInput={onCpf} />
 </div>
 <div className="field">
 <label className="field__label">RG (c/ órgão expedidor) <span className="field__required">*</span></label>
 <input name="clienteRg" className="field__input" placeholder="1234567 SSP/SC" onInput={onRg} required />
 </div>
 <div className="field">
 <label className="field__label">Data de nascimento</label>
 <input ref={nascimentoRef} name="clienteNascimento" type="date" className="field__input" onChange={(e) => validaNascimento(e.currentTarget)} />
 <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 6, cursor: 'pointer' }}>
 <input type="checkbox" checked={emancipado} onChange={(e) => setEmancipado(e.target.checked)} />
 Menor emancipado (16–18 anos)
 </label>
 </div>
 <div className="field">
 <label className="field__label">Profissão</label>
 <input name="clienteProfissao" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">E-mail</label>
 <input name="clienteEmail" type="email" className="field__input" value={cliente.email} onChange={onEmailCtrl} />
 </div>
 <div className="field">
 <label className="field__label">Telefone</label>
 <input name="clienteTelefone" className="field__input" inputMode="tel" placeholder={telIntl ? '+1 305 555 0100' : '(47) 99999-9999'} value={cliente.telefone} onChange={onTelefoneCtrl} />
 <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
 <input type="checkbox" checked={telIntl} onChange={(e) => { setTelIntl(e.target.checked); if (!e.target.checked) setCliente((c) => ({ ...c, telefone: maskTelefone(c.telefone) })); }} style={{ width: 'auto' }} />
 Número internacional (sem máscara nacional)
 </label>
 </div>
 <div className="field">
 <label className="field__label">Estado civil <span className="field__required">*</span></label>
 <select name="clienteEstadoCivil" className="field__select" required value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)}>
 <option value="">— Selecionar —</option>
 {ESTADO_CIVIL.map((e) => <option key={e} value={e}>{e}</option>)}
 </select>
 <div className="field__hint">Define os documentos exigidos e os dados do cônjuge.</div>
 </div>
 <div className="field">
 <label className="field__label">CEP</label>
 <div style={{ display: 'flex', gap: 6 }}>
 <input className="field__input" inputMode="numeric" placeholder="00000-000" value={endPF.cep}
 onChange={(e) => setEndPF((c) => ({ ...c, cep: maskCEP(e.target.value) }))}
 onBlur={() => { if (endPF.cep.replace(/\D/g, '').length === 8 && !endPF.logradouro) onBuscarCep(); }} />
 <button type="button" className="btn btn--secondary btn--sm" onClick={onBuscarCep} disabled={buscandoCep}>{buscandoCep ? '...' : 'Buscar'}</button>
 </div>
 </div>
 <div className="field">
 <label className="field__label">Logradouro</label>
 <input className="field__input" value={endPF.logradouro} onChange={(e) => setEndPF((c) => ({ ...c, logradouro: e.target.value }))} />
 </div>
 <div className="field">
 <label className="field__label">Número</label>
 <input className="field__input" value={endPF.numero} onChange={(e) => setEndPF((c) => ({ ...c, numero: e.target.value }))} />
 </div>
 <div className="field">
 <label className="field__label">Complemento</label>
 <input className="field__input" value={endPF.complemento} onChange={(e) => setEndPF((c) => ({ ...c, complemento: e.target.value }))} />
 </div>
 <div className="field">
 <label className="field__label">Bairro</label>
 <input className="field__input" value={endPF.bairro} onChange={(e) => setEndPF((c) => ({ ...c, bairro: e.target.value }))} />
 </div>
 <div className="field">
 <label className="field__label">Cidade</label>
 <input className="field__input" value={endPF.cidade} onChange={(e) => setEndPF((c) => ({ ...c, cidade: e.target.value }))} />
 </div>
 <div className="field">
 <label className="field__label">UF</label>
 <input className="field__input" maxLength={2} value={endPF.uf} onChange={(e) => setEndPF((c) => ({ ...c, uf: e.target.value.toUpperCase() }))} />
 </div>
 <input type="hidden" name="clienteEndereco" value={enderecoPFStr} />
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
 <input name="conjugeCpf" className="field__input" inputMode="numeric" placeholder="000.000.000-00" onInput={onCpf} />
 </div>
 <div className="field">
 <label className="field__label">RG (c/ órgão expedidor)</label>
 <input name="conjugeRg" className="field__input" placeholder="1234567 SSP/SC" onInput={onRg} />
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
 <input name="conjugeEmail" type="email" className="field__input" onInput={onEmail} />
 </div>
 <div className="field">
 <label className="field__label">Telefone</label>
 <input name="conjugeTelefone" className="field__input" inputMode="tel" placeholder="(47) 99999-9999" onInput={onTelefone} />
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
 <input name="clienteTelefone" className="field__input" inputMode="tel" placeholder={telIntl ? '+1 305 555 0100' : '(47) 99999-9999'} onInput={onTelefoneCliente} />
 <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
 <input type="checkbox" checked={telIntl} onChange={(e) => setTelIntl(e.target.checked)} style={{ width: 'auto' }} />
 Número internacional (sem máscara nacional)
 </label>
 </div>
 <div className="field">
 <label className="field__label">E-mail</label>
 <input name="clienteEmail" type="email" className="field__input" onInput={onEmail} />
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
 <input name="socioCpf" className="field__input" inputMode="numeric" placeholder="000.000.000-00" onInput={onCpf} />
 </div>
 <div className="field">
 <label className="field__label">RG (c/ órgão expedidor) <span className="field__required">*</span></label>
 <input name="socioRg" className="field__input" placeholder="1234567 SSP/SC" onInput={onRg} required />
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
 <input name="socioEmail" type="email" className="field__input" onInput={onEmail} />
 </div>
 <div className="field">
 <label className="field__label">Telefone</label>
 <input name="socioTelefone" className="field__input" inputMode="tel" placeholder="(47) 99999-9999" onInput={onTelefone} />
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
 <div className="field">
 <label className="field__label">Unidade <span className="field__required">*</span></label>
 <input name="unidade" className="field__input" required placeholder="Apt 1207 · Torre A" value={unidadeLivre} onChange={(e) => setUnidadeLivre(e.target.value)} />
 <div className="field__hint">Este empreendimento ainda não tem estoque cadastrado — cadastre as unidades em Empreendimentos pra selecionar daqui.</div>
 </div>
 )}
 {unidadeOcupadaCod && (
 <div className="field" style={{ gridColumn: '1 / -1' }}>
 <div className="text-xs" style={{ color: '#dc2626', fontWeight: 600 }}>⚠ Esta unidade já possui uma venda ativa nossa ({unidadeOcupadaCod}). Cancele a venda anterior para liberá-la.</div>
 </div>
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
 <select name="corretorTitularId" className="field__select" required value={corretorTitularId} onChange={(e) => setCorretorTitularId(e.target.value)}>
 {(corretores || []).map((c: any) => (
 <option key={c.id} value={c.id}>{c.nome}</option>
 ))}
 </select>
 )}
 </div>
 <div className="field">
 <label className="field__label">Sala GPI</label>
 <input name="salaGpi" className="field__input" placeholder="Sala 12" value={salaGpi} onChange={(e) => setSalaGpi(e.target.value)} />
 <div className="field__hint">Preenchida com a sala da sua última venda — ajuste se mudou.</div>
 </div>
 </div>

 {/* Card do imóvel selecionado — SÓ dados que existem no cadastro */}
 {empSel && (
 <div className="card fade-in" style={{ padding: '12px 16px', marginBottom: 14, background: 'var(--bg-elevated)' }}>
 <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
 <Icon name="building" size={13} /> {empSel.nome}
 </div>
 <div className="text-xs text-secondary">
 {[
 empSel.construtora?.nome && `Construtora ${empSel.construtora.nome}`,
 empSel.cidade && `${empSel.cidade}${empSel.estado ? '/' + empSel.estado : ''}`,
 empSel.status && String(empSel.status).replace('_', '-').toLowerCase(),
 unidadeSel?.valor
 ? `Unidade R$ ${Number(unidadeSel.valor).toLocaleString('pt-BR')}`
 : empSel.valorInicial && `a partir de R$ ${Number(empSel.valorInicial).toLocaleString('pt-BR')}`,
 ].filter(Boolean).join(' · ')}
 </div>
 {unidadeSel && (
 <div className="text-xs" style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
 {[
 unidadeSel.tipologia,
 unidadeSel.quartos && `${unidadeSel.quartos} quarto${unidadeSel.quartos > 1 ? 's' : ''}`,
 unidadeSel.areaPrivativa && `${unidadeSel.areaPrivativa} m² privativos`,
 unidadeSel.vagas && `${unidadeSel.vagas} vaga${unidadeSel.vagas > 1 ? 's' : ''}`,
 unidadeSel.andar && `${unidadeSel.andar}º andar`,
 ].filter(Boolean).map((t: any) => (
 <span key={String(t)} className="badge badge--neutral" style={{ fontSize: 10 }}>{t}</span>
 ))}
 </div>
 )}
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

 {/* Referência do imóvel — o corretor preenche o valor negociado livremente */}
 {empSel && (
 <div className="card" style={{ padding: '12px 16px', marginBottom: 14, background: 'var(--bg-elevated)' }}>
 <div style={{ fontSize: 12, fontWeight: 700 }}>
 {empSel.nome}
 {unidadeSel ? ` — ${[unidadeSel.identificacao, unidadeSel.torre].filter(Boolean).join(' · ')}` : ''}
 </div>
 <div className="text-xs text-secondary">
 {[
 unidadeSel?.tipologia,
 unidadeSel?.areaPrivativa && `${unidadeSel.areaPrivativa} m²`,
 (unidadeSel?.valor || empSel?.valorInicial)
 ? `valor de tabela R$ ${Number(unidadeSel?.valor || empSel?.valorInicial).toLocaleString('pt-BR')} (referência)`
 : 'sem valor de tabela no cadastro',
 ].filter(Boolean).join(' · ')}
 </div>
 {/* Regras da venda cadastradas no empreendimento — espelhadas nos campos abaixo */}
 {politicaVigente && (politicaVigente.entradaMinimaPct || politicaVigente.chavesPct || politicaVigente.parcelasMensaisMax || politicaVigente.reforcosAnuaisMax || politicaVigente.percentualComissao) ? (
 <div className="text-xs" style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
 {politicaVigente.entradaMinimaPct ? <span className="badge badge--info" style={{ fontSize: 10 }}>entrada mín. {politicaVigente.entradaMinimaPct}%</span> : null}
 {politicaVigente.chavesPct ? <span className="badge badge--info" style={{ fontSize: 10 }}>chaves {politicaVigente.chavesPct}%</span> : null}
 {politicaVigente.parcelasMensaisMax ? <span className="badge badge--neutral" style={{ fontSize: 10 }}>até {politicaVigente.parcelasMensaisMax} mensais</span> : null}
 {politicaVigente.reforcosAnuaisMax ? <span className="badge badge--neutral" style={{ fontSize: 10 }}>{politicaVigente.reforcosAnuaisMax} reforços anuais</span> : null}
 {!isCorretor && politicaVigente.percentualComissao ? <span className="badge badge--neutral" style={{ fontSize: 10 }}>comissão {politicaVigente.percentualComissao}%</span> : null}
 </div>
 ) : null}
 </div>
 )}

 <div className="form-grid" style={{ marginBottom: 16 }}>
 <div className="field">
 <label className="field__label">Valor da venda <span className="field__required">*</span></label>
 <input
 className="field__input"
 required
 inputMode="numeric"
 placeholder="R$ 780.000,00"
 value={valorVenda}
 onChange={(e) => setValorVenda(maskMoedaBR(e.target.value))}
 />
 {!!(unidadeSel?.valor || empSel?.valorInicial) && (
 <div className="field__hint">Sugerido pelo valor de tabela — ajuste para o valor negociado.</div>
 )}
 </div>
 <div className="field">
 <label className="field__label">Entrada total</label>
 <input name="entradaTotal" className="field__input" inputMode="numeric" placeholder="R$ 156.000,00" value={entradaTotal} onChange={(e) => setEntradaTotal(maskMoedaBR(e.target.value))} />
 {politicaVigente?.entradaMinimaPct != null && (() => {
 const vv = parseMoedaBR(valorVenda), et = parseMoedaBR(entradaTotal);
 if (!vv || !et) return <div className="field__hint">Mínimo do empreendimento: {politicaVigente.entradaMinimaPct}% de entrada.</div>;
 const pct = (et / vv) * 100;
 return pct < politicaVigente.entradaMinimaPct
 ? <div className="field__hint" style={{ color: '#DC2626', fontWeight: 600 }}>Entrada de {pct.toFixed(1)}% — abaixo do mínimo de {politicaVigente.entradaMinimaPct}%. A venda NÃO pode ser registrada assim.</div>
 : <div className="field__hint" style={{ color: 'var(--color-success)' }}>Entrada de {pct.toFixed(1)}% — dentro da política ({politicaVigente.entradaMinimaPct}% mín.).</div>;
 })()}
 </div>
 <div className="field">
 <label className="field__label">Arras / sinal (R$) <span className="text-secondary" style={{ fontWeight: 400 }}>— pago no ato</span></label>
 <input name="arrasValor" className="field__input" inputMode="numeric" placeholder="R$ 20.000,00" value={arrasValor} onChange={(e) => setArrasValor(maskMoedaBR(e.target.value))} />
 <div className="field__hint">Faz parte da entrada. É quitado na reserva — sem vencimento.</div>
 </div>
 <div className="field">
 <label className="field__label">Parcelas da entrada</label>
 <input name="entradaParcelas" type="number" min={1} className="field__input" value={entradaParcelas} onChange={(e) => { setEntradaParcelas(e.target.value); setParcelasTocadas(false); }} />
 {Number(entradaParcelas) > 4 && (
 <div className="field__hint" style={{ color: '#d97706' }}>Acima de 4x — vai pra aprovação do Paulo.</div>
 )}
 </div>
 <div className="field">
 <label className="field__label">1º vencimento da entrada</label>
 <input name="entradaData" type="date" className="field__input" value={entradaData} onChange={(e) => setEntradaData(e.target.value)} />
 {politicaVigente?.parcelasMensaisMax ? <div className="field__hint">Empreendimento libera até {politicaVigente.parcelasMensaisMax} mensais{politicaVigente.reforcosAnuaisMax ? ` e ${politicaVigente.reforcosAnuaisMax} reforços` : ''}.</div> : null}
 </div>
 {parcelasEntrada.length > 0 && (
 <div className="field field--span-2">
 <label className="field__label">Valores e vencimentos das parcelas da entrada <span className="text-secondary" style={{ fontWeight: 400 }}>— pré-preenchido, editável</span></label>
 <div style={{ display: 'grid', gap: 6 }}>
 {parcelasEntrada.map((p, i) => (
 <div key={i} className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
 <span style={{ width: 30, fontSize: 12, color: 'var(--text-secondary)' }}>{i + 1}ª</span>
 <input className="field__input" style={{ maxWidth: 160 }} inputMode="numeric" value={p.valor} onChange={(e) => { const v = maskMoedaBR(e.target.value); setParcelasEntrada((cur) => cur.map((x, j) => j === i ? { ...x, valor: v } : x)); setParcelasTocadas(true); }} />
 <input type="date" className="field__input" style={{ maxWidth: 170 }} value={p.venc} onChange={(e) => { const v = e.target.value; setParcelasEntrada((cur) => cur.map((x, j) => j === i ? { ...x, venc: v } : x)); setParcelasTocadas(true); }} />
 </div>
 ))}
 </div>
 {(() => {
 const soma = parcelasEntrada.reduce((a, p) => a + parseMoedaBR(p.valor), 0);
 const alvo = parseMoedaBR(entradaTotal) - parseMoedaBR(arrasValor);
 const bate = Math.abs(soma - alvo) <= 1;
 return <div className="field__hint" style={{ color: bate ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>Soma das parcelas: {formatMoedaBR(soma)} · esperado (entrada − arras): {formatMoedaBR(alvo)} {bate ? '✓' : '— ajuste até fechar'}</div>;
 })()}
 {parcelasTocadas && <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 4 }} onClick={() => setParcelasTocadas(false)}>Recalcular automático</button>}
 </div>
 )}
 <div className="field">
 <label className="field__label">Mensais (R$)</label>
 <input name="mensaisValor" className="field__input" inputMode="numeric" placeholder="R$ 4.500,00" value={mensaisValor} onChange={(e) => setMensaisValor(maskMoedaBR(e.target.value))} />
 </div>
 <div className="field">
 <label className="field__label">Qtd de parcelas mensais</label>
 <input name="mensaisQtd" type="number" min={0} className="field__input" placeholder="36" value={mensaisQtd} onChange={(e) => setMensaisQtd(e.target.value)} />
 {recon.mensaisTot > 0 && <div className="field__hint">Total mensais: <strong>{formatMoedaBR(recon.mensaisTot)}</strong></div>}
 </div>
 <div className="field">
 <label className="field__label">Melhor dia do mês</label>
 <input name="mensaisMelhorDia" type="number" min={1} max={31} className="field__input" placeholder="10" value={mensaisDia} onChange={(e) => setMensaisDia(e.target.value)} />
 </div>
 <div className="field">
 <label className="field__label">Reforços anuais / balões (R$)</label>
 <input name="anuaisValor" className="field__input" inputMode="numeric" placeholder="R$ 30.000,00" value={anuaisValor} onChange={(e) => setAnuaisValor(maskMoedaBR(e.target.value))} />
 </div>
 <div className="field">
 <label className="field__label">Qtd de reforços</label>
 <input name="anuaisQtd" type="number" min={0} className="field__input" placeholder="3" value={anuaisQtd} onChange={(e) => setAnuaisQtd(e.target.value)} />
 {recon.anuaisTot > 0 && <div className="field__hint">Total reforços: <strong>{formatMoedaBR(recon.anuaisTot)}</strong></div>}
 </div>
 <div className="field">
 <label className="field__label">Mês de vencimento dos reforços</label>
 <select name="anuaisInicio" className="field__select" value={anuaisMes} onChange={(e) => setAnuaisMes(e.target.value)}>
 <option value="">— Mês —</option>
 {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
 </select>
 </div>
 <div className="field">
 <label className="field__label">Chaves (R$)</label>
 <input name="chavesValor" className="field__input" inputMode="numeric" placeholder="R$ 150.000,00" value={chavesValor} onChange={(e) => setChavesValor(maskMoedaBR(e.target.value))} />
 {politicaVigente?.chavesPct ? <div className="field__hint">Sugerido: {politicaVigente.chavesPct}% do valor da venda (regra do empreendimento) — ajuste se negociado.</div> : null}
 </div>
 </div>

 {/* Reconciliação com o VGV — soma dos pagamentos vs valor da venda */}
 {recon.vgv > 0 && (
 <div className="card" style={{ marginBottom: 16, padding: '12px 16px', background: recon.fecha ? 'var(--bg-elevated)' : 'var(--color-danger-bg, #fde8ea)', border: recon.fecha ? undefined : '1px solid var(--color-danger)' }}>
 <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>Conferência dos valores × VGV</div>
 <div className="text-xs" style={{ display: 'grid', gap: 3 }}>
 <div className="flex" style={{ justifyContent: 'space-between' }}><span className="text-secondary">Valor da venda (VGV)</span><strong>{formatMoedaBR(recon.vgv)}</strong></div>
 <div className="flex" style={{ justifyContent: 'space-between' }}><span className="text-secondary">Entrada + mensais + reforços + chaves</span><strong>{formatMoedaBR(recon.soma)}</strong></div>
 {!recon.fecha && (
 <div className="flex" style={{ justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--border-light)' }}>
 <span className="text-secondary">Diferença</span>
 <strong style={{ color: 'var(--color-danger)' }}>{formatMoedaBR(Math.abs(recon.saldo))}</strong>
 </div>
 )}
 </div>
 {recon.fecha
 ? <div className="text-xs" style={{ color: 'var(--color-success)', marginTop: 6, fontWeight: 600 }}>Os valores fecham com o VGV ✓</div>
 : <div className="text-xs" style={{ color: 'var(--color-danger)', marginTop: 6, fontWeight: 600 }}>A soma dos pagamentos precisa fechar com o VGV — ajuste antes de avançar.</div>}
 </div>
 )}

 <div className="card" style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-elevated)' }}>
 <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Dados bancários — conta da unidade (manter no protocolo)</div>
 {contaBanco ? (
 <div className="text-xs text-secondary">
 Titular: {contaBanco.razaoSocial}{contaBanco.cnpj ? ` · CNPJ: ${contaBanco.cnpj}` : ''}{contaBanco.banco ? ` · Banco: ${contaBanco.banco}` : ''}{contaBanco.agencia ? ` · Agência: ${contaBanco.agencia}` : ''}{contaBanco.conta ? ` · Conta: ${contaBanco.conta}` : ''}{contaBanco.pix ? ` · PIX: ${contaBanco.pix}` : ''}
 {(!contaBanco.banco || !contaBanco.conta) && <span style={{ color: '#d97706' }}> — dados bancários incompletos; cadastre em Contas Bancárias.</span>}
 </div>
 ) : (
 <div className="text-xs" style={{ color: '#d97706' }}>Conta da unidade não cadastrada. Cadastre em Financeiro → Contas Bancárias (ou vincule a empresa da filial).</div>
 )}
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
 {podeEditarRateio && (
 <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 10 }}>
 <input type="checkbox" checked={comEspecial} onChange={(e) => setComEspecial(e.target.checked)} style={{ width: 'auto' }} />
 Negociação especial da comissão (editar valores)
 </label>
 )}
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
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
 <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
 <input type="checkbox" checked={temNf} onChange={(e) => setTemNf(e.target.checked)} /> Tem Nota Fiscal
 </label>
 {temNf && (
 <>
 <div className="field" style={{ maxWidth: 170 }}>
 <label className="field__label">Alíquota NF (%)</label>
 <input type="number" step="0.01" min="0" className="field__input" value={nfAliquota} onChange={(e) => setNfAliquota(e.target.value)} />
 <div className="field__hint">Padrão global: {nfAliquotaGlobal}% — pode personalizar nesta venda.</div>
 </div>
 <button type="button" className="btn btn--ghost btn--sm" disabled={salvandoNfGlobal || Number(nfAliquota) === nfAliquotaGlobal} onClick={async () => {
 const pct = Number(nfAliquota);
 if (!(pct >= 0 && pct <= 100)) { toast.error('Alíquota inválida.'); return; }
 setSalvandoNfGlobal(true);
 try { const r = await Api.nfAliquotaSave(pct); setNfAliquotaGlobal(r.pct); toast.success(`Alíquota global atualizada para ${r.pct}%.`); }
 catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
 finally { setSalvandoNfGlobal(false); }
 }}>Definir como padrão global</button>
 </>
 )}
 </div>
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
 <div><span className="text-secondary">Valor da venda:</span> <strong>{formatMoedaBR(parseMoedaBR(valorVenda))}</strong></div>
 <div><span className="text-secondary">Entrada:</span> <strong>{resumo?.entradaTotal ? `${formatMoedaBR(parseMoedaBR(String(resumo.entradaTotal)))} em ${resumo?.entradaParcelas || 1}x` : '—'}</strong></div>
 {resumo?.arrasValor ? <div><span className="text-secondary">Arras:</span> <strong>{formatMoedaBR(parseMoedaBR(String(resumo.arrasValor)))}</strong></div> : null}
 {resumo?.mensaisValor ? <div><span className="text-secondary">Mensais:</span> <strong>{formatMoedaBR(parseMoedaBR(String(resumo.mensaisValor)))}{resumo?.mensaisMelhorDia ? ` · dia ${resumo.mensaisMelhorDia}` : ''}</strong></div> : null}
 {resumo?.anuaisValor ? <div><span className="text-secondary">Anuais:</span> <strong>{formatMoedaBR(parseMoedaBR(String(resumo.anuaisValor)))}</strong></div> : null}
 {resumo?.chavesValor ? <div><span className="text-secondary">Chaves:</span> <strong>{formatMoedaBR(parseMoedaBR(String(resumo.chavesValor)))}</strong></div> : null}
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
export function FormularioGpi({ f }: { f: any }) {
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
// Cor de cada fase — pinta o topo da coluna e o destaque dos cards.
const COR_FASE: Record<string, string> = {
 PRE_ANALISE: '#3FB6D4',
 ANALISE_JURIDICA: '#8493B4',
 AGUARDANDO_CONSTRUTORA: '#F2B544',
 CONTRATO_EM_CONFECCAO: '#F2B544',
 CONTRATO_EM_CONFERENCIA: '#E08E1A',
 EM_ASSINATURA: '#9B59B6',
 ASSINADO: '#88C559',
 ASSINADO_AGUARDANDO_PAGAMENTO: '#0E7C9B',
 INADIMPLENTE: '#C70A1A',
 PAGO: '#88C559',
 AGUARDANDO_REPASSE: '#0E7C9B',
};

function VendaKanban({ onSelect, podeMover }: { onSelect: (id: number) => void; podeMover: boolean }) {
 // Hooks ANTES de qualquer return condicional (Rules of Hooks).
 const { data, loading, error } = useApi<{ colunas: any[] }>(() => Api.vendaKanban());
 const [colunas, setColunas] = useState<any[]>([]);
 // Padrão: mostra TODAS as fases (inclusive vazias) — o usuário recolhe se quiser.
 const [mostrarVazias, setMostrarVazias] = useState(true);
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

 const totalVendas = colunas.reduce((s, c) => s + c.total, 0);
 const totalValor = colunas.reduce((s, c) => s + (c.valorTotal || 0), 0);
 const vazias = colunas.filter((c) => !c.cards.length).length;
 // Com o modal recolhido, esconde colunas vazias (menos a primeira, que é a
 // porta de entrada) — evita o scroll infinito de fases sem nada.
 const visiveis = mostrarVazias ? colunas : colunas.filter((c, i) => c.cards.length > 0 || i === 0);

 return (
 <>
 <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
 <div className="text-sm">
 <strong>{totalVendas}</strong> venda{totalVendas === 1 ? '' : 's'} em andamento · <strong className="money">{formatCurrencyShort(totalValor)}</strong>
 </div>
 {vazias > 0 && (
 <button className="btn btn--ghost btn--sm" onClick={() => setMostrarVazias((v) => !v)}>
 <Icon name={mostrarVazias ? 'zoom_out' : 'zoom_in'} size={13} /> {mostrarVazias ? 'Ocultar fases vazias' : `Mostrar ${vazias} fases vazias`}
 </button>
 )}
 </div>
 <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
 {visiveis.map((col) => {
 const cor = COR_FASE[col.fase] || '#0E7C9B';
 const isDropTarget = podeMover && dnd.hoverCol === col.fase;
 return (
 <div
 key={col.fase}
 data-kanban-col={col.fase}
 style={{
 minWidth: 250,
 flex: '0 0 250px',
 borderRadius: 12,
 padding: 10,
 background: isDropTarget ? 'var(--bg-card-hover)' : 'var(--bg-elevated)',
 borderTop: `3px solid ${cor}`,
 outline: isDropTarget ? `2px dashed ${cor}` : '2px dashed transparent',
 transition: 'outline-color .12s, background .12s',
 }}
 onDragOver={podeMover ? dnd.onDragOver(col.fase) : undefined}
 onDragLeave={podeMover ? dnd.onDragLeave(col.fase) : undefined}
 onDrop={podeMover ? dnd.onDrop(col.fase) : undefined}
 >
 <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 6 }}>
 <span style={{ fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
 <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col.label}>{col.label}</span>
 </span>
 <span className="text-xs" style={{ fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
 {col.total} · {formatCurrencyShort(col.valorTotal)}
 </span>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 46 }}>
 {col.cards.map((c: any) => (
 <div
 key={c.id}
 className="card kanban-card"
 draggable={podeMover}
 onDragStart={podeMover ? dnd.onDragStart(c.id) : undefined}
 onDragEnd={podeMover ? dnd.onDragEnd : undefined}
 onPointerDown={podeMover ? dnd.onPointerDown(c.id) : undefined}
 style={{
 padding: 12,
 cursor: podeMover ? 'grab' : 'pointer',
 opacity: dnd.draggingId === c.id ? 0.45 : 1,
 borderLeft: `3px solid ${cor}`,
 ['--sg-accent' as any]: cor,
 }}
 onClick={() => onSelect(c.id)}
 >
 <div className="font-semibold" style={{ fontSize: 13 }}>{c.clienteNome}</div>
 <div className="text-xs text-secondary" style={{ marginTop: 2 }}>
 #{c.codigo} · {c.empreendimento}
 </div>
 <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
 <span className="money" style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>{formatCurrencyShort(c.valorVenda)}</span>
 <div className="avatar avatar--sm" title={c.corretor?.nome}>
 {c.corretor?.initials || initials(c.corretor?.nome || '')}
 </div>
 </div>
 {c.aguardandoAprovacao && (
 <span className="badge badge--cancelled" style={{ fontSize: 9, marginTop: 8, display: 'inline-block' }}>
 Aguardando aprovação {c.entradaParcelas}x
 </span>
 )}
 </div>
 ))}
 {!col.cards.length && (
 <div className="text-xs text-secondary" style={{ textAlign: 'center', padding: '14px 8px', border: '1.5px dashed var(--border-light)', borderRadius: 8 }}>
 {isDropTarget ? 'Soltar aqui' : 'Nenhuma venda nesta fase'}
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </>
 );
}

// Documentos do protocolo (fotos/PDFs) anexados à venda.
export function VendaDocumentos({ vendaId, podeRemover }: { vendaId: number; podeRemover?: boolean }) {
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

export function VendaParcelas({ vendaId, podeConfirmar }: { vendaId: number; podeConfirmar?: boolean }) {
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
 const pagas = parcelas.filter((p) => p.status === 'PAGO');
 const totalEntrada = parcelas.reduce((s, p) => s + (p.valor || 0), 0);
 const totalPago = pagas.reduce((s, p) => s + (p.valor || 0), 0);
 return (
 <div style={{ margin: '16px 0', padding: '14px 16px', background: 'var(--bg-card-hover)', borderRadius: 10 }}>
 <div className="flex-between" style={{ alignItems: 'baseline', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
 <div className="uppercase-tag">Plano de recebimento (entrada)</div>
 <div className="text-xs text-secondary">
 {pagas.length}/{parcelas.length} pagas · {formatCurrencyShort(totalPago)} de {formatCurrencyShort(totalEntrada)}
 </div>
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 6 }}>
 {parcelas.map((p) => {
 const [k, lbl] = PARCELA_BADGE[p.status] || ['neutral', p.status];
 const venc = p.vencimento ? new Date(p.vencimento).toLocaleDateString('pt-BR') : '—';
 return (
 <div key={p.id} className="flex-between" style={{ alignItems: 'center', gap: 8, padding: '5px 10px', background: 'var(--bg-card)', borderRadius: 8, minWidth: 0 }}>
 <div style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
 <strong>{p.numero}/{p.total}</strong> · {formatCurrencyShort(p.valor)} · {venc}
 </div>
 <div className="flex gap-2" style={{ alignItems: 'center', flexShrink: 0 }}>
 {(!podeConfirmar || p.status === 'PAGO') && <span className={`badge badge--${k}`} style={{ fontSize: 10 }}>{lbl}</span>}
 {podeConfirmar && p.status !== 'PAGO' && (
 <button className="btn btn--secondary btn--sm" style={{ padding: '3px 10px' }} disabled={busy === p.id} onClick={() => mudarStatus(p.id, 'PAGO')}>
 {busy === p.id ? '…' : 'Confirmar'}
 </button>
 )}
 {podeConfirmar && p.status === 'PAGO' && (
 <button className="btn btn--ghost btn--sm" style={{ padding: '3px 8px' }} disabled={busy === p.id} onClick={() => mudarStatus(p.id, 'ABERTO')} title="Desfazer">
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
