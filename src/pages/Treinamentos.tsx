import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Auth } from '../lib/auth';
import { TREINAMENTOS, type Treino } from '../data/treinamentos';

import './treinamentos.css';

// Converte um link de YouTube/Vimeo (inclui Shorts) em URL de embed.
function embedUrl(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|shorts\/|[?&]v=)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&playsinline=1&autoplay=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return url;
}

function ytThumb(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|shorts\/|[?&]v=)([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

function capa(t: Treino): string | undefined {
  if (t.thumb) return t.thumb;
  if (t.url) return ytThumb(t.url) || undefined;
  return undefined;
}

function isShort(url?: string): boolean {
  return !!url && /shorts\//.test(url);
}

export default function Treinamentos() {
  const [ativo, setAtivo] = useState<Treino | null>(null);
  const navigate = useNavigate();
  const logado = !!Auth.token;
  // Cadastro aberto ainda aguardando liberação de um Analista: aqui é o único
  // lugar que ele acessa. Troca o CTA "voltar ao sistema" (que só o devolveria
  // pra cá) por Sair, e mostra que o acesso está em análise.
  const pendente = Auth.user?.statusCadastro === 'AGUARDANDO_APROVACAO';
  const sair = () => { Auth.clear(); navigate('/login', { replace: true }); };

  const destaque = useMemo(() => TREINAMENTOS.find((t) => t.destaque) || TREINAMENTOS[0], []);
  const lista = useMemo(() => TREINAMENTOS.filter((t) => t.id !== destaque?.id), [destaque]);
  const total = TREINAMENTOS.length;

  const abrir = (t?: Treino | null) => {
    if (!t || !t.url) return;
    setAtivo(t);
  };

  // Fecha o player com ESC + trava o scroll do fundo enquanto aberto.
  useEffect(() => {
    if (!ativo) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAtivo(null);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [ativo]);

  return (
    <div className="trn-page">
      {/* ---------- HERO CINEMATOGRÁFICO ---------- */}
      <section className="trn-top">
        <div className="trn-top__bg" aria-hidden />
        <div className="trn-top__veil" aria-hidden />

        <div className="trn-top__bar">
          <img className="trn-top__logo" src="/assets/home/grupopons_logo.png" alt="Grupo Pons" />
          {pendente ? (
            <button className="trn-top__cta" onClick={sair}>
              Sair
              <Icon name="arrow_right" size={15} />
            </button>
          ) : (
            <Link className="trn-top__cta" to={logado ? '/dashboard' : '/login'}>
              {logado ? 'Voltar ao sistema' : 'Entrar no sistema'}
              <Icon name="arrow_right" size={15} />
            </Link>
          )}
        </div>

        {pendente && (
          <div className="trn-pendente-aviso" role="status">
            <Icon name="clock" size={15} />
            <span>Seu cadastro foi recebido e está <b>em análise</b>. Enquanto isso, aproveite as aulas da Academia Pons.</span>
          </div>
        )}

        <div className="trn-hero">
          <div className="trn-hero__left">
            <span className="trn-hero__eyebrow">Academia Pons</span>
            <h1 className="trn-hero__title">Alta performance<br />começa aqui</h1>
            <p className="trn-hero__sub">
              Treinamentos gravados pela liderança do Grupo Pons sobre mentalidade, atendimento e o
              jeito Pons de correr na frente. Assista no seu ritmo, direto pelo app.
            </p>
            <div className="trn-stats">
              <div className="trn-stat"><b>{total}</b><span>treinamentos</span></div>
              <div className="trn-stat"><b>Grupo Pons</b><span>conteúdo oficial</span></div>
              <div className="trn-stat"><b>24h</b><span>no seu ritmo</span></div>
            </div>
            {destaque && (
              <button className="trn-cyan-btn" onClick={() => abrir(destaque)} disabled={!destaque.url}>
                <Icon name="play" size={15} />
                {destaque.url ? 'Assistir agora' : 'Em breve'}
              </button>
            )}
          </div>

          {destaque && (
            <button
              className={'trn-feature' + (destaque.url ? '' : ' trn-feature--soon')}
              onClick={() => abrir(destaque)}
              disabled={!destaque.url}
            >
              <div
                className="trn-feature__thumb"
                style={capa(destaque) ? { backgroundImage: `url(${capa(destaque)})` } : {}}
              >
                <span className="trn-feature__play"><Icon name="play" size={26} /></span>
                {!destaque.url && <span className="trn-soon">Em breve</span>}
              </div>
              <div className="trn-feature__body">
                <span className="trn-tag">Em destaque</span>
                <h3 className="trn-feature__title">{destaque.titulo}</h3>
                <span className="trn-feature__by"><Icon name="crown" size={13} /> Grupo Pons</span>
              </div>
            </button>
          )}
        </div>
      </section>

      {/* ---------- GRADE ---------- */}
      <div className="trn-page__inner">
        <div className="trn-grid-head">
          <div>
            <span className="trn-grid-head__eyebrow">Box de treinamentos</span>
            <h2 className="trn-grid-head__title">Todos os vídeos</h2>
          </div>
          <span className="trn-grid-head__count">{lista.length} {lista.length === 1 ? 'vídeo' : 'vídeos'}</span>
        </div>

        <div className="trn-grid">
          {lista.map((t) => (
            <button
              className={'trn-card' + (t.url ? '' : ' trn-card--soon')}
              key={t.id}
              onClick={() => abrir(t)}
              disabled={!t.url}
            >
              <div
                className="trn-card__thumb"
                style={capa(t) ? { backgroundImage: `url(${capa(t)})` } : {}}
              >
                <span className="trn-card__play"><Icon name="play" size={17} /></span>
                {!t.url && <span className="trn-soon">Em breve</span>}
              </div>
              <div className="trn-card__body">
                <h4 className="trn-card__title">{t.titulo}</h4>
                <span className="trn-card__by"><Icon name="crown" size={12} /> Grupo Pons</span>
              </div>
            </button>
          ))}
        </div>

        <footer className="trn-footer">
          <img src="/assets/home/grupopons_logo.png" alt="Grupo Pons" />
          <span>Academia Pons · Grupo Pons Imobiliário</span>
        </footer>
      </div>

      {/* ---------- PLAYER (lightbox imersivo) ---------- */}
      {ativo && ativo.url && (
        <div className="trn-lightbox" onClick={() => setAtivo(null)}>
          <button className="trn-lightbox__close" onClick={() => setAtivo(null)}>
            <Icon name="x" size={18} /> Fechar
          </button>
          <div className="trn-lightbox__inner" onClick={(e) => e.stopPropagation()}>
            <div className={'trn-frame' + (isShort(ativo.url) ? ' trn-frame--portrait' : '')}>
              <iframe
                src={embedUrl(ativo.url) || ''}
                title={ativo.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="trn-lightbox__meta">
              <span className="trn-lightbox__eyebrow">Academia Pons</span>
              <h3>{ativo.titulo}</h3>
              <span className="trn-lightbox__by"><Icon name="crown" size={13} /> Grupo Pons</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
