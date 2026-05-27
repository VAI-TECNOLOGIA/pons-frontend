# pons-frontend

Frontend do **VAI Sistema — Grupo Pons** (CRM + ERP + Financeiro).

- React 18 + Vite + TypeScript
- React Router 6
- Chart.js
- Deploy: [Vercel](https://vercel.com) — projeto `pons-frontend`

## Rodar local

```bash
npm install
npm run dev
# Frontend em http://localhost:5173
# /api/* é proxiado pelo Vite ou pelo Vercel (em prod) pro backend Railway.
```

## Variáveis de ambiente

Em dev local, o frontend chama `/api/*` que vai pro mesmo host (Vite dev server tem proxy embutido pra `localhost:3030`).

Em produção (Vercel), o `vercel.json` faz rewrite `/api/*` → URL pública do backend Railway.

Pra forçar URL absoluta (ex.: build standalone, app nativo via Capacitor):
```
VITE_API_BASE_URL=https://web-production-e420b.up.railway.app
```

## Deploy

Vercel auto-deploy a cada push em `main`. Rewrite + SPA fallback em `vercel.json`.

## Backend

Backend está em outro repo: [pons-backend](https://github.com/VAI-TECNOLOGIA/pons-backend).
