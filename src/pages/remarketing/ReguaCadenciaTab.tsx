import { useState } from 'react';
import { Api } from '../../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../../lib/useApi';
import { useToast } from '../../lib/toast';
import { ReguaTimeline } from '../../components/ReguaTimeline';
import { ReguaPassosEditor } from '../../components/ReguaPassosEditor';
import { ReguaExecucoesList } from '../../components/ReguaExecucoesList';
import { Icon } from '../../components/Icon';

type Tipo = 'NAO_RESPONDEU' | 'RESPONDEU_24H';

const TIPOS: Array<{ tipo: Tipo; label: string; desc: string }> = [
  { tipo: 'NAO_RESPONDEU', label: 'Lead não respondeu', desc: 'Fora da janela de 24h do WhatsApp — só pode enviar templates aprovados pela Meta.' },
  { tipo: 'RESPONDEU_24H', label: 'Lead respondeu (24h)', desc: 'Dentro da janela de 24h — texto livre, editável a qualquer momento, sem aprovação.' },
];

const DIAS_SEMANA: Array<[string, string]> = [['0', 'Dom'], ['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb']];

// Régua de cadência — duas réguas fixas (NAO_RESPONDEU / RESPONDEU_24H). O
// backend permite múltiplas do mesmo tipo, mas o gatilho automático
// (onLeadRespondeuWhatsapp/onTemplateEnviado) só olha pra primeira ATIVA de
// cada tipo — a UI reflete esse uso real: 1 régua por tipo.
export function ReguaCadenciaTab() {
  const [tipoAtivo, setTipoAtivo] = useState<Tipo>('NAO_RESPONDEU');
  const [editandoPassos, setEditandoPassos] = useState(false);
  const { data: reguas, loading, error, reload } = useApi(() => Api.reguaList());
  const toast = useToast();

  const regua = (reguas || []).find((r: any) => r.tipo === tipoAtivo) || null;
  const infoTipo = TIPOS.find((t) => t.tipo === tipoAtivo)!;
  const { data: templatesData } = useApi(
    () => (tipoAtivo === 'NAO_RESPONDEU' ? Api.whatsappTemplates() : Promise.resolve({ items: [], cached: true })),
    [tipoAtivo],
  );
  const templates = templatesData?.items || [];

  const criar = async () => {
    try {
      await Api.reguaCreate({ tipo: tipoAtivo, nome: infoTipo.label });
      toast.success('Régua criada — configure os passos abaixo');
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const toggleAtiva = async () => {
    if (!regua) return;
    try {
      await Api.reguaUpdate(regua.id, { ativa: !regua.ativa });
      toast.success(regua.ativa ? 'Régua desativada' : 'Régua ativada');
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const salvarCfg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!regua) return;
    const fd = new FormData(e.currentTarget);
    try {
      await Api.reguaUpdate(regua.id, {
        nome: String(fd.get('nome') || regua.nome),
        templateGatilho: String(fd.get('templateGatilho') || '') || null,
        expedienteDias: Array.from(fd.getAll('expedienteDias')).join(',') || '1,2,3,4,5,6,0',
        expedienteInicioHora: Number(fd.get('expedienteInicioHora')),
        expedienteFimHora: Number(fd.get('expedienteFimHora')),
      });
      toast.success('Configurações salvas');
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const diasAtivos = (regua?.expedienteDias || '1,2,3,4,5,6,0').split(',');

  return (
    <div>
      <div className="flex" style={{ gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TIPOS.map((t) => (
          <button
            key={t.tipo}
            type="button"
            className={`btn btn--sm ${tipoAtivo === t.tipo ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setTipoAtivo(t.tipo); setEditandoPassos(false); }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-secondary" style={{ marginBottom: 16 }}>{infoTipo.desc}</p>

      {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

      {!loading && !error && !regua && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
            Nenhuma régua "{infoTipo.label}" configurada ainda.
          </p>
          <button type="button" className="btn btn--primary" onClick={criar}>+ Criar régua</button>
        </div>
      )}

      {regua && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="flex-between" style={{ marginBottom: 14 }}>
              <div>
                <strong>{regua.nome}</strong>
                <div className="text-xs text-secondary">{regua.execucoesAtivas} execução(ões) ativa(s) agora</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={regua.ativa} onChange={toggleAtiva} />
                {regua.ativa ? 'Ativa' : 'Inativa'}
              </label>
            </div>

            <form key={regua.id} onSubmit={salvarCfg}>
              <div className="form-grid">
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label className="field__label">Nome</label>
                  <input name="nome" className="field__input" defaultValue={regua.nome} />
                </div>
                {tipoAtivo === 'NAO_RESPONDEU' && (
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label className="field__label">Gatilho automático (opcional)</label>
                    <select name="templateGatilho" className="field__select" defaultValue={regua.templateGatilho || ''}>
                      <option value="">Nenhum — só inicia manualmente</option>
                      {templates.map((t: any) => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                    <div className="field__hint">Ao enviar esse template pra um lead, a régua inicia sozinha.</div>
                  </div>
                )}
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label className="field__label">Expediente — dias da semana</label>
                  <div className="flex" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {DIAS_SEMANA.map(([v, l]) => (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" name="expedienteDias" value={v} defaultChecked={diasAtivos.includes(v)} />
                        {l}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label className="field__label">Início expediente</label>
                  <select name="expedienteInicioHora" className="field__select" defaultValue={regua.expedienteInicioHora}>
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}h</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label">Fim expediente</label>
                  <select name="expedienteFimHora" className="field__select" defaultValue={regua.expedienteFimHora}>
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}h</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn--primary btn--sm">Salvar configurações</button>
              </div>
            </form>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="flex-between" style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 14 }}>Passos da régua</strong>
              {!editandoPassos && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditandoPassos(true)}>
                  <Icon name="pencil" size={12} /> Editar passos
                </button>
              )}
            </div>
            {editandoPassos ? (
              <ReguaPassosEditor
                key={regua.id}
                regua={regua}
                onSaved={() => { setEditandoPassos(false); reload(); }}
                onCancel={() => setEditandoPassos(false)}
              />
            ) : (
              <ReguaTimeline
                steps={(regua.passos || []).map((p: any) => ({
                  ordem: p.ordem,
                  nomeExibicao: p.nomeExibicao,
                  atrasoHoras: p.atrasoHoras,
                  detalhe: (
                    <span className="text-xs text-secondary">
                      {p.templateName ? `Template: ${p.templateName}` : p.mensagemTexto}
                    </span>
                  ),
                }))}
                emptyLabel="Nenhum passo configurado — clique em Editar passos pra começar."
              />
            )}
          </div>

          <div className="card">
            <strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>Execuções</strong>
            <ReguaExecucoesList reguaId={regua.id} />
          </div>
        </>
      )}
    </div>
  );
}
