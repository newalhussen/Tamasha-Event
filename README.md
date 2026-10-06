# Tamasha: events and ticketing for Addis Ababa

Event discovery, ticket checkout, QR tickets, organizer tools and an admin console, with Ethiopian seed data (Addis Ababa venues, ETB prices, Telebirr / CBE Birr).

Two apps, one repo:

| | Stack | Folder |
|---|---|---|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind v4 | `frontend/` |
| **Backend API** | Node.js, Express 5, TypeScript, Prisma, **PostgreSQL**, zod | `backend/` |

```
Browser ──► Next.js (:3000) ──/api/* proxy──► Express API (:4000) ──► PostgreSQL
              pages + UI          same-origin cookie     controllers → services → Prisma
```

The browser only talks to the frontend. Next.js proxies `/api/*` to the backend (`frontend/next.config.ts`), so the session cookie is first-party and there is no CORS to manage. Server-rendered pages call the API with the visitor's cookie forwarded (`frontend/src/lib/server-api.ts`).

## Run it

You need Node 20+ and a PostgreSQL 14+ database.

```bash
# 1. Database (any Postgres works; this starts one with Docker)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # set DATABASE_URL and a long random AUTH_SECRET
npm install
npm run db:migrate            # applies prisma/migrations to your database
npm run db:seed               # demo data (safe to re-run; it resets the data)
npm run dev                   # API on http://localhost:4000/api

# 3. Frontend (second terminal)
cd frontend
cp .env.example .env          # BACKEND_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:3000
```

Production: `npm run build && npm start` in each folder; apply migrations with `npm run db:deploy` in `backend/`.
Tests: `cd backend && npm test` (needs the database; includes a race test proving the last tickets can't be oversold).

## Demo logins

Password for **every** account: `12345678`

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@tamasha.et` | Review queue, organizers, users, reports |
| Organizer (verified) | `dawit@tamasha.et` | Abay Sound Collective: flagship event, a live event for check-in, a draft |
| Organizer (verified) | `hanna@tamasha.et` | Zema Events: comedy, supper club, film (rescheduled), market, run |
| Organizer (verified) | `liya@tamasha.et` | Skylight Jazz Club |
| Organizer (unverified) | `selamawit@tamasha.et`, `yonas@tamasha.et` | Their events need admin approval |
| Attendee | `meron@tamasha.et` | Upcoming, past, refunded tickets; an unnamed guest ticket; a rescheduled event |
| Attendee | `abel@tamasha.et`, `hiwot@tamasha.et` | Smaller ticket lists |

## Backend layout

```
backend/
  prisma/            schema.prisma, migrations/, seed.ts
  src/
    server.ts        starts the HTTP server
    app.ts           Express app: CORS, JSON, cookies, session, routes, error handling
    config/env.ts    validated environment (the only place process.env is read)
    routes/          URL → controller wiring, plus which roles may call what
    controllers/     thin HTTP layer: validate input, call a service, shape the response
    validation/      zod schemas for every request body
    services/        all business rules: holds, orders, refunds, check-in, analytics, moderation…
    middleware/      session → req.user, role guards, JSON-only mutations, error handler
    db/prisma.ts     the single Prisma client
    utils/           errors, constants, formatting, phone and code helpers
  tests/             unit tests and a PostgreSQL integration test
```

Rules of the road: controllers never touch the database, services never touch `req`/`res`, and every route is guarded in `routes/index.ts` (`requireAuth`, `requireOrganizer`) with ownership re-checked in services.

Key behaviours: 10-minute ticket holds protected by a row lock (`SELECT … FOR UPDATE` on the event), a 5% platform fee included in the buyer's price, instant refunds inside the organizer's window (otherwise a request the organizer decides), event cancellation refunding everyone, and compare-and-set check-in so two scanners can't admit the same ticket.

## API at a glance

`/api/auth/*` sign in/out and the current user · `/api/events` discovery and event pages · `/api/holds`, `/api/orders/:id/*` checkout, payment, refunds · `/api/tickets/*`, `/api/me/tickets` · `/api/organizer/*` events, tickets, attendees, check-in, analytics, orders, payouts · `/api/admin/*` review queue, organizers, users, reports. Errors always look like `{ "error": "…", "code": "…", "fields": { "email": "…" } }`.

## Known limits (out of scope for the MVP)

- **Payments are simulated** (`backend/src/services/payments.service.ts`): a mobile-money number ending in `0000` fails, anything else succeeds. Implement `charge()` against Chapa / Telebirr / CBE Birr and keep card entry on the provider's hosted page.
- **Email and SMS are only logged** (`backend/src/services/notify.service.ts`). Swap in an SMTP or SMS gateway there.
- Artwork is a set of generated styles, not image upload; the venue map is a placeholder with a Google Maps link.
- Add rate limiting (login, holds) at the edge or with a small middleware before going public.
- Frontend response types in `frontend/src/lib/types.ts` are hand-maintained copies of the API shapes.
