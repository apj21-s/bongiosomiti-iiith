# Runbook

Operating the bangiya.samiti.iiith site: setup, event day, and what to do when
something breaks. For how the code is arranged, see [README.md](./README.md).

---

## 1. First-time setup

### 1.1 Database

Run these in the Supabase SQL editor, in order:

| File | What it creates |
|---|---|
| `supabase/schema.sql` | `events`, `admin_profiles`, `tickets`, `checkins`, RLS |
| `supabase/manager-profiles.sql` | `manager_profiles`, `tickets.receiver_upi` |
| `supabase/album_migration.sql` | `album_photos` for the homepage gallery |
| `supabase/seed.sql` | Demo events, tickets and an admin. **Skip in production** |

All are safe to re-run. The manager feature does nothing until
`manager-profiles.sql` has been applied — the manager list stays empty rather
than erroring.

### 1.2 Environment variables

Set every variable from the README's table in the Vercel project settings, for
Production *and* Preview. Two are easy to miss:

- **`SESSION_SECRET`** — if unset, session signing falls back to
  `SUPABASE_SERVICE_ROLE_KEY`, which means rotating the Supabase key silently
  signs every admin out. Set it explicitly to a long random string.
- **`TIER1/2/3_EMAIL` and `_PASSWORD`** — if unset, the public defaults in
  `utils/auth/admin-roles.ts` are live credentials on your production site.

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 1.3 Deploy

Vercel builds from `main`. Confirm which Supabase project the deployment points
at before assuming anything about the data:

```bash
# in Vercel → Settings → Environment Variables
NEXT_PUBLIC_SUPABASE_URL
```

Development happens on `dev`. Keep it current before starting work:

```bash
git fetch --all --prune
git checkout dev
git merge origin/main        # always the remote ref, never a stale local main
```

---

## 2. Accounts

### 2.1 The three tier accounts

Fixed, and configured only through environment variables. Changing one means
changing the variable in Vercel and redeploying. There is no UI for them.

| Tier | Role | Can reach |
|---|---|---|
| 1 | Gate staff | Scanner, check-in activity |
| 2 | Manager | + payments, check-in log |
| 3 | Super admin | + registrations, events, manager profiles |

### 2.2 Creating a manager profile

1. Sign in as tier 3 and open **/admin/managers**.
2. Enter a username, a password of at least 8 characters, and **the UPI ID that
   manager collects payments on**.
3. Hand them the username and password. They sign in at `/admin/login` like
   everyone else.

That manager will see, and be able to act on, **only** the payments whose
receiver UPI matches theirs. Disable a profile to revoke access without losing
the audit trail; delete it to remove it entirely.

Passwords are stored as scrypt hashes and cannot be read back. To reset one,
delete the profile and create it again.

### 2.3 Sessions

Sessions last 24 hours. Changing `SESSION_SECRET`, rotating the Supabase
service-role key, or deploying a change to the session format signs everyone
out; they simply sign in again with the same credentials.

---

## 3. Before an event

1. **Open registrations.** Set `"status": "OPEN"` for the event in
   `public/data/events.json`, commit, and deploy. The admin toggle exists but
   does not persist on Vercel.
2. **Check the UPI ids.** `config.upi_ids` in the same file is what the
   registration form offers, and what the OCR matches a receipt against. Each
   one that a manager will verify needs a matching `manager_profiles.upi_id`.
3. **Send a test registration** on the live site and confirm the pass email
   arrives. If it does not, see §6.1.
4. **Confirm capacity.** `capacity` counts tickets whose `payment_status` is
   `PENDING` or `APPROVED`, so abandoned registrations do occupy places.

---

## 4. Payment verification

Day-to-day work for managers, at **/admin/payments**.

1. Filter to `PENDING (Action Required)`.
2. For each row, check the UTR against your own UPI statement.
3. **VERIFY** marks the booking `APPROVED` and emails the QR passes to the
   registrant. **REJECT** marks it rejected and emails them to say so.

Both act on the whole booking — every ticket sharing that UTR — not one pass.

A manager sees only their own UPI's payments. A super admin sees everything. If
a payment is missing from a manager's list, the usual cause is that
`receiver_upi` was not captured or was captured as a different handle: check the
row in Supabase.

---

## 5. Event day

### 5.1 The gate scanner

- Open **/admin/scanner** on a phone, signed in as any tier.
- **HTTPS is required for the camera.** On plain HTTP the camera silently fails
  and the page offers manual entry instead.
- Pick the gate in the top-right before scanning; it is recorded against every
  check-in.

Outcomes:

| Result | Meaning |
|---|---|
| `VALID` | Let them in, then press check-in |
| `ALREADY_USED` | The pass has been scanned. The screen shows the gate and time |
| `PAYMENT_PENDING` | Payment was never verified. Send them to a manager |
| `INVALID` | No such token |

Check-in is a single conditional update, so two gates scanning the same pass at
the same instant cannot both succeed.

### 5.2 Undoing a check-in

Tier 3 only, at **/admin/check-ins** → *Undo Entry*. It returns the pass to
`UNUSED` and deletes the check-in row.

### 5.3 Re-sending a pass

If an attendee never received their email:

```bash
node scripts/resend-passes.js --url https://your-site.example someone@example.com
```

It drives the same endpoint the site uses and is rate limited to 3 sends per
address per 10 minutes.

---

## 6. Troubleshooting

### 6.1 Passes are not arriving

1. Check `SMTP_USER` and `SMTP_PASS` are set. Without them the app **logs a
   warning and skips sending** rather than failing, so registration still looks
   successful.
2. Check the Vercel function logs for `[email] Transporter error`.
3. Confirm the address on the ticket row is right.
4. Re-send with the script above.

### 6.2 "Approve" returns a 500 but the payment looks approved

Historically caused by debug writes to `scratch/api_debug.log` on Vercel's
read-only filesystem, after the database update had already landed. Those writes
were removed. If it recurs, look for any new `fs` write in the request path.

### 6.3 Check-in fails with `invalid input syntax for type uuid`

`redeemed_by` and `scanned_by` are `uuid` columns and the tier accounts have
synthetic ids like `admin-tier-1`. The code now writes null for them. If this
appears again, something is passing a non-uuid id straight through — see
`utils/auth/db-identity.ts`.

### 6.4 The page loads but is blank below the header

Scroll reveals are stuck: every `.scroll-reveal` element starts at `opacity: 0`
and is revealed by an IntersectionObserver. If the observer never runs, the page
stays invisible. `components/scroll-reveal.tsx` now re-scans, always installs a
MutationObserver, and sweeps anything already in view. If it recurs, check the
browser console for an error thrown during hydration.

Note that an IntersectionObserver does not fire in a **backgrounded tab**, so
automated screenshots of a hidden tab legitimately look blank.

### 6.5 An admin cannot sign in after a deploy

Expected if the session format or `SESSION_SECRET` changed — sessions are
invalidated and everyone signs in again. If nobody can sign in, check the
function logs for:

```
[session] Neither SESSION_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set.
```

### 6.6 A manager sees no payments

- Has `supabase/manager-profiles.sql` been run?
- Does `manager_profiles.upi_id` exactly match the `receiver_upi` on the
  tickets? Comparison is case-insensitive but otherwise exact.
- Is the profile still enabled? A disabled or deleted profile returns 403.

### 6.7 Event edits disappear

Expected. `public/data/events.json` is written on disk, which Vercel discards.
Edit the file in git and redeploy.

---

## 7. Incidents

### 7.1 Leaked pass tokens

`scratch/api_debug.log` was committed to a **public** repository and contains 17
attendee email addresses and 13 live pass tokens. A token is the QR payload, so
each one is a working gate credential.

The file has been removed from the working tree, but **it is still in git
history.** Two things are outstanding:

1. **Rotate the tokens.** `supabase/rotate-leaked-tokens.sql` re-rolls the pass
   code half of each affected token, keeping the registration id so payment
   records still line up. Run the `SELECT` first to see who is affected, then
   re-send their passes with `scripts/resend-passes.js`.
2. **Purge the history.** Requires `git filter-repo` or BFG plus a force-push,
   rewriting history on both `dev` and `main`. Coordinate with anyone holding a
   clone. The repository has no forks, which limits the blast radius.

Run the rotation against whichever Supabase project **production** uses.

### 7.2 Suspected credential exposure

1. Rotate the Supabase service-role key in the Supabase dashboard, then update
   Vercel. This signs all admins out if `SESSION_SECRET` is unset.
2. Change the `TIER*_PASSWORD` values and redeploy.
3. Disable any suspect manager profile at `/admin/managers`.
4. Rotate the database password if it has been shared anywhere.

### 7.3 Emergency: close registrations

Set `"status": "LOCKED"` in `public/data/events.json` and deploy. The
registration form then renders its "opening soon" state and `POST /api/register`
rejects with *Event is closed for registration*.

---

## 8. Maintenance scripts

In `scripts/`. All read credentials from `.env.local` and act on whichever
Supabase project that points at — check it before running anything.

| Script | Purpose |
|---|---|
| `resend-passes.js` | Re-send QR passes to given addresses |
| `create_admin.js` | Create a Supabase auth admin user |
| `init-db.js` / `fix-db.js` / `update-remote-db.js` | Schema and data maintenance |
| `truncate_db.js` | **Destructive.** Empties tables |
| `test_email.js` | Send a test email to verify SMTP |
| `dummy-reset.js` | Reset the local mock store (`npm run dummy:reset`) |

---

## 9. Verifying a build

```bash
npx tsc --noEmit     # types
npx eslint .         # lint - NOT `npm run lint`, which is broken on Next 16
npm run build        # production build
```

Stop the dev server before `npm run build`: on Windows both use `.next` and the
build fails with `EPERM: operation not permitted, unlink`.

A quick authorisation smoke test, with a valid tier-3 cookie in `$T3`:

```bash
C=bangiya.samiti.iiith_dummy_session
curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: $C=admin-tier-3" \
  http://localhost:3000/api/admin/registrations      # expect 401, forged cookie
curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: $C=$T3" \
  http://localhost:3000/api/admin/registrations      # expect 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' \
  --data '{"query":"%"}' http://localhost:3000/api/pass/lookup   # expect 404, not a token
```

The last one matters: a wildcard must never return a pass token.
