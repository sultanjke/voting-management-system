# Server (Express API + Prisma)

This app is the backend service for the voting platform:

- Express API (`/api/resident/*`, `/api/admin/*`)
- Prisma ORM + PostgreSQL
- OTP provider integration (Twilio or Vonage)
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
  - `POST /api/resident/auth/otp/request`
  - `POST /api/resident/auth/otp/verify`
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
  - `PATCH /api/admin/residents/:residentId`
  - `GET /api/admin/surveys`
  - `POST /api/admin/surveys`
  - `PATCH /api/admin/surveys/:surveyId`
  - `DELETE /api/admin/surveys/:surveyId`
  - `GET /api/admin/surveys/:surveyId/results`
  - `GET /api/admin/analytics/participation`

## Notes

- One vote per house per survey is enforced by DB and API logic.
- Dev mode can return `devCode` in OTP request response.
- Production requires valid provider credentials and production-ready env values.

## Railway deployment

- Root Directory: `server`
- Start command: `npm run start`
- Required env vars:
  - `NODE_ENV=production`
  - `CLIENT_ORIGIN=https://<your-vercel-domain>`
  - `DATABASE_URL=...`
  - `SESSION_SECRET=...`
  - `OTP_SMS_PROVIDER=twilio_whatsapp` (or `twilio` / `vonage`)
  - matching OTP credentials (`TWILIO_WHATSAPP_*`, `TWILIO_*`, or `VONAGE_*`)

Run DB deploy steps in Railway shell or CI:

```bash
npm run prisma:generate
npm run prisma:deploy
```

Optional one-time bootstrap data:

```bash
npm run prisma:seed
```
