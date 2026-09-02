// Vitrine "Sem Fila" — leads quentes (anúncio/WhatsApp/site) que caíram sem
// fila e sem corretor. Visível pra TODOS os papéis (pedido Elison 02/09):
// acaba com o ponto cego do bolsão. Corretor clica "Pegar lead" e assume na
// hora (claim atômico no backend — sem corrida entre dois corretores).
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useState } from 'react';

const dt = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const ORIGEM_LABEL: Record<string, string> = {
  META_ADS: 'Anúncio Meta', WHATSAPP: 'WhatsApp', SITE: 'Site', INSTAGRAM: 'Instagram',
};

export default function SemFila() {
  const toast = useToast();
  const { data: leads, loading, error, reload } = useApi<any[]>(() => Api.semFilaList());
  const [pegando, setPegando] = useState<number | null>(null);

  const pegar = async (l: any) => {
    setPegando(l.id);
    try {
      await Api.semFilaPegar(l.id);
      toast.success(`${l.nome} agora é seu — abre o Atendimento pra falar com ele`);
      reload();
    } catch (err: any) {
      toast.error(err?.message === 'ja_pego' ? 'Outro corretor pegou este lead primeiro' : 'Erro: ' + (err?.message || 'falha'));
      reload();
    } finally {
      setPegando(null);
    }
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h1 className="card__title">Sem Fila</h1>
          <p className="text-sm text-secondary">
            Leads de anúncio que entraram sem fila de distribuição. Quem pegar primeiro, atende — o lead vai direto pro seu Atendimento.
          </p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={reload}>Atualizar</button>
      </div>

      <div className="card">
        {loading && <LoadingBlock />}
        {error && <ErrorBlock error={error} />}
        {leads && leads.length === 0 && (
          <p className="text-sm text-secondary">Nenhum lead esperando — todas as campanhas estão distribuindo certinho.</p>
        )}
        {leads && leads.length > 0 && (
          <table className="table">
            <thead>
              <tr><th>Lead</th><th>Origem</th><th>Campanha</th><th>Entrou em</th><th>Onde está</th><th></th></tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="font-semibold">{l.nome}<div className="text-xs text-secondary">{l.telefone || 'sem telefone'}</div></td>
                  <td className="text-sm">{ORIGEM_LABEL[l.origem] || l.origem}</td>
                  <td className="text-sm text-secondary">{l.campanha || '-'}</td>
                  <td className="text-sm">{dt(l.createdAt)}</td>
                  <td className="text-sm text-secondary">{l.bolsao || 'sem bolsão'}</td>
                  <td>
                    <button className="btn btn--primary btn--sm" disabled={pegando === l.id} onClick={() => pegar(l)}>
                      {pegando === l.id ? 'Pegando…' : 'Pegar lead'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-secondary mt-4">
        Gestores: além de pegar, dá pra direcionar em lote pelo Bolsão. O telefone segue a regra padrão (mascarado até liberar contato).
      </p>
    </div>
  );
}
