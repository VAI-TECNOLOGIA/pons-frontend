// Agente IA do Atendimento WhatsApp — configura o bot que responde leads em
// PENDENTE até o corretor aceitar. Roda durante as 3 primeiras respostas
// automáticas (limite configurável em Settings "ia.limiteRespostas").
//
// Layout split:
//   header        — breadcrumb · botão Salvar
//   sidebar       — avatar bot · nome · provider · menu (Instruções, Integrações)
//   main          — aba ativa
//     Instruções  — Tom + Descrição do comportamento + Instruções + Base de Conhecimento
//     Integrações — Provider (Anthropic/OpenAI) + Modelo + API Key

import { useEffect, useState } from 'react';
import { Topbar } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { Icon } from '../components/Icon';
import './agente-ia.css';

// 1 aba só — Integrações virou um dropdown na própria pill da sidebar.

const TONS: Array<{ id: 'formal' | 'equilibrado' | 'descontraido' | 'criativo'; label: string; sub: string; icon: string }> = [
  { id: 'formal',       label: 'Formal',       sub: 'Direto, preciso e profissional.', icon: 'shield' },
  { id: 'equilibrado',  label: 'Equilibrado',  sub: 'Neutro, claro e acessível.',      icon: 'check' },
  { id: 'descontraido', label: 'Descontraído', sub: 'Leve, amigável e próximo.',       icon: 'sparkles' },
  { id: 'criativo',     label: 'Criativo',     sub: 'Expressivo e com personalidade.', icon: 'lightbulb' },
];

type ProviderOpt = { id: string; label: string; model: string; provider: 'anthropic' | 'openai' };

const PROVIDER_OPTIONS: ProviderOpt[] = [
  { id: 'claude-opus-4-7',        label: 'Anthropic · Claude Opus 4.7',   model: 'claude-opus-4-7',           provider: 'anthropic' },
  { id: 'claude-sonnet-4-6',      label: 'Anthropic · Claude Sonnet 4.6', model: 'claude-sonnet-4-6',         provider: 'anthropic' },
  { id: 'claude-haiku-4-5',       label: 'Anthropic · Claude Haiku 4.5',  model: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
  { id: 'gpt-4o',                 label: 'OpenAI · GPT-4o',               model: 'gpt-4o',                    provider: 'openai' },
  { id: 'gpt-4o-mini',            label: 'OpenAI · GPT-4o mini',          model: 'gpt-4o-mini',               provider: 'openai' },
];

export default function AgenteIA() {
  const { data, loading, reload } = useApi<Record<string, string>>(() => Api.agenteIaConfig());
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [editandoKey, setEditandoKey] = useState(false);

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
  const modeloAtual = form['ia.atendimento.model'] || '';
  const selecionado = PROVIDER_OPTIONS.find((p) => p.model === modeloAtual);
  const labelAtual = selecionado?.label || 'Selecione um modelo';

  function escolherModelo(opt: ProviderOpt) {
    upd('ia.atendimento.provider', opt.provider);
    upd('ia.atendimento.model', opt.model);
    setProviderDropdownOpen(false);
    // Se ainda não tem chave salva pra esse provider, abre o campo de chave
    if (!apiKeyPreview) setEditandoKey(true);
  }

  function confirmarKey() {
    const k = (form['ia.atendimento.apiKey'] || '').trim();
    if (!k) {
      toast.info('Cola a API key antes de confirmar.');
      return;
    }
    // Salva agora pra "confirmar" o campo
    Api.agenteIaSave({
      'ia.atendimento.provider': form['ia.atendimento.provider'],
      'ia.atendimento.model':    form['ia.atendimento.model'],
      'ia.atendimento.apiKey':   k,
    })
      .then(() => {
        toast.success('API key confirmada');
        setEditandoKey(false);
        // Limpa o input pra não mostrar a chave plain
        setForm((f) => ({ ...f, 'ia.atendimento.apiKey': '' }));
        reload();
      })
      .catch((e) => toast.error('Erro: ' + (e?.message || 'falha')));
  }

  return (
    <>
      <Topbar title="Agente IA · Atendimento WhatsApp" />
      <div className="agente">
        {/* Breadcrumb + ações no topo */}
        <div className="agente__topbar">
          <a className="agente__crumb" href="/agente-ia">
            <Icon name="arrow_left" size={14} /> Agente IA · WhatsApp
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
              Atendimento WhatsApp · Pendente
            </div>
            <div className="agente__name-tag">
              <Icon name="whatsapp" size={11} /> WhatsApp Cloud Meta
            </div>

            {/* Provider Pill — clica pra abrir dropdown de modelos */}
            <div className="agente__pill-wrap">
              <button
                type="button"
                className="agente__provider-pill"
                onClick={() => setProviderDropdownOpen((v) => !v)}
              >
                <Icon name="bot" size={14} />
                <span>{labelAtual}</span>
                <Icon name="arrow_down" size={12} className={'agente__provider-arrow' + (providerDropdownOpen ? ' is-open' : '')} />
              </button>
              {providerDropdownOpen && (
                <div className="agente__provider-dropdown" onMouseLeave={() => setProviderDropdownOpen(false)}>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => escolherModelo(opt)}
                      className={'agente__provider-option' + (selecionado?.id === opt.id ? ' is-selected' : '')}
                    >
                      <Icon name={opt.provider === 'anthropic' ? 'sparkles' : 'bot'} size={14} />
                      <span>{opt.label}</span>
                      {selecionado?.id === opt.id && <Icon name="check" size={14} className="agente__provider-check" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Campo de API key inline. Some quando key está confirmada,
                volta a aparecer ao clicar em "Trocar chave". */}
            {modeloAtual && (
              <div className="agente__key-area">
                {!editandoKey && apiKeyPreview ? (
                  <div className="agente__key-confirmed">
                    <Icon name="check" size={13} />
                    <span>Chave salva: <code>{apiKeyPreview}</code></span>
                    <button
                      type="button"
                      className="agente__key-edit-btn"
                      onClick={() => setEditandoKey(true)}
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="password"
                      className="agente__key-input"
                      value={form['ia.atendimento.apiKey'] || ''}
                      onChange={(e) => upd('ia.atendimento.apiKey', e.target.value)}
                      placeholder={selecionado?.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                      autoFocus
                    />
                    <div className="agente__key-actions">
                      {apiKeyPreview && (
                        <button
                          type="button"
                          className="agente__key-cancel"
                          onClick={() => {
                            setEditandoKey(false);
                            upd('ia.atendimento.apiKey', '');
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="button"
                        className="agente__key-confirm"
                        onClick={confirmarKey}
                      >
                        Confirmar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

          </aside>

          {/* Coluna direita — header + conteúdo */}
          <main className="agente__main">
            <div className="agente__channel-banner">
              <Icon name="whatsapp" size={18} />
              <div>
                <b>Canal: WhatsApp Cloud API (Meta)</b>
                <span> · este agente responde leads na aba Atendimento &rsaquo; Pendente. Quando o corretor clica em <i>Aceitar</i>, a IA para automaticamente.</span>
              </div>
            </div>

            <header className="agente__head">
              <h1 className="agente__title">{nome}</h1>
              <p className="agente__subtitle">
                Configure o agente que responde leads no WhatsApp enquanto o corretor não aceita o atendimento.
                Limite padrão: <b>3 respostas automáticas</b> por lead. Depois, a conversa fica esperando humano.
              </p>
            </header>

            {/* Conteúdo único — Instruções (Comportamento + Resposta + Base) */}
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


          </main>
        </div>
      </div>
    </>
  );
}
