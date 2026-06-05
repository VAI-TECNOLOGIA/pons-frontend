import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { timeAgo } from '../lib/format';

import './formularios.css';

// Mapeamento de origem → plataforma visual + ícone + cor + nome amigável + dica de configuração
type SourceMeta = {
  match: RegExp;          // padrões pra casar com a coluna `origem`
  label: string;
  icon: string;
  bgVar: string;
  fgVar: string;
  setup: React.ReactNode;
  docs?: string;
};

const SOURCES: SourceMeta[] = [
  {
    match: /META_ADS|META|FACEBOOK_LEAD|FB/i,
    label: 'Meta Lead Ads',
    icon: 'facebook',
    bgVar: 'var(--src-meta-bg)',
    fgVar: 'var(--src-meta-fg)',
    setup: (
      <>
        No <strong>Meta Business Manager</strong> → Centro de Anúncios → Formulários
        instantâneos → Configurações de CRM → Webhook. Cole o endpoint abaixo + token. Já existe
        integração nativa (suporta o payload <code>field_data</code> do Meta sem Zapier).
      </>
    ),
    docs: 'https://www.facebook.com/business/help/908902042493104',
  },
  {
    match: /INSTAGRAM|IG_ADS|IG_LEAD/i,
    label: 'Instagram Lead Ads',
    icon: 'instagram',
    bgVar: 'var(--src-instagram-bg)',
    fgVar: 'var(--src-instagram-fg)',
    setup: (
      <>
        Mesmo fluxo do Meta — formulários de IG criados via Ads Manager ficam visíveis
        em Centro de Anúncios → Formulários instantâneos. Aponte o webhook deles pra cá.
      </>
    ),
    docs: 'https://business.instagram.com/help',
  },
  {
    match: /GOOGLE|GOOGLE_ADS|GOOGLE_LEAD|GADS/i,
    label: 'Google Ads / Lead Form',
    icon: 'google',
    bgVar: 'var(--blue-50)',
    fgVar: 'var(--blue-700)',
    setup: (
      <>
        Em <strong>Google Ads</strong> → Ferramentas → Configuração → Lead Form Extensions →
        Webhook URL. Use o endpoint + token. Campos UTM (<code>utm_source/medium/campaign</code>)
        chegam automaticamente.
      </>
    ),
    docs: 'https://support.google.com/google-ads/answer/9347963',
  },
  {
    match: /WHATSAPP|WA/i,
    label: 'WhatsApp (Meta Cloud)',
    icon: 'whatsapp',
    bgVar: 'var(--color-success-bg)',
    fgVar: 'var(--color-success-fg)',
    setup: (
      <>
        Mensagens recebidas pelo número conectado entram como lead novo automaticamente
        (configurado em <Link to="/configuracoes?secao=integracoes" style={{ color: 'var(--text-link)' }}>Configurações → Integrações</Link>).
        Não usa esse webhook — usa o do Meta Cloud em <code>/api/webhooks/meta-whatsapp</code>.
      </>
    ),
  },
  {
    match: /SITE|LANDING|FORM|RD_STATION|ELEMENTOR/i,
    label: 'Site / Landing pages',
    icon: 'globe',
    bgVar: 'var(--src-site-bg)',
    fgVar: 'var(--src-site-fg)',
    setup: (
      <>
        Faça <code>POST</code> direto do seu formulário (Elementor, WPForms, RD Station,
        Webflow, etc.) com JSON. Plugue o webhook no destino do formulário. Origem registra
        como <code>SITE</code>.
      </>
    ),
  },
  {
    match: /INDICACAO|REFERRAL/i,
    label: 'Indicação',
    icon: 'users',
    bgVar: 'var(--bg-card-hover)',
    fgVar: 'var(--text-secondary)',
    setup: <>Cadastro manual feito pelos corretores em <Link to="/leads" style={{ color: 'var(--text-link)' }}>Leads</Link>.</>,
  },
  {
    match: /MANUAL/i,
    label: 'Manual',
    icon: 'users',
    bgVar: 'var(--bg-card-hover)',
    fgVar: 'var(--text-secondary)',
    setup: <>Lead criado direto pela equipe no botão "+ Novo lead" da página Leads.</>,
  },
];

const FALLBACK_META: SourceMeta = {
  match: /.*/,
  label: 'Outras origens',
  icon: 'link',
  bgVar: 'var(--bg-card-hover)',
  fgVar: 'var(--text-secondary)',
  setup: <>Qualquer fonte que use o endpoint abaixo sem mapeamento específico.</>,
};

function metaFor(origem: string): SourceMeta {
  return SOURCES.find((s) => s.match.test(origem)) || FALLBACK_META;
}

export default function Formularios() {
  const { data, loading, error, reload } = useApi(() => Api.leadsSourcesStats());
  const toast = useToast();
  const [testing, setTesting] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const tokenPreview = data?.tokenStatus?.preview || '';
  const webhookUrl = data?.tokenStatus?.configurado
    ? `${origin}/api/webhooks/lead?token=${tokenPreview.replace('…', '***')}`
    : `${origin}/api/webhooks/lead?token=COLE_O_TOKEN_AQUI`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado!');
    } catch {
      toast.error('Não consegui copiar — selecione manualmente.');
    }
  };

  const testarWebhook = async () => {
    setTesting(true);
    try {
      const r: any = await Api.leadsTestWebhook('TESTE');
      if (r?.error) {
        toast.error('Falhou: ' + r.error);
      } else if (r?.leadId) {
        toast.success(`Lead #${r.leadId} criado${r.distribuido ? ` · roleta atribuiu p/ ${r.corretor}` : ''}.`);
        reload();
      } else {
        toast.info('Webhook respondeu mas sem lead criado.');
      }
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <Topbar
        title="Formulários & Webhooks"
        right={
          <>
            <Link to="/leads" className="btn btn--ghost btn--sm">Ver Leads</Link>
            <button className="btn btn--primary btn--sm" onClick={testarWebhook} disabled={testing}>
              <Icon name="zap" size={14} /> {testing ? 'Testando…' : 'Testar webhook'}
            </button>
          </>
        }
      />

      <div className="main__content">
        <PageHeader
          breadcrumb="Comercial · Integrações"
          title="Captura de Leads — formulários & webhooks"
          subtitle="Todo lead que chegar por estas URLs entra no sistema e cai na roleta automaticamente."
        />

        {loading && <LoadingBlock />}
        {error && <ErrorBlock error={error} label="Erro ao carregar estatísticas" />}
        {data && (
          <>
            {/* KPIs do topo */}
            <div className="kpi-grid mb-6">
              <div className="kpi">
                <div className="kpi__label">Total de leads</div>
                <div className="kpi__value">{data.total}</div>
                <div className="kpi__delta">
                  {data.ultimoLead
                    ? <>Último: {data.ultimoLead.nome.split(' ')[0]} · {timeAgo(data.ultimoLead.createdAt)}</>
                    : 'Nenhum lead ainda'}
                </div>
              </div>
              <div className="kpi">
                <div className="kpi__label">Token do webhook</div>
                <div className="kpi__value" style={{ fontSize: 16, fontFamily: 'var(--font-mono)' }}>
                  {data.tokenStatus.configurado ? data.tokenStatus.preview : '—'}
                </div>
                <div className="kpi__delta">
                  {data.tokenStatus.configurado ? (
                    <span style={{ color: 'var(--color-success-fg)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="circle" size={8} /> Configurado
                    </span>
                  ) : (
                    <Link to="/configuracoes?secao=integracoes" style={{ color: 'var(--color-danger-fg)' }}>
                      Configure o token →
                    </Link>
                  )}
                </div>
              </div>
              <div className="kpi">
                <div className="kpi__label">Origens ativas</div>
                <div className="kpi__value">{data.origens.length}</div>
                <div className="kpi__delta">canais com pelo menos 1 lead</div>
              </div>
            </div>

            <div className="grid-2-1" style={{ alignItems: 'flex-start' }}>
              <div className="flex-col gap-6">
                {/* Endpoint */}
                <div className="card">
                  <h3 className="card__title mb-2">Endpoint universal de captura</h3>
                  <p className="text-sm text-secondary mb-4">
                    Cole esta URL como destino de webhook em qualquer formulário. O token autentica a chamada.
                  </p>
                  <div className="code-box">
                    <button className="copy-btn" onClick={() => copy(`${origin}/api/webhooks/lead?token=${tokenPreview ? tokenPreview.replace('…', '***') : 'TOKEN'}`)}>copiar</button>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>POST {webhookUrl}</span>
                  </div>
                  {!data.tokenStatus.configurado && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 10,
                        borderRadius: 8,
                        background: 'var(--color-warning-bg)',
                        color: 'var(--color-warning-fg)',
                        fontSize: 12,
                      }}
                    >
                      <Icon name="warn" size={12} /> Token ainda não configurado.
                      Vá em <Link to="/configuracoes?secao=integracoes" style={{ color: 'inherit', textDecoration: 'underline' }}>Configurações → Integrações</Link> e gere um valor pra <code>webhook.token</code>.
                    </div>
                  )}
                </div>

                {/* Plataformas */}
                <div className="card">
                  <h3 className="card__title mb-4">Como vincular cada plataforma</h3>
                  {SOURCES.filter((s) => s.label !== 'Indicação' && s.label !== 'Manual').map((s) => (
                    <div className="src-card" key={s.label}>
                      <div
                        className="src-icon"
                        style={{
                          background: s.bgVar,
                          color: s.fgVar,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name={s.icon} size={20} />
                      </div>
                      <div>
                        <div className="font-bold" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {s.label}
                          {s.docs && (
                            <a
                              href={s.docs}
                              target="_blank"
                              rel="noopener"
                              title="Documentação oficial"
                              style={{ color: 'var(--text-link)', display: 'inline-flex' }}
                            >
                              <Icon name="external" size={11} />
                            </a>
                          )}
                        </div>
                        <div className="text-sm text-secondary">{s.setup}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Payload */}
                <div className="card">
                  <h3 className="card__title mb-2">Formato do payload (genérico)</h3>
                  <p className="text-sm text-secondary mb-3">
                    Campos mínimos: ao menos um de <strong>nome</strong>, <strong>telefone</strong> ou <strong>email</strong>.
                    O resto é opcional — quanto mais dados, melhor o rastreio e a roleta por origem/campanha.
                  </p>
                  <div className="code-box">
                    <button
                      className="copy-btn"
                      onClick={() =>
                        copy(`{
  "nome": "Maria Investidora",
  "telefone": "(48) 99999-0000",
  "email": "maria@email.com",
  "origem": "META_ADS",
  "campanha": "Park View Investidor",
  "criativo": "video-pordosol-01",
  "empreendimento": "park-view",
  "mensagem": "Quero saber valores"
}`)
                      }
                    >
                      copiar
                    </button>
                    <pre style={{ margin: 0, fontSize: 12 }}>
{`{
  "nome": "Maria Investidora",
  "telefone": "(48) 99999-0000",
  "email": "maria@email.com",
  "origem": "META_ADS",
  "campanha": "Park View Investidor",
  "criativo": "video-pordosol-01",
  "empreendimento": "park-view",
  "mensagem": "Quero saber valores"
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Status real das origens */}
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '20px 20px 12px' }}>
                  <h3 className="card__title">Status real das origens</h3>
                  <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
                    Origens com pelo menos 1 lead capturado. Dados em tempo real do banco.
                  </p>
                </div>
                {data.origens.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Nenhum lead capturado ainda.
                    <br />
                    <button className="btn btn--primary btn--sm" style={{ marginTop: 12 }} onClick={testarWebhook} disabled={testing}>
                      <Icon name="zap" size={12} /> Criar lead de teste
                    </button>
                  </div>
                ) : (
                  <div className="list">
                    {(data.origens ?? []).map((o) => {
                      const meta = metaFor(o.origem);
                      const ativo = o.ultimos30d > 0;
                      return (
                        <div className="list__item" key={o.origem}>
                          <div
                            className="avatar avatar--sm"
                            style={{
                              background: meta.bgVar,
                              color: meta.fgVar,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon name={meta.icon} size={14} />
                          </div>
                          <div className="list__main">
                            <div className="list__title">
                              {meta.label}{' '}
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
                                · {o.origem}
                              </span>
                            </div>
                            <div className="list__meta">
                              {o.total} total · {o.ultimos30d} nos últimos 30d
                              {o.ultimoEm ? ` · último ${timeAgo(o.ultimoEm)}` : ''}
                            </div>
                          </div>
                          <span className={'badge ' + (ativo ? 'badge--signed' : 'badge--neutral')}>
                            {ativo ? 'ATIVO' : 'INATIVO'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
