# Coupon codes — steps and changes

What was built so a super admin can add, change, switch off and delete coupon
codes, the exact steps taken, and how each step was checked.

The work sits on `dev` in two commits:

1. `5533ad8` **Coupon Code handling (ongoing)**: the rules engine, the
   server-side preview, and the register route and form wired to it.
2. The commit that adds this file: coupons moved to their own Super Admin page
   (`/admin/coupons`), plus the fixes found while finishing the work.

---

## 1. The requirement

- A super admin controls, adds and deletes coupon codes.
- Each coupon gives **either** a fixed amount off **or** a percentage of the
  total price.
- A coupon applies when **either** of these is true:
  - the total before discount is **greater than a threshold** (threshold ≥ 0,
    set by the super admin), **or**
  - the visitor is among the **first N registrants** of the event (N set by the
    super admin).
- Coupon handling is **its own option** in the Super Admin area, not a section
  buried inside the event editor.

## 2. How a coupon is evaluated

The rules live in `utils/coupons.ts`. That module does no I/O, so the preview
endpoint and the register route call the same function and cannot disagree.

| Field | Meaning |
|---|---|
| `code` | 2–40 characters: `A–Z 0–9 - _`. Stored upper-case, matched case-insensitively. Unique within an event. |
| `kind` | `fixed` (rupees) or `percent` (of the total before discount). |
| `value` | Whole number above 0. A percentage cannot exceed 100. Older coupons written as `{ code, discount }` still work: `discount` is read when `value` is absent. |
| `maxDiscount` | Optional cap in rupees, for percentage coupons only. |
| `minSubtotal` | Optional. Applies when the total is **strictly greater** than this. `0` means "any basket that costs something", which is different from blank (no threshold). |
| `firstN` | Optional, ≥ 1. Applies while **fewer than N** registrations exist, so the N-th booking still gets it. |
| `active` | Switch. `false` keeps the coupon and its history but stops it applying. Absent means on. |

Order of evaluation:

1. Unknown code → refused: *"X is not a coupon for this event."*
2. `active: false` → refused: *"X is not active right now."*
3. Conditions: with neither set, it applies to anyone. With one or both set, it
   applies if **any** set condition holds. Refusals name the condition, e.g.
   *"BIG10 applies to baskets over ₹500. This booking is not."*
4. Amount: fixed amount, or `round(total × percent / 100)` capped at
   `maxDiscount`. The discount never exceeds the total.

"Registrations" counts **bookings, not ticket rows**. One booking of four
plates is four ticket rows that share a registration id (the token up to `_`),
and it counts once. Rejected bookings still count. If the count cannot be read,
it is treated as unlimited, so an early-bird coupon **fails closed**.

## 3. Steps followed

### Part 1 — already committed as `5533ad8`

1. **Pure rules module.** Wrote `utils/coupons.ts` (`findCoupon`, `valueOf`,
   `resolveCoupon`, `describeCoupon`) for the model above.
2. **Registration count.** Wrote `utils/data/registrations.ts`
   `countRegistrations(eventId)`: distinct registration ids per event, failing
   closed.
3. **Register route.** `app/api/register/route.ts` dropped its own flat-only
   `resolveCoupon` and now calls the shared one, using the subtotal the route
   computes itself and the live registration count. Any amount sent by the
   client is ignored.
4. **Preview endpoint.** Added `POST /api/events/[slug]/coupon`
   (`{ code, subtotal }` → verdict), rate-limited to 20 checks a minute per
   caller. Its subtotal is used only for display; the register route
   recomputes everything.
5. **Form.** `RegistrationForm.tsx` asks the preview endpoint instead of reading
   `event.config.coupons` itself, and shows the server's reason on refusal.
6. **Event editor (interim).** Grew a coupon grid (type, amount, cap,
   threshold, first N). Part 2 moved this to its own page.
7. **Wording fix.** A one-condition refusal said "This booking is neither." It
   now says "not" when there is a single condition.
8. **Hydration fix, notifications.** `components/site-notifications.tsx` now
   renders its portal only after mount, so the server and first client render
   match.

### Part 2 — this change

1. **Synced with the remote first.** `origin/dev` had been force-pushed with
   Part 1, so the stale local branch was kept as `dev-stale-local-backup` and
   `dev` was checked out fresh from `origin/dev`. Nothing was discarded.
2. **On/off switch.** Added `active?: boolean` to `Coupon`. `valueOf` refuses a
   switched-off coupon with its own message.
3. **Server-side validation.** Added `validateCoupon(input, otherCodes)` to
   `utils/coupons.ts`. It enforces the table in §2 and normalises the result
   (upper-case code, cap removed from flat coupons, legacy `discount` read as
   `value`). Every write goes through it.
4. **Usage numbers.** Added `registrationStats(eventIds)` to
   `utils/data/registrations.ts`: registrations so far per event, and how many
   bookings used each code, counted by booking. `countRegistrations` now shares
   its registration-id helper.
5. **Coupon store.** Added `utils/data/coupon-store.ts`
   `changeEventCoupons(slug, change)`. It reads `public/data/events.json`,
   applies the change to that event's `config.coupons` and writes the file
   back, all in one synchronous step. If the file cannot be written it returns
   a clear error instead of reporting success.
6. **Admin API** (super admin only, via `requireAdmin(3)`):
   - `GET  /api/admin/coupons`: every event with its coupons, `uses` per code
     and `registrations` so far.
   - `POST /api/admin/coupons`, body `{ eventSlug, coupon }`: add.
   - `PUT  /api/admin/coupons/[slug]/[code]`, body `{ coupon }`: replace. Also
     used to rename and to switch on or off.
   - `DELETE /api/admin/coupons/[slug]/[code]`: remove. Bookings that already
     used the code keep it on their tickets.
7. **The new page, `/admin/coupons`.** `app/admin/coupons/page.tsx` (redirects
   anyone below tier 3) and `CouponsClient.tsx`:
   - **New / Edit coupon form.** Fields: event, code, type (flat ₹ or %),
     amount, cap (percent only), an *Applies when* box with two checkboxes
     ("total is more than ₹__" and "among the first __ registrations"), and an
     *Active* switch. A live *Will read:* line shows the coupon as it will
     appear before you save. Server errors appear beside the form.
   - **One table per event.** Columns: code, discount and conditions, *Used
     by* (bookings), status (Active or Off). For first-N coupons it also shows
     where the coupon stands, e.g. "12 of the first 50 registrations taken" or
     "First 50 reached — now only the basket threshold applies". Actions:
     **Edit**, **Switch off / on**, **Delete** (with a confirmation dialog).
   - `/admin/coupons#<slug>` preselects that event in the form.
8. **Event editor hands over.** `EventEditorClient.tsx` no longer edits coupons.
   It shows the event's codes read-only and links to *Manage coupons →*
   (`/admin/coupons#<slug>`).
9. **Stale saves can't undo coupon edits.** `PUT /api/admin/events/[slug]` now
   always keeps the coupon list that is on file. The editor sends the whole
   `config` it loaded, so an editor tab opened before a coupon was added would
   otherwise have put the old list back.
10. **Codes are no longer public.** The event page passed the full event, coupon
    list included, to the client form, and `GET /api/events` and
    `GET /api/events/[slug]` returned it too, so anyone could view the page
    source and read every code. All three now go through `stripCoupons()`. The
    form never needed the list; it asks about one code at a time.
11. **The form re-checks a discount when the basket changes.** A discount is
    stored with the subtotal it was priced on. If the basket changes later
    (passes added or removed, or a verified address moving the price), the
    discount is withheld and the code is re-checked once the visitor is back on
    the payment step, and the message says *"re-checked for the new total"*. Before this, a 10% coupon applied to ₹500
    kept showing ₹50 off after the basket grew, while the server recorded a
    different amount.
12. **Docs and permissions.** Added the page to the page map in `HOWTO.md`, and
    `'coupons'` to the tier-3 `sidebar` list in `utils/auth/admin-roles.ts`.
13. **Mobile layout.** At 390px the new page's card overflowed. The page's grid
    column now uses `minmax(0, 1fr)` and the fieldset has `min-width: 0`, so the
    tables scroll inside their own containers like the other admin tables.

## 4. Files

| File | Change |
|---|---|
| `app/admin/coupons/page.tsx` | **New.** Super-admin page shell. |
| `app/admin/coupons/CouponsClient.tsx` | **New.** Form, per-event tables, edit / switch / delete. |
| `app/api/admin/coupons/route.ts` | **New.** `GET` list with usage, `POST` add. |
| `app/api/admin/coupons/[slug]/[code]/route.ts` | **New.** `PUT` replace, `DELETE`. |
| `utils/data/coupon-store.ts` | **New.** Read-change-write of `config.coupons` in `events.json`. |
| `utils/coupons.ts` | `active` flag, `validateCoupon`, `stripCoupons`, `COUPON_CODE_PATTERN`. |
| `utils/data/registrations.ts` | `registrationStats`; shared registration-id helper. |
| `app/admin/events/[slug]/edit/EventEditorClient.tsx` | Coupon grid replaced by a read-only list and a link. |
| `app/api/admin/events/[slug]/route.ts` | Keeps the on-file coupon list on every event save. |
| `app/events/[slug]/page.tsx` | Passes `stripCoupons(event)` to the form. |
| `app/api/events/route.ts`, `app/api/events/[slug]/route.ts` | Strip coupons from public responses. |
| `app/events/[slug]/RegistrationForm.tsx` | Discount tied to its subtotal; re-check when the basket changes. |
| `utils/auth/admin-roles.ts` | `'coupons'` in the tier-3 sidebar list. |
| `HOWTO.md` | `/admin/coupons` row in the page map. |
| `COUPONS.md` | This file. |

## 5. Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean. |
| `npx eslint` on every touched file | No new findings; each file's count matches `HEAD`. The new files are clean. |
| Unit tests for `utils/coupons.ts` (`node --test`, 28 cases) | 28/28 pass. They cover: legacy coupons, fixed and percent amounts, cap, strict threshold, threshold 0, first N at the boundary (N-th booking yes, N+1-th no), either-or conditions, "not" vs "neither" wording, the switch, all 9 validation refusals, normalisation, and `stripCoupons`. |
| End-to-end in Chromium against `next dev` on the mock DB (`DUMMY_DB=True`), signed in as tier 3 | All 17 scripted checks pass. With two `curl` checks on the public pages, they cover the list below. |

The end-to-end checks:

- An anonymous `GET /api/admin/coupons` gets `401`.
- `#mahalaya` preselects the event, and the live preview reads
  *"FIRST2 — 25% off, up to ₹100 — first 2"*.
- Added `FIRST2` (25%, cap ₹100, first 2) and `BIG10` (10%, over ₹500). A
  duplicate `EARLYBIRD` was refused with a message.
- Edited the legacy `EARLYBIRD` (`{discount: 50}`) to ₹60.
- `BIG10` switched off, so the preview endpoint says *"not active"*. Switched
  back on, it refuses ₹400 and gives ₹80 off ₹800.
- `FIRST2` on ₹1000 gives ₹100 (the cap), `because: "early"`.
- An event save carrying an empty coupon list left all three coupons in place.
- The event editor shows the read-only list and *Manage coupons →*.
- Deleting through the confirmation dialog removes the row.
- 390px wide: no horizontal overflow of the page or its scroll area.
- The public event page and `/api/events/mahalaya` contain no coupon list (the
  page still carries `pass_types`, so the event config is still serialised).
- No hydration warnings on `/admin/login`, `/admin`, `/admin/coupons` or `/`.

`public/data/events.json` was backed up before the browser run and restored
byte-for-byte afterwards.

Not exercised in a browser: the form's automatic re-check (step 11). It sits
behind the email-OTP step, which the local mock cannot complete. It was checked
by typecheck, lint and reading the code.

## 6. The hydration error on `/admin/login`

Every mismatched line in that report is an attribute `fdprocessedid="…"`. That
attribute is not in this codebase. It is injected into buttons and inputs by a
form-filling browser extension after the server HTML arrives and before React
hydrates. A browser with no extensions shows no mismatch on the same pages
(checked above). Nothing in the code needs to change. Allow-list `localhost` in
that extension, or develop in a profile without it. Adding
`suppressHydrationWarning` to every button would hide real mismatches on those
elements too, so it was not done.

## 7. Known limits and follow-ups

- **On Vercel, saving coupons fails with a clear error.** Coupons live in
  `events.json` like the rest of an event's `config`, and the deployment's
  filesystem is read-only (README, "Event edits are lost on Vercel"). The
  coupons API says so instead of pretending to save. Until coupons move into a
  Supabase table (the same fix `/admin/playlist` got), live coupon changes mean
  editing `public/data/events.json` in the repo and deploying.
- **Sidebar entry.** The page is reachable from *Manage Cultural Events* →
  *Event settings* → *Manage coupons →* and from `/admin/coupons` directly. The
  sidebar link itself (`app/admin/AdminSidebar.tsx`, next to *Manage Cultural
  Events*) is still to add.
- **Coupon lost between preview and booking.** If a first-N coupon runs out
  between the preview and the submit, the register route records the full
  price, as it did before this change. The manager verifying the payment then
  sees the amount mismatch.
