# Voting Management System

Production-ready bilingual voting platform for residential communities with true frontend/backend separation, passkey resident authentication, and admin governance tools.

## Architecture

- `client/` - Next.js 15 UI-only app
- `server/` - Express API + Prisma + PostgreSQL
- `shared/` - Shared TypeScript API contracts

Client never accesses database code directly. Browser calls `/api/*` on the client domain, and Next.js rewrites requests to the Express API.

## Core Features

### Resident

- Passkey-first sign in
- First-time passkey registration via `phone + house` for active residents only
- Session cookie auth (`rv_resident_session`)
- Survey participation and results
- One vote per house per survey enforcement
- Kazakh / Russian language switching

### Admin

- Login/password auth (`rv_admin_session`)
- Resident management (add, status update, passkey reset)
- Survey builder wizard (details -> questions -> review)
- Survey lifecycle management (`ACTIVE`, `CLOSED`, `ARCHIVED`)
- Force delete surveys (removes linked votes first)
- Detailed per-survey answer view by house
- CSV export of detailed survey answers (localized by selected UI language)

## Recent Updates

- OTP removed, resident auth migrated to passkeys (WebAuthn).
- Resident login UX: direct passkey sign-in button + collapsible passkey registration section.
- Global floating notifications: top-center popups for success/error flows (green/red).
- Admin survey results page:
  - Excel-style CSV export action
  - improved mobile header wrapping (badge/buttons stay inside panel)
- Session hint text clarified: 7-day session expiry requires sign-in again, not passkey re-registration.

## Security Model

- DB-backed sessions; only hashed tokens are stored (`AuthSession.tokenHash`)
- HTTP-only cookies, `sameSite=lax`, `secure` in production
- Separate resident/admin guards and cookies
- Audit logs for auth and admin mutations
- Integrity constraints:
  - `Resident(phoneNormalized, houseId)` unique
  - `Vote(surveyId, houseId)` unique

Session TTL defaults:

- Resident: 7 days
- Admin: 7 days

After expiry, resident signs in again with existing passkey (no re-registration needed).

## API Surface

### Resident

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

### Admin

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
- `GET /api/admin/surveys/:surveyId/results/csv?lang=kk|ru`

## Local Development

### 1) Install

```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 2) Configure env files

- `server/.env` from `server/.env.example`
- `client/.env` from `client/.env.example`

### 3) Prepare DB

```bash
npm --prefix server run prisma:generate
npm --prefix server run prisma:deploy
npm --prefix server run prisma:seed
```

### 4) Start

```bash
npm run dev
```

Local URLs:

- Client: `http://localhost:3000`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

## Scripts

### Root

- `npm run dev:server`
- `npm run dev:client`
- `npm run dev`
- `npm run build`
- `npm run db:deploy`
- `npm run db:seed`

### Server

- `npm --prefix server run dev`
- `npm --prefix server run build`
- `npm --prefix server run start`
- `npm --prefix server run test`
- `npm --prefix server run prisma:generate`
- `npm --prefix server run prisma:migrate`
- `npm --prefix server run prisma:deploy`
- `npm --prefix server run prisma:seed`
- `npm --prefix server run prisma:cleanup:residents`
- `npm --prefix server run prisma:localize-surveys`

### Client

- `npm --prefix client run dev`
- `npm --prefix client run build`
- `npm --prefix client run start`

## Environment

### Server required

- `CLIENT_ORIGIN`
- `DATABASE_URL`
- `SESSION_SECRET`
- `WEBAUTHN_RP_ID`
- `WEBAUTHN_RP_NAME`
- `WEBAUTHN_ORIGINS`

Optional:

- `OPENAI_API_KEY`
- `OPENAI_TRANSLATION_MODEL`

Seed bootstrap:

- `ADMIN_BOOTSTRAP_EMAIL` (used as admin login value, default `admin`)
- `ADMIN_BOOTSTRAP_PASSWORD`

### Client required

- `API_PROXY_TARGET` (default dev target: `http://localhost:4000`)

## Deployment (Vercel + Railway)

### Client (Vercel)

- Root Directory: `client`
- Env: `API_PROXY_TARGET=https://<railway-api-domain>`

### Server (Railway)

- Root Directory: `server`
- Start command: `npm run start`
- Env:
  - `NODE_ENV=production`
  - `CLIENT_ORIGIN=https://<vercel-domain>`
  - `DATABASE_URL=...`
  - `SESSION_SECRET=...`
  - `WEBAUTHN_RP_ID=<production-domain>`
  - `WEBAUTHN_RP_NAME=Resident Vote`
  - `WEBAUTHN_ORIGINS=https://<vercel-domain>[,https://<custom-domain>]`

### Production DB lifecycle

```bash
npm run prisma:generate
npm run prisma:deploy
```

Optional first bootstrap:

```bash
npm run prisma:seed
```

## Verification Checklist

- `GET <railway-domain>/health` -> `{ "ok": true }`
- `GET <vercel-domain>/api/resident/session` returns JSON (not HTML 404)
- Resident passkey sign-in works
- Admin login works
- Admin CSV export downloads successfully

## Tests

Current automated unit tests (server):

- `server/tests/unit/phone.test.ts`
- `server/tests/unit/passkey-policy.test.ts`
- `server/tests/unit/vote-policy.test.ts`

Run:

```bash
npm --prefix server run test
```
