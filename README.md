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

## Environment files

- API runtime: `server/.env`
- API template: `server/.env.example`
