import { useState, useRef } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useUser } from '../lib/userContext';
import { useToast } from '../lib/toast';
import { formatRole } from '../lib/auth';
import { InsightsList } from '../components/InsightsList';
import { ScorePanel } from '../components/ScorePanel';
import { MinhasBMs } from '../components/MinhasBMs';
import { PreferenciasCard } from '../components/PreferenciasCard';
import { DeleteAccountCard } from '../components/DeleteAccountCard';

import './perfil.css';

export default function Perfil() {
  const { user, setUser, reload } = useUser();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [openSenha, setOpenSenha] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(user?.avatarUrl || null);

  if (!user) return null;

  const dataNascValue = user.dataNascimento
    ? new Date(user.dataNascimento).toISOString().slice(0, 10)
    : '';

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error('Imagem maior que 2MB. Reduza antes de enviar.');
      return;
    }
    if (!f.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem.');
      return;
    }
    // Por enquanto: data URL inline (será trocado por upload no Cloudflare R2 em breve)
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
      toast.info('Foto carregada. Clique em Salvar para aplicar.');
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const u: any = await Api.meUpdate({
        name: String(fd.get('name') || ''),
        phone: fd.get('phone') ? String(fd.get('phone')) : null,
        dataNascimento: fd.get('dataNascimento') ? String(fd.get('dataNascimento')) : null,
        avatarUrl: avatar,
        ...(user.corretor ? { creci: fd.get('creci') ? String(fd.get('creci')) : null } : {}),
      });
      setUser({ ...user, ...u });
      await reload();
      toast.success('Perfil atualizado');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  const submitSenha = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const senhaAtual = String(fd.get('senhaAtual') || '');
    const novaSenha = String(fd.get('novaSenha') || '');
    const confirmar = String(fd.get('confirmar') || '');
    if (novaSenha !== confirmar) {
      toast.error('Confirmação não confere com a nova senha');
      return;
    }
    if (novaSenha.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    try {
      await Api.mePassword(senhaAtual, novaSenha);
      toast.success('Senha alterada com sucesso');
      setOpenSenha(false);
    } catch (err: any) {
      const m =
        err.message === 'senha_atual_incorreta'
          ? 'Senha atual incorreta'
          : 'Erro: ' + (err.message || 'falha');
      toast.error(m);
    }
  };

  return (
    <>
      <Topbar title="Meu perfil" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Conta"
          title="Meu perfil"
          subtitle="Atualize seus dados pessoais, foto e senha"
        />

        <div className="perfil-grid">
          <form className="card perfil-card" onSubmit={submit}>
            <div className="perfil-foto">
              <label htmlFor="perfil-file-input" className="perfil-foto__avatar" style={{ cursor: 'pointer' }} title="Clique para trocar a foto">
                {avatar ? (
                  <img src={avatar} alt={user.name} />
                ) : (
                  <span>{user.initials || '?'}</span>
                )}
              </label>
              <div className="perfil-foto__actions">
                <label htmlFor="perfil-file-input" className="btn btn--secondary btn--sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="pencil" size={14} /> Alterar foto
                </label>
                {avatar && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setAvatar(null)}
                  >
                    Remover
                  </button>
                )}
                <input
                  ref={fileRef}
                  id="perfil-file-input"
                  type="file"
                  accept="image/*"
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  onChange={onFileChange}
                />
                <div className="perfil-foto__hint">
                  PNG ou JPG até 2MB. Upload para Cloudflare R2 disponível em breve.
                </div>
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 20 }}>
              <div className="field field--span-2">
                <label className="field__label">Nome completo</label>
                <input name="name" className="field__input" defaultValue={user.name} required />
              </div>
              <div className="field">
                <label className="field__label">E-mail</label>
                <input className="field__input" value={user.email || ''} disabled />
                <div className="field__hint">Contato com o admin pra trocar</div>
              </div>
              <div className="field">
                <label className="field__label">Telefone</label>
                <input
                  name="phone"
                  className="field__input"
                  defaultValue={user.phone || ''}
                  placeholder="(48) 99999-0000"
                />
              </div>
              <div className="field">
                <label className="field__label">Data de nascimento</label>
                <input
                  name="dataNascimento"
                  type="date"
                  className="field__input"
                  defaultValue={dataNascValue}
                />
                <div className="field__hint">Opcional — usamos só pra te desejar parabéns</div>
              </div>
              <div className="field">
                <label className="field__label">Cargo</label>
                <input className="field__input" value={formatRole(user.role)} disabled />
              </div>
              {user.corretor && (
                <div className="field">
                  <label className="field__label">CRECI</label>
                  <input
                    name="creci"
                    className="field__input"
                    defaultValue={user.corretor?.creci || ''}
                    placeholder="Ex.: 12345-F ou 12345/SC"
                    maxLength={30}
                  />
                  <div className="field__hint">Seu registro no CRECI — necessário pra contratos e protocolos</div>
                </div>
              )}
            </div>

            <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="btn btn--secondary" onClick={() => setOpenSenha(true)}>
                <Icon name="lock" size={14} /> Mudar senha
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>

        {user.role === 'CORRETOR' && user.corretor && (
          <>
            <ScorePanel
              corretorId={user.corretor.id}
              scoreAtual={(user.corretor as any).scoreAtual}
              scoreMes={(user.corretor as any).scoreMes}
              scoreAno={(user.corretor as any).scoreAno}
            />
            {typeof (user.corretor as any).leadsChamadosFora === 'number' && (
              <div className="card" style={{ marginTop: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon name="phone" size={20} style={{ color: 'var(--blue-500)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Leads chamados externamente</div>
                  <div className="text-xs text-secondary">Contatos que você liberou pra ligar/abordar fora da plataforma</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--blue-500)' }}>
                  {(user.corretor as any).leadsChamadosFora}
                </div>
              </div>
            )}
            <MinhasBMs />
            <InsightsList />
          </>
        )}
        <PreferenciasCard />
        <DeleteAccountCard />
      </div>

      <Modal
        open={openSenha}
        onClose={() => setOpenSenha(false)}
        title="Alterar senha"
        subtitle="Defina uma nova senha de pelo menos 6 caracteres"
        size="sm"
      >
        <form onSubmit={submitSenha}>
          <div className="form-grid form-grid--single">
            <div className="field">
              <label className="field__label">
                Senha atual <span className="field__required">*</span>
              </label>
              <input name="senhaAtual" type="password" className="field__input" required />
            </div>
            <div className="field">
              <label className="field__label">
                Nova senha <span className="field__required">*</span>
              </label>
              <input
                name="novaSenha"
                type="password"
                className="field__input"
                required
                minLength={6}
              />
            </div>
            <div className="field">
              <label className="field__label">
                Confirmar nova senha <span className="field__required">*</span>
              </label>
              <input
                name="confirmar"
                type="password"
                className="field__input"
                required
                minLength={6}
              />
            </div>
          </div>
          <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn--secondary" onClick={() => setOpenSenha(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary">
              Salvar nova senha
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
