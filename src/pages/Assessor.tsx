// Assessor no WhatsApp (pedido Elison 16-17/10): o sócio manda áudio ou texto para
// o número do assessor e o sistema agenda (agenda do sistema + Google), lembra no
// aplicativo, passa demanda para outra pessoa (com aviso no app dela), avisa os
// corretores (com SIM) e responde sobre vendas, ranking, agenda e contas a pagar.
// Esta tela: conectar o número (QR ou código), liberar quem usa e ver as conversas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { formatRole } from '../lib/auth';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { TextoWhatsapp } from '../components/TextoWhatsapp';

type Situacao = {
  configurado: boolean; instancia: string; servidor: string;
  conexao: { conectado: boolean; estado: string; numero: string; erro?: string };
  pessoas: { userId: number; nome: string; papel: string; telefone: string | null; liberado: boolean; telefoneLiberado: string | null }[];
};

const fone = (d?: string | null) => {
  const x = String(d || '').replace(/\D/g, '');
  const n = x.startsWith('55') ? x.slice(2) : x;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return d || '—';
};

const EXEMPLOS = [
  '"Amanhã às 15h reunião com a Kóra, me lembra meia hora antes."',
  '"Avisa o Márcio que ele precisa levar o contrato na sexta às 10h."',
  '"Quantas vendas fizemos este mês? Quem lidera o ranking?"',
  '"O que tenho hoje?" · "O que vence para pagar esta semana?"',
  '"Avisa todos os corretores que amanhã às 9h tem reunião." (pede SIM antes)',
];

export default function Assessor() {
  const [s, setS] = useState<Situacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [numeroCodigo, setNumeroCodigo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [conversas, setConversas] = useState<any[] | null>(null);
  // Testar pela tela: mesmo caminho do WhatsApp (as ações são de verdade, na sua agenda).
  const [teste, setTeste] = useState('');
  const [trocas, setTrocas] = useState<{ eu: string; assessor: string }[]>([]);
  const testar = async () => {
    const t = teste.trim();
    if (!t || busy === 'teste') return;
    setBusy('teste');
    try { const r = await Api.assessorTestar(t); setTrocas((x) => [...x, { eu: t, assessor: r.resposta }]); setTeste(''); }
    catch (e: any) { toast.error(e.message || 'Falha no teste'); }
    finally { setBusy(null); }
  };
  const toast = useToast();
  const confirmar = useConfirm();
  const vigia = useRef<number | null>(null);

  const carregar = useCallback(async () => {
    try { const r = await Api.assessorSituacao(); setS(r); setErro(null); return r; }
    catch (e: any) { setErro(e.message || 'Falha ao carregar'); return null; }
  }, []);
  useEffect(() => { carregar(); Api.assessorConversas().then(setConversas).catch(() => setConversas([])); }, [carregar]);
  // Enquanto o QR/código está na tela, confere a cada 4 s se conectou.
  useEffect(() => {
    if (!qr && !codigo) return;
    vigia.current = window.setInterval(async () => {
      const r = await carregar();
      if (r?.conexao.conectado) { setQr(null); setCodigo(null); toast.success('WhatsApp do assessor conectado.'); }
    }, 4000);
    return () => { if (vigia.current) window.clearInterval(vigia.current); };
  }, [qr, codigo, carregar, toast]);

  const conectar = async (porCodigo: boolean) => {
    setBusy('conectar');
    try {
      const r = await Api.assessorConectar(porCodigo ? numeroCodigo : undefined);
      if (porCodigo) { setCodigo(r.codigo || null); setQr(null); if (!r.codigo) toast.error('O servidor não devolveu o código. Tente o QR.'); }
      else { setQr(r.qr || null); setCodigo(null); if (!r.qr) toast.info('Sem QR: confira se já está conectado.'); }
    } catch (e: any) { toast.error(e.message || 'Falha ao conectar'); }
    finally { setBusy(null); }
  };
  const desconectar = async () => {
    const ok = await confirmar({ title: 'Desconectar o WhatsApp da Pons?', message: 'O assessor para no WhatsApp e o protocolo das vendas volta a sair pela API oficial (Meta) até conectar de novo.', confirmText: 'Desconectar', tone: 'danger' });
    if (!ok) return;
    setBusy('desconectar');
    try { await Api.assessorDesconectar(); await carregar(); toast.success('Desconectado.'); }
    catch (e: any) { toast.error(e.message || 'Falha'); }
    finally { setBusy(null); }
  };
  const liberar = async (p: Situacao['pessoas'][number]) => {
    setBusy(`p${p.userId}`);
    try {
      const r = await Api.assessorLiberar(p.userId);
      toast.success(r.boasVindas ? `${p.nome} liberado(a). A mensagem de boas-vindas chegou no WhatsApp.` : `${p.nome} liberado(a). A boas-vindas sai quando o WhatsApp do assessor estiver conectado.`);
      await carregar();
    } catch (e: any) { toast.error(e.message || 'Falha ao liberar'); }
    finally { setBusy(null); }
  };
  const remover = async (p: Situacao['pessoas'][number]) => {
    setBusy(`p${p.userId}`);
    try { await Api.assessorRemover(p.userId); await carregar(); toast.success(`${p.nome} não usa mais o assessor.`); }
    catch (e: any) { toast.error(e.message || 'Falha'); }
    finally { setBusy(null); }
  };

  const c = s?.conexao;
  return (
    <>
      <Topbar title="Assessor no WhatsApp" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Sistema"
          title="Assessor no WhatsApp"
          subtitle="O sócio manda áudio ou texto e o sistema agenda, lembra, passa demandas, avisa a equipe e responde sobre a operação"
        />
        {erro && <div className="card" style={{ color: 'var(--color-danger)' }}>{erro}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
          <section className="card">
            <h3 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="whatsapp" size={18} /> WhatsApp da Pons (QR Code)</h3>
            <p className="text-sm text-secondary" style={{ margin: '4px 0 0' }}>Este número também envia o protocolo das vendas (PDF com os documentos) ao Adm, sem depender da Meta.</p>
            {!s ? <div className="text-secondary">Carregando…</div> : !s.configurado ? (
              <p className="text-sm text-secondary">O servidor de WhatsApp ainda não foi configurado para a Pons. Fale com a VAI.</p>
            ) : (
              <>
                <div className="flex gap-2" style={{ alignItems: 'center', margin: '8px 0 12px' }}>
                  <span className={`badge badge--${c?.conectado ? 'signed' : 'cancelled'}`}>{c?.conectado ? 'Conectado' : c?.estado === 'connecting' ? 'Aguardando leitura' : 'Desconectado'}</span>
                  {c?.conectado && <strong>{fone(c.numero)}</strong>}
                </div>
                {c?.conectado ? (
                  <button className="btn btn--secondary btn--sm" disabled={busy === 'desconectar'} onClick={desconectar}>Desconectar</button>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <p className="text-sm text-secondary" style={{ margin: 0 }}>No celular do chip do assessor: WhatsApp → Aparelhos conectados → Conectar um aparelho.</p>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                      <button className="btn btn--primary btn--sm" disabled={busy === 'conectar'} onClick={() => conectar(false)}>{busy === 'conectar' ? 'Gerando…' : 'Gerar QR Code'}</button>
                    </div>
                    <div className="flex gap-2" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <label className="field" style={{ flex: '1 1 180px', margin: 0 }}>
                        <span className="field__label">Ou conectar com código (número do chip)</span>
                        <input className="field__input" inputMode="tel" value={numeroCodigo} onChange={(e) => setNumeroCodigo(e.target.value)} placeholder="(47) 99999-9999" style={{ fontSize: 16 }} />
                      </label>
                      <button className="btn btn--secondary btn--sm" disabled={busy === 'conectar' || numeroCodigo.replace(/\D/g, '').length < 10} onClick={() => conectar(true)}>Gerar código</button>
                    </div>
                    {qr && <img src={qr} alt="QR Code do WhatsApp do assessor" style={{ width: 260, height: 260, background: '#fff', padding: 8, borderRadius: 12 }} />}
                    {codigo && (
                      <div className="text-sm">No celular: "Conectar com número de telefone" e digite o código <strong style={{ fontSize: 20, letterSpacing: 2 }}>{codigo}</strong></div>
                    )}
                  </div>
                )}
                <p className="text-xs text-secondary" style={{ marginTop: 12, marginBottom: 0 }}>Mesma conexão do Encanta (servidor {s.servidor}, instância {s.instancia}). Use um chip só do assessor.</p>
              </>
            )}
          </section>

          <section className="card">
            <h3 className="card__title">O que dá para pedir</h3>
            <ul className="text-sm" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
              {EXEMPLOS.map((x) => <li key={x}>{x}</li>)}
            </ul>
            <p className="text-xs text-secondary" style={{ marginTop: 10 }}>
              Compromisso, lembrete e demanda são feitos na hora; a resposta traz o resumo e "DESFAZER" vale por 10 minutos.
              Aviso para os corretores só sai depois do SIM. Pagamentos: o assessor só informa, nunca paga nem aprova.
              Cada pessoa vê pelo WhatsApp só o que já vê no sistema.
            </p>
          </section>
        </div>

        <section className="card" style={{ marginTop: 16 }}>
          <h3 className="card__title" style={{ margin: 0 }}>Testar o assessor</h3>
          <p className="text-sm text-secondary" style={{ margin: '6px 0 10px' }}>Escreva como se fosse no WhatsApp. O que ele fizer vale de verdade (na sua agenda); responda DESFAZER para desfazer.</p>
          {trocas.length > 0 && (
            <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
              {trocas.map((t, i) => (
                <div key={i} style={{ display: 'grid', gap: 4 }}>
                  <div className="text-sm" style={{ justifySelf: 'end', background: 'var(--bg-card-hover)', borderRadius: 10, padding: '6px 10px', maxWidth: '85%' }}>{t.eu}</div>
                  <div className="text-sm" style={{ border: '1px solid var(--border-light)', borderRadius: 10, padding: '6px 10px', maxWidth: '85%', whiteSpace: 'pre-wrap' }}><TextoWhatsapp texto={t.assessor} /></div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2" style={{ alignItems: 'flex-end' }}>
            <textarea className="field__input" rows={2} value={teste} onChange={(e) => setTeste(e.target.value)} placeholder='Ex.: "Quantas vendas fizemos este mês?"' style={{ flex: 1, fontSize: 16, resize: 'vertical' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); testar(); } }} />
            <button className="btn btn--primary btn--sm" disabled={busy === 'teste' || !teste.trim()} onClick={testar}>{busy === 'teste' ? 'Pensando…' : 'Enviar'}</button>
          </div>
        </section>

        <section className="card" style={{ marginTop: 16, padding: 0 }}>
          <div style={{ padding: '14px 16px 4px' }}>
            <h3 className="card__title" style={{ margin: 0 }}>Quem usa o assessor</h3>
            <p className="text-sm text-secondary" style={{ margin: '6px 0 8px' }}>CEO, diretoria e sócios. O assessor só responde ao celular cadastrado no perfil de quem foi liberado.</p>
          </div>
          <table className="table">
            <thead><tr><th>Pessoa</th><th>Perfil</th><th>Celular</th><th style={{ width: 160 }}></th></tr></thead>
            <tbody>
              {(s?.pessoas || []).map((p) => (
                <tr key={p.userId}>
                  <td className="font-semibold">{p.nome}</td>
                  <td>{formatRole(p.papel)}</td>
                  <td>{p.liberado ? fone(p.telefoneLiberado) : p.telefone ? fone(p.telefone) : <span className="text-secondary">sem celular no perfil</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    {p.liberado
                      ? <button className="btn btn--ghost btn--sm" disabled={busy === `p${p.userId}`} onClick={() => remover(p)}>Remover</button>
                      : <button className="btn btn--secondary btn--sm" disabled={busy === `p${p.userId}` || !p.telefone} onClick={() => liberar(p)}>Liberar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h3 className="card__title">Últimas conversas</h3>
          {conversas === null ? <div className="text-secondary">Carregando…</div> : conversas.length === 0 ? <div className="text-secondary text-sm">Nenhuma conversa ainda.</div> : (
            <div style={{ display: 'grid', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
              {conversas.map((m) => (
                <div key={m.id} className="text-sm" style={{ padding: '6px 10px', borderRadius: 8, background: m.direcao === 'IN' ? 'var(--bg-card-hover)' : 'transparent', border: '1px solid var(--border-light)' }}>
                  <div className="text-xs text-secondary">{m.direcao === 'IN' ? (m.quem || 'Pessoa') : 'Assessor'}{m.tipo === 'audio' ? ' · áudio' : ''} · {new Date(m.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.texto}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
