// Configuração do Agente IA — layout split estilo "criador de agente"
// (inspiração: print enviado pelo cliente, similar a Manus AI / Chatwoot Bot).
//
// Estrutura:
//   header        — breadcrumb · título "Novo Agente" · botão Salvar
//   sidebar       — avatar bot · nome · provider select · menu (Instruções/Integrações/MCP)
//   main          — aba ativa
//     Instruções  — Comportamento (tom + descrição) + Instruções de resposta + Base
//     Integrações — Provider + API key + Modelo
//     MCP         — placeholder (em breve)

import { useEffect, useState } from 'react';
import { Topbar } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { Icon } from '../components/Icon';
import './agente-ia.css';

type Tab = 'instrucoes' | 'integracoes' | 'mcp';

const TONS: Array<{ id: 'formal' | 'equilibrado' | 'descontraido' | 'criativo'; label: string; sub: string; icon: string }> = [
  { id: 'formal',       label: 'Formal',       sub: 'Direto, preciso e profissional.', icon: 'shield' },
  { id: 'equilibrado',  label: 'Equilibrado',  sub: 'Neutro, claro e acessível.',      icon: 'check' },
  { id: 'descontraido', label: 'Descontraído', sub: 'Leve, amigável e próximo.',       icon: 'sparkles' },
  { id: 'criativo',     label: 'Criativo',     sub: 'Expressivo e com personalidade.', icon: 'lightbulb' },
];

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic Claude', model: 'claude-haiku-4-5-20251001' },
  { id: 'openai',    label: 'OpenAI GPT-4',     model: 'gpt-4o-mini' },
];

export default function AgenteIA() {
  const { data, loading, reload } = useApi<Record<string, string>>(() => Api.agenteIaConfig());
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('instrucoes');

  useEffect(() => {
    if (data && Object.keys(form).length === 0) {
      setForm({
        'ia.atendimento.provider':         data['ia.atendimento.provider'] || 'anthropic',
        'ia.atendimento.apiKey':           '',
        'ia.atendimento.model':            data['ia.atendimento.model'] || 'claude-haiku-4-5-20251001',
        'ia.atendimento.tom':              data['ia.atendimento.tom'] || 'equilibrado',
        'ia.atendimento.descricao':        data['ia.atendimento.descricao'] || '',
        'ia.atendimento.instrucoes':       data['ia.atendimento.instrucoes'] || '',
        'ia.atendimento.baseConhecimento': data['ia.atendimento.baseConhecimento'] || '',
        'ia.atendimento.nome':             data['ia.atendimento.nome'] || 'Pons IA',
      });
    }
  }, [data, form]);

  if (loading) return <LoadingBlock />;

  const upd = (campo: string, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));
  const apiKeyPreview = data?.['ia.atendimento.apiKey'] || '';

  const salvar = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload['ia.atendimento.apiKey']) delete payload['ia.atendimento.apiKey'];
      await Api.agenteIaSave(payload);
      toast.success('Configuração salva');
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  const nome = form['ia.atendimento.nome'] || 'Novo Agente';
  const tomSelecionado = form['ia.atendimento.tom'] || 'equilibrado';
  const providerAtual = form['ia.atendimento.provider'] || 'anthropic';
  const providerLabel = PROVIDERS.find((p) => p.id === providerAtual)?.label || 'Selecione';

  return (
    <>
      <Topbar title="Agentes IA" />
      <div className="agente">
        {/* Breadcrumb + ações no topo */}
        <div className="agente__topbar">
          <a className="agente__crumb" href="/agente-ia">
            <Icon name="arrow_left" size={14} /> Agentes IA
          </a>
          <div className="agente__topbar-right">
            <button className="agente__save-btn" onClick={salvar} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Body em split */}
        <div className="agente__body">
          {/* Coluna esquerda — perfil + menu */}
          <aside className="agente__side">
            <div className="agente__avatar-wrap">
              <div className="agente__avatar">
                <Icon name="bot" size={42} />
              </div>
              <button className="agente__avatar-cam" title="Trocar avatar" aria-label="Trocar avatar">
                <Icon name="search" size={12} />
              </button>
            </div>
            <input
              className="agente__name"
              value={nome}
              onChange={(e) => upd('ia.atendimento.nome', e.target.value)}
              placeholder="Novo Agente"
            />
            <div className="agente__name-sub">
              {form['ia.atendimento.descricao']?.slice(0, 40) || 'Sem descrição'}
            </div>

            <div className="agente__provider-pill">
              <Icon name="bot" size={14} />
              <span>{providerLabel}</span>
              <Icon name="arrow_down" size={12} className="agente__provider-arrow" />
            </div>

            <nav className="agente__menu">
              <button
                className={'agente__menu-item' + (tab === 'instrucoes' ? ' is-active' : '')}
                onClick={() => setTab('instrucoes')}
              >
                <Icon name="doc" size={16} /> Instruções
              </button>
              <button
                className={'agente__menu-item' + (tab === 'integracoes' ? ' is-active' : '')}
                onClick={() => setTab('integracoes')}
              >
                <Icon name="link" size={16} /> Integrações
              </button>
              <button
                className={'agente__menu-item' + (tab === 'mcp' ? ' is-active' : '')}
                onClick={() => setTab('mcp')}
              >
                <Icon name="settings" size={16} /> MCP
              </button>
            </nav>
          </aside>

          {/* Coluna direita — header + conteúdo */}
          <main className="agente__main">
            <header className="agente__head">
              <h1 className="agente__title">{nome}</h1>
              <p className="agente__subtitle">Configure seu novo agente de IA</p>
            </header>

            {tab === 'instrucoes' && (
              <>
                {/* Comportamento */}
                <section className="agente__section">
                  <h2 className="agente__sec-title">Comportamento</h2>
                  <p className="agente__sec-sub">Personalize o tom de comunicação do agente.</p>

                  <div className="agente__field-label">Tom de comunicação</div>
                  <div className="agente__tons">
                    {TONS.map((tom) => {
                      const selected = tomSelecionado === tom.id;
                      return (
                        <button
                          key={tom.id}
                          type="button"
                          onClick={() => upd('ia.atendimento.tom', tom.id)}
                          className={'agente__tom' + (selected ? ' is-active' : '')}
                        >
                          <Icon name={tom.icon} size={16} />
                          <div className="agente__tom-name">{tom.label}</div>
                          <div className="agente__tom-sub">{tom.sub}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="agente__field-label" style={{ marginTop: 24 }}>
                    Descrição do comportamento
                  </div>
                  <div className="agente__textarea-wrap">
                    <textarea
                      className="agente__textarea"
                      rows={6}
                      value={form['ia.atendimento.descricao'] || ''}
                      onChange={(e) => upd('ia.atendimento.descricao', e.target.value)}
                      placeholder="Descreva como o agente deve se comportar durante a conversa."
                    />
                    <div className="agente__textarea-footer">
                      <button className="agente__ai-btn" type="button" title="Em breve — gera descrição com IA" disabled>
                        <Icon name="sparkles" size={12} /> Gerar com IA
                      </button>
                      <span className="agente__char-count">
                        {(form['ia.atendimento.descricao'] || '').length}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Instruções de Resposta */}
                <section className="agente__section">
                  <h2 className="agente__sec-title">Instruções de Resposta</h2>
                  <p className="agente__sec-sub">Regras específicas sobre como o agente deve responder.</p>
                  <div className="agente__textarea-wrap">
                    <textarea
                      className="agente__textarea"
                      rows={8}
                      value={form['ia.atendimento.instrucoes'] || ''}
                      onChange={(e) => upd('ia.atendimento.instrucoes', e.target.value)}
                      placeholder={`Exemplo:
- Sempre responda em português
- Seja objetivo e claro
- Use emojis com moderação`}
                    />
                  </div>
                </section>

                {/* Base de Conhecimento */}
                <section className="agente__section">
                  <h2 className="agente__sec-title">Base de Conhecimento</h2>
                  <p className="agente__sec-sub">
                    Contexto sobre Pons, empreendimentos, valores e política comercial. Tudo que o agente precisa pra responder bem.
                  </p>
                  <div className="agente__textarea-wrap">
                    <textarea
                      className="agente__textarea"
                      rows={14}
                      value={form['ia.atendimento.baseConhecimento'] || ''}
                      onChange={(e) => upd('ia.atendimento.baseConhecimento', e.target.value)}
                      placeholder={`Sobre o Grupo Pons:
- Imobiliária com atuação em SC (Itapema, Balneário, Itajaí, Bombinhas)
- 30+ anos no mercado

Empreendimentos em destaque:
- Palm Beach Residence (Itapema, R$ 850k a 2.4M, 2-3 dorms)
- Park View (Balneário Camboriú, R$ 1.2M a 3.8M, 3-4 suítes)

Política comercial:
- Reserva mediante sinal de R$ 5.000 reembolsável em 30 dias
- Visitas: agendar com corretor, preferencialmente sábado de manhã`}
                    />
                  </div>
                </section>
              </>
            )}

            {tab === 'integracoes' && (
              <section className="agente__section">
                <h2 className="agente__sec-title">Integrações</h2>
                <p className="agente__sec-sub">Conecte o agente a um provedor de IA (LLM).</p>

                <div className="agente__field-label">Provider</div>
                <div className="agente__tons" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  {PROVIDERS.map((p) => {
                    const sel = providerAtual === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          upd('ia.atendimento.provider', p.id);
                          upd('ia.atendimento.model', p.model);
                        }}
                        className={'agente__tom' + (sel ? ' is-active' : '')}
                      >
                        <Icon name={p.id === 'anthropic' ? 'sparkles' : 'bot'} size={16} />
                        <div className="agente__tom-name">{p.label}</div>
                        <div className="agente__tom-sub">{p.model}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="agente__field-label" style={{ marginTop: 24 }}>
                  Modelo
                </div>
                <input
                  className="agente__input"
                  value={form['ia.atendimento.model'] || ''}
                  onChange={(e) => upd('ia.atendimento.model', e.target.value)}
                  placeholder={providerAtual === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini'}
                />

                <div className="agente__field-label" style={{ marginTop: 24 }}>
                  API Key
                  {apiKeyPreview && (
                    <span className="agente__field-hint"> · salvo: <code>{apiKeyPreview}</code></span>
                  )}
                </div>
                <input
                  className="agente__input"
                  type="password"
                  value={form['ia.atendimento.apiKey'] || ''}
                  onChange={(e) => upd('ia.atendimento.apiKey', e.target.value)}
                  placeholder={apiKeyPreview ? 'Deixe vazio pra manter a chave atual' : 'sk-... (OpenAI) ou sk-ant-... (Claude)'}
                />
                <p className="agente__hint">A chave fica criptografada — só os 4 últimos dígitos são exibidos.</p>
              </section>
            )}

            {tab === 'mcp' && (
              <section className="agente__section">
                <h2 className="agente__sec-title">MCP</h2>
                <p className="agente__sec-sub">Model Context Protocol — conectar tools externos ao agente.</p>
                <div className="agente__empty">
                  <Icon name="sparkles" size={32} />
                  <div>Em breve</div>
                  <p>Configuração de MCP servers + tools customizadas chega na próxima sprint.</p>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
