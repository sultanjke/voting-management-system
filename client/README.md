# Client (Next.js UI)

This app is frontend-only and contains:

- App Router pages
- UI components
- i18n and presentation logic
- API calls to `/api/*`

It does not include Prisma, migrations, or direct DB access.

## Run

```bash
npm install
npm run dev
```

Default URL: `http://localhost:3000`

## API integration

All client requests use `/api/*`.
`next.config.ts` rewrites those paths to the Express server target:

- `API_PROXY_TARGET` (default `http://localhost:4000`)

## Vercel deployment

- Framework preset: Next.js
- Root Directory: `client`
- Build command: `npm run build` (default)
- Output: Next.js default
- Environment variables:
  - `API_PROXY_TARGET=https://<railway-api-domain>`

This keeps browser requests same-origin (`/api/*`) while Vercel proxies them to Railway.
