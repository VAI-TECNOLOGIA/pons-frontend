# Propriedade e Continuidade — Sistema Grupo Pons (frontend + aplicativo)

## De quem é este sistema
Este repositório e todo o seu código pertencem ao **Grupo Pons — GP Pons Imobiliário (CNPJ 05.198.406/0001-44)**, conforme o Termo de Aceite **VAI-AC-2026-081** (24/05/2026) e o Documento de Entrega **ENT-GPI-2026-0923**.
A **VAI Tecnologia Ltda** desenvolveu o sistema e presta a sustentação (correções, atualizações, monitoramento). O Grupo Pons pode, a qualquer momento, **revogar o acesso da VAI** em *Settings → Collaborators* e seguir com outro fornecedor — o código está documentado para isso.

## O que tem aqui
- **Sistema web** (React + Vite + TypeScript): todas as telas do CRM/ERP — comercial, marketing, financeiro, pessoas, IA, governança.
- **Aplicativo Android e iOS** (Capacitor, modo servidor): a pasta `android/` e `ios/` embalam o sistema web para as lojas.
  Android: `br.com.grupopons.sistema` (Google Play) · iOS: `br.com.grupopons.vai` (App Store).

## Onde roda em produção
| Parte | Onde | Observação |
|---|---|---|
| Sistema web | Vercel · **app.grupopons.com.br** | publica sozinho a cada push na branch `main` |
| API e rotinas | Railway (repositório `pons-backend`) | ver o `PROPRIEDADE-E-CONTINUIDADE.md` de lá |
| Notificações no celular | Firebase (projeto `pons-75376`) | push Android e iOS |

## Como rodar localmente
```bash
npm install
npm run dev          # abre em http://localhost:5173, apontando para a API configurada em .env (ver .env.example se existir)
npm run build        # gera a pasta dist/ (é o que a Vercel publica)
```

## Como publicar
- **Mudança no sistema web:** `git push` na `main` → a Vercel publica em ~1 min. Aumente a versão em `public/versao.json` para o app avisar "Nova versão" e recarregar.
- **Mudança nativa** (permissão, plugin, ícone, splash): precisa de **binário novo** nas lojas — `npx cap sync android|ios`, aumentar `versionCode`/`CFBundleVersion`, gerar AAB (Android) / archive (Xcode) e enviar pela Play Console / App Store Connect.

## Documentação
- Manuais em PDF com telas reais (Corretor, Gestor, Marketing, Financeiro, Diretor Comercial) e o Manual completo do sistema — entregues ao Grupo Pons na pasta do projeto.
- `README.md` deste repositório · `PROPRIEDADE-E-CONTINUIDADE.md` e `DEPLOYMENT_CHECKLIST.md` do `pons-backend`.

## Cofre de continuidade (guardado pelo Grupo Pons — NÃO fica no repositório)
Itens que o representante do Grupo Pons deve guardar em local seguro; sem eles não é possível publicar versões novas do aplicativo:
- **Keystore de assinatura Android** (`.jks`) + senhas + `android/key.properties` — *perder = nunca mais atualizar o app na Play*.
- **Chave APNs** (`.p8`), Team ID e certificados de distribuição da Apple.
- `google-services.json` (Android) e `GoogleService-Info.plist` (iOS) do projeto Firebase.
- Acessos: Google Play Console, Apple Developer / App Store Connect, Firebase, Vercel, domínio/DNS.

## Sustentação
VAI Tecnologia Ltda · contato@vaitecnologia.com.br · www.vaitecnologia.com.br — Proposta de Sustentação PROP-2026-287.
