// Campo de CNPJ com consulta automática na Receita ao completar 14 dígitos.
// Mostra razão social + situação cadastral (ATIVA verde; BAIXADA/etc. vermelho)
// e devolve o CnpjInfo pro form auto-preencher via onInfo. Com permitirCpf,
// aceita CPF (11 dígitos) sem consultar — consulta só quando virar CNPJ.
import { useRef, useState } from 'react';
import { consultaCnpj, formataCnpj, formataCpf, soDigitos, type CnpjInfo } from '../lib/consultaCnpj';

export function CampoCnpj({
  name,
  label = 'CNPJ',
  required = false,
  defaultValue = '',
  permitirCpf = false,
  onInfo,
}: {
  name: string;
  label?: string;
  required?: boolean;
  defaultValue?: string;
  permitirCpf?: boolean;
  onInfo?: (info: CnpjInfo) => void;
}) {
  const [valor, setValor] = useState(defaultValue);
  const [st, setSt] = useState<'idle' | 'loading' | 'ok' | 'erro'>('idle');
  const [info, setInfo] = useState<CnpjInfo | null>(null);
  const [erro, setErro] = useState('');
  const ultimaConsulta = useRef('');

  const consultar = async (digits: string) => {
    if (digits === ultimaConsulta.current) return; // não repete a mesma consulta
    ultimaConsulta.current = digits;
    setSt('loading'); setErro(''); setInfo(null);
    try {
      const r = await consultaCnpj(digits);
      setInfo(r); setSt('ok');
      onInfo?.(r);
    } catch (e: any) {
      setSt('erro');
      setErro(e?.message || 'Falha na consulta');
    }
  };

  const onChange = (raw: string) => {
    const digits = soDigitos(raw).slice(0, 14);
    const mascarado = permitirCpf && digits.length <= 11 ? formataCpf(digits) : formataCnpj(digits);
    setValor(mascarado);
    if (digits.length === 14) consultar(digits);
    else { setSt('idle'); setInfo(null); setErro(''); ultimaConsulta.current = ''; }
  };

  const situacaoAtiva = info?.situacao?.toUpperCase() === 'ATIVA';

  return (
    <>
      <label className="field__label">{label}{required && <span className="field__required"> *</span>}</label>
      <input
        name={name}
        className="field__input"
        required={required}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={permitirCpf ? '000.000.000-00 ou 00.000.000/0000-00' : '00.000.000/0000-00'}
        inputMode="numeric"
        autoComplete="off"
      />
      {st === 'loading' && <div className="field__hint">Consultando a Receita…</div>}
      {st === 'erro' && <div className="field__hint" style={{ color: 'var(--color-danger)' }}>{erro}</div>}
      {st === 'ok' && info && (
        <div className="field__hint" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className={`badge ${situacaoAtiva ? 'badge--signed' : 'badge--cancelled'}`} style={{ fontSize: 10 }}>
            {info.situacao || '—'}
          </span>
          <strong>{info.razaoSocial}</strong>
          {info.municipio && <span>· {info.municipio}/{info.uf}</span>}
          {info.porte && <span>· {info.porte}</span>}
        </div>
      )}
    </>
  );
}
