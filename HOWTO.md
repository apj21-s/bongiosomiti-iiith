# How to navigate this site

A guided tour for someone who has just cloned the repository: how to get it
running, what every page does, which file renders it, and how to walk each flow
end to end.

- Architecture and design decisions: [README.md](./README.md)
- Operating the live site: [RUNBOOK.md](./RUNBOOK.md)

Everything below was walked through on 27 September 2026 against Next 16.3.6;
the expected output shown is what it actually produced.

---

## 1. Get it running

```bash
node --version          # needs 20.9+, developed on 24
npm install
cp .env.example .env.local
npm run dev             # http://localhost:3000
```

Fill in `.env.local` before anything that touches the database. The minimum to
see the public site is the three Supabase values; without them the public pages
still render (events come from a JSON file) but tickets fail.

**No database at all?** Set `DUMMY_DB=True` and it runs on a local mock store.

Two things that will bite you early:

- **Stop the dev server before `npm run build`.** Both use `.next`, and on
  Windows the build dies with `EPERM: operation not permitted, unlink`.
- **`npm run lint` is broken** — `next lint` was removed in Next 16. Use
  `npx eslint .`

---

## 2. The map

| URL | What it is | Rendered by |
|---|---|---|
| `/` | Home: hero, the two event cards, music player, photo album | `app/page.tsx` |
| `/events` | Event catalogue | `app/events/page.tsx` |
| `/events/[slug]` | Event detail + 5-step registration | `app/events/[slug]/page.tsx`, `RegistrationForm.tsx` |
| `/durga-puja` | Map of 60+ pandals in Hyderabad | `app/durga-puja/page.tsx` |
| `/pass/[token]` | A single QR pass | `app/pass/[token]/page.tsx` |
| `/admin/login` | Sign-in for every kind of admin | `app/admin/login/page.tsx` |
| `/admin` | Dashboard; content varies by tier | `app/admin/page.tsx` |
| `/admin/scanner` | Gate QR scanner | `app/admin/scanner/page.tsx` |
| `/admin/check-ins` | Gate log, with undo | `app/admin/check-ins/` |
| `/admin/payments` | Verify or reject payments | `app/admin/payments/` |
| `/admin/registrations` | Every ticket | `app/admin/registrations/` |
| `/admin/events` | Edit events | `app/admin/events/` |
| `/admin/managers` | Create manager profiles | `app/admin/managers/` |
| `/admin/playlist` | Homepage music | `app/admin/playlist/` |

`/pass` and `/durga-puja` both contain a `should404()`-style gate near the top
of the file. `/pass` is currently disabled that way; `/durga-puja` is live.

---

## 3. Signing in

All four kinds of account use the same form at `/admin/login`.

| Account | Credentials from | Tier |
|---|---|---|
| Gate staff | `TIER1_EMAIL` / `TIER1_PASSWORD` | 1 |
| Manager | `TIER2_EMAIL` / `TIER2_PASSWORD` | 2 |
| Super admin | `TIER3_EMAIL` / `TIER3_PASSWORD` | 3 |
| Manager profile | Created at `/admin/managers`, stored in Supabase | 2 |

If the `TIER*_` variables are unset, the defaults in
`utils/auth/admin-roles.ts` apply. They are public, so set them for anything
real.

**What each tier sees** — verified, `307` means redirected away:

| Page | Tier 1 | Tier 2 | Tier 3 | Signed out |
|---|---|---|---|---|
| `/admin` | 200 | 200 | 200 | 307 |
| `/admin/scanner` | 200 | 200 | 200 | 307 |
| `/admin/check-ins` | 307 | 200 | 200 | 307 |
| `/admin/payments` | 307 | 200 | 200 | 307 |
| `/admin/registrations` | 307 | 307 | 200 | 307 |
| `/admin/events` | 307 | 307 | 200 | 307 |
| `/admin/managers` | 307 | 307 | 200 | 307 |
| `/admin/playlist` | 307 | 307 | 200 | 307 |

The page redirect is only the first gate. Every admin API route calls
`requireAdmin(n)` as well (`utils/auth/require-admin.ts`) — without that, a
tier-1 account could call the endpoints directly.

---

## 4. Walking each flow

### 4.1 Registration (public)

1. Open `/events/mahalaya`.
2. If the card says **"Registrations Opening Soon"**, the event's `status` in
   `public/data/events.json` is `LOCKED`. Set it to `OPEN` and save; the dev
   server recompiles.
3. Step through: association → details → passes → payment → receipt →
   confirmation.
4. At the receipt step, upload any image. Tesseract reads it **in the browser**
   and fills in the transaction ID and the UPI ID paid to. Whatever it cannot
   read, it asks you to type, and says so in the status line.
5. Submit. `POST /api/register` writes **one ticket row per pass**.

Things worth knowing while testing:

- The form keeps a draft in `localStorage`, so a reload does not lose it. Clear
  it with `localStorage.removeItem('bangiya.samiti.iiith_registration_draft_v4_mahalaya')`.
- Without SMTP configured, the app **logs a warning and skips the email** —
  registration still appears to succeed.
- With the event locked, the API refuses:
  ```bash
  curl -s -X POST -H 'Content-Type: application/json' \
    --data '{"eventSlug":"mahalaya","participantName":"T","email":"t@example.invalid","numPasses":1}' \
    http://localhost:3000/api/register
  # -> 400 {"error":"Event is closed for registration"}
  ```

### 4.2 Payment verification (tier 2+)

1. Sign in as tier 2 and open `/admin/payments`.
2. Filter to `PENDING (Action Required)`.
3. **VERIFY** approves the whole booking (every ticket sharing that UTR) and
   emails the passes. **REJECT** marks it rejected and emails to say so.

A **manager profile** sees only the payments whose `receiver_upi` matches its
own UPI id. That scope is enforced on the approve and reject routes too, not
just the list — otherwise a manager could act on someone else's payment by
calling the route with its token.

### 4.3 The gate scanner (tier 1+)

Open `/admin/scanner`. The camera needs **HTTPS**; on plain HTTP it falls back
to manual entry.

The round trip, exercised against the seed ticket:

```bash
C=bangiya.samiti.iiith_dummy_session          # $T1 = a tier-1 session cookie
B=http://localhost:3000

curl -s -X POST -H "Cookie: $C=$T1" -H 'Content-Type: application/json' \
  --data '{"token":"MBH-DEMO-001","eventSlug":"all"}' $B/api/scanner/lookup
# -> VALID  "Pass verified & valid for entry."

curl -s -X POST -H "Cookie: $C=$T1" -H 'Content-Type: application/json' \
  --data '{"token":"MBH-DEMO-001","gate":"Gate 1"}' $B/api/scanner/checkin
# -> SUCCESS "Check-in successful"

# scanning again is refused
# -> ALREADY_USED "Ticket has already been redeemed"
```

Undo it afterwards so the seed data is unchanged: `/admin/check-ins` →
**Undo Entry** (tier 3 only). The ticket returns to `UNUSED` and the check-in
row is deleted.

### 4.4 Manager profiles (tier 3)

Needs `supabase/manager-profiles.sql` run first. Until then the list is empty
rather than broken.

1. `/admin/managers` → username, password (8+ chars), and **the UPI ID that
   manager collects on**.
2. Give them the username and password; they sign in at `/admin/login`.
3. Disable to revoke access and keep the audit trail; delete to remove it.

Passwords are scrypt hashes and cannot be read back — to reset one, delete the
profile and recreate it.

### 4.5 Homepage music (tier 3)

Two sources, in priority order:

1. **`/admin/playlist`** — paste a YouTube playlist link. Stored in Supabase;
   needs `supabase/site-playlist.sql`.
2. **`public/data/playlists.json`** — the fallback, and the way to ship audio
   files you host. The simplest form is just the link:
   ```json
   ["https://www.youtube.com/playlist?list=PLxxxxxxxx"]
   ```

The playlist must be **public or unlisted**; YouTube will not embed a private
one. With neither source set, the player does not render at all — that is the
usual reason for "I can't see the player".

> The JSON file is imported at **build time**. Editing it locally recompiles,
> but on Vercel it needs a commit and redeploy. The admin UI does not, which is
> why it exists.

### 4.6 The two audio controls

There are two independent audio sources on the home page hero:

| Control | Where | Source |
|---|---|---|
| Chonga mic | top of the hero | `/assets/mahalaya_audio.mp3`, unlocks 10 Oct |
| Playlist player | bottom of the hero | YouTube playlist or hosted files |

They do not overlap visually, but **nothing stops both playing at once** once
the mic unlocks. See the open question at the end of `README.md`.

---

## 5. Checking your work

```bash
npx tsc --noEmit      # types
npx eslint .          # lint (NOT npm run lint)
npm run build         # production build - stop the dev server first
npm audit             # should report 0 vulnerabilities
```

### A quick authorisation smoke test

The one test worth running after touching anything in `utils/auth/`:

```bash
C=bangiya.samiti.iiith_dummy_session
B=http://localhost:3000

# a forged cookie must not be admin
curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: $C=admin-tier-3" \
  $B/api/admin/registrations                    # expect 401

# a wildcard must never return a pass token
curl -s -X POST -H 'Content-Type: application/json' \
  --data '{"query":"%"}' $B/api/pass/lookup     # expect 404

# a real token still resolves
curl -s -X POST -H 'Content-Type: application/json' \
  --data '{"query":"MBH-DEMO-001"}' $B/api/pass/lookup   # expect 200
```

### Minting a session cookie for API testing

The admin cookie is signed, so you cannot hand-write one. Mint it with the
app's own function:

```js
// mint.mjs - run with: node mint.mjs
import fs from 'node:fs'
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]
}
const { createSessionToken } = await import('./utils/auth/session.ts')
for (const tier of [1,2,3]) console.log(tier, await createSessionToken(tier))
```

Set it as `bangiya.samiti.iiith_dummy_session`. Signing in through the form
does the same thing.

---

## 6. Where things live

```
app/
  page.tsx              home page - hero, events tabs, player, album
  events/[slug]/        event detail + RegistrationForm (the 5-step wizard)
  admin/                one folder per admin screen
  api/                  route handlers; every admin one calls requireAdmin(n)
components/
  hero-playlist.tsx     the music player
  crossfade-video.tsx   the looping video + the chonga mic audio
  scroll-reveal.tsx     adds is-revealed as elements enter the viewport
utils/
  auth/                 sessions, tiers, manager profiles, payment scoping
  data/                 events, playlists, the admin playlist setting
  db/                   PostgREST filter escaping and ticket lookup
  ocr/                  reading payment receipts
public/data/            events.json, album.json, playlists.json
supabase/               schema and migrations - run these in order
others/                 quarantined; not built, not linted, not served
```

---

## 7. When something looks broken

| Symptom | Cause |
|---|---|
| Page loads but is blank below the header | Scroll reveals did not fire. Everything with `.scroll-reveal` starts at `opacity: 0`. Also expected in a **backgrounded tab** — an IntersectionObserver does not run there |
| No music player | No playlist configured. See §4.5 |
| "Registrations Opening Soon" | The event's `status` is `LOCKED` in `events.json` |
| Registration succeeds, no email | `SMTP_USER` / `SMTP_PASS` unset — sending is skipped with a warning |
| Admin edits to events vanish | Expected on Vercel: the write goes to `public/data/events.json` on a read-only filesystem. Edit in git and redeploy |
| Manager sees no payments | Migration not run, or `receiver_upi` does not match their UPI id |
| Everyone signed out after a deploy | The session format or `SESSION_SECRET` changed. Sign in again |
| `EPERM ... unlink` during build | The dev server is running. Stop it first |
| Camera does nothing on the scanner | Needs HTTPS. Use manual entry locally |

---

## 8. Before you touch the auth or lookup code

Two rules that are load-bearing:

1. **Never interpolate user input into a PostgREST filter string.** Use
   `escapeLikePattern` from `utils/db/filters.ts` or the typed builders. An
   unescaped `%` matches every row — that was a real bug here, and it returned
   live pass tokens to anonymous callers.
2. **Anything that identifies the caller must come from the signed session**,
   not from a header, query parameter or body. The manager id that scopes
   payments travels inside the cookie signature for exactly this reason.
