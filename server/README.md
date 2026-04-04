# Server (Express API + Prisma)

This app is the backend service for the voting platform:

- Express API (`/api/resident/*`, `/api/admin/*`)
- Prisma ORM + PostgreSQL
- Passkey/WebAuthn resident authentication
- Cookie-based resident/admin sessions backed by `AuthSession`
- Survey, vote, resident, admin, and audit domain logic

## Setup

1. Install:

```bash
npm install
```

2. Configure environment:

```bash
copy .env.example .env
```

3. Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

4. Seed initial data:

```bash
npm run prisma:seed
```

5. Start API:

```bash
npm run dev
```

Default API URL: `http://localhost:4000`

## Key endpoints

- Resident auth/session:
  - `GET /api/resident/session`
  - `POST /api/resident/auth/passkey/register/options`
  - `POST /api/resident/auth/passkey/register/verify`
  - `POST /api/resident/auth/passkey/login/options`
  - `POST /api/resident/auth/passkey/login/verify`
  - `POST /api/resident/auth/logout`
- Resident surveys:
  - `GET /api/resident/surveys`
  - `GET /api/resident/surveys/:surveyId`
  - `POST /api/resident/surveys/:surveyId/vote`
  - `GET /api/resident/results`
- Admin auth/session:
  - `GET /api/admin/session`
  - `POST /api/admin/auth/login`
  - `POST /api/admin/auth/logout`
- Admin management:
  - `GET /api/admin/residents`
  - `POST /api/admin/residents`
  - `PATCH /api/admin/residents/:residentId`
  - `POST /api/admin/residents/:residentId/passkeys/reset`
  - `GET /api/admin/surveys`
  - `POST /api/admin/surveys`
  - `PATCH /api/admin/surveys/:surveyId`
  - `DELETE /api/admin/surveys/:surveyId`
  - `GET /api/admin/surveys/:surveyId/results`
  - `GET /api/admin/analytics/participation`

## Notes

- One vote per house per survey is enforced by DB and API logic.
- Production requires valid WebAuthn RP config and HTTPS origins.

## Railway deployment

- Root Directory: `server`
- Start command: `npm run start`
- Required env vars:
  - `NODE_ENV=production`
  - `CLIENT_ORIGIN=https://<your-vercel-domain>`
  - `DATABASE_URL=...`
  - `SESSION_SECRET=...`
  - `WEBAUTHN_RP_ID=<your-domain>`
  - `WEBAUTHN_RP_NAME=Resident Vote`
  - `WEBAUTHN_ORIGINS=https://<your-vercel-domain>`

Run DB deploy steps in Railway shell or CI:

```bash
npm run prisma:generate
npm run prisma:deploy
```

Optional one-time bootstrap data:

```bash
npm run prisma:seed
```
