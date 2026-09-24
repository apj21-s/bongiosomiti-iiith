# bangiya.samiti.iiith — Production Build Prompt (Next.js + Supabase)

## How to use this prompt

Paste this whole document into the coding LLM/agent, **and attach the current prototype files alongside it**: the four `index.html` variants (home/`BONGIO.SOMITI`, `/login/`, `/pass/`, `/scanner/` redirect), `site.js`, `styles.css`, and `qrcode.js`.

Tell the agent explicitly: *"The attached files are a finished theme/UX prototype. They are the source of truth for visual design, copy, page structure, and business-logic branching. They are NOT the target architecture — everything runs on `localStorage` as a fake database with no real security. Rebuild it as a real Next.js + Supabase app per the spec below, reproducing every page and interaction, but backed by a real, secure system."*

---

## 1. What this app is

bangiya.samiti.iiith is a digital event-pass platform. The current instance is branded for **BONGIO.SOMITI** (a Bengali cultural community group at IIIT Hyderabad) running events like Mahalaya Bhoj and Saraswati Puja. Attendees register, get a QR pass, and show it at the gate; organisers manage events, approve payments, and scan passes for entry.

Keep the dual branding exactly as in the prototype: the home page is `BONGIO.SOMITI`-branded; login, pass, and admin pages are `bangiya.samiti.iiith`-branded. Don't merge or rename them.

## 2. Non-negotiables — reproduce exactly

- Every page/route in the prototype (list in §7) — no dropped or merged pages.
- Visual design: layout, spacing, color system, typography, animations (scroll-reveal, story-gallery lightbox, toast notifications).
- All copy, including the Bengali text on the home page.
- The digital pass card layout and its printable view (`window.print()` on the print button).
- Filtering/search/export behavior on admin registrations and payments pages (including the CSV export).
- **Port `styles.css` as the global stylesheet essentially verbatim.** Do not rewrite it in Tailwind or redesign it. Componentize the HTML into React while keeping the same class names and DOM structure the CSS already targets. This is the fastest way to guarantee pixel parity.

## 3. What's fake in the prototype → what must become real

This is the actual point of the rebuild. Everything below is a genuine security/correctness gap in the attached code, not a style choice:

| Prototype behavior | Problem | Required real behavior |
|---|---|---|
| `UtsavDB` reads/writes `localStorage` | No real persistence, nothing shared across devices/browsers | Supabase Postgres is the single source of truth |
| Admin login accepts any email, no password check | Anyone can "log in" as organiser | Real Supabase Auth (email + password), session-gated |
| No route guard on `/admin/*` pages | Admin pages just don't render widgets if you bypass login, but nothing blocks direct access | Server-side session check on every admin route + middleware redirect |
| Registration auto-approves payment instantly ("for seamless offline testing") | A paid ticket is valid before anyone checks the money moved | Paid tickets start `PENDING`; only an authenticated admin action flips them to `APPROVED` |
| Scanner validates and redeems tickets entirely in client JS against `localStorage` | Anyone can open devtools and call `UtsavDB.recordCheckin()` to forge entry, or mark any ticket `USED` | Validation and redemption happen in a server route/RPC the client cannot bypass |
| No concurrency control on check-in | Two gates scanning the same duplicated QR simultaneously could both succeed | Atomic conditional update (`WHERE status != 'USED'`) or a Postgres function, so only one redemption ever wins |
| `capacity` field exists and is *displayed* but never enforced | Events can be oversold | Registration must reject once `capacity` is reached |
| Tokens generated client-side (`Date.now()` + `Math.random()`) | Guessable/collidable, and trivially forgeable since nothing checks them server-side anyway | Tokens generated server-side on insert, unique-constrained, never accepted from the client |
| No payment proof artifact — just a free-text UTR string | No evidence for the admin to actually verify against | Optional screenshot upload to Supabase Storage, private bucket, signed URL for admin viewing only |

## 4. Tech stack

- **Next.js 14+, App Router, TypeScript.**
- **Supabase**: Postgres (schema in §6), Supabase Auth for admin/organiser accounts, Supabase Storage for payment-proof screenshots.
- **`@supabase/ssr`** for browser + server Supabase clients (not the deprecated auth-helpers package).
- Two Supabase clients in code: an **anon client** (safe for the browser, RLS-restricted) and a **service-role client** (server-only, used inside Route Handlers for privileged reads/writes — never bundled to the client).
- **zod** for validating all API input.
- QR rendering: port the existing `qrcode.js` logic into a small React `<QRCode token={...}>` component (it's a clean, dependency-free SVG QR encoder — keep it, just wrap it). Validation of what a scanned QR means is **always** a server call, regardless of how the QR image itself is rendered.

## 5. Data model — field mapping (prototype → Postgres)

Drop the prototype's unused `gate` field on tickets (it was set once at registration to a hardcoded "Gate 1" and never meaningfully used) — only `redeemed_gate`/`redeemed_at`, set at actual check-in time, matter.

```
events
  id            uuid pk default gen_random_uuid()
  slug          text unique not null
  name          text not null
  event_date    date not null
  venue         text not null
  capacity      int not null
  price         int not null default 0        -- paise/rupees, 0 = free
  category      text
  description   text
  image_url     text
  status        text not null default 'OPEN'  -- OPEN | CLOSED
  created_at    timestamptz default now()

tickets
  id                uuid pk default gen_random_uuid()
  token             text unique not null       -- server-generated, e.g. MBH-<base36 time>-<4 char rand>
  event_id          uuid references events(id)
  participant_name  text not null
  college_id        text
  email             text
  phone             text
  utr               text                        -- attendee-entered payment reference
  payment_proof_url text                        -- private storage path, nullable
  amount            int not null                -- snapshot of event.price at registration time
  payment_status    text not null default 'PENDING'  -- PENDING | APPROVED | REJECTED
  status            text not null default 'PENDING_PAYMENT' -- PENDING_PAYMENT | UNUSED | USED | PAYMENT_REJECTED
  redeemed_at       timestamptz
  redeemed_gate     text
  redeemed_by       uuid references admin_profiles(id)
  created_at        timestamptz default now()

checkins
  id            uuid pk default gen_random_uuid()
  ticket_id     uuid references tickets(id)
  gate          text not null
  scanned_by    uuid references admin_profiles(id)
  created_at    timestamptz default now()

admin_profiles
  id      uuid pk references auth.users(id)
  name    text
  email   text
  role    text not null default 'organiser'   -- organiser | scanner
```

Free events (`price = 0`) insert directly as `payment_status = 'APPROVED'`, `status = 'UNUSED'` — same as the Saraswati Puja demo ticket in the prototype's seed data.

## 6. Row-Level Security & access model

- `events`: public `select` where `status = 'OPEN'` (anon key). All writes go through server routes only (service role).
- `tickets`, `checkins`: **deny all to anon** — no direct client reads/writes at all. Every read (pass lookup, pass detail, admin lists) and every write goes through a Next.js Route Handler using the service-role client. This is deliberate: it keeps one place to enforce "who can see whose PII" and "who can redeem a ticket," instead of leaning on RLS edge cases.
- `admin_profiles`: a user may `select` their own row (`id = auth.uid()`). Role checks for every admin/scanner action happen server-side by reading this table inside the Route Handler, not by trusting anything from the client.

## 7. Pages (reproduce all of these)

Public:
- `/` — home (`BONGIO.SOMITI`, hero, events section, story gallery)
- `/events` — events catalog
- `/events/[slug]` — event detail + registration form
- `/login` — pass lookup by College ID / Email / Phone / Token
- `/pass/[token]` — digital pass with QR, print button, "lookup another pass" box
  - *Deliberate change from the prototype's `pass/index.html?token=`: use a proper dynamic route segment. Update every internal link that pointed at the old query-string form (registration redirect, admin tables, scanner result links, pass-page's own "lookup" redirect).*

Admin (all behind auth + middleware):
- `/admin/login`
- `/admin` — dashboard (stats, recent registrations, recent check-ins)
- `/admin/events`, `/admin/events/new`
- `/admin/registrations` — search/filter/export CSV
- `/admin/payments` — approve/reject
- `/admin/check-ins` — log + undo
- `/admin/scanner` — camera QR scan (`BarcodeDetector` where available) + manual token entry + gate select

Keep the root `/scanner` → `/admin/scanner` redirect.

## 8. API contract (Route Handlers under `app/api/`)

Public:
- `GET /api/events` — open events
- `GET /api/events/[slug]`
- `POST /api/register` — body: `{eventSlug, participantName, collegeId, email, phone, utr?, proofFile?}`. Server: checks capacity (count of `PENDING`+`APPROVED` tickets for that event `< capacity`, else reject), generates token, sets `payment_status`/`status` per the free/paid rule above, uploads proof file if present.
- `POST /api/pass/lookup` — body: `{query}`. Matches token/collegeId/email/phone. Rate-limit this (e.g. per-IP) since it's an unauthenticated lookup.
- `GET /api/pass/[token]` — single ticket by exact token, for rendering the pass page.

Admin (session + `role = organiser` required unless noted):
- `GET /api/admin/stats`
- `GET /api/admin/events` / `POST /api/admin/events` / `DELETE /api/admin/events/[slug]`
- `GET /api/admin/registrations` (query params for search/event/status filters)
- `DELETE /api/admin/registrations/[token]`
- `GET /api/admin/payments`
- `POST /api/admin/payments/[token]/approve` / `POST /api/admin/payments/[token]/reject`
- `GET /api/admin/checkins`
- `POST /api/admin/checkins/[id]/undo`

Scanner (session + `role` in `{organiser, scanner}`):
- `POST /api/scanner/lookup` — body: `{token, eventSlug}`. Returns the same outcome enum the prototype already defines: `VALID | ALREADY_USED | PAYMENT_PENDING | BLOCKED | INVALID`. Reimplement `lookupTicket()`'s exact branching from `site.js`.
- `POST /api/scanner/checkin` — body: `{token, gate}`. Must **re-validate server-side** (never trust the client's last lookup result) and redeem atomically — see §9.

## 9. Redemption must be race-safe

Implement as a single conditional update (or a Postgres RPC function) equivalent to:

```sql
update tickets
set status = 'USED', redeemed_at = now(), redeemed_gate = $gate, redeemed_by = $admin_id
where token = $token and status = 'UNUSED'
returning *;
```

If it returns zero rows, the ticket was already used (or never valid) — report that instead of a generic error. This is what actually prevents the "two scanners, one duplicated QR" race that the prototype's client-side check can't.

## 10. Payment flow (manual, as in the prototype — kept intentionally)

- Paid event registration → ticket created `PENDING`/`PENDING_PAYMENT`, attendee enters a UTR and may attach a screenshot.
- Free event registration → `APPROVED`/`UNUSED` immediately.
- Admin `/admin/payments` approve → `APPROVED`/`UNUSED`. Reject → `REJECTED`/`PAYMENT_REJECTED`.
- Scanner treats `PENDING_PAYMENT` and `PAYMENT_REJECTED` as non-enterable, matching the prototype's `PAYMENT_PENDING` outcome.
- This is the one place the prototype's *shortcut* (instant auto-approval) must NOT be reproduced — the UI/workflow stays the same, but paid tickets must actually wait for a real admin action.

## 11. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-only, never sent to the client
```

## 12. Seed data

Port the prototype's `SEED_EVENTS` and `SEED_TICKETS` (Mahalaya Bhoj, Saraswati Puja, and the four demo tickets — unused/used/pending) into a Supabase seed script, plus one demo admin account, so local dev matches the prototype's demo state exactly.

## 13. Acceptance checklist (verify before calling it done)

- [ ] `/admin/**` is unreachable without a valid session (middleware redirect to `/admin/login`, not just a hidden widget).
- [ ] Registering for a paid event produces a `PENDING` ticket that the scanner correctly refuses.
- [ ] Approving payment in `/admin/payments` is the only thing that makes that ticket enterable.
- [ ] Scanning the same valid token twice — including two near-simultaneous requests — succeeds exactly once.
- [ ] Registering past an event's `capacity` is rejected.
- [ ] The anon Supabase key cannot read or write `tickets` or `checkins` directly (test in the Supabase SQL editor / a raw fetch with the anon key).
- [ ] Every page from §7 exists and visually matches the attached prototype.
