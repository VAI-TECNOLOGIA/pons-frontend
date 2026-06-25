// Feature flags. Mantenha as flags simples (booleans) — sem complicar com env vars
// até realmente precisar. Quando der pra ligar uma feature, é só trocar pra true.

// Integração Google Calendar — desligada enquanto o app OAuth tá aguardando
// verificação do Google. Quando aprovado, trocar pra `true` aqui e tudo
// (UI de conectar, sync de eventos, CTAs) volta automaticamente.
export const GOOGLE_CALENDAR_ENABLED = true;
