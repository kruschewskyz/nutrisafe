# 🥗 NutriSafe

Aplicativo web (mobile-first) de nutrição com foco em **segurança e privacidade de dados de saúde**:
registro de refeições, calorias/macros/micros, metas automáticas (TMB), progresso com gráficos,
favoritos, sugestões simples e exportação/exclusão de dados (LGPD/GDPR).

> ⚠️ O NutriSafe fornece **estimativas** e não substitui orientação médica ou de nutricionista.
> É destinado a maiores de 18 anos (a API recusa perfis de menores).

---

## 1. Arquitetura

```
┌──────────────────────────┐        HTTPS         ┌────────────────────────────────┐        ┌────────────┐
│  Frontend (Vercel)       │  /api/* (rewrite →)  │  Backend (Railway / Render)    │  TLS   │ PostgreSQL │
│  React + TS + Tailwind   │ ───────────────────▶ │  Express 5 + TypeScript        │ ─────▶ │  (Prisma)  │
│  • access token: memória │ ◀─────────────────── │  Helmet · CORS · rate limit    │        └────────────┘
│  • refresh: cookie       │   JSON               │  CSRF guard · Zod · JWT · RBAC │
│    httpOnly (Strict)     │                      │  Argon2id · logs com redação   │
└──────────────────────────┘                      └────────────────────────────────┘
```

**Fluxo de autenticação**

1. `POST /api/auth/login` → resposta traz um **access token JWT (15 min)** no corpo e define o
   **refresh token opaco** num cookie `httpOnly; Secure; SameSite=Strict; Path=/api/auth`.
2. O frontend guarda o access token **só em memória** e o envia em `Authorization: Bearer …`.
3. Ao expirar (401), o cliente chama `POST /api/auth/refresh`. O servidor **rotaciona** o refresh token
   (o antigo é invalidado). Se um token já usado reaparecer (possível roubo), **toda a sessão é revogada**.
4. No banco só existe o **HMAC** dos refresh/reset tokens — um vazamento do banco não entrega sessões.

**Por que o refresh token é opaco (e não um segundo JWT)?** Tokens opacos guardados como hash podem ser
revogados e rotacionados com detecção de reuso, o que um JWT stateless não permite. O access token continua
JWT, como pedido.

**Por que Express (e não NestJS)?** Mantém o projeto pequeno e auditável. Os módulos
(`modules/<domínio>/{routes,service,schemas}`) seguem a mesma separação que o NestJS imporia, então a migração é simples.

**Por que Tailwind puro (e não shadcn/ui)?** Menos dependências de terceiros na superfície de ataque.
Os componentes (`card`, `btn`, `input`…) estão em `index.css` e são fáceis de trocar por shadcn depois.

## 2. Estrutura de pastas

```
nutrisafe/
├── docker-compose.yml            # PostgreSQL local
├── docs/
│   ├── API.md                    # endpoints + exemplos de request/response
│   └── SECURITY.md               # decisões, mapeamento OWASP Top 10 e checklist
├── backend/
│   ├── prisma/{schema.prisma, seed.ts}
│   └── src/
│       ├── server.ts · app.ts    # bootstrap e ordem dos middlewares
│       ├── config/env.ts         # validação das variáveis de ambiente (fail fast)
│       ├── lib/                  # prisma, logger (com redação), tokens, http/validação, sanitização, mailer
│       ├── middleware/           # security (helmet, cors, https, csrf, rate limit), auth (JWT, RBAC), errorHandler
│       └── modules/
│           ├── auth/             # registro, login, refresh, logout, recuperação de senha
│           ├── profile/          # perfil + metas (TMB/Mifflin-St Jeor)
│           ├── foods/            # busca e alimentos personalizados
│           ├── meals/            # CRUD de refeições
│           ├── favorites/        # CRUD de favoritos + registro em 1 clique
│           ├── dashboard/        # resumo do dia + sugestões
│           ├── progress/         # séries diárias/semanais/mensais + peso
│           ├── privacy/          # exportar e excluir dados (LGPD)
│           └── nutrition/        # cálculos puros (calc.ts, suggest.ts) + testes
└── frontend/
    ├── vercel.json               # rewrite /api + CSP e headers de segurança
    ├── public/theme-init.js
    └── src/
        ├── lib/{api,types,date,nutrition}.ts
        ├── context/{AuthContext,ThemeContext}.tsx
        ├── components/{Layout,ProtectedRoute,MacroBar,FoodPicker,MealEditor}.tsx
        └── pages/{Auth,Dashboard,Meals,Favorites,Progress,Profile}.tsx
```

## 3. Modelo de dados

Veja `backend/prisma/schema.prisma`. Resumo: `User` (1—1 `Profile`, 1—1 `DailyTarget`),
`Food` (pública quando `userId` é nulo, privada quando preenchido), `Meal`→`MealItem`→`Food`,
`FavoriteMeal`→`FavoriteMealItem`, `WeightLog`, `RefreshToken`, `PasswordResetToken`.
Todo dado do usuário tem `onDelete: Cascade` a partir de `User`.

## 4. Como rodar localmente

Pré-requisitos: Node.js ≥ 20.11, Docker (ou um PostgreSQL 14+).

```bash
# 1) Banco de dados
docker compose up -d

# 2) Backend
cd backend
cp .env.example .env            # gere os 2 segredos:  openssl rand -base64 64
npm install
npx prisma migrate dev --name init
npm run db:seed                 # alimentos de exemplo
npm run test                    # testes dos cálculos
npm run dev                     # http://localhost:4000  (GET /healthz)

# 3) Frontend (outro terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173  (o Vite encaminha /api para o backend)
```

Em desenvolvimento, o link de "esqueci minha senha" é impresso no console do backend
(o envio real de e-mail está como stub em `backend/src/lib/mailer.ts`).

Antes de publicar: `npm run audit` em cada pasta e `npm run typecheck`.

## 5. Deploy

- **Banco:** PostgreSQL gerenciado (Railway/Render/Neon) com TLS (`?sslmode=require` na `DATABASE_URL`).
- **Backend (Railway/Render):** `NODE_ENV=production`, `TRUST_PROXY=1`, `CORS_ORIGIN` e `APP_URL` com `https://…`,
  segredos novos e distintos. Build: `npm ci && npm run build`; release: `npm run db:deploy`; start: `npm start`.
- **Frontend (Vercel):** edite o destino do rewrite em `frontend/vercel.json` para a URL do backend. Assim o
  navegador só fala com **uma origem** (a da Vercel), o cookie `SameSite=Strict` funciona e não há CORS em produção.
  Alternativa: domínios do mesmo site (`app.exemplo.com` + `api.exemplo.com`).

## 6. Limitações conhecidas / próximos passos

- Base de alimentos de **exemplo** (30 itens, valores aproximados). Para uso real, importe a TACO e/ou USDA.
- Envio de e-mail é um **stub**; falta verificação de e-mail no cadastro.
- Rate limit em memória (1 instância); com várias instâncias use um store compartilhado (Redis).
- Recomendados antes de produção: pentest/revisão independente, testes de integração da API, backups cifrados,
  política de privacidade/termos escritos por um jurídico (LGPD), monitoramento (ex.: Sentry sem PII).

Veja `docs/API.md` e `docs/SECURITY.md`.
