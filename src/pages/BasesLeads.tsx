import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

// Bases de Leads — categorias nomeadas ("Equipe Segunda Avenida", "Base de
// roleta"…) pra organizar e rastrear leads por unidade/equipe. Transferir um
// lead pra base NÃO muda o corretor: é etiqueta de origem/destino.
const CORES = ['#1258CA', '#0E9F6E', '#7C3AED', '#DC2626', '#D97706', '#0E7C9B', '#DB2777', '#52525B'];

export default function BasesLeads() {
  const { data: bases, loading, error, reload } = useApi<any[]>(() => Api.basesLead());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [cor, setCor] = useState(CORES[0]);
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();

  const abrirCriar = () => { setEditing(null); setCor(CORES[0]); setOpen(true); };
  const abrirEditar = (b: any) => { setEditing(b); setCor(b.cor || CORES[0]); setOpen(true); };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      nome: String(fd.get('nome') || '').trim(),
      descricao: String(fd.get('descricao') || '').trim() || null,
      cor,
    };
    if (!body.nome) { toast.error('Dê um nome pra base.'); return; }
    try {
      if (editing) await Api.baseLeadUpdate(editing.id, body);
      else await Api.baseLeadCreate(body);
      toast.success(editing ? 'Base atualizada.' : 'Base criada.');
      setOpen(false);
      reload();
    } catch (err: any) {
      toast.error(err?.message === 'nome_ja_existe' ? 'Já existe uma base com esse nome.' : 'Erro: ' + (err?.message || 'falha'));
    }
  };

  const excluir = async (b: any) => {
    const ok = await confirm({
      title: `Excluir a base "${b.nome}"?`,
      message: `Os ${b.totalLeads} lead(s) dela NÃO são apagados — só ficam sem base.`,
      confirmText: 'Excluir base',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await Api.baseLeadDelete(b.id);
      toast.success('Base excluída (leads preservados).');
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    }
  };

  if (loading) return <Shell onNew={abrirCriar}><LoadingBlock /></Shell>;
  if (error) return <Shell onNew={abrirCriar}><ErrorBlock error={error} /></Shell>;

  return (
    <Shell onNew={abrirCriar}>
      {(bases || []).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          Nenhuma base ainda. Crie a primeira — ex.: "Equipe Segunda Avenida", "Base de roleta".
        </div>
      ) : (
        <div className="grid-3">
          {(bases || []).map((b: any) => (
            <div className="card" key={b.id} style={{ position: 'relative', overflow: 'hidden' }}>
              <div className="racing-stripe" style={{ ['--team-color' as any]: b.cor }} />
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{b.nome}</div>
                  {b.descricao && <div className="text-xs text-secondary" style={{ marginTop: 2 }}>{b.descricao}</div>}
                </div>
                <span className="badge" style={{ background: `${b.cor}1a`, color: b.cor, fontWeight: 800 }}>{b.totalLeads} lead{b.totalLeads === 1 ? '' : 's'}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn btn--secondary btn--sm" onClick={() => nav(`/leads?base=${b.id}`)}>
                  <Icon name="users" size={12} /> Ver leads
                </button>
                <button className="btn btn--secondary btn--sm" onClick={() => abrirEditar(b)}>
                  <Icon name="pencil" size={12} /> Editar
                </button>
                <button className="btn btn--ghost btn--sm" style={{ color: 'var(--color-danger, #e5484d)' }} onClick={() => excluir(b)}>
                  <Icon name="trash" size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="field__hint" style={{ marginTop: 14 }}>
        Pra mover leads pra uma base: tela de Leads (ou Distribuição) → selecione os leads → "Transferir para" → aba <strong>Base</strong>. A base não muda o corretor do lead — é o rastro de a qual equipe/unidade ele pertence.
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Editar · ${editing.nome}` : 'Nova base de leads'}
        subtitle='Ex.: "Equipe Segunda Avenida", "Equipe Dallo", "Base de roleta"'
        size="sm"
      >
        <form onSubmit={submit}>
          <div className="field">
            <label className="field__label">Nome</label>
            <input name="nome" className="field__input" defaultValue={editing?.nome || ''} placeholder="Nome da base" required />
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label className="field__label">Descrição (opcional)</label>
            <input name="descricao" className="field__input" defaultValue={editing?.descricao || ''} placeholder="Pra que serve esta base" />
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label className="field__label">Cor</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: cor === c ? '3px solid var(--text-primary)' : '3px solid transparent', cursor: 'pointer' }}
                  title={c}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn--primary">{editing ? 'Salvar' : 'Criar base'}</button>
          </div>
        </form>
      </Modal>
    </Shell>
  );
}

function Shell({ children, onNew }: { children: React.ReactNode; onNew: () => void }) {
  return (
    <>
      <Topbar
        title="Bases de Leads"
        right={<button className="btn btn--primary btn--sm" onClick={onNew}>+ Nova base</button>}
      />
      <div className="main__content page-enter">
        <PageHeader
          breadcrumb="Marketing · Bases de Leads"
          title="Bases de Leads"
          subtitle="Organize os leads por unidade/equipe e saiba a origem e o destino de cada contato"
        />
        {children}
      </div>
    </>
  );
}
