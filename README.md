# Voting Management System

True frontend/backend monorepo split:

- `client/` - Next.js UI-only application
- `server/` - Express API + Prisma + Postgres + OTP/Auth/Survey logic
- `shared/` - shared TypeScript API contracts

## Development

```bash
npm install
npm --prefix server install
npm --prefix client install
npm run dev
```

Services:

- Client: `http://localhost:3000`
- Server: `http://localhost:4000`
- Client proxies `/api/:path*` to server via `client/next.config.ts`

## Root scripts

- `npm run dev:server` - run Express API
- `npm run dev:client` - run Next.js client
- `npm run dev` - run both services
- `npm run build` - build/type-check both apps
- `npm run db:deploy` - run Prisma migrate deploy on server
- `npm run db:seed` - run server seed script

## Environment files

- API runtime: `server/.env`
- API template: `server/.env.example`
- Client env template: `client/.env.example`

## Production deployment (Vercel + Railway)

### 1) Deploy client on Vercel

- Import repo in Vercel
- Set **Root Directory** to `client`
- Set env var in Vercel project:
  - `API_PROXY_TARGET=https://<railway-api-domain>`

The client keeps calling `/api/*`; Next rewrites proxy these to your Railway API.

### 2) Deploy API on Railway

- Create service from the same repo
- Set **Root Directory** to `server`
- Start command: `npm run start`
- Required env vars:
  - `NODE_ENV=production`
  - `CLIENT_ORIGIN=https://<your-vercel-domain>`
  - `DATABASE_URL=...`
  - `SESSION_SECRET=...`
  - `OTP_SMS_PROVIDER=twilio_whatsapp` (or `twilio` / `vonage`)
  - matching OTP credentials (`TWILIO_WHATSAPP_*`, `TWILIO_*`, or `VONAGE_*`)

### 3) Run database migration lifecycle

Run on Railway (or CI/CD):

```bash
npm run prisma:generate
npm run prisma:deploy
```

Optional first deploy data only:

```bash
npm run prisma:seed
```
