# API do NutriSafe

Base: `/api`. JSON em UTF-8. Erros seguem o formato:

```json
{ "error": { "message": "Dados inválidos", "code": "VALIDATION_ERROR",
             "details": [{ "path": "password", "message": "Use letras e números" }] } }
```

**Requisitos de toda requisição que altera estado (POST/PUT/DELETE):** header `X-Requested-With: nutrisafe`
(proteção CSRF) e, se houver `Origin`, ele deve estar em `CORS_ORIGIN`.
**Rotas protegidas:** `Authorization: Bearer <accessToken>`.
**Datas/horas:** instantes ISO 8601 (`2026-10-13T03:00:00.000Z`). Intervalos: `from` e `to` (máx. 366 dias).

## Autenticação

| Método | Rota | Descrição | Limite |
|---|---|---|---|
| POST | `/auth/register` | Cria conta | 5/h por IP |
| POST | `/auth/login` | Entra | 10 falhas/15 min por IP |
| POST | `/auth/refresh` | Renova sessão (cookie `ns_rt`) | geral |
| POST | `/auth/logout` | Encerra a sessão atual | geral |
| POST | `/auth/logout-all` 🔒 | Encerra todas as sessões | geral |
| POST | `/auth/forgot-password` | Pede link (resposta sempre 202) | 5/h por IP |
| POST | `/auth/reset-password` | Define nova senha (revoga sessões) | 5/h por IP |
| GET | `/auth/me` 🔒 | Usuário atual | geral |

**POST /auth/register**
```json
// request
{ "name": "Ana Souza", "email": "ana@exemplo.com", "password": "uma frase longa 2026", "acceptTerms": true }
// 201 (+ Set-Cookie: ns_rt=...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth)
{ "accessToken": "eyJhbGciOi...", "user": { "id": "…", "name": "Ana Souza", "email": "ana@exemplo.com", "role": "USER" } }
```

**POST /auth/login** → mesmo corpo de resposta (200). Falha: `401 { "error": { "message": "E-mail ou senha incorretos" } }`.

## Perfil e metas 🔒

**PUT /profile**
```json
{ "birthDate": "1995-04-20", "sex": "FEMALE", "heightCm": 165, "weightKg": 62,
  "activityLevel": "MODERATE", "goal": "LOSE", "autoGoals": true }
```
**200**
```json
{ "profile": { "birthDate": "1995-04-20", "sex": "FEMALE", "heightCm": 165, "weightKg": 62, "activityLevel": "MODERATE", "goal": "LOSE", "...": "…" },
  "target": { "calories": 1560, "proteinG": 124, "carbsG": 135, "fatG": 43 },
  "estimate": { "age": 31, "bmr": 1371, "tdee": 2125, "suggested": { "calories": 1625, "…": "…" } } }
```
`GET /profile` devolve a mesma estrutura. `PUT /profile/goals` define metas manuais
(`calories` 1000–6000, `proteinG`, `carbsG`, `fatG`).

## Alimentos 🔒

- `GET /foods?q=arroz&limit=20` → `{ "foods": [ { "id", "name", "calories", "proteinG", "carbsG", "fatG", "fiberG", "sodiumMg", "ironMg", "calciumMg", "vitCMg", "source", "userId" } ] }` (valores por 100 g)
- `POST /foods` → cria alimento **privado** do usuário (valores por 100 g)
- `GET /foods/:id` · `DELETE /foods/:id` (só os próprios; `409` se estiver em uso)
- `POST /foods/public` → somente `ADMIN`

## Refeições 🔒

- `GET /meals?from=…&to=…`
- `POST /meals`
```json
{ "type": "LUNCH", "eatenAt": "2026-10-13T15:00:00.000Z", "notes": "opcional",
  "items": [ { "foodId": "uuid", "grams": 150 }, { "foodId": "uuid", "grams": 100 } ] }
```
**201**
```json
{ "meal": { "id": "…", "type": "LUNCH", "eatenAt": "…", "notes": null,
  "items": [ { "id": "…", "foodId": "…", "foodName": "Arroz branco cozido", "grams": 150,
               "nutrients": { "calories": 192, "proteinG": 3.8, "carbsG": 42.2, "fatG": 0.3, "…": 0 } } ],
  "totals": { "calories": 351, "proteinG": 41.8, "…": 0 } } }
```
- `GET /meals/:id` · `PUT /meals/:id` (substitui itens) · `DELETE /meals/:id` → 204

## Favoritos 🔒

- `GET /favorites` · `POST /favorites` `{ "name", "type", "items": [{ "foodId", "grams" }] }`
- `PUT /favorites/:id` · `DELETE /favorites/:id`
- `POST /favorites/:id/log` `{ "eatenAt": "…", "type": "DINNER" (opcional) }` → cria uma refeição a partir do favorito

## Painel, sugestões e progresso 🔒

- `GET /dashboard?from=…&to=…` (limites do dia local)
```json
{ "target": { "calories": 1560, "proteinG": 124, "carbsG": 135, "fatG": 43 },
  "consumed": { "calories": 820, "proteinG": 61, "…": 0 },
  "remaining": { "calories": 740, "proteinG": 63, "carbsG": 70, "fatG": 20 },
  "percent": { "calories": 53, "proteinG": 49, "carbsG": 48, "fatG": 53 },
  "meals": [ "…" ] }
```
- `GET /suggestions?from=…&to=…` → `{ remaining, favorites: [...], foods: [{ foodId, name, grams, calories, proteinG }] }` (`409 PROFILE_REQUIRED` sem metas)
- `GET /progress?from=…&to=…&tzOffsetMinutes=180` → `{ days: [{ date, calories, proteinG, carbsG, fatG, meals }], daysLogged, averages, target }`
- `GET /progress/weight?from=…&to=…` · `POST /progress/weight { "weightKg": 61.5 }` · `DELETE /progress/weight/:id`

## Privacidade (LGPD/GDPR) 🔒

- `GET /privacy/export` → JSON com todos os dados do usuário (sem hash de senha nem tokens)
- `DELETE /privacy/account` `{ "password": "…", "confirm": "EXCLUIR" }` → 204; apaga tudo em uma transação

## Saúde

- `GET /healthz` → `{ "status": "ok" }` (fora de `/api`, sem autenticação, sem dados)
