// Área de Agentes IA — duas abas:
//   · Atendimento WhatsApp   — bot que responde leads PENDENTE até o corretor aceitar.
//   · Resumidor de Reuniões  — perfil do agente que transcreve/resume reuniões (Settings ia.reuniao.*).
// As duas abas usam EXATAMENTE o mesmo formulário (tom, descrição, instruções,
// base de conhecimento, provider/modelo/API key), só mudam as Settings de destino.

import { useEffect, useState } from 'react';
import { Topbar } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { Icon } from '../components/Icon';
import './agente-ia.css';

const TONS: Array<{ id: 'formal' | 'equilibrado' | 'descontraido' | 'criativo'; label: string; sub: string; icon: string }> = [
  { id: 'formal',       label: 'Formal',       sub: 'Direto, preciso e profissional.', icon: 'shield' },
  { id: 'equilibrado',  label: 'Equilibrado',  sub: 'Neutro, claro e acessível.',      icon: 'check' },
  { id: 'descontraido', label: 'Descontraído', sub: 'Leve, amigável e próximo.',       icon: 'sparkles' },
  { id: 'criativo',     label: 'Criativo',     sub: 'Expressivo e com personalidade.', icon: 'lightbulb' },
];

type ProviderOpt = { id: string; label: string; model: string; provider: 'anthropic' | 'openai' };

const PROVIDER_OPTIONS: ProviderOpt[] = [
  { id: 'claude-opus-4-7',   label: 'Anthropic · Claude Opus 4.7',   model: 'claude-opus-4-7',           provider: 'anthropic' },
  { id: 'claude-sonnet-4-6', label: 'Anthropic · Claude Sonnet 4.6', model: 'claude-sonnet-4-6',         provider: 'anthropic' },
  { id: 'claude-haiku-4-5',  label: 'Anthropic · Claude Haiku 4.5',  model: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
  { id: 'gpt-4o',            label: 'OpenAI · GPT-4o',               model: 'gpt-4o',                    provider: 'openai' },
  { id: 'gpt-4o-mini',       label: 'OpenAI · GPT-4o mini',          model: 'gpt-4o-mini',               provider: 'openai' },
];

type Variant = 'atendimento' | 'reuniao';

type VariantCfg = {
  prefix: string;
  load: () => Promise<Record<string, string>>;
  save: (data: Record<string, string>) => Promise<{ ok: boolean }>;
  // Provedores disponíveis no dropdown. Reunião usa só OpenAI: a transcrição
  // depende do Whisper, que não tem equivalente na Anthropic.
  allowedProviders: Array<'anthropic' | 'openai'>;
  defaultProvider: 'anthropic' | 'openai';
  defaultModel: string;
  defaultNome: string;
  nameSub: string;
  nameTag: { icon: string; label: string };
  avatarIcon: string;
  banner: { icon: string; titulo: string; texto: string };
  subtitle: string;
};

const VARIANTS: Record<Variant, VariantCfg> = {
  atendimento: {
    prefix: 'ia.atendimento',
    load: Api.agenteIaConfig,
    save: Api.agenteIaSave,
    allowedProviders: ['anthropic', 'openai'],
    defaultProvider: 'anthropic',
    defaultModel: 'claude-haiku-4-5-20251001',
    defaultNome: 'Pons IA',
    nameSub: 'Atendimento WhatsApp · Pendente',
    nameTag: { icon: 'whatsapp', label: 'WhatsApp Cloud Meta' },
    avatarIcon: 'bot',
    banner: {
      icon: 'whatsapp',
      titulo: 'Canal: WhatsApp Cloud API (Meta)',
      texto: ' · este agente responde leads na aba Atendimento › Pendente. Quando o corretor clica em Aceitar, a IA para automaticamente.',
    },
    subtitle:
      'Configure o agente que responde leads no WhatsApp enquanto o corretor não aceita o atendimento. Limite padrão: 3 respostas automáticas por lead.',
  },
  reuniao: {
    prefix: 'ia.reuniao',
    load: Api.agenteReuniaoConfig,
    save: Api.agenteReuniaoSave,
    allowedProviders: ['openai'],
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultNome: 'Resumidor de Reuniões',
    nameSub: 'Reuniões · Transcrição + Resumo',
    nameTag: { icon: 'sparkles', label: 'Whisper + LLM' },
    avatarIcon: 'bot',
    banner: {
      icon: 'video',
      titulo: 'Canal: Reuniões (upload de .mp4)',
      texto: ' · este perfil define o tom e as regras com que a IA resume as reuniões enviadas na seção Reunião. A API key é usada para transcrever (Whisper) e resumir.',
    },
    subtitle:
      'Configure como a IA deve transcrever e resumir as reuniões. O modelo e a API key abaixo são usados na seção Reunião ao processar cada arquivo enviado.',
  },
};

export default function AgenteIA() {
  const [aba, setAba] = useState<Variant>('atendimento');
  return (
    <>
      <Topbar title="Agentes IA" />
      <div className="agente">
        <div className="agente__tabs">
          <button
            className={'agente__tab' + (aba === 'atendimento' ? ' is-active' : '')}
            onClick={() => setAba('atendimento')}
          >
            <Icon name="whatsapp" size={15} /> Atendimento WhatsApp
          </button>
          <button
            className={'agente__tab' + (aba === 'reuniao' ? ' is-active' : '')}
            onClick={() => setAba('reuniao')}
          >
            <Icon name="video" size={15} /> Resumidor de Reuniões
          </button>
        </div>
        <AgenteConfig key={aba} variant={aba} />
      </div>
    </>
  );
}

function AgenteConfig({ variant }: { variant: Variant }) {
  const v = VARIANTS[variant];
  const k = (campo: string) => `${v.prefix}.${campo}`;
  const providerOptions = PROVIDER_OPTIONS.filter((p) => v.allowedProviders.includes(p.provider));
  const { data, loading, reload } = useApi<Record<string, string>>(() => v.load());
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [editandoKey, setEditandoKey] = useState(false);

  useEffect(() => {
    if (data && Object.keys(form).length === 0) {
      setForm({
        [k('provider')]:         data[k('provider')] || v.defaultProvider,
        [k('apiKey')]:           '',
        [k('model')]:            data[k('model')] || v.defaultModel,
        [k('tom')]:              data[k('tom')] || 'equilibrado',
        [k('descricao')]:        data[k('descricao')] || '',
        [k('instrucoes')]:       data[k('instrucoes')] || '',
        [k('baseConhecimento')]: data[k('baseConhecimento')] || '',
        [k('nome')]:             data[k('nome')] || v.defaultNome,
      });
    }
  }, [data, form]);

  if (loading) return <LoadingBlock />;

  const upd = (campo: string, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));
  const apiKeyPreview = data?.[k('apiKey')] || '';

  const salvar = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload[k('apiKey')]) delete payload[k('apiKey')];
      await v.save(payload);
      toast.success('Configuração salva');
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  const nome = form[k('nome')] || v.defaultNome;
  const tomSelecionado = form[k('tom')] || 'equilibrado';
  const modeloAtual = form[k('model')] || '';
  const selecionado = PROVIDER_OPTIONS.find((p) => p.model === modeloAtual);
  const labelAtual = selecionado?.label || 'Selecione um modelo';

  function escolherModelo(opt: ProviderOpt) {
    upd(k('provider'), opt.provider);
    upd(k('model'), opt.model);
    setProviderDropdownOpen(false);
    if (!apiKeyPreview) setEditandoKey(true);
  }

  function confirmarKey() {
    const key = (form[k('apiKey')] || '').trim();
    if (!key) {
      toast.info('Cola a API key antes de confirmar.');
      return;
    }
    v.save({
      [k('provider')]: form[k('provider')],
      [k('model')]:    form[k('model')],
      [k('apiKey')]:   key,
    })
      .then(() => {
        toast.success('API key confirmada');
        setEditandoKey(false);
        setForm((f) => ({ ...f, [k('apiKey')]: '' }));
        reload();
      })
      .catch((e) => toast.error('Erro: ' + (e?.message || 'falha')));
  }

  return (
    <>
      <div className="agente__topbar">
        <span className="agente__crumb">
          <Icon name={v.nameTag.icon} size={14} /> {v.defaultNome}
        </span>
        <div className="agente__topbar-right">
          <button className="agente__save-btn" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="agente__body">
        <aside className="agente__side">
          <div className="agente__avatar-wrap">
            <div className="agente__avatar">
              <Icon name={v.avatarIcon} size={42} />
            </div>
          </div>
          <input
            className="agente__name"
            value={nome}
            onChange={(e) => upd(k('nome'), e.target.value)}
            placeholder={v.defaultNome}
          />
          <div className="agente__name-sub">{v.nameSub}</div>
          <div className="agente__name-tag">
            <Icon name={v.nameTag.icon} size={11} /> {v.nameTag.label}
          </div>

          <div className="agente__pill-wrap">
            <button
              type="button"
              className="agente__provider-pill"
              onClick={() => setProviderDropdownOpen((s) => !s)}
            >
              <Icon name="bot" size={14} />
              <span>{labelAtual}</span>
              <Icon name="arrow_down" size={12} className={'agente__provider-arrow' + (providerDropdownOpen ? ' is-open' : '')} />
            </button>
            {providerDropdownOpen && (
              <div className="agente__provider-dropdown" onMouseLeave={() => setProviderDropdownOpen(false)}>
                {providerOptions.map((opt) => (
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

          {modeloAtual && (
            <div className="agente__key-area">
              {!editandoKey && apiKeyPreview ? (
                <div className="agente__key-confirmed">
                  <Icon name="check" size={13} />
                  <span>Chave salva: <code>{apiKeyPreview}</code></span>
                  <button type="button" className="agente__key-edit-btn" onClick={() => setEditandoKey(true)}>
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="password"
                    className="agente__key-input"
                    value={form[k('apiKey')] || ''}
                    onChange={(e) => upd(k('apiKey'), e.target.value)}
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
                          upd(k('apiKey'), '');
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                    <button type="button" className="agente__key-confirm" onClick={confirmarKey}>
                      Confirmar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>

        <main className="agente__main">
          <div className="agente__channel-banner">
            <Icon name={v.banner.icon} size={18} />
            <div>
              <b>{v.banner.titulo}</b>
              <span>{v.banner.texto}</span>
            </div>
          </div>

          <header className="agente__head">
            <h1 className="agente__title">{nome}</h1>
            <p className="agente__subtitle">{v.subtitle}</p>
          </header>

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
                    onClick={() => upd(k('tom'), tom.id)}
                    className={'agente__tom' + (selected ? ' is-active' : '')}
                  >
                    <Icon name={tom.icon} size={16} />
                    <div className="agente__tom-name">{tom.label}</div>
                    <div className="agente__tom-sub">{tom.sub}</div>
                  </button>
                );
              })}
            </div>

            <div className="agente__field-label" style={{ marginTop: 24 }}>Descrição do comportamento</div>
            <div className="agente__textarea-wrap">
              <textarea
                className="agente__textarea"
                rows={6}
                value={form[k('descricao')] || ''}
                onChange={(e) => upd(k('descricao'), e.target.value)}
                placeholder="Descreva como o agente deve se comportar."
              />
              <div className="agente__textarea-footer">
                <button className="agente__ai-btn" type="button" title="Em breve" disabled>
                  <Icon name="sparkles" size={12} /> Gerar com IA
                </button>
                <span className="agente__char-count">{(form[k('descricao')] || '').length}</span>
              </div>
            </div>
          </section>

          <section className="agente__section">
            <h2 className="agente__sec-title">Instruções</h2>
            <p className="agente__sec-sub">Regras específicas para o agente seguir.</p>
            <div className="agente__textarea-wrap">
              <textarea
                className="agente__textarea"
                rows={8}
                value={form[k('instrucoes')] || ''}
                onChange={(e) => upd(k('instrucoes'), e.target.value)}
                placeholder={`Exemplo:
- Sempre responda em português
- Seja objetivo e claro`}
              />
            </div>
          </section>

          <section className="agente__section">
            <h2 className="agente__sec-title">Base de Conhecimento</h2>
            <p className="agente__sec-sub">
              Contexto sobre Pons, empreendimentos, valores e política comercial — tudo que o agente precisa pra responder bem.
            </p>
            <div className="agente__textarea-wrap">
              <textarea
                className="agente__textarea"
                rows={14}
                value={form[k('baseConhecimento')] || ''}
                onChange={(e) => upd(k('baseConhecimento'), e.target.value)}
                placeholder="Contexto sobre o Grupo Pons, produtos e política comercial."
              />
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
