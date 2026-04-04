# Server (Express API + Prisma)

Backend service for resident voting and admin management.

## Stack

- Express API
- Prisma ORM
- PostgreSQL
- WebAuthn passkey auth (`@simplewebauthn/server`)
- Cookie sessions backed by `AuthSession`

## Auth Domains

### Resident

- Passkey registration: gated by active `phone + house` match
- Passkey login: credential assertion verification
- Session cookie: `rv_resident_session` (default 7 days)

### Admin

- Login/password auth
- Session cookie: `rv_admin_session` (default 7 days)

## Setup

1. Install:

```bash
npm install
```

2. Create env file:

```bash
copy .env.example .env
```

3. Prepare Prisma:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

4. Seed:

```bash
npm run prisma:seed
```

5. Run:

```bash
npm run dev
```

Default API URL: `http://localhost:4000`

Health endpoint:

- `GET /health`

## API Endpoints

### Resident auth/session

- `GET /api/resident/session`
- `POST /api/resident/auth/passkey/register/options`
- `POST /api/resident/auth/passkey/register/verify`
- `POST /api/resident/auth/passkey/login/options`
- `POST /api/resident/auth/passkey/login/verify`
- `POST /api/resident/auth/logout`

### Resident surveys

- `GET /api/resident/surveys`
- `GET /api/resident/surveys/:surveyId`
- `POST /api/resident/surveys/:surveyId/vote`
- `GET /api/resident/results`

### Admin auth/session

- `GET /api/admin/session`
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`

### Admin management

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

## Data and Integrity Rules

- One resident record per normalized phone + house
- One vote per survey per house
- Only active residents can register/login/vote
- CSV export includes detailed row-level answers for admin analysis

## Environment Variables

Required:

- `NODE_ENV`
- `CLIENT_ORIGIN`
- `DATABASE_URL`
- `SESSION_SECRET`
- `WEBAUTHN_RP_ID`
- `WEBAUTHN_RP_NAME`
- `WEBAUTHN_ORIGINS` (comma-separated origins, no trailing slash)

Optional:

- `OPENAI_API_KEY`
- `OPENAI_TRANSLATION_MODEL`

Seed bootstrap:

- `ADMIN_BOOTSTRAP_EMAIL` (used as admin login value)
- `ADMIN_BOOTSTRAP_PASSWORD`

## Prisma and Utility Scripts

- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:deploy`
- `npm run prisma:seed`
- `npm run prisma:localize-surveys`
- `npm run prisma:cleanup:residents`

## Tests

Run:

```bash
npm run test
```

Current unit tests:

- `tests/unit/phone.test.ts`
- `tests/unit/passkey-policy.test.ts`
- `tests/unit/vote-policy.test.ts`

## Railway Deployment

- Root Directory: `server`
- Start command: `npm run start`
- Configure required env vars in Railway service

Deploy DB schema:

```bash
npm run prisma:generate
npm run prisma:deploy
```

Optional first bootstrap data:

```bash
npm run prisma:seed
```
