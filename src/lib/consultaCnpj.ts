// consultaCnpj.ts — consulta CNPJ na Receita (BrasilAPI + fallback Minha Receita).
// A chamada externa roda no BACKEND (/api/consulta-cnpj/:cnpj): evita CORS no
// navegador, usa o User-Agent que a BrasilAPI exige e cacheia por 24h.
import { Api } from './api';

export interface CnpjInfo {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string; // ATIVA, BAIXADA, etc.
  abertura: string | null;
  cnae: string | null;
  porte: string | null;
  municipio: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  socios: { nome: string; qualificacao: string }[];
}

export const soDigitos = (v: string) => v.replace(/\D/g, '');

/** Máscara progressiva 00.000.000/0000-00 (aceita CPF parcial quando permitido). */
export function formataCnpj(v: string): string {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formataCpf(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export async function consultaCnpj(cnpjRaw: string): Promise<CnpjInfo> {
  const cnpj = soDigitos(cnpjRaw);
  if (cnpj.length !== 14) throw new Error('CNPJ inválido (precisa de 14 dígitos)');
  return Api.consultaCnpj(cnpj);
}
