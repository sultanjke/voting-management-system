# Voting Management System

Production-ready resident voting platform with bilingual UI (Kazakh/Russian), passkey login, household vote integrity, and admin management tooling.

## Overview

This repository is a true frontend/backend split monorepo:

- `client/` - Next.js 15 UI-only app
- `server/` - Express API + Prisma + PostgreSQL
- `shared/` - shared TypeScript contracts (DTOs)

The frontend never talks directly to Prisma or the database. It calls `/api/*`, and Next.js rewrites those requests to the Express API.

## Product Capabilities

### Resident side

- Passkey authentication
- First-time passkey enrollment via phone + house code for active residents
- Secure cookie-based session
- Active/closed surveys list
- Survey voting
- Household-level duplicate vote protection
- Aggregate results page
- KK/RU language switching

### Admin side

- Login with login/password
- Resident management:
  - list residents
  - add resident from UI (phone + house)
  - update resident status (`ACTIVE`, `PENDING`, `DISABLED`)
- Survey management:
  - wizard builder (Details -> Questions -> Review)
  - question templates (`SINGLE`, `SCALE`, `TEXT`)
  - archive/restore survey status
  - force delete survey (deletes linked votes first)
- Analytics and detailed review:
  - participation dashboard
  - survey-level vote detail page with house codes and submitted answers

## Security and Integrity

- Session tokens are random and hashed before DB storage (`AuthSession.tokenHash`)
- HTTP-only session cookies:
  - `rv_resident_session`
  - `rv_admin_session`
- Session durations:
  - Resident session: 7 days
  - Admin session: 7 days
- Authorization middleware protects resident/admin APIs separately
- Audit logging tracks auth attempts, vote events, and admin mutations
- Core DB constraints:
  - `Resident(phoneNormalized, houseId)` unique
  - `Vote(surveyId, houseId)` unique (one vote per house per survey)

## API Endpoints

Resident:

- `GET /api/resident/session`
- `POST /api/resident/auth/passkey/register/options`
- `POST /api/resident/auth/passkey/register/verify`
- `POST /api/resident/auth/passkey/login/options`
- `POST /api/resident/auth/passkey/login/verify`
- `POST /api/resident/auth/logout`
- `GET /api/resident/surveys`
- `GET /api/resident/surveys/:surveyId`
- `POST /api/resident/surveys/:surveyId/vote`
- `GET /api/resident/results`

Admin:

- `GET /api/admin/session`
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/residents`
- `POST /api/admin/residents`
- `PATCH /api/admin/residents/:residentId`
- `POST /api/admin/residents/:residentId/passkeys/reset`
- `GET /api/admin/surveys`
- `POST /api/admin/surveys`
- `PATCH /api/admin/surveys/:surveyId`
- `DELETE /api/admin/surveys/:surveyId`
- `GET /api/admin/analytics/participation`
- `GET /api/admin/surveys/:surveyId/results`

## Repository Layout

```txt
.
|-- client/
|   |-- app/
|   |-- components/
|   `-- lib/
|-- server/
|   |-- prisma/
|   |-- src/routes/
|   |-- src/middleware/
|   |-- src/services/
|   `-- lib/
`-- shared/
```

## Local Development

### 1) Install dependencies

```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 2) Configure env files

- `server/.env` from `server/.env.example`
- `client/.env` from `client/.env.example`

Minimum server env values:

- `DATABASE_URL`
- `SESSION_SECRET` (32+ chars)
- `CLIENT_ORIGIN` (for local: `http://localhost:3000`)

### 3) Prepare database

```bash
npm --prefix server run prisma:generate
npm --prefix server run prisma:deploy
npm --prefix server run prisma:seed
```

### 4) Start app

```bash
npm run dev
```

Local URLs:

- Client: `http://localhost:3000`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/health`

## Scripts

Root:

- `npm run dev:server`
- `npm run dev:client`
- `npm run dev`
- `npm run build`
- `npm run db:deploy`
- `npm run db:seed`

Server:

- `npm --prefix server run dev`
- `npm --prefix server run build`
- `npm --prefix server run start`
- `npm --prefix server run test`
- `npm --prefix server run prisma:generate`
- `npm --prefix server run prisma:migrate`
- `npm --prefix server run prisma:deploy`
- `npm --prefix server run prisma:seed`
- `npm --prefix server run prisma:localize-surveys`
- `npm --prefix server run prisma:cleanup:residents`

Client:

- `npm --prefix client run dev`
- `npm --prefix client run build`
- `npm --prefix client run start`

## Seed Data Policy

Current seed is production-oriented and minimal:

- Residents:
  - `+7 708 858 5331` (house `9`)
  - `+7 701 552 6777` (house `9`)
- Legacy demo surveys are cleaned up by slug:
  - `parking-lot-redesign`
  - `playground-upgrade`
  - `security-cctv-entry`
- Admin account is created/updated from:
  - `ADMIN_BOOTSTRAP_EMAIL`
  - `ADMIN_BOOTSTRAP_PASSWORD`

## Controlled Resident Cleanup Script

Script: `server/prisma/cleanup-residents.ts`

Dry run:

```bash
$env:RESIDENT_CLEANUP_PHONES="+77771234561,+77771234562"; npm --prefix server run prisma:cleanup:residents
```

Execute delete:

```bash
$env:RESIDENT_CLEANUP_PHONES="+77771234561,+77771234562"; $env:RESIDENT_CLEANUP_CONFIRM="DELETE"; npm --prefix server run prisma:cleanup:residents
```

Behavior:

- Finds matching residents by normalized phone
- Deletes resident-linked votes first
- Deletes residents after vote cleanup
- Stays in dry-run mode unless `RESIDENT_CLEANUP_CONFIRM=DELETE`

## Passkey Configuration

WebAuthn env vars in `server/.env`:

- `WEBAUTHN_RP_ID` (example: `localhost` in dev, your domain in prod)
- `WEBAUTHN_RP_NAME` (display name for authenticator prompt)
- `WEBAUTHN_ORIGINS` (comma-separated allowed origins)

Local default:

- `WEBAUTHN_RP_ID=localhost`
- `WEBAUTHN_RP_NAME=Resident Vote`
- `WEBAUTHN_ORIGINS=http://localhost:3000`

## KK/RU Survey Localization

- Survey text is stored in encoded localized form for `kk` and `ru`
- Translation can use OpenAI when configured:
  - `OPENAI_API_KEY`
  - `OPENAI_TRANSLATION_MODEL` (default fallback in code: `gpt-4.1-mini`)
- If translation is unavailable, survey creation still succeeds with source text

## Deployment (Vercel + Railway)

### Client on Vercel

1. Import repository
2. Set Root Directory to `client`
3. Add env:
   - `API_PROXY_TARGET=https://<railway-api-domain>`

### Server on Railway

1. Create service from same repository
2. Set Root Directory to `server`
3. Start command:
   - `npm run start`
4. Add env:
   - `NODE_ENV=production`
   - `CLIENT_ORIGIN=https://<your-vercel-domain>`
   - `DATABASE_URL=...`
   - `SESSION_SECRET=...`
   - `WEBAUTHN_RP_ID=<your-domain>`
   - `WEBAUTHN_RP_NAME=Resident Vote`
   - `WEBAUTHN_ORIGINS=https://<your-vercel-domain>`

### Database lifecycle in production

Run in Railway server context (or CI job):

```bash
npm run prisma:generate
npm run prisma:deploy
```

First deploy only (optional):

```bash
npm run prisma:seed
```

### Post-deploy checks

- `GET https://<railway-domain>/health` returns `{ "ok": true }`
- `GET https://<vercel-domain>/api/resident/session` returns JSON, not 404 HTML
- Resident/admin login works
- Surveys load and voting works from Vercel frontend

## Troubleshooting

- `Cannot GET /api/...` on frontend:
  - `API_PROXY_TARGET` is missing/wrong on Vercel
- `DATABASE_URL not found`:
  - missing env variable in server context
- DB auth failed:
  - invalid DB credentials/URL
- Passkey flow fails in browser:
  - check HTTPS and correct `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGINS`
- Admin password changed in env but login fails:
  - run `npm --prefix server run prisma:seed` to refresh bootstrap hash

## Test Coverage

Current automated tests are server unit tests:

- `server/tests/unit/phone.test.ts`
- `server/tests/unit/passkey-policy.test.ts`
- `server/tests/unit/vote-policy.test.ts`

Run tests:

```bash
npm --prefix server run test
```
