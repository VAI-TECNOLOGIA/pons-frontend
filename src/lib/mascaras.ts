// Máscaras e validações de formulário (documentos, contato, dinheiro, CEP).
// Usadas no wizard de venda e onde mais precisar. Tudo pt-BR.

// ── CPF ────────────────────────────────────────────────────────────────────
export function maskCPF(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// Valida os dígitos verificadores do CPF (rejeita 000..., 111..., aleatórios).
export function validaCPF(v: string): boolean {
  const c = (v || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dig = (base: number) => {
    let soma = 0;
    for (let i = 0; i < base; i++) soma += Number(c[i]) * (base + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(c[9]) && dig(10) === Number(c[10]);
}

// ── CNPJ ───────────────────────────────────────────────────────────────────
export function maskCNPJ(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function validaCNPJ(v: string): boolean {
  const c = (v || '').replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: number) => {
    const pesos = base === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base; i++) soma += Number(c[i]) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

// ── Telefone ───────────────────────────────────────────────────────────────
export function maskTelefone(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

export function validaTelefone(v: string): boolean {
  const d = (v || '').replace(/\D/g, '');
  return d.length === 10 || d.length === 11;
}

// ── E-mail ─────────────────────────────────────────────────────────────────
// Mais estrito que o type=email do browser (que aceita "a@b").
export function validaEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test((v || '').trim());
}

// ── CEP ────────────────────────────────────────────────────────────────────
export function maskCEP(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

export type EnderecoViaCep = { logradouro: string; bairro: string; cidade: string; uf: string };

// Busca o endereço no ViaCEP. Retorna null se CEP inválido ou não encontrado.
export async function buscaCEP(cep: string): Promise<EnderecoViaCep | null> {
  const d = (cep || '').replace(/\D/g, '');
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (j.erro) return null;
    return { logradouro: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', uf: j.uf || '' };
  } catch {
    return null;
  }
}

// ── Dinheiro (R$) ──────────────────────────────────────────────────────────
// Máscara enquanto digita: trata a entrada como centavos → "R$ 1.234,56".
export function maskMoedaBR(v: string): string {
  const d = (v || '').replace(/\D/g, '');
  if (!d) return '';
  const n = Number(d) / 100;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formata um NÚMERO (reais) como "R$ 1.234,56" — pra preencher campos calculados.
export function formatMoedaBR(n: number): string {
  if (!n && n !== 0) return '';
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Converte "R$ 1.234,56" (ou "1234,56" / "1234.56") em número.
export function parseMoedaBR(v: string): number {
  if (typeof v === 'number') return v;
  const s = String(v || '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  // Se tem vírgula, ela é o decimal (pt-BR): remove pontos de milhar.
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(s) || 0;
}

// ── Idade / menoridade ─────────────────────────────────────────────────────
export function idadeEmAnos(dataNasc: string): number | null {
  if (!dataNasc) return null;
  const d = new Date(dataNasc);
  if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--;
  return anos;
}
