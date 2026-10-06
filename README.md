# Tamasha — events and ticketing for Addis Ababa

Event discovery, ticket checkout, QR tickets, organizer tools and an admin console.
UI follows the Tamasha design files; seed data is Ethiopian (Addis Ababa venues, ETB prices, Telebirr / CBE Birr).

**Stack:** Next.js 15 (App Router) · TypeScript · Prisma + SQLite (portable to Postgres) · Tailwind v4 · JWT cookie auth (`jose`, `bcryptjs`) · `zod` validation · `qrcode` (generate) / `jsqr` (scan).

## Run it

```bash
npm install
cp .env.example .env        # set AUTH_SECRET to a long random string
npm run db:push             # create the SQLite schema
npm run db:seed             # load demo data (safe to re-run: it resets the data)
npm run dev                 # http://localhost:3000
```

`npm run db:reset` wipes and reseeds. `npm test` runs unit tests, `npm run lint` type-checks, `npm run build` makes a production build.

## Demo logins

Password for **every** account: `12345678`

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@tamasha.et` | Review queue, organizers, users, reports |
| Organizer (verified) | `dawit@tamasha.et` | Abay Sound Collective. Flagship event, a live event for check-in, a draft |
| Organizer (verified) | `hanna@tamasha.et` | Zema Events. Comedy, supper club, film (rescheduled), market, run |
| Organizer (verified) | `liya@tamasha.et` | Skylight Jazz Club (event flagged "venue changed after sales") |
| Organizer (unverified) | `selamawit@tamasha.et` | Birhan Studio (sold-out event with waitlist, cancelled event) |
| Organizer (unverified) | `yonas@tamasha.et` | Events need admin approval before going live |
| Attendee | `meron@tamasha.et` | Upcoming, past, refunded tickets; a guest ticket not yet named; a rescheduled event |
| Attendee | `abel@tamasha.et`, `hiwot@tamasha.et` | Smaller ticket lists |
| Suspended attendee | `suspended@tamasha.et` | Cannot sign in |

Also seeded: `bereket@`, `mesfin@`, `kaleb@tamasha.et` (organizers whose events sit in the admin review queue) and ~190 background attendees (`first.last#@example.com`).

## Try the two core flows

**Attendee:** `/` → pick an event → choose tickets → *Get tickets* → checkout (new buyers create their account inline) → pay → confirmation → *Open my tickets* → QR ticket.
Payment is simulated: a mobile-money number ending in `0000` shows the "prompt timed out, no money taken" state; anything else succeeds.

**Organizer:** sign in as `dawit@tamasha.et` → *Create event* → basics → when and where → tickets → event page → *Publish* (verified organizers go live; unverified go to admin review) → *Attendees* → check people in, or *Open door scanner* on a phone (camera QR scan, manual code entry, find by name, undo).

## How it fits together

- `src/lib/` — domain logic (events, orders, holds, refunds, check-in, analytics, moderation), auth, validation (`zod`), formatting. Pages and API routes stay thin.
- `src/app/api/**` — JSON REST routes wrapped by `route()` (JSON-only mutations, uniform `{error, code, fields}` errors). Every route re-checks role and ownership against the database.
- `src/middleware.ts` — redirects signed-out / wrong-role visitors (UX only; real enforcement is in routes and layouts).
- `src/components/` — reusable UI (`ui/`), layouts, events, tickets, organizer, admin.
- `prisma/schema.prisma`, `prisma/seed.ts` — data model and Ethiopian seed data (dates are relative to the day you seed).

Key rules implemented: 10-minute ticket holds with race-safe stock checks, 5% platform fee included in the buyer's price, refunds instant inside the organizer's window (otherwise a request the organizer approves or declines), event cancellation refunds everyone, QR codes encode a random ticket code and check-in is compare-and-set so two scanners can't double-admit.

## Known limits (deliberately out of scope for the MVP)

- **Payments are simulated** (`src/lib/payments.ts`). Plug Chapa / Telebirr / CBE Birr behind the same `charge()` signature; keep card entry on the provider's hosted page.
- **Email/SMS are logged, not sent** (`src/lib/notify.ts`). Swap in an SMTP / SMS gateway there.
- Artwork is a set of generated styles, not image upload. Maps are a placeholder with a Google Maps link.
- Add rate limiting at the edge (login, holds) before going public. SQLite is for development; point `DATABASE_URL` at Postgres and change the datasource provider for production.
