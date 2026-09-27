# bangiya.samiti.iiith

Event site for the Bangiya Samiti at IIIT Hyderabad. It publishes the society's
festivals, takes registrations, collects UPI payments, issues QR entry passes by
email, and verifies those passes at the gate.

- **Framework:** Next.js 16.3 (App Router, Turbopack) with React 19.2
- **Database:** Supabase (Postgres)
- **Styling:** hand-written CSS in `app/globals.css` plus Tailwind 4 tooling
- **Email:** Nodemailer over SMTP
- **Deploy:** Vercel

New to the codebase? **[HOWTO.md](./HOWTO.md)** is a guided tour: how to run it,
what every page does, which file renders it, and how to walk each flow end to end.

Operational procedures — deploying, creating accounts, running migrations, event
day, incidents — live in [RUNBOOK.md](./RUNBOOK.md).

---

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill it in, see "Environment" below
npm run dev                  # http://localhost:3000
```

You need **Node 20.9+** (developed against Node 24). Without Supabase
credentials most public pages still render, because events are read from a JSON
file, but anything touching tickets will fail.

To work without a database at all, set `DUMMY_DB=True`. That swaps in the mock
client in `utils/supabase/mock-client.ts`, backed by a local JSON store.

---

## Environment

| Variable | Required | What it does |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable key, used by the browser and middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Secret key. Server-only; bypasses row-level security |
| `SESSION_SECRET` | strongly recommended | Signs admin session cookies. Falls back to `SUPABASE_SERVICE_ROLE_KEY`, which means rotating that key signs everyone out |
| `TIER1_EMAIL` / `TIER1_PASSWORD` | yes | The gate credential, shared by the gate staff |
| `TIER3_EMAIL` / `TIER3_PASSWORD` | yes | Super admin sign-in |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | for email | Pass delivery. Without `SMTP_USER`/`SMTP_PASS` sending is skipped with a warning rather than failing |
| `FROM_EMAIL` | no | Sender address; defaults to `SMTP_USER` |
| `NEXT_PUBLIC_APP_URL` | no | Absolute links in emails |
| `DUMMY_DB` | no | `True` runs against the local mock store |

> **The tier credentials have no defaults.** `utils/auth/admin-roles.ts`
> reads them from the environment and nowhere else. A tier without both an
> email and a password set has no account; with none of the three set, the
> admin area cannot be signed into, and the server log says so on the first
> attempt. This is deliberate - the defaults that used to be here were
> published, because the repository is.

---

## How it fits together

### Public flow

```
/                     home: hero, the two event cards, photo album, music player
/events               catalogue
/events/[slug]        five-step registration wizard
/pass/[token]         a QR pass
/durga-puja           map of 60+ pandals across Hyderabad
```

Registration, step by step: association → details → pass selection → UPI payment
→ receipt upload → confirmation. The form keeps a draft in `localStorage`, so a
half-finished registration survives a reload.

On submit, `POST /api/register` creates **one ticket row per pass**, each with
its own token, then emails either the QR passes (free events) or a
"payment pending" notice.

### Admin flow

```
/admin                overview
/admin/registrations  every ticket            tier 3
/admin/payments       verify or reject        tier 2+  (managers: scoped, see below)
/admin/check-ins      gate log                tier 2+
/admin/events         edit events             tier 3
/admin/managers       create manager profiles tier 3
/admin/playlist       homepage music          tier 3
/admin/scanner        QR scanner              tier 1+
```

### Where data lives

This is the thing to understand first, because it is split:

| Data | Source | Notes |
|---|---|---|
| Events | `public/data/events.json` | Read from disk via `utils/data/events.ts`. Each event carries a `config` blob: pass types, coupons, UPI ids, food preferences |
| Tickets, check-ins | Supabase | All access via the service-role client in API routes |
| Manager profiles | Supabase (`manager_profiles`) | Created by a super admin |
| Photo album | Supabase (`album_photos`), falling back to `public/data/album.json` | `GET /api/album` |
| Playlist | `public/data/playlists.json` | Imported at build time |

> **Events are kept in two places, and only one deployment owns the row.**
> The site reads `public/data/events.json`, which is per branch. The `events`
> table is shared by everything pointed at the same Supabase project, and is
> what `tickets.event_id` refers to. The editor and the open/lock toggle write
> both - but only where `EVENTS_DB_WRITES=true`, so opening an event on a dev
> branch cannot open it on the live site. Everywhere else the change stays in
> that deployment's own JSON, and the response says so.
>
> On Vercel the JSON write fails anyway (read-only filesystem), so on
> production the row is the durable half and the JSON has to be edited in the
> repository to match. `node scripts/sync-events.js --check` reports any
> difference; without `--check` it reconciles, and refuses to unless this
> environment owns the rows.

### Data model

`tickets` is the centre of gravity — one row per pass:

| Column | Meaning |
|---|---|
| `token` | `<registrationId>_<passCode>`, the value inside the QR |
| `event_id`, `participant_name`, `college_id`, `email`, `phone` | Who and what |
| `utr` | UPI transaction reference; `FREE-PASS` for free events |
| `receiver_upi` | Which UPI id was paid. Routes the payment to a manager |
| `payment_proof_url` | Receipt image. **Currently always null** — see Known gaps |
| `payment_status` | `PENDING` / `APPROVED` / `REJECTED` |
| `status` | `PENDING_PAYMENT` / `UNUSED` / `USED` / `PAYMENT_REJECTED` |
| `redeemed_at`, `redeemed_gate`, `redeemed_by` | Set at check-in |

Rows for one booking are grouped by `utr`, which is how the payments screen and
`/api/pass/verify` show "3 passes" rather than three separate payments.

---

## Authentication

Two kinds of admin account, both landing on `/admin/login`:

1. **Env-credential tiers.** Two fixed accounts from `TIER*_EMAIL` /
   `TIER*_PASSWORD`: tier 1 is the gate credential the gate staff share, tier 3
   is the super admin. There is deliberately no tier-2 pair - see below.
2. **Manager profiles.** Rows in `manager_profiles`, created by a super admin at
   `/admin/managers`, with a username, a scrypt-hashed password and a UPI id.
   They sign in at tier 2. This is the only way a manager exists: a shared
   manager password passed between people could not be scoped to anybody's
   takings, which is the whole point of the tier. Adding a manager also adds
   their UPI id, and the QR generated from it, to the registration payment
   step.

The session is a **signed cookie**: `v2.<tier>.<subject>.<expiry>.<hmac>`, HMAC
covering the whole payload, so neither the tier nor the manager identity can be
edited by the browser. `subject` is the manager's profile id, or `-` for a tier
account. Web Crypto is used throughout so the same code runs in the proxy
(middleware) and in Node.

Authorisation is enforced in two places, and both matter:

- **Pages** redirect on tier (`app/admin/*/page.tsx`).
- **API routes** call `requireAdmin(n)`. Without this a tier-1 account could
  call the admin endpoints directly.

### Manager scoping

A manager sees only the payments whose `receiver_upi` matches their own. This is
applied on the list **and** on the individual approve and reject routes —
filtering only the list would let a manager act on someone else's payment by
calling the route with its token. If the profile is missing or disabled the
scope fails closed (403) rather than falling back to showing everything.

---

## Receipt OCR

When a visitor uploads their payment receipt, Tesseract reads it **in the
browser** and extracts the transaction id and the receiver's UPI id. The image
never leaves the device to be read — these are screenshots of someone's bank
app. The engine is imported dynamically, so it is only downloaded once a receipt
is actually chosen.

- `utils/ocr/receipt.ts` — pure extraction from OCR text; no imports, unit-testable
- `utils/ocr/read-receipt.ts` — runs Tesseract and hands the text to the above

Receipts list the payer's handle as well as the payee's, so when several UPI ids
appear the one the event actually collects on wins. Anything not found with
confidence is left blank and the form asks the visitor to type it.

---

## The homepage music player

`components/hero-playlist.tsx` overlays a player on the events video. It takes
either a **YouTube playlist link** or **audio files you host**.

Set the playlist from **/admin/playlist** (super admin). It is stored in
Supabase rather than in a file, because the filesystem is read-only on Vercel.
Only the extracted playlist id is stored, never the pasted URL, and the id is
validated again every time the homepage renders it — so nothing that reaches
the page can carry a scheme, a host or markup.

`public/data/playlists.json` remains as the fallback when nothing is configured,
and is the way to ship hosted audio files; that format is documented in
`utils/data/playlists.ts`. With neither set, the player does not render at all.

The YouTube embed stays visible as a small tile because YouTube's terms require
their player to be shown while it plays.

---

## Layout

```
app/                  routes: pages and API handlers
components/           shared React components
utils/
  auth/               sessions, tiers, manager profiles, payment scoping
  data/               events, playlists
  db/                 PostgREST filter escaping, ticket lookup
  ocr/                receipt reading
  supabase/           server, browser and mock clients
public/data/          events.json, album.json, playlists.json, pujas dataset
supabase/             schema and migrations
scripts/              operational tooling (see RUNBOOK.md)
others/               quarantined: prototypes, duplicates, one-off scripts
```

`others/` is excluded from `tsconfig.json` and ignored by ESLint. See
[others/README.md](./others/README.md).

---

## Conventions

- **Read the Next docs in `node_modules/next/dist/docs/` before writing code.**
  This is Next 16; it has breaking changes, and `AGENTS.md` requires it.
- `middleware.ts` is deprecated in Next 16 in favour of `proxy.ts`. It still
  works and warns on every build; migrate with
  `npx @next/codemod@canary middleware-to-proxy .`
- Never interpolate user input into a PostgREST filter string. Use
  `escapeLikePattern` from `utils/db/filters.ts`, or the typed builders. An
  unescaped `%` matches every row.
- Anything that sends email or writes on behalf of an anonymous caller should be
  rate limited (`utils/rate-limit.ts`).
- `npm run lint` is **broken**: `next lint` was removed in Next 16. Use
  `npx eslint .` instead.

---

## Known gaps

Carried deliberately, not oversights:

1. **Receipt images are never stored.** The form reads the receipt with OCR but
   does not upload it, so `payment_proof_url` stays null and verifiers cannot
   eyeball the receipt beside the UTR. Needs a private Supabase Storage bucket.
2. **Event edits are lost on Vercel** (read-only filesystem) — see above.
3. **Pricing ignores `config.pass_types`.** `app/api/register/route.ts` charges
   `event.price` or a hardcoded ₹350, so a mixed Veg/Non-Veg booking is billed
   incorrectly.
4. **Pass count mismatch.** The UI offers up to 10 passes; `utils/schemas.ts`
   caps `numPasses` at 6, so 7+ fails validation.
5. **`vegCount`/`nonVegCount` are stripped by Zod**, so the per-pass food split
   never reaches the database.
6. **`tickets.redeemed_by` / `checkins.scanned_by` are `uuid`** but tier accounts
   have synthetic ids, so those columns are written as null for them.
7. **No admin can sign in until the `TIER*_` variables are set.** The defaults
   that used to stand in for them were published in this repository, so they
   were removed: a tier with nothing configured now has no account, and an
   installation with none configured cannot be signed into at all. The startup
   log says so when that is the case.
8. **`scratch/api_debug.log` is still in git history** with attendee emails and
   live pass tokens. See the incident section of the runbook.

## Open question: two audio sources on the hero

The home page hero now has two independent players: the chonga mic
(`/assets/mahalaya_audio.mp3`, unlocks 10 October) added in `crossfade-video.tsx`,
and the playlist player. They do not overlap visually - the mic sits at the top,
the player at the bottom - but nothing stops both playing at once once the mic
unlocks. Options: make them mutually exclusive, hide the playlist player while
the mic is unlocked, or leave it and simply not set a playlist in October.
