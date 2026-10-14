# Segurança do NutriSafe

## Decisões e por quê

| Decisão | Motivo |
|---|---|
| **Argon2id** (19 MiB, t=2, p=1) para senhas | Recomendação OWASP; resistente a GPU. Salt aleatório embutido. Rehash transparente se os parâmetros subirem. |
| **Access JWT de 15 min**, HS256 com algoritmo fixado, `iss`/`aud`/`sub` verificados | Janela curta de abuso; evita "alg: none"/troca de algoritmo. |
| **Refresh token opaco**, rotativo, só o HMAC no banco, detecção de reuso por "família" | Revogável e à prova de vazamento do banco; reuso de token roubado derruba a sessão. |
| Access token **só em memória**; refresh em cookie `httpOnly; Secure; SameSite=Strict; Path=/api/auth` | XSS não lê tokens persistentes; navegador não envia o cookie em requisições cross-site. |
| **CSRF em camadas**: SameSite=Strict + Bearer no header + checagem de `Origin` + header `X-Requested-With` obrigatório | Nenhuma rota que altera estado depende só de cookie. |
| **Zod em toda entrada** (body, query, params) + sanitização de texto | Tipos estritos barram injeção de operadores; campos desconhecidos são descartados. |
| **Prisma** (consultas parametrizadas), sem `$queryRawUnsafe` | Elimina SQL Injection. Não há MongoDB, então NoSQL Injection não se aplica; ainda assim, queries só aceitam strings. |
| **Autorização por recurso**: toda query filtra por `userId` do token; recurso alheio responde 404 | Previne IDOR. RBAC (`USER`/`ADMIN`) via `requireRole`. |
| **Rate limiting**: 120/min geral; 10 falhas/15 min no login; 5/h em cadastro, recuperação e exclusão | Força bruta, enumeração e abuso. |
| **Helmet** + CSP restritiva na API (`default-src 'none'`), HSTS em produção, `no-store` nas respostas | Respostas com dados de saúde não ficam em cache; sem clickjacking. |
| **HTTPS obrigatório** em produção (`enforceHttps`, `trust proxy`, HSTS) e validação de `https` em `CORS_ORIGIN`/`APP_URL` | Dados em trânsito sempre cifrados. |
| **Logs sem dados de saúde**: só método, rota (sem query), status e tempo; redação de `password`, `token`, `email`, `authorization`, `cookie` | Dados sensíveis nunca vão para logs. Erros inesperados logam apenas nome/código. |
| **Segredos só em variáveis de ambiente**, validados na subida (mín. 32 chars, distintos); o servidor não sobe se faltarem | Sem segredos no código; falha cedo. |
| **Sem enumeração de contas** no login (mensagem única + hash isca para igualar o tempo) e na recuperação de senha (sempre 202) | Dificulta descoberta de e-mails cadastrados. |
| Cadastro devolve 409 em e-mail duplicado | *Trade-off consciente* (UX). Para eliminar totalmente, adicione verificação de e-mail. Mitigado por rate limit estrito. |
| Menores de 18 anos são recusados | Metas calóricas automáticas não são adequadas a crianças/adolescentes. |
| Piso calórico automático (1200/1500 kcal) | O app nunca sugere um déficit extremo por conta própria. |

## Mapeamento OWASP Top 10 (2021)

- **A01 Broken Access Control** — `requireAuth` + filtro por `userId` em toda query + `requireRole`; 404 para recursos alheios; validação de que os alimentos referenciados são públicos ou do próprio usuário (`assertFoodsAccessible`).
- **A02 Cryptographic Failures** — Argon2id; tokens de alta entropia com HMAC+pepper; HTTPS/HSTS; cookies `Secure`; JWT com segredo ≥ 32 chars.
- **A03 Injection** — Prisma parametrizado; Zod; sanitização; React escapa saída (sem `dangerouslySetInnerHTML`); CSP.
- **A04 Insecure Design** — rotação de refresh com detecção de reuso; reautenticação (senha) para excluir conta; limites de tamanho/intervalo em toda entrada; privacidade por design (cascade, export).
- **A05 Security Misconfiguration** — Helmet, CORS com lista explícita, `x-powered-by` desligado, validação de ambiente, erros genéricos ao cliente, sourcemaps desativados no build.
- **A06 Vulnerable Components** — poucas dependências, todas mantidas; `npm run audit`; recomendado Dependabot/Renovate e `npm ci` no CI.
- **A07 Identification & Authentication Failures** — política de senha, rate limit, sessão curta + refresh rotativo, logout/logout-all, troca de senha revoga sessões.
- **A08 Software & Data Integrity** — `npm ci` com lockfile (commitar `package-lock.json`); migrações versionadas (`prisma migrate deploy`).
- **A09 Logging & Monitoring Failures** — logs estruturados com `X-Request-Id` e redação; sem PII. Adicione alertas (picos de 401/429).
- **A10 SSRF** — a API não faz requisições a URLs fornecidas pelo usuário.

## LGPD / GDPR

- **Consentimento** explícito no cadastro (`consentAt`). Dados de saúde são **dados pessoais sensíveis** (LGPD art. 11): publique política de privacidade e base legal revisadas por jurídico.
- **Acesso/portabilidade:** `GET /api/privacy/export`.
- **Eliminação:** `DELETE /api/privacy/account` (transação única; apaga refeições, favoritos, alimentos próprios, perfil, metas, peso e tokens).
- **Minimização:** só coletamos o necessário para o cálculo (nascimento, sexo, altura, peso, atividade, objetivo).
- **Retenção:** tokens expirados são purgados diariamente.

## Checklist implementado

- [x] Senhas com Argon2id (nunca em texto puro)
- [x] JWT de acesso curto + refresh token rotativo (hash no banco, detecção de reuso)
- [x] Cookie de refresh httpOnly/Secure/SameSite=Strict/Path restrito
- [x] Proteção CSRF (SameSite + Origin + header customizado)
- [x] Validação Zod no backend (e atributos de validação no frontend)
- [x] Sanitização de texto livre
- [x] Proteção contra SQL Injection (Prisma) e contra injeção de operadores (tipos estritos)
- [x] XSS: saída escapada pelo React, sem HTML dinâmico, CSP no frontend e na API
- [x] Rate limiting (geral, login, ações sensíveis)
- [x] Helmet/headers de segurança (API e Vercel)
- [x] HTTPS obrigatório em produção + HSTS
- [x] RBAC e isolamento por usuário (anti-IDOR)
- [x] Logs sem dados de saúde, com redação automática
- [x] Segredos em variáveis de ambiente, validados na inicialização
- [x] Exportação e exclusão de dados (LGPD/GDPR)
- [x] Respostas `Cache-Control: no-store`
- [x] Tratamento de erros sem vazar detalhes internos
- [ ] **A fazer antes de produção:** verificação de e-mail, MFA opcional, store de rate limit compartilhado (Redis), pentest, CI com `npm audit`/SAST, backups cifrados, revisão jurídica (LGPD)

## Observação sobre sessões em várias abas

Como o refresh token rotaciona a cada uso, duas abas renovando **no mesmo instante** podem acionar a detecção de
reuso e encerrar a sessão (o usuário só precisa entrar de novo). Dentro de uma aba o cliente já serializa as
renovações. Se isso incomodar, adicione uma janela de tolerância curta (ex.: 10 s) para reuso do token anterior.
