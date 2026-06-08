// Configuração do Agente IA de Atendimento de Lead.
//
// Inspirado no painel "Novo Agente" de outros sistemas, mas SEM as abas de
// Integrações e MCP — o agente do VAI fica focado exclusivamente em responder
// leads via WhatsApp Meta enquanto o corretor não aceita.
import { useEffect, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { PageWrap } from '../components/PageWrap';
import { Api } from '../lib/api';
import { useApi, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { Icon } from '../components/Icon';

const TONS: Array<{ id: 'formal' | 'equilibrado' | 'descontraido' | 'criativo'; label: string; sub: string; icon: string }> = [
  { id: 'formal',      label: 'Formal',       sub: 'Direto, preciso e profissional',     icon: 'shield' },
  { id: 'equilibrado', label: 'Equilibrado',  sub: 'Neutro, claro e acessível',          icon: 'check' },
  { id: 'descontraido', label: 'Descontraído', sub: 'Leve, amigável e próximo',           icon: 'sparkles' },
  { id: 'criativo',    label: 'Criativo',     sub: 'Expressivo e com personalidade',     icon: 'lightbulb' },
];

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI (GPT)' },
  { id: 'anthropic', label: 'Anthropic (Claude)' },
];

export default function AgenteIA() {
  const { data, loading, reload } = useApi<Record<string, string>>(() => Api.agenteIaConfig());
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && Object.keys(form).length === 0) {
      setForm({
        'ia.atendimento.provider': data['ia.atendimento.provider'] || 'openai',
        'ia.atendimento.apiKey': '',
        'ia.atendimento.model': data['ia.atendimento.model'] || 'gpt-4o-mini',
        'ia.atendimento.tom': data['ia.atendimento.tom'] || 'equilibrado',
        'ia.atendimento.descricao': data['ia.atendimento.descricao'] || '',
        'ia.atendimento.instrucoes': data['ia.atendimento.instrucoes'] || '',
        'ia.atendimento.baseConhecimento': data['ia.atendimento.baseConhecimento'] || '',
      });
    }
  }, [data, form]);

  if (loading) return <LoadingBlock />;

  const upd = (campo: string, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  const apiKeyPreview = data?.['ia.atendimento.apiKey'] || '';

  const salvar = async () => {
    setSaving(true);
    try {
      // Não envia apiKey vazia (preserva a salva)
      const payload = { ...form };
      if (!payload['ia.atendimento.apiKey']) delete payload['ia.atendimento.apiKey'];
      await Api.agenteIaSave(payload);
      toast.success('Configuração do agente salva');
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  const tomSelecionado = form['ia.atendimento.tom'] || 'equilibrado';

  return (
    <>
      <Topbar title="Agente de Atendimento IA" />
      <PageWrap>
        <PageHeader
          breadcrumb="Sistema · IA"
          title="Agente de Atendimento"
          subtitle="Configure como a IA responde leads enquanto o corretor não aceita o atendimento"
          actions={
            <button className="btn btn--primary" onClick={salvar} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          }
        />

        {/* Status compacto */}
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
          <Icon name="bot" size={20} style={{ color: 'var(--blue-500)' }} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 14 }}>Agente {data?.['ia.atendimento.apiKey'] ? 'ativo' : 'sem chave configurada'}</strong>
            <div className="text-xs text-secondary">
              {data?.['ia.atendimento.apiKey']
                ? `Provider: ${data['ia.atendimento.provider'] || 'openai'} · Modelo: ${data['ia.atendimento.model'] || 'gpt-4o-mini'}`
                : 'Cadastre uma chave de API GPT/Claude pra habilitar a IA. Sem chave, o sistema usa regras-base como fallback.'}
            </div>
          </div>
        </div>

        {/* Modelo + API Key */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="card__title" style={{ marginBottom: 12 }}>Modelo & credenciais</h3>
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Provider</label>
              <select
                className="field__select"
                value={form['ia.atendimento.provider'] || 'openai'}
                onChange={(e) => upd('ia.atendimento.provider', e.target.value)}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Modelo</label>
              <input
                className="field__input"
                value={form['ia.atendimento.model'] || ''}
                onChange={(e) => upd('ia.atendimento.model', e.target.value)}
                placeholder={form['ia.atendimento.provider'] === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini'}
              />
            </div>
            <div className="field field--span-2">
              <label className="field__label">API Key {apiKeyPreview && <span className="text-xs text-secondary">(salvo: {apiKeyPreview})</span>}</label>
              <input
                className="field__input"
                type="password"
                value={form['ia.atendimento.apiKey'] || ''}
                onChange={(e) => upd('ia.atendimento.apiKey', e.target.value)}
                placeholder={apiKeyPreview ? 'Deixe vazio pra manter a chave atual' : 'sk-... ou sk-ant-...'}
              />
              <p className="field__hint">A chave fica criptografada no servidor — só os 4 últimos dígitos são exibidos.</p>
            </div>
          </div>
        </div>

        {/* Tom de comunicação */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="card__title" style={{ marginBottom: 12 }}>Tom de comunicação</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {TONS.map((tom) => {
              const selected = tomSelecionado === tom.id;
              return (
                <button
                  key={tom.id}
                  type="button"
                  onClick={() => upd('ia.atendimento.tom', tom.id)}
                  style={{
                    background: selected ? 'rgba(96,165,250,0.12)' : 'var(--bg-elevated)',
                    border: selected ? '2px solid var(--blue-500)' : '2px solid transparent',
                    borderRadius: 10,
                    padding: 14,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 200ms',
                  }}
                >
                  <Icon name={tom.icon} size={18} style={{ marginBottom: 6, color: selected ? 'var(--blue-500)' : 'var(--text-secondary)' }} />
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{tom.label}</div>
                  <div className="text-xs text-secondary" style={{ marginTop: 2 }}>{tom.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Descrição do comportamento */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="card__title" style={{ marginBottom: 6 }}>Descrição do comportamento</h3>
          <p className="text-sm text-secondary" style={{ marginBottom: 10 }}>
            Descreva como o agente deve se comportar durante a conversa. Quanto mais detalhe, melhor o tom da resposta.
          </p>
          <textarea
            className="field__textarea"
            rows={5}
            value={form['ia.atendimento.descricao'] || ''}
            onChange={(e) => upd('ia.atendimento.descricao', e.target.value)}
            placeholder="Ex.: Você é uma especialista em imóveis no litoral catarinense. Foca em qualificar o lead — entender perfil de uso (moradia, veraneio, investimento), orçamento e prazo. Quando o cliente demonstrar interesse forte, encaminhe pra corretor humano."
            style={{ width: '100%', fontFamily: 'inherit' }}
          />
        </div>

        {/* Instruções de resposta */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="card__title" style={{ marginBottom: 6 }}>Instruções de resposta</h3>
          <p className="text-sm text-secondary" style={{ marginBottom: 10 }}>
            Regras específicas sobre como o agente deve responder (uma por linha).
          </p>
          <textarea
            className="field__textarea"
            rows={6}
            value={form['ia.atendimento.instrucoes'] || ''}
            onChange={(e) => upd('ia.atendimento.instrucoes', e.target.value)}
            placeholder={`Sempre responda em português brasileiro
Seja objetivo (máximo 3-4 linhas)
Use emojis com moderação
Nunca prometa preços sem confirmar
Se não souber, diga que vai consultar o corretor responsável`}
            style={{ width: '100%', fontFamily: 'inherit' }}
          />
        </div>

        {/* Base de conhecimento */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="card__title" style={{ marginBottom: 6 }}>Base de conhecimento</h3>
          <p className="text-sm text-secondary" style={{ marginBottom: 10 }}>
            Conteúdo sobre Pons, empreendimentos, valores, política de venda — tudo que o agente precisa pra responder bem.
          </p>
          <textarea
            className="field__textarea"
            rows={12}
            value={form['ia.atendimento.baseConhecimento'] || ''}
            onChange={(e) => upd('ia.atendimento.baseConhecimento', e.target.value)}
            placeholder={`Sobre o Grupo Pons:
- Imobiliária com atuação em SC (Itapema, Balneário, Itajaí, Bombinhas)
- 30+ anos no mercado, 50+ empreendimentos lançados
- Especializado em residencial de alto padrão na orla

Empreendimentos em destaque:
- Palm Beach Residence (Itapema, R$ 850k a 2.4M, 2-3 dorms, vista mar)
- Park View (Balneário Camboriú, R$ 1.2M a 3.8M, 3-4 suítes)
- (...)

Política comercial:
- Reserva mediante sinal de R$ 5.000 reembolsável em 30 dias
- Entrada típica 20%, saldo financiado em até 60 meses
- Aceita FGTS na entrada
- Visitas: agendar com corretor — preferencialmente sábado de manhã`}
            style={{ width: '100%', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn--primary" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar configuração'}
          </button>
        </div>
      </PageWrap>
    </>
  );
}
