// Mapeia códigos de erro do Meta WhatsApp Cloud API pra mensagens legíveis.
// Espelho do backend src/lib/meta-errors.js — manter os dois em sincronia.

type MetaErrKind =
  | 'invalid_recipient'
  | 'missing_param'
  | 'param_invalid'
  | 'reengagement'
  | 'spam'
  | 'quality'
  | 'unsupported_message'
  | 'media_download'
  | 'media_upload'
  | 'template_param'
  | 'template_missing'
  | 'template_lang'
  | 'template_paused'
  | 'template_format'
  | 'app_unavailable'
  | 'phone_unregistered'
  | 'unknown';

const META_ERRORS: Record<number, { kind: MetaErrKind; msg: string }> = {
  131000: { kind: 'invalid_recipient', msg: 'Número inválido — não tem WhatsApp.' },
  131008: { kind: 'missing_param', msg: 'Parâmetro do template ausente.' },
  131009: { kind: 'param_invalid', msg: 'Parâmetro do template inválido.' },
  131026: { kind: 'reengagement', msg: 'Cliente inativo há muito tempo — use template de reabertura.' },
  131047: { kind: 'reengagement', msg: 'Janela de 24h fechou. Use um template Meta pra reabrir a conversa.' },
  131049: { kind: 'spam', msg: 'Excesso de mensagens detectado pelo Meta. Aguarde antes de tentar de novo.' },
  131050: { kind: 'quality', msg: 'Bloqueio temporário do Meta por qualidade. Avise o admin.' },
  131051: { kind: 'unsupported_message', msg: 'Tipo de mensagem não suportado.' },
  131052: { kind: 'media_download', msg: 'Falha ao baixar mídia do cliente.' },
  131053: { kind: 'media_upload', msg: 'Falha ao subir mídia pro Meta.' },
  132000: { kind: 'template_param', msg: 'Template com parâmetros inválidos ou faltando.' },
  132001: { kind: 'template_missing', msg: 'Template não existe ou foi reprovado. Verifique no WhatsApp Manager.' },
  132005: { kind: 'template_lang', msg: 'Idioma do template incompatível.' },
  132007: { kind: 'template_paused', msg: 'Template pausado pelo Meta por baixa qualidade.' },
  132012: { kind: 'template_format', msg: 'Formato de variável do template inválido.' },
  133000: { kind: 'app_unavailable', msg: 'Indisponibilidade do Meta. Tente novamente em instantes.' },
  133010: { kind: 'phone_unregistered', msg: 'Número WhatsApp não está registrado na WABA.' },
};

export function humanizeMetaError(err: any): { code: number | null; kind: MetaErrKind; msg: string } {
  if (!err) return { code: null, kind: 'unknown', msg: 'Erro desconhecido.' };
  const code = Number(err.code ?? err.error?.code ?? err.error?.error?.code ?? 0);
  const known = META_ERRORS[code];
  if (known) return { code, ...known };
  const raw = err.message || err.error?.message || err.error?.error?.message || String(err);
  return { code, kind: 'unknown', msg: raw.length > 160 ? raw.slice(0, 160) + '…' : raw };
}

export function humanizeErrorReason(errorReason: string | null | undefined): string {
  if (!errorReason) return '';
  try {
    const obj = JSON.parse(errorReason);
    const h = humanizeMetaError(obj);
    return h.msg;
  } catch {
    if (errorReason.length > 160) return errorReason.slice(0, 160) + '…';
    return errorReason;
  }
}
