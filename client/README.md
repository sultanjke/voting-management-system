# Client (Next.js UI-Only App)

Frontend for the voting management platform.

## Scope

This app contains:

- App Router pages
- Resident/admin UI components
- KK/RU i18n
- API calls to `/api/*`
- UI-only state, forms, notifications

This app does **not** include Prisma, migrations, or direct database access.

## Current UX Highlights

- Resident passkey login:
  - Primary direct sign-in button
  - Collapsible first-time passkey registration section
- Top-center popup notifications for success/error flows
- Admin survey results page with CSV export action
- Mobile responsiveness improvements for admin survey results header controls

## Run Locally

```bash
npm install
npm run dev
```

Default URL: `http://localhost:3000`

## Build

```bash
npm run build
npm run start
```

## API Integration

Client sends requests to `/api/*`.

`next.config.ts` rewrites these calls to:

- `API_PROXY_TARGET` (defaults to `http://localhost:4000`)

Example:

- Browser calls: `/api/admin/surveys`
- Next proxy target: `http://localhost:4000/api/admin/surveys`

## Environment

Use `.env` with:

```env
API_PROXY_TARGET=http://localhost:4000
```

Template file:

- `client/.env.example`

## Deployment (Vercel)

- Framework: Next.js
- Root Directory: `client`
- Env:
  - `API_PROXY_TARGET=https://<railway-api-domain>`

This keeps browser auth/cookie behavior simple because the browser still uses same-origin `/api/*` calls.
