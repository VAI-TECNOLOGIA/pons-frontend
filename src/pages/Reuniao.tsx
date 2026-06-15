// Reunião — upload de .mp4 → transcrição + resumo (processados no worker).
// Duas abas:
//   · Gravar      — envia um arquivo .mp4/áudio (gravação ao vivo pelo sistema fica pra depois).
//   · Ver resumos — lista das reuniões; abre o resumo + transcrição, renomeia, apaga.

import { useEffect, useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import './reuniao.css';

type Reuniao = {
  id: number;
  titulo: string;
  status: 'PROCESSANDO' | 'PRONTO' | 'ERRO';
  duracao: number | null;
  arquivoNome: string | null;
  mensagemErro: string | null;
  transcricao?: string | null;
  resumo?: string | null;
  createdAt: string;
};

const STATUS_META: Record<Reuniao['status'], { label: string; cls: string; icon: string }> = {
  PROCESSANDO: { label: 'Processando', cls: 'is-proc', icon: 'clock' },
  PRONTO:      { label: 'Pronto',      cls: 'is-ok',   icon: 'check' },
  ERRO:        { label: 'Erro',        cls: 'is-erro', icon: 'warn' },
};

const fmtData = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const fmtDur = (seg: number | null) => {
  if (!seg) return null;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}min ${String(s).padStart(2, '0')}s`;
};

export default function ReuniaoPage() {
  const [aba, setAba] = useState<'gravar' | 'resumos'>('gravar');
  const { data, loading, reload } = useApi<Reuniao[]>(() => Api.reunioes());
  const lista = data || [];

  // Poll enquanto houver reunião processando.
  useEffect(() => {
    if (!lista.some((r) => r.status === 'PROCESSANDO')) return;
    const t = setInterval(reload, 8000);
    return () => clearInterval(t);
  }, [lista, reload]);

  return (
    <>
      <Topbar title="Reunião" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Reunião"
          title="Reuniões"
          subtitle="Envie um arquivo de reunião e receba a transcrição e o resumo gerados pela IA."
        />

        <div className="reuniao__tabs">
          <button className={'reuniao__tab' + (aba === 'gravar' ? ' is-active' : '')} onClick={() => setAba('gravar')}>
            <Icon name="send" size={15} /> Enviar
          </button>
          <button className={'reuniao__tab' + (aba === 'resumos' ? ' is-active' : '')} onClick={() => setAba('resumos')}>
            <Icon name="scroll" size={15} /> Ver resumos
          </button>
        </div>

        {aba === 'gravar' ? (
          <GravarTab
            onEnviado={() => {
              reload();
              setAba('resumos');
            }}
          />
        ) : loading ? (
          <LoadingBlock />
        ) : (
          <ResumosTab lista={lista} reload={reload} />
        )}
      </div>
    </>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function GravarTab({ onEnviado }: { onEnviado: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isAudio = !!file && /audio|\.(mp3|m4a|wav)$/i.test(file.type || file.name);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const enviar = async () => {
    if (!file) {
      toast.info('Selecione um arquivo .mp4 primeiro.');
      return;
    }
    setEnviando(true);
    try {
      await Api.reuniaoUpload(file, titulo.trim());
      toast.success('Arquivo enviado! O resumo aparece em "Ver resumos" assim que ficar pronto.');
      setFile(null);
      setTitulo('');
      if (inputRef.current) inputRef.current.value = '';
      onEnviado();
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + (e?.message || 'falha'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="reuniao__gravar">
      <div className="reuniao__card reuniao__upload">
        <div className="reuniao__upload-icon"><Icon name="video" size={32} /></div>
        <h3>Enviar gravação</h3>
        <p>Selecione o arquivo de vídeo (.mp4) ou áudio da reunião. A IA transcreve e resume automaticamente.</p>

        <input
          className="reuniao__titulo-input"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título da reunião (opcional)"
          maxLength={120}
        />

        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*,.mp4,.mp3,.m4a,.wav"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          hidden
        />

        {!file ? (
          <div
            className={'reuniao__dropzone' + (dragOver ? ' is-drag' : '')}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="reuniao__dropzone-icon"><Icon name="arrow_up" size={22} /></div>
            <div className="reuniao__dropzone-main">Arraste o arquivo aqui ou <span>clique para escolher</span></div>
            <div className="reuniao__dropzone-hint">Vídeo (.mp4) ou áudio (.mp3, .m4a, .wav) · até 200&nbsp;MB</div>
          </div>
        ) : (
          <div className="reuniao__file-chip">
            <div className="reuniao__file-chip-icon"><Icon name={isAudio ? 'megafone' : 'video'} size={18} /></div>
            <div className="reuniao__file-chip-info">
              <div className="reuniao__file-chip-name" title={file.name}>{file.name}</div>
              <div className="reuniao__file-chip-meta">{formatBytes(file.size)} · {isAudio ? 'Áudio' : 'Vídeo'}</div>
            </div>
            <button
              type="button"
              className="reuniao__file-chip-del"
              onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ''; }}
              disabled={enviando}
              aria-label="Remover arquivo"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        )}

        <button className="reuniao__btn-primary" onClick={enviar} disabled={enviando || !file}>
          {enviando ? 'Enviando…' : <><Icon name="send" size={15} /> Enviar e gerar resumo</>}
        </button>
      </div>
    </div>
  );
}

function ResumosTab({ lista, reload }: { lista: Reuniao[]; reload: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<Reuniao | null>(null);
  const [carregandoDet, setCarregandoDet] = useState(false);
  const [editTitulo, setEditTitulo] = useState<string | null>(null);
  const [mostrarTranscricao, setMostrarTranscricao] = useState(false);

  const abrir = async (r: Reuniao) => {
    if (r.status !== 'PRONTO') return;
    setAbertoId(r.id);
    setMostrarTranscricao(false);
    setCarregandoDet(true);
    try {
      const det = await Api.reuniao(r.id);
      setDetalhe(det);
    } catch {
      toast.error('Falha ao carregar a reunião.');
    } finally {
      setCarregandoDet(false);
    }
  };

  const salvarTitulo = async (id: number) => {
    const t = (editTitulo || '').trim();
    if (!t) return;
    try {
      await Api.reuniaoRenomear(id, t);
      setEditTitulo(null);
      setDetalhe((d) => (d ? { ...d, titulo: t } : d));
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'falha'));
    }
  };

  const apagar = async (r: Reuniao) => {
    const ok = await confirm({
      title: 'Apagar reunião',
      message: `Apagar "${r.titulo}" e seu resumo? Isso não pode ser desfeito.`,
      confirmText: 'Apagar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await Api.reuniaoDelete(r.id);
      if (abertoId === r.id) { setAbertoId(null); setDetalhe(null); }
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'falha'));
    }
  };

  if (lista.length === 0) {
    return (
      <div className="reuniao__vazio">
        <Icon name="scroll" size={28} />
        <p>Nenhuma reunião ainda. Envie um arquivo na aba "Enviar".</p>
      </div>
    );
  }

  return (
    <div className="reuniao__lista">
      {lista.map((r) => {
        const meta = STATUS_META[r.status];
        const aberto = abertoId === r.id;
        return (
          <div key={r.id} className={'reuniao__item' + (aberto ? ' is-open' : '')}>
            <div className="reuniao__item-head">
              <button
                className="reuniao__item-main"
                onClick={() => (aberto ? setAbertoId(null) : abrir(r))}
                disabled={r.status !== 'PRONTO'}
              >
                <div className="reuniao__item-titulo">{r.titulo}</div>
                <div className="reuniao__item-meta">
                  {fmtData(r.createdAt)}
                  {fmtDur(r.duracao) ? ` · ${fmtDur(r.duracao)}` : ''}
                </div>
              </button>
              <span className={'reuniao__badge ' + meta.cls}>
                <Icon name={meta.icon} size={12} /> {meta.label}
              </span>
              <button className="reuniao__item-del" title="Apagar" onClick={() => apagar(r)}>
                <Icon name="trash" size={15} />
              </button>
            </div>

            {r.status === 'ERRO' && r.mensagemErro && (
              <div className="reuniao__item-erro">Falha: {r.mensagemErro}</div>
            )}

            {aberto && (
              <div className="reuniao__detalhe">
                {carregandoDet ? (
                  <LoadingBlock />
                ) : detalhe && detalhe.id === r.id ? (
                  <>
                    <div className="reuniao__det-titulo-row">
                      {editTitulo !== null ? (
                        <>
                          <input
                            className="reuniao__titulo-input"
                            value={editTitulo}
                            onChange={(e) => setEditTitulo(e.target.value)}
                            maxLength={120}
                            autoFocus
                          />
                          <button className="reuniao__btn-mini" onClick={() => salvarTitulo(r.id)}>Salvar</button>
                          <button className="reuniao__btn-mini ghost" onClick={() => setEditTitulo(null)}>Cancelar</button>
                        </>
                      ) : (
                        <button className="reuniao__btn-mini ghost" onClick={() => setEditTitulo(detalhe.titulo)}>
                          <Icon name="pencil" size={13} /> Renomear
                        </button>
                      )}
                    </div>

                    <h4 className="reuniao__det-sec">Resumo</h4>
                    <div className="reuniao__resumo">{detalhe.resumo || '—'}</div>

                    <button
                      className="reuniao__toggle-transc"
                      onClick={() => setMostrarTranscricao((s) => !s)}
                    >
                      <Icon name={mostrarTranscricao ? 'arrow_down' : 'arrow_right'} size={13} />
                      {mostrarTranscricao ? 'Ocultar transcrição' : 'Ver transcrição completa'}
                    </button>
                    {mostrarTranscricao && (
                      <div className="reuniao__transcricao">{detalhe.transcricao || '—'}</div>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
