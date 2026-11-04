import { useState } from 'react';
import { Api } from '../lib/api';
import { useToast } from '../lib/toast';
import { exportarXlsx } from '../lib/xlsx-simple';

// Vendas gravadas sem nota fiscal (desde 13/07 toda venda é com NF): planilha para conferir
// e corrigir uma a uma no Editar negociação. Só lê, não altera nada. Fica no Financeiro e
// no Administrativo de Vendas (Gláucia 04/11).
export function BotaoVendasSemNf() {
  const toast = useToast();
  const [baixando, setBaixando] = useState(false);
  const baixar = async () => {
    setBaixando(true);
    try {
      const r = await Api.rateioVendasSemNf();
      const vs: any[] = r?.vendas || [];
      if (!vs.length) { toast.success('Nenhuma venda sem nota fiscal para corrigir.'); return; }
      exportarXlsx(`vendas-sem-nota-fiscal-${new Date().toLocaleDateString('sv-SE')}.xlsx`,
        ['Código', 'Data', 'Cliente', 'Empreendimento', 'Unidade', 'Corretor', 'Lançada por', 'Status', 'Valor da venda', 'Comissão bruta', 'Alíquota NF (%)', 'Corretor hoje (sem NF)', 'Corretor com NF', 'Diferença', 'Já pago ao corretor', 'Pago a mais'],
        vs.map((v) => [v.codigo, new Date(v.data).toLocaleDateString('pt-BR'), v.cliente, v.empreendimento, v.unidade, v.corretor, v.lancadaPor, v.status, v.valorVenda, v.comissaoBruta, v.aliquotaNf, v.corretorHoje, v.corretorComNf, v.diferenca, v.pagoAoCorretor, v.pagoAMais]),
        'Vendas sem NF');
      toast.success(`${vs.length} vendas na planilha.`);
    } catch (err: any) {
      toast.error(err?.message || 'Não consegui gerar a planilha.');
    } finally {
      setBaixando(false);
    }
  };
  return (
    <button className="btn btn--secondary btn--sm" disabled={baixando} onClick={baixar} title="Vendas lançadas desde 13/07 que ficaram sem o desconto da nota fiscal">
      {baixando ? 'Gerando…' : 'Vendas sem nota fiscal (Excel)'}
    </button>
  );
}
