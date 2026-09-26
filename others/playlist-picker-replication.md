# Homepage player: fix and playlist picker — replication guide

A complete record of the work done on branch `dev` of `apj21-s/bongiosomiti-iiith` on 2026-09-26,
written so it can be re-applied to an older (stale) checkout, either with the patch or by hand.

| | |
|---|---|
| Base commit | `8dfe928` "Testing Playlist Update" (tip of `origin/dev` at the time) |
| Commit 1 | `1a7d279` Fix the homepage player not rendering for a bare playlist link |
| Commit 2 | `8a207d2` Let visitors pick a saved playlist or paste their own link in the player |
| Pushed? | **No.** `git push` to `origin dev` was refused with HTTP 403 (see §1) |
| Stack | Next.js 16.3.6, React 19.2.8, TypeScript, Supabase (or the local mock DB) |

Contents

1. What happened in the session
2. Root cause of "the player is not shown"
3. Before you start on a stale checkout
4. Fast path: apply the patch
5. Manual path, part 1: the fix
6. Manual path, part 2: the playlist picker
7. Behaviour the result must have
8. Design decisions and why
9. Verification, step by step
10. Commit messages used
11. Known limitations and follow-ups
12. Appendix: the full patch

---

## 1. What happened in the session

1. **Checked push access.** The local `dev` was at `b6116e8` ("Fix 1.02") and clean.
   `git fetch origin dev` worked (read access is fine) and showed `origin/dev` 22 commits ahead
   (`b6116e8..8dfe928`). `git push --dry-run -u origin dev` failed:

   ```text
   remote: Claude doesn't have GitHub access to apj21-s/bongiosomiti-iiith for your organization.
   fatal: unable to access 'https://github.com/apj21-s/bongiosomiti-iiith/': The requested URL returned error: 403
   ```

   This is an authorisation failure, not a network one, so retrying does not help. Fix: reconnect
   GitHub at https://claude.ai/connect-github and make sure the Claude GitHub App is installed on
   the repository.

2. **Pulled the latest work.** `git pull origin dev` fast-forwarded `b6116e8 → 8dfe928`. The
   commits that matter for the player are:

   | Commit | What it did |
   |---|---|
   | `e47d3ae` | Fixed `.scroll-reveal` elements staying at opacity 0 (a blank page) |
   | `7c3d33b` | Added the music player over the events video (`components/hero-playlist.tsx`, `.css`, `utils/data/playlists.ts`, `public/data/playlists.json`) |
   | `0cc9830` | Let the player take a YouTube playlist link (`utils/data/youtube.ts`) |
   | `cb4fde4` | Admin UI at `/admin/playlist`, Supabase `site_playlist` table, `utils/data/site-playlist.ts`; also bumped `next` 16.3.0→16.3.6, `nodemailer`, `sharp` |
   | `8dfe928` | "Testing Playlist Update": changed `public/data/playlists.json` from `[]` to a bare link |

3. **Debugged** the missing player (§2), confirmed the cause by running the loader on its own,
   fixed it, and verified it end to end in a dev server and in Chromium.
4. **Built the new feature** requested mid-session: named saved playlists selectable in the
   player, and a field where the visitor pastes their own playlist link (§6).
5. **Verified** with `tsc`, `eslint`, `next build` and Playwright (§9), committed twice, and tried
   to push again (403 again). The commits were exported as `playlist-picker.patch`.

Files changed across both commits:

```text
 README.md                             |  21 ++-
 RUNBOOK.md                            |   5 +-
 app/admin/playlist/PlaylistClient.tsx |  18 ++-
 app/admin/playlist/page.tsx           |   2 +-
 app/page.tsx                          |   2 +-
 components/hero-playlist.css          | 211 ++++++++++++++++++++++++-
 components/hero-playlist.tsx          | 280 ++++++++++++++++++++++++++++++++--
 utils/data/playlists.ts               |  33 +++-
 utils/data/site-playlist.ts           |  33 ++--
 9 files changed, 558 insertions(+), 47 deletions(-)
```

---

## 2. Root cause of "the player is not shown"

The data path for the homepage player on the base commit:

```text
app/page.tsx  (server component, revalidate = 0)
  └─ getHomepagePlaylists()                      utils/data/site-playlist.ts
       ├─ getSitePlaylistSetting()               reads Supabase table `site_playlist`
       │     returns EMPTY { youtubePlaylistId: null, isEnabled: true } when:
       │       - DUMMY_DB=True (mock client has no such table → data null), or
       │       - supabase/site-playlist.sql was never run (error → EMPTY), or
       │       - no playlist has been saved at /admin/playlist
       └─ falls back to getPlaylists()            utils/data/playlists.ts
             └─ reads public/data/playlists.json (imported at build time)
                  └─ toPlaylist(entry) for each entry
page.tsx: {playlists.length > 0 && <HeroPlaylist playlists={playlists} />}
```

`8dfe928` wrote the JSON file as an **array of one plain string**:

```json
["https://youtube.com/playlist?list=PLVmJU7r0oUb9oojH85t1tRBjf7ujKA38A&si=wdRkInEAxdSVDV5C"]
```

but `toPlaylist` began with

```ts
if (typeof value !== 'object' || value === null) return null
```

so the string was discarded, `getPlaylists()` returned `[]`, and `page.tsx` rendered no player.
Before `8dfe928` the file was `[]`, which also renders nothing. Locally the admin setting was
empty (the mock DB has no `site_playlist` data, and on a real database the table has to be created
and a playlist saved first), so the JSON file was the only source and the player never appeared.

**Confirmed** by running the loader on its own against the real JSON, before and after the fix
(the script is in §9.2):

```text
before: []
after: [{"id":"playlist-0","name":"Playlist","youtubePlaylistId":"PLVmJU7r0oUb9oojH85t1tRBjf7ujKA38A","tracks":[]}]
```

(`name` became `"Playlist 1"` once numbered default names were added in the same commit.)

Things ruled out:
- **CSP:** `next.config.ts` sets no Content-Security-Policy, so the YouTube IFrame API is not blocked.
- **CSS:** the only `display: none` in `hero-playlist.css` hides the time readout on narrow screens.
- **The component:** `HeroPlaylist` renders a bar whenever it gets a playlist; it was simply never rendered.

---

## 3. Before you start on a stale checkout

The change builds on files introduced by `7c3d33b`, `0cc9830` and `cb4fde4`. Check what the
stale checkout has:

```bash
git log --oneline -1 -- components/hero-playlist.tsx   # player exists? (7c3d33b)
test -f utils/data/youtube.ts      && echo "has YouTube parser (0cc9830)"
test -f utils/data/site-playlist.ts && echo "has admin playlist (cb4fde4)"
grep -n "getHomepagePlaylists\|getPlaylists" app/page.tsx
git merge-base --is-ancestor e47d3ae HEAD && echo "has scroll-reveal fix"
```

Pick the route that matches:

| Situation | Route |
|---|---|
| Checkout contains `cb4fde4` (has `utils/data/site-playlist.ts`) | §4 (patch), or §5 and §6 by hand. |
| Checkout is newer than `74b2a74` but lacks `cb4fde4` | `git cherry-pick cb4fde4`, then §4. |
| Anything older, e.g. `b6116e8` | §3.1 below. `cb4fde4` does **not** cherry-pick onto it (see why below). |
| Hero/events section invisible (opacity 0) | Separate scroll-reveal bug: `git cherry-pick e47d3ae` (applies cleanly, even on `b6116e8`). |

Notes on `cb4fde4`:
- It edits `package.json` and `package-lock.json`. On a lockfile conflict, take either side and run
  `npm install` to regenerate it; never hand-edit the lockfile.
- It needs `supabase/site-playlist.sql` run once in the Supabase SQL editor. Without the table the
  code falls back safely (the setting reads as empty) and the homepage still works.
- On `b6116e8` it conflicts in `README.md`, `RUNBOOK.md`, `app/admin/AdminSidebar.tsx`,
  `package.json` and `package-lock.json`, because it builds on the admin auth, profiles and docs
  added by `0a9fdc4`, `74b2a74` and `6f0f212`. Pulling all of that in is a merge of the whole
  branch, not a replication. Route §3.1 avoids it.

### 3.1 Tested recipe for a very old checkout (`b6116e8`, Next 16.3.0)

Everything below was run on a clean worktree of `b6116e8` and ended with the player on the page
and the picker working in Chromium (details at the end of this section).

```bash
git checkout -b player-backport b6116e8          # or your stale branch

# 1. The player itself. Conflicts in app/page.tsx (import block only).
git cherry-pick 7c3d33b
```

Resolve the conflict in `app/page.tsx`. The old page has no `EventsTabs` component, so keep the
old imports and add only the two player imports. The conflicted block

```text
<<<<<<< HEAD
=======
import EventsTabs from '@/components/events-tabs'
import HeroPlaylist from '@/components/hero-playlist'
import { getPlaylists } from '@/utils/data/playlists'
>>>>>>> 7c3d33b (Add a music player overlaid on the homepage events video)
```

becomes

```ts
import HeroPlaylist from '@/components/hero-playlist'
import { getPlaylists } from '@/utils/data/playlists'
```

The rest of that commit's `page.tsx` changes (`const playlists = getPlaylists()` and the
`<HeroPlaylist>` line inside `#events-hero-player`) merge on their own.

```bash
git add app/page.tsx && git cherry-pick --continue

# 2. YouTube playlist support (clean)
git cherry-pick 0cc9830

# 3. Scroll-reveal fix, so the section is not left invisible (clean)
git cherry-pick e47d3ae

# 4. This session's work, player files only (the other files do not exist here)
git apply --3way \
  --include='components/hero-playlist.tsx' \
  --include='components/hero-playlist.css' \
  --include='utils/data/playlists.ts' \
  playlist-picker.patch
```

All three files apply cleanly. Then two hand edits:

- **`app/page.tsx`**: there is no `getHomepagePlaylists` or admin switch on this version, so render
  the player unconditionally (it must show even with nothing saved, so visitors can paste a link):

  ```diff
  -              {playlists.length > 0 && <HeroPlaylist playlists={playlists} />}
  +              <HeroPlaylist playlists={playlists} />
  ```

- **`public/data/playlists.json`**: put your playlists in (format in §6.7), e.g.
  `["https://youtube.com/playlist?list=PLVmJU7r0oUb9oojH85t1tRBjf7ujKA38A&si=wdRkInEAxdSVDV5C"]`.

Commit, then run §9.1 and §9.3.

**Security:** this route skips `cb4fde4`, which also carried the dependency security fixes. On
`b6116e8`, `npm audit` reports 4 vulnerabilities (1 critical, 3 high): `next` 16.0.0–16.3.2,
`nodemailer` ≤9.1.0 and `sharp` <0.35.4 (pulled in by `next`). Fix them on the stale branch:

```bash
npm install next@16.3.6   # package.json pins next exactly, so it needs an explicit bump
npm audit fix             # nodemailer (caret range) and sharp (transitive): lockfile only
npm audit                 # expect: found 0 vulnerabilities
```

Tested on `b6116e8`: this ends at `next` 16.3.6, `nodemailer` 9.1.1 and 0 vulnerabilities,
changing only `package.json` (the `next` line) and `package-lock.json`.

What the test showed on `b6116e8` + this recipe, with `npm ci` (Next 16.3.0), `DUMMY_DB=True`:
`tsc` clean, `eslint` clean on the player files, homepage HTML contains `hero-playlist__controls`
and `hero-playlist__btn--list`, the picker lists `Playlist 1` (the bare link), pasting a link adds
and selects `Your playlist`, the hero's computed opacity is `1`, and there are no page errors.

---

## 4. Fast path: apply the patch

The patch holds both commits (`playlist-picker.patch`, also reproduced in §12).

```bash
git checkout dev
git am -3 playlist-picker.patch      # -3 falls back to a 3-way merge on drift
# on conflict: fix the files, then
git add <files> && git am --continue
# to give up: git am --abort
```

If the checkout is older than `8dfe928`, `public/data/playlists.json` is not touched by the patch,
so nothing conflicts there. Put your own playlists in it afterwards (format in §6.7).

After applying, run the checks in §9.

---

## 5. Manual path, part 1: the fix

File: `utils/data/playlists.ts`. Four edits.

### 5.1 Numbered default names

Add this helper just above `function toTrack(`:

```ts
// Numbered, so unnamed playlists can still be told apart in the picker.
function defaultName(index: number) {
  return `Playlist ${index + 1}`
}
```

### 5.2 Accept a bare string as a YouTube link

At the very top of `toPlaylist`, before the existing `typeof value !== 'object'` check:

```ts
function toPlaylist(value: unknown, index: number): Playlist | null {
  // A bare link is shorthand for a YouTube playlist with a default name.
  if (typeof value === 'string') {
    const youtubePlaylistId = parseYouTubePlaylistId(value)
    if (!youtubePlaylistId) return null
    return { id: `playlist-${index}`, name: defaultName(index), youtubePlaylistId, tracks: [] }
  }

  if (typeof value !== 'object' || value === null) return null
```

### 5.3 Use the numbered default for unnamed object entries

In the object returned at the end of `toPlaylist`, change

```ts
    name: isFilledString(playlist.name) ? playlist.name.trim() : 'Playlist',
```

to

```ts
    name: isFilledString(playlist.name) ? playlist.name.trim() : defaultName(index),
```

### 5.4 Drop repeated ids

The picker keys its rows by id, so duplicates must go. Replace the body of `getPlaylists` with:

```ts
export function getPlaylists(): Playlist[] {
  // Typed as unknown on purpose: an empty playlists.json would otherwise be
  // inferred as never[], and the validation below is what defines the shape.
  const raw: unknown = playlistsJson
  if (!Array.isArray(raw)) return []

  // The id keys the picker, so a repeated id keeps only its first playlist.
  const seen = new Set<string>()
  return raw
    .map((playlist, index) => toPlaylist(playlist, index))
    .filter((playlist): playlist is Playlist => {
      if (!playlist || seen.has(playlist.id)) return false
      seen.add(playlist.id)
      return true
    })
}
```

### 5.5 Doc comment (optional, keeps the file honest)

In the big comment at the top of the file, after "as does a bare playlist id.", add that a plain
string entry `["https://www.youtube.com/playlist?list=PLxxxxxxxx"]` works when the default name
will do. Replace the closing sentence "When nothing survives, the homepage renders no player at
all." with a paragraph saying every playlist is offered by name in the picker after the admin one,
the first plays by default, and visitors can paste their own link.

**At this point the original bug is fixed.** With the bare-link JSON, the homepage renders the
player bar. Part 2 is the new feature.

---

## 6. Manual path, part 2: the playlist picker

### 6.1 `utils/data/site-playlist.ts` — offer the admin playlist plus the saved ones

Replace the whole `getHomepagePlaylists` function (and its doc comment) at the end of the file with:

```ts
/**
 * The playlists the homepage player offers: the one set from the admin UI
 * first, as the default, then the named playlists saved in
 * public/data/playlists.json. The list may be empty - visitors can still paste
 * a link of their own - so null, not [], is what hides the player.
 */
export async function getHomepagePlaylists(): Promise<Playlist[] | null> {
  const setting = await getSitePlaylistSetting()
  if (!setting.isEnabled) return null

  const saved = getPlaylists()
  if (!setting.youtubePlaylistId) return saved

  const site: Playlist = {
    id: 'site',
    name: setting.name,
    youtubePlaylistId: setting.youtubePlaylistId,
    tracks: [],
  }

  // Listed once, even when the file saves the same playlist.
  return [
    site,
    ...saved.filter((playlist) => playlist.id !== site.id && playlist.youtubePlaylistId !== site.youtubePlaylistId),
  ]
}
```

What changed: before, an admin playlist *replaced* the JSON playlists, and an empty result hid
the player. Now the admin playlist is listed first, followed by the saved ones, and only `null`
(admin unticked "Show the player") hides it.

### 6.2 `app/page.tsx` — render unless hidden

```diff
-              {playlists.length > 0 && <HeroPlaylist playlists={playlists} />}
+              {playlists && <HeroPlaylist playlists={playlists} />}
```

The line sits inside `<div className="events-scene__hero ..." id="events-hero-player">`, after
`<CrossfadeVideo />`.

### 6.3 `components/hero-playlist.tsx` — the player

Seven edits, in file order.

**(a) Import the parser** below the existing `import type { Playlist }` line:

```ts
import { parseYouTubePlaylistId } from '@/utils/data/youtube'
```

**(b) Header comment.** Replace the paragraph ending "because browsers block autoplaying audio." with:

```ts
 * The events video itself is untouched and stays muted; the music sits on top
 * of it. Nothing plays until the visitor presses play or picks a playlist,
 * because browsers block autoplaying audio.
 *
 * A picker in the bar lists the saved playlists by name and takes a YouTube
 * playlist link pasted by the visitor. A pasted link is only ever reduced to
 * its playlist id and handed to YouTube's player API, and it stays in this
 * visitor's browser - nothing is sent to the site.
```

**(c) `BarProps`**: add as the last member, after `children?: React.ReactNode`:

```ts
  /** The playlist picker, placed at the end of the bar. */
  picker?: React.ReactNode
```

**(d) `PlayerBar`**: add `picker,` to the destructured parameters (after `children,`), and render
it as the last child of the outer `<div className="hero-playlist" ...>`, after the closing
`</div>` of `hero-playlist__body`:

```tsx
      </div>

      {picker}
    </div>
  )
}
```

Then, directly after the `PlayerBar` function, add the props both engines share:

```ts
type EngineProps = {
  /** Start playing once loaded: set when the visitor picked this playlist. */
  autoStart: boolean
  picker: React.ReactNode
}
```

**(e) `AudioPlayer`**: change the signature to

```tsx
function AudioPlayer({ playlist, autoStart, picker }: { playlist: Playlist } & EngineProps) {
```

add this effect right after the existing "Resume across a track change" effect (the one with
`[index]` deps), before `if (!track) return null`:

```tsx
  // A playlist the visitor just picked starts straight away. The engine is
  // remounted per playlist, so this runs once for each pick.
  useEffect(() => {
    if (!autoStart) return
    audioRef.current?.play().then(() => setIsPlaying(true), () => setIsPlaying(false))
  }, [autoStart])
```

and pass `picker={picker}` to its `<PlayerBar ...>` (after the `onSeek` prop).

**(f) `YouTubePlayer`**: change the signature to

```tsx
function YouTubePlayer({ playlistId, name, autoStart, picker }: { playlistId: string; name: string } & EngineProps) {
```

then, inside the effect that creates `new YT.Player(...)`:

```diff
-            // No autoplay: the visitor presses play.
+            // Never on page load; a picked playlist is started in onReady.
             autoplay: 0,
```

```diff
               readMetadata()
+              if (autoStart) playerRef.current?.playVideo()
             },
```

```diff
-  }, [playlistId])
+  }, [playlistId, autoStart])
```

and pass `picker={picker}` to its `<PlayerBar ...>` (after the `onSeek` prop, before the
`hero-playlist__yt` child).

**(g) Replace the default export.** Delete the old `export default function HeroPlaylist` (the
one with the comment "One playlist drives the hero...") and put this in its place, at the end of
the file:

```tsx
type Choice = Playlist & { custom?: boolean }

type PickerProps = {
  choices: Choice[]
  selectedId: string | null
  open: boolean
  /** Put focus back on the toggle, since a pick remounts the bar. */
  refocus: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (id: string) => void
  /** Returns an error message, or null once the link is playing. */
  onAddLink: (link: string) => string | null
}

/** The list button in the bar, and the panel of playlists it opens above it. */
function PlaylistPicker({ choices, selectedId, open, refocus, onOpenChange, onSelect, onAddLink }: PickerProps) {
  const panelId = useId()
  const inputId = useId()
  const errorId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)

  // On a short video the panel scrolls, which can leave the message out of view.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

  useEffect(() => {
    if (refocus) toggleRef.current?.focus()
  }, [refocus])

  // With nothing saved, the link field is the only thing to do here.
  useEffect(() => {
    if (open && choices.length === 0) inputRef.current?.focus()
  }, [open, choices.length])

  // Closes like any popover: on a click outside it, or on Escape.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onOpenChange(false)
      toggleRef.current?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  const pick = (id: string) => {
    toggleRef.current?.focus()
    onSelect(id)
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = onAddLink(link)
    setError(message)
    if (message) return
    setLink('')
    toggleRef.current?.focus()
  }

  return (
    <div className="hero-playlist__picker" ref={rootRef}>
      <button
        ref={toggleRef}
        type="button"
        className={`hero-playlist__btn hero-playlist__btn--list ${open ? 'is-on' : ''}`}
        onClick={() => onOpenChange(!open)}
        aria-label="Choose a playlist"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 6h12" />
          <path d="M4 11h12" />
          <path d="M4 16h7" />
          <circle cx="16.5" cy="17.5" r="2.5" />
          <path d="M19 17.5V9.5l2 1" />
        </svg>
      </button>

      <div id={panelId} className="hero-playlist__panel" role="dialog" aria-label="Playlists" hidden={!open}>
        {choices.length > 0 && (
          <ul className="hero-playlist__options">
            {choices.map((choice) => {
              const current = choice.id === selectedId
              return (
                <li key={choice.id}>
                  <button
                    type="button"
                    className={`hero-playlist__option ${current ? 'is-current' : ''}`}
                    aria-pressed={current}
                    onClick={() => pick(choice.id)}
                  >
                    <span className="hero-playlist__option-name" title={choice.name}>{choice.name}</span>
                    {choice.custom && <span className="hero-playlist__option-tag">your link</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <form className="hero-playlist__custom" onSubmit={submit} noValidate>
          <label htmlFor={inputId}>Play a YouTube playlist</label>
          <div className="hero-playlist__custom-row">
            <input
              ref={inputRef}
              id={inputId}
              className="hero-playlist__input"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste a playlist link"
              value={link}
              onChange={(e) => {
                setLink(e.currentTarget.value)
                if (error) setError(null)
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <button type="submit" className="hero-playlist__go" disabled={link.trim() === ''}>
              Play
            </button>
          </div>
          {error && <p ref={errorRef} id={errorId} className="hero-playlist__error" role="alert">{error}</p>}
        </form>
      </div>
    </div>
  )
}

const noop = () => {}

export default function HeroPlaylist({ playlists }: { playlists: Playlist[] }) {
  // Links pasted by this visitor. Kept in memory only; never sent anywhere.
  const [custom, setCustom] = useState<Choice[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(playlists[0]?.id ?? null)
  const [open, setOpen] = useState(false)
  // Set by the first pick, so nothing plays until the visitor asks for it.
  const [picked, setPicked] = useState(false)

  const choices: Choice[] = [...playlists, ...custom]
  const playlist = choices.find((choice) => choice.id === selectedId)

  const select = (id: string) => {
    setOpen(false)
    if (id === selectedId) return
    setSelectedId(id)
    setPicked(true)
  }

  const addLink = (link: string) => {
    const youtubePlaylistId = parseYouTubePlaylistId(link)
    if (!youtubePlaylistId) {
      return 'That is not a YouTube playlist link. Copy it from the playlist\'s Share button.'
    }

    const existing = choices.find((choice) => choice.youtubePlaylistId === youtubePlaylistId)
    if (existing) {
      select(existing.id)
      return null
    }

    const choice: Choice = {
      id: `custom-${youtubePlaylistId}`,
      name: custom.length === 0 ? 'Your playlist' : `Your playlist ${custom.length + 1}`,
      youtubePlaylistId,
      tracks: [],
      custom: true,
    }
    setCustom((list) => [...list, choice])
    select(choice.id)
    return null
  }

  const picker = (
    <PlaylistPicker
      choices={choices}
      selectedId={playlist?.id ?? null}
      open={open}
      refocus={picked}
      onOpenChange={setOpen}
      onSelect={select}
      onAddLink={addLink}
    />
  )

  // Keyed by playlist, so a pick starts the new one from a clean engine.
  if (playlist?.youtubePlaylistId) {
    return (
      <YouTubePlayer
        key={playlist.id}
        playlistId={playlist.youtubePlaylistId}
        name={playlist.name}
        autoStart={picked}
        picker={picker}
      />
    )
  }

  if (playlist) {
    return <AudioPlayer key={playlist.id} playlist={playlist} autoStart={picked} picker={picker} />
  }

  // Nothing saved: the bar still shows, and play opens the picker.
  return (
    <PlayerBar
      title="Choose a playlist"
      isPlaying={false}
      shuffle={false}
      currentTime={0}
      duration={0}
      onToggle={() => setOpen(true)}
      onNext={noop}
      onPrevious={noop}
      onShuffle={noop}
      onSeek={noop}
      picker={picker}
    />
  )
}
```

`useCallback`, `useEffect`, `useId`, `useRef`, `useState` are all already imported at the top.

### 6.4 `components/hero-playlist.css` — styles

**(a)** Give the list button the same "on" look as shuffle. Change the selector

```css
.hero-playlist__btn--shuffle.is-on {
```

to

```css
.hero-playlist__btn--shuffle.is-on,
.hero-playlist__btn--list.is-on {
```

**(b)** Insert this block immediately **before** `@media (max-width: 560px) {`:

```css
/* Playlist picker. The panel opens upward over the video, which clips its
   overflow, so the video is made a size container and the panel is capped to
   the room left above the bar, scrolling inside itself beyond that. */
.events-scene__hero:has(> .hero-playlist) {
  container-type: size;
}

.hero-playlist__picker {
  display: flex;
  flex-shrink: 0;
}

.hero-playlist__btn--list svg {
  width: 18px;
  height: 18px;
}

.hero-playlist__panel {
  position: absolute;
  right: 6px;
  bottom: calc(100% + 8px);
  width: min(320px, calc(100vw - 32px));
  max-height: 340px;
  max-height: min(340px, calc(100cqh - 100% - 40px));
  overflow-y: auto;
  overscroll-behavior: contain;

  display: grid;
  align-content: start;
  gap: 10px;
  padding: 10px;

  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: rgba(251, 245, 232, 0.96);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 10px 28px rgba(47, 33, 20, 0.32);
}

.hero-playlist__panel[hidden] {
  display: none;
}

.hero-playlist__options {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hero-playlist__option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background-color 200ms ease, color 200ms ease;
}

/* A dot marks the playlist that is loaded, filled in when it is current. */
.hero-playlist__option::before {
  content: '';
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid rgba(110, 78, 52, 0.45);
}

.hero-playlist__option:hover {
  background: rgba(182, 90, 60, 0.1);
}

.hero-playlist__option.is-current {
  color: var(--brand-2, #8e3f2d);
  background: rgba(182, 90, 60, 0.16);
}

.hero-playlist__option.is-current::before {
  border-color: var(--brand, #b65a3c);
  background: var(--brand, #b65a3c);
}

.hero-playlist__option:focus-visible {
  outline: 2px solid var(--brand-2, #8e3f2d);
  outline-offset: -2px;
}

.hero-playlist__option-name {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-playlist__option-tag {
  flex-shrink: 0;
  color: #6b5b4c;
  font-size: 0.68rem;
  font-weight: 500;
}

.hero-playlist__custom {
  display: grid;
  gap: 6px;
}

.hero-playlist__options + .hero-playlist__custom {
  padding-top: 10px;
  border-top: 1px solid rgba(110, 78, 52, 0.18);
}

.hero-playlist__custom label {
  padding: 0 2px;
  color: #6b5b4c;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero-playlist__custom-row {
  display: flex;
  gap: 6px;
}

.hero-playlist__input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid rgba(110, 78, 52, 0.3);
  border-radius: 10px;
  background: #fffaf0;
  color: #3c2c1e;
  font: inherit;
  font-size: 0.78rem;
}

.hero-playlist__input::placeholder {
  color: #8a7a6b;
}

.hero-playlist__input:focus-visible {
  outline: 2px solid var(--brand-2, #8e3f2d);
  outline-offset: 1px;
}

.hero-playlist__input[aria-invalid='true'] {
  border-color: #a8412f;
}

.hero-playlist__go {
  flex-shrink: 0;
  padding: 7px 14px;
  border: 0;
  border-radius: 10px;
  background: var(--brand, #b65a3c);
  color: #fdf7ea;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 200ms ease;
}

.hero-playlist__go:hover:not(:disabled) {
  background: var(--brand-2, #8e3f2d);
}

.hero-playlist__go:disabled {
  cursor: default;
  opacity: 0.5;
}

.hero-playlist__go:focus-visible {
  outline: 2px solid var(--brand-2, #8e3f2d);
  outline-offset: 2px;
}

.hero-playlist__error {
  margin: 0;
  padding: 0 2px;
  color: #9b2c1f;
  font-size: 0.72rem;
}
```

**(c)** Inside the existing `@media (max-width: 560px)` block, after the `.hero-playlist__btn--play`
rule, add:

```css
  .hero-playlist__option {
    padding: 6px 8px;
  }

  /* Below 16px, iOS zooms the page when the field takes focus. */
  .hero-playlist__input {
    font-size: 16px;
  }
```

**(d)** In the `@media (prefers-reduced-motion: reduce)` block, change the transition rule's
selector to cover the new controls:

```css
  .hero-playlist__btn,
  .hero-playlist__option,
  .hero-playlist__go {
    transition: none;
  }
```

### 6.5 Admin wording — `app/admin/playlist/PlaylistClient.tsx` and `page.tsx`

The admin text claimed "leave blank to hide the player", which is no longer true.

In `PlaylistClient.tsx`, the save notice:

```tsx
      setNotice(!data.isEnabled
        ? 'Saved. The player is hidden on the homepage.'
        : data.youtubePlaylistId
          ? `Saved. The homepage will play playlist ${data.youtubePlaylistId} by default.`
          : 'Saved. No playlist is set here, so the player offers only the saved playlists.')
```

(The PUT response from `/api/admin/playlist` already includes `isEnabled`.)

The intro paragraph under "Homepage music":

```tsx
          Paste a YouTube playlist link. It is the default for the player over the video in the middle
          of the home page, listed first in its picker ahead of the playlists saved in
          <code>public/data/playlists.json</code>. Visitors can also paste a link of their own there.
          The playlist must be <strong>public or unlisted</strong> — YouTube will not embed a private one.
```

The hint under the link field:

```tsx
              Leave blank to offer only the saved playlists. To hide the player, untick the box below.
```

The hint under "Display name":

```tsx
            <small className="text-muted">Shown in the picker, and until YouTube reports the first track title.</small>
```

In the "Currently set" table, the empty value `none — player hidden` becomes `none — saved playlists only`.

In `app/admin/playlist/page.tsx`, the subtitle becomes:

```tsx
            The default playlist for the music player over the video on the home page.
```

### 6.6 Docs — `README.md` and `RUNBOOK.md`

In `README.md`, section "The homepage music player", replace the paragraph that starts
"`public/data/playlists.json` remains as the fallback" with:

```markdown
More playlists can be saved by name in `public/data/playlists.json`, which is
also the way to ship hosted audio files; that format is documented in
`utils/data/playlists.ts`. A bare link works as an entry too, named
"Playlist 1", "Playlist 2" and so on:

~~~json
[
  { "id": "agomoni", "name": "Agomoni", "youtube": "https://www.youtube.com/playlist?list=PL..." },
  "https://www.youtube.com/playlist?list=PL..."
]
~~~

A list button in the player opens a picker with the admin playlist first, as
the default, followed by the saved ones. Visitors can also paste their own
YouTube playlist link there; it goes through the same parser, plays only in
their browser and is never sent to the site. The player shows even with
nothing saved, so a link can still be pasted; unticking "Show the player" at
/admin/playlist is what hides it.
```

(The inner `~~~json` fence is a normal triple-backtick fence in the real README; it is shown
with tildes here only so it can sit inside this block.)

In `RUNBOOK.md`, section "2.3 Homepage music", replace the line "Leave the field blank, or untick
"Show the player", to hide the player." with:

```markdown
It is the default in the player's picker, listed ahead of the playlists saved
in `public/data/playlists.json`; leave the field blank to offer only those.
Visitors can paste their own playlist link in the picker, which plays only for
them. To hide the player altogether, untick "Show the player".
```

### 6.7 Saving named playlists

`public/data/playlists.json` accepts any mix of:

```json
[
  { "id": "agomoni", "name": "Agomoni", "youtube": "https://www.youtube.com/playlist?list=PL..." },
  { "id": "local", "name": "Hosted songs", "tracks": [
      { "id": "t1", "title": "Agomoni", "artist": "Traditional", "src": "/assets/music/agomoni.mp3" }
  ] },
  "https://www.youtube.com/playlist?list=PL..."
]
```

- `youtube` may be a playlist URL, a watch URL with `list=`, or a bare id. `youtubePlaylist` and
  `youtubePlaylistId` are accepted as alternative keys.
- A bare string entry is shown as "Playlist N" (N is its 1-based position in the file).
- The playlist set at `/admin/playlist` is always listed first and plays by default; a file entry
  with the same id (`site`) or the same YouTube id is not listed twice.
- The file is imported at build time, so edits need a rebuild / redeploy (a dev server picks them
  up on save).

---

## 7. Behaviour the result must have

| Situation | Expected |
|---|---|
| Admin unticked "Show the player" | No player at all (`getHomepagePlaylists` returns `null`). |
| Nothing saved anywhere | Bar shows with title "Choose a playlist"; pressing play opens the picker and focuses the link field. |
| One or more saved | First one (admin one if set) is loaded, **not playing**; list button (aria-label "Choose a playlist") opens the panel. |
| Panel open | Saved playlists by name; the current one has a filled dot and `aria-pressed="true"`; below them "Play a YouTube playlist" with a text field and a Play button (disabled while empty). |
| Pick a different playlist | Panel closes, focus returns to the list button, the new playlist loads and starts playing. |
| Pick the one already loaded | Panel just closes; nothing restarts. |
| Paste a valid link (playlist URL, watch URL with `list=`, or bare id) | Added as "Your playlist" (then "Your playlist 2", ...) tagged "your link", selected and started. |
| Paste a link that matches a saved playlist | That saved playlist is selected instead of adding a duplicate. |
| Paste anything else (other host, junk text) | Error under the field: "That is not a YouTube playlist link. Copy it from the playlist's Share button."; field marked `aria-invalid`; error scrolled into view; typing clears it. |
| Escape / click outside | Panel closes (Escape also returns focus to the list button). |
| Reload | Pasted links are gone (memory only, by design). |
| Phone widths | Panel never overflows the video; it scrolls inside itself; the input uses 16px text so iOS does not zoom. |

---

## 8. Design decisions and why

- **Why a bare string is accepted instead of just fixing the JSON.** A bare link is what people
  naturally paste; failing silently on it is how the bug hid. It goes through the same
  `parseYouTubePlaylistId` as everything else, so it fails closed on anything that is not YouTube.
- **Security of pasted links.** A pasted link is reduced to its playlist id by
  `parseYouTubePlaylistId` (host must be `youtube.com`/`youtu.be` or a subdomain; id limited to
  `[A-Za-z0-9_-]`) and only that id is passed to YouTube's player API as a parameter. No iframe URL
  is built from user input, nothing is sent to the server, nothing is stored.
- **`null` vs `[]`.** Now that visitors can paste a link, an empty saved list is still a useful
  player. Only the admin's "Show the player" switch hides it, expressed as `null`.
- **Engine remount per playlist (`key={playlist.id}`).** Switching playlists starts a fresh
  `YouTubePlayer`/`AudioPlayer`, so no stale title, progress, shuffle history or YT instance leaks
  across. Consequence: the picker, which lives inside the bar, remounts too. Hence `refocus` (puts
  focus back on the list button after a pick) and keeping `open` state in `HeroPlaylist`.
- **`autoStart` only after a pick.** Nothing plays on page load (browsers block it, and it would be
  rude). A pick is a user gesture, so the new playlist starts in `onReady` / on mount. If a browser
  still blocks it, the bar just stays paused.
- **Picking the current playlist does nothing but close.** Otherwise `autoStart` would flip on
  without a remount and the YouTube effect (which depends on `autoStart`) would rebuild the player.
- **Container query for the panel height.** `.events-scene__hero` has `overflow: hidden` and is only
  ~200–235px tall on phones, so a panel opening upward would be clipped. The hero is made a size
  container only when it holds the player (`:has(> .hero-playlist)`), and the panel's
  `max-height` is `min(340px, calc(100cqh - 100% - 40px))`, where `100%` is the bar's height and
  40px covers the bar's bottom offset, the 8px gap and breathing room. There is a plain `340px`
  fallback. Measured with `offsetHeight`, the hero's layout size is identical with and without the
  rule at 1280, 375 and 320px wide (736, 234, 200px).
- **`hidden` attribute on the panel rather than conditional rendering.** Keeps `aria-controls`
  pointing at a real element and keeps the typed link while the panel is closed. The CSS needs
  `.hero-playlist__panel[hidden] { display: none; }` because `display: grid` would override the UA
  rule.
- **Numbered default names and id de-duplication.** The picker is keyed by id and shows names; two
  entries called "Playlist" or sharing an id would be indistinguishable or collide.

---

## 9. Verification, step by step

### 9.1 Install and static checks

```bash
npm ci
npx tsc --noEmit -p .                       # must print nothing
npx eslint components/hero-playlist.tsx utils/data/playlists.ts utils/data/site-playlist.ts app/admin/playlist
DUMMY_DB=True NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x npx next build
```

`npx eslint` on `app/page.tsx` and `utils/data/events.ts` reports `no-explicit-any` errors and
`<img>` warnings. They were there before this work and are on lines it does not touch.

The dummy Supabase env values only let the build and the mock DB start. With `DUMMY_DB=True` every
Supabase call goes to `utils/supabase/mock-client.ts`.

### 9.2 Prove the loader on its own (no Next needed)

Node 22 can run the TypeScript directly with `--experimental-strip-types`, after two small
rewrites of the copied file (JSON import attribute and `.ts` extension):

```bash
T=$(mktemp -d); mkdir -p $T/before $T/after
cp utils/data/youtube.ts $T/before/; cp utils/data/youtube.ts $T/after/
git show 8dfe928:utils/data/playlists.ts > $T/before/playlists.ts   # the unfixed loader
cp utils/data/playlists.ts $T/after/                                 # the fixed loader
for d in before after; do
  sed -i "s#import playlistsJson from '../../public/data/playlists.json'#import playlistsJson from '$PWD/public/data/playlists.json' with { type: 'json' }#; s#from './youtube'#from './youtube.ts'#" $T/$d/playlists.ts
  echo "import { getPlaylists } from './playlists.ts'; console.log('$d:', JSON.stringify(getPlaylists()))" > $T/$d/run.ts
  node --experimental-strip-types --no-warnings $T/$d/run.ts
done
```

Expected with the bare-link JSON: `before: []` and `after: [{... "youtubePlaylistId":"PLVmJU7r0oUb9oojH85t1tRBjf7ujKA38A" ...}]`.

### 9.3 Run the app locally

```bash
DUMMY_DB=True NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x npx next dev -p 3100
curl -s http://localhost:3100/ | grep -o 'hero-playlist[a-z_-]*' | sort | uniq -c
```

Before the fix the grep prints nothing; after it, it lists `hero-playlist__controls`,
`hero-playlist__btn--play`, `hero-playlist__btn--list` and so on. To stop the server, find its PID
(`pgrep -af next`) and kill that. `pkill -f "next dev"` run inside a compound shell command also
matches and kills the shell itself (exit code 144).

### 9.4 Browser test (Playwright)

For the test, temporarily replace `public/data/playlists.json` with two named playlists (keep a
copy of the original and restore it afterwards):

```json
[{"id":"agomoni","name":"Agomoni","youtube":"https://youtube.com/playlist?list=PLVmJU7r0oUb9oojH85t1tRBjf7ujKA38A&si=wdRkInEAxdSVDV5C"},{"id":"dhunuchi","name":"Dhunuchi Naach","youtube":"PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSU"}]
```

Run with a global Playwright (`npm i -g playwright`, or point `executablePath` at an installed
Chromium): `node pw.cjs <dir-for-screenshots>`.

```js
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')
const S = process.argv[2]
;(async () => {
  const browser = await chromium.launch()
  for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 375, height: 740 }]]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' })
    const hero = page.locator('#events-hero-player')
    await hero.scrollIntoViewIfNeeded()
    await page.waitForTimeout(2500)
    const box0 = await hero.boundingBox()
    await page.getByRole('button', { name: 'Choose a playlist' }).click()
    await page.waitForTimeout(300)
    const options = await page.locator('.hero-playlist__option').allInnerTexts()
    const pressed = await page.locator('.hero-playlist__option[aria-pressed="true"]').innerText()
    await hero.screenshot({ path: `${S}/${label}-open.png` })
    const panel = await page.locator('.hero-playlist__panel').boundingBox()

    // Invalid link
    await page.getByLabel('Play a YouTube playlist').fill('https://evil.example.com/playlist?list=PLabc')
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    const err = await page.locator('.hero-playlist__error').innerText().catch(() => null)
    await hero.screenshot({ path: `${S}/${label}-error.png` })

    // Valid custom link
    await page.getByLabel('Play a YouTube playlist').fill('https://www.youtube.com/watch?v=abc&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.waitForTimeout(500)
    const panelHidden = await page.locator('.hero-playlist__panel').isHidden()
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
    await page.getByRole('button', { name: 'Choose a playlist' }).click()
    const options2 = await page.locator('.hero-playlist__option').allInnerTexts()
    const pressed2 = await page.locator('.hero-playlist__option[aria-pressed="true"]').innerText()
    const ytList = await page.locator('.hero-playlist__yt iframe').getAttribute('src').catch(() => null)

    // Pick a saved one, then Escape closes
    await page.locator('.hero-playlist__option', { hasText: 'Dhunuchi' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Choose a playlist' }).click()
    const pressed3 = await page.locator('.hero-playlist__option[aria-pressed="true"]').innerText()
    await page.keyboard.press('Escape')
    const closedByEsc = await page.locator('.hero-playlist__panel').isHidden()
    const box1 = await hero.boundingBox()
    await hero.screenshot({ path: `${S}/${label}-closed.png` })

    console.log(JSON.stringify({ label, heroBefore: box0, heroAfter: box1, panel, options, pressed, err, panelHidden, focused, options2, pressed2, ytList: ytList && ytList.slice(0, 120), pressed3, closedByEsc, errors }, null, 1))
    await page.close()
  }
  await browser.close()
})()
```

Expected output at both widths: `options` = `["Agomoni","Dhunuchi Naach"]`, `pressed` = `"Agomoni"`,
`err` = the error sentence, `panelHidden: true`, `focused: "Choose a playlist"`, `options2` ends
with `"Your playlist\nyour link"` and it is `pressed2`, `pressed3` = `"Dhunuchi Naach"`,
`closedByEsc: true`, `errors: []`.

Empty state (set the JSON to `[]` first):

```js
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []; page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' })
  await page.locator('#events-hero-player').scrollIntoViewIfNeeded(); await page.waitForTimeout(1500)
  const title = await page.locator('.hero-playlist__title').innerText()
  await page.getByRole('button', { name: 'Play music' }).click(); await page.waitForTimeout(200)
  const open = await page.locator('.hero-playlist__panel').isVisible()
  const focused = await page.evaluate(() => document.activeElement?.placeholder)
  await page.getByLabel('Play a YouTube playlist').fill('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')
  await page.keyboard.press('Enter'); await page.waitForTimeout(300)
  const title2 = await page.locator('.hero-playlist__title').innerText()
  const hasYtTile = await page.locator('.hero-playlist__yt').count()
  console.log({ title, open, focused, title2, hasYtTile, errors })
  await browser.close()
})()
```

Expected: `title: 'Choose a playlist'`, `open: true`, `focused: 'Paste a playlist link'`,
`hasYtTile: 1`, `errors: []`.

Layout check for the container rule: compare `offsetHeight`/`offsetWidth` of `#events-hero-player`
with the rule on and with
`.events-scene__hero:has(> .hero-playlist){container-type:normal !important}` injected. They
must be equal. Use `offsetHeight`, not `getBoundingClientRect`, because the scroll-reveal
animation scales the element and makes the rect vary.

In the sandbox the YouTube iframe never loaded (no route to youtube.com), so the bar read
"Playlist unavailable" there. **Actual playback must be checked in a normal browser**, including
that a picked playlist starts playing on its own.

---

## 10. Commit messages used

Commit 1 (`1a7d279`), staging only `utils/data/playlists.ts`:

```text
Fix the homepage player not rendering for a bare playlist link

public/data/playlists.json holds a plain link string, but the loader only
accepted objects, so every entry was dropped and the homepage rendered no
player. With no playlist set from /admin/playlist - which is the case locally,
and anywhere supabase/site-playlist.sql has not been run - the JSON file is
the only source, so the player never showed.

A bare string entry is now read as a YouTube playlist link. Unnamed playlists
get numbered names ("Playlist 1") so they can be told apart, and a repeated id
keeps only its first playlist.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AF3NfoF1hqhMvpb4dz9LbJ
```

Commit 2 (`8a207d2`), staging everything else:

```text
Let visitors pick a saved playlist or paste their own link in the player

A list button in the homepage player opens a picker above the bar. It lists
the playlist set at /admin/playlist first, as the default, followed by the
named playlists saved in public/data/playlists.json, and takes a YouTube
playlist link pasted by the visitor.

A pasted link goes through the same parser as the admin form, so anything
that is not a genuine YouTube playlist is refused with a message, and only the
extracted id reaches YouTube's player API. It plays only in that visitor's
browser and is never sent to the site.

Picking a playlist starts it straight away; nothing plays on page load. The
player now shows whenever it is enabled, even with nothing saved, so a link
can still be pasted - unticking "Show the player" in the admin is what hides
it. The admin copy, README and RUNBOOK are updated to match.

The panel opens over the video, which clips its overflow, so the video is made
a size container and the panel is capped to the room above the bar. Its
layout size is unchanged at 1280, 375 and 320px wide.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AF3NfoF1hqhMvpb4dz9LbJ
```

---

## 11. Known limitations and follow-ups

- **Not pushed.** Both commits exist only in the session's clone and in the patch. Push once GitHub
  access is fixed (§1).
- **Pasted links are not remembered** across reloads. Remembering them per visitor would be a small
  `localStorage` addition (wrapped in try/catch, loaded after mount to avoid a hydration mismatch).
- **Saved playlists live in a file.** Changing them needs a redeploy. The admin page still manages
  one playlist. Letting admins save several named playlists would need a new Supabase table (e.g.
  `site_playlists` with `id`, `name`, `youtube_playlist_id`, `position`) and a list editor at
  `/admin/playlist`.
- **Mock DB has no `upsert`.** With `DUMMY_DB=True`, saving at `/admin/playlist` fails
  (`utils/supabase/mock-client.ts` implements no `upsert`). This predates this work.
- **YouTube constraints.** The playlist must be public or unlisted, and the embed tile must stay
  visible while playing (YouTube's terms).

---

## 12. Appendix: the full patch

Exactly what `git format-patch --stdout 8dfe928..8a207d2` produced. Save everything between the
`~~~~` fences as `playlist-picker.patch` and apply with `git am -3 playlist-picker.patch`.

~~~~diff
From 1a7d2798ccc25202386128f50e8c0431fec331db Mon Sep 17 00:00:00 2001
From: Claude <noreply@anthropic.com>
Date: Sat, 26 Sep 2026 17:19:16 +0000
Subject: [PATCH 1/2] Fix the homepage player not rendering for a bare playlist
 link

public/data/playlists.json holds a plain link string, but the loader only
accepted objects, so every entry was dropped and the homepage rendered no
player. With no playlist set from /admin/playlist - which is the case locally,
and anywhere supabase/site-playlist.sql has not been run - the JSON file is
the only source, so the player never showed.

A bare string entry is now read as a YouTube playlist link. Unnamed playlists
get numbered names ("Playlist 1") so they can be told apart, and a repeated id
keeps only its first playlist.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AF3NfoF1hqhMvpb4dz9LbJ
---
 utils/data/playlists.ts | 33 ++++++++++++++++++++++++++++-----
 1 file changed, 28 insertions(+), 5 deletions(-)

diff --git a/utils/data/playlists.ts b/utils/data/playlists.ts
index 38b5fcd..ae6a88f 100644
--- a/utils/data/playlists.ts
+++ b/utils/data/playlists.ts
@@ -22,7 +22,9 @@ import { parseYouTubePlaylistId } from './youtube'
  *      ]
  *
  *    A watch URL carrying a `list` parameter works too, as does a bare
- *    playlist id. Playback runs through YouTube's own embedded player, which
+ *    playlist id. The link can also stand alone as a plain string entry,
+ *    `["https://www.youtube.com/playlist?list=PLxxxxxxxx"]`, when the default
+ *    name will do. Playback runs through YouTube's own embedded player, which
  *    stays visible in the bar because YouTube's terms require it.
  *
  * 2. Audio files you host - drop them in `public/assets/music/`:
@@ -41,10 +43,13 @@ import { parseYouTubePlaylistId } from './youtube'
  *    A track's `src` may be a path under `public/` or an absolute https URL, so
  *    the audio can move to Supabase Storage later without touching this code.
  *
+ * Every playlist in the file is offered by name in the player's picker, after
+ * the one set from /admin/playlist; the first is what plays by default.
+ * Visitors can also paste their own YouTube playlist link into the picker.
+ *
  * If a playlist has both, the YouTube link wins. Tracks missing a title or src
  * are dropped rather than rendered as broken controls, and a playlist with no
- * usable source is dropped with them. When nothing survives, the homepage
- * renders no player at all.
+ * usable source is dropped with them.
  */
 
 export type PlaylistTrack = {
@@ -66,6 +71,11 @@ function isFilledString(value: unknown): value is string {
   return typeof value === 'string' && value.trim().length > 0
 }
 
+// Numbered, so unnamed playlists can still be told apart in the picker.
+function defaultName(index: number) {
+  return `Playlist ${index + 1}`
+}
+
 function toTrack(value: unknown, index: number): PlaylistTrack | null {
   if (typeof value !== 'object' || value === null) return null
 
@@ -81,6 +91,13 @@ function toTrack(value: unknown, index: number): PlaylistTrack | null {
 }
 
 function toPlaylist(value: unknown, index: number): Playlist | null {
+  // A bare link is shorthand for a YouTube playlist with a default name.
+  if (typeof value === 'string') {
+    const youtubePlaylistId = parseYouTubePlaylistId(value)
+    if (!youtubePlaylistId) return null
+    return { id: `playlist-${index}`, name: defaultName(index), youtubePlaylistId, tracks: [] }
+  }
+
   if (typeof value !== 'object' || value === null) return null
 
   const playlist = value as Record<string, unknown>
@@ -99,7 +116,7 @@ function toPlaylist(value: unknown, index: number): Playlist | null {
 
   return {
     id: isFilledString(playlist.id) ? playlist.id.trim() : `playlist-${index}`,
-    name: isFilledString(playlist.name) ? playlist.name.trim() : 'Playlist',
+    name: isFilledString(playlist.name) ? playlist.name.trim() : defaultName(index),
     youtubePlaylistId,
     tracks,
   }
@@ -111,7 +128,13 @@ export function getPlaylists(): Playlist[] {
   const raw: unknown = playlistsJson
   if (!Array.isArray(raw)) return []
 
+  // The id keys the picker, so a repeated id keeps only its first playlist.
+  const seen = new Set<string>()
   return raw
     .map((playlist, index) => toPlaylist(playlist, index))
-    .filter((playlist): playlist is Playlist => playlist !== null)
+    .filter((playlist): playlist is Playlist => {
+      if (!playlist || seen.has(playlist.id)) return false
+      seen.add(playlist.id)
+      return true
+    })
 }
-- 
2.43.0


From 8a207d2130cdc2864fc2aa5a8f54e44e28999309 Mon Sep 17 00:00:00 2001
From: Claude <noreply@anthropic.com>
Date: Sat, 26 Sep 2026 17:19:16 +0000
Subject: [PATCH 2/2] Let visitors pick a saved playlist or paste their own
 link in the player

A list button in the homepage player opens a picker above the bar. It lists
the playlist set at /admin/playlist first, as the default, followed by the
named playlists saved in public/data/playlists.json, and takes a YouTube
playlist link pasted by the visitor.

A pasted link goes through the same parser as the admin form, so anything
that is not a genuine YouTube playlist is refused with a message, and only the
extracted id reaches YouTube's player API. It plays only in that visitor's
browser and is never sent to the site.

Picking a playlist starts it straight away; nothing plays on page load. The
player now shows whenever it is enabled, even with nothing saved, so a link
can still be pasted - unticking "Show the player" in the admin is what hides
it. The admin copy, README and RUNBOOK are updated to match.

The panel opens over the video, which clips its overflow, so the video is made
a size container and the panel is capped to the room above the bar. Its
layout size is unchanged at 1280, 375 and 320px wide.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AF3NfoF1hqhMvpb4dz9LbJ
---
 README.md                             |  21 +-
 RUNBOOK.md                            |   5 +-
 app/admin/playlist/PlaylistClient.tsx |  18 +-
 app/admin/playlist/page.tsx           |   2 +-
 app/page.tsx                          |   2 +-
 components/hero-playlist.css          | 211 ++++++++++++++++++-
 components/hero-playlist.tsx          | 280 ++++++++++++++++++++++++--
 utils/data/site-playlist.ts           |  33 +--
 8 files changed, 530 insertions(+), 42 deletions(-)

diff --git a/README.md b/README.md
index 8c7dd4e..d8cb872 100644
--- a/README.md
+++ b/README.md
@@ -185,9 +185,24 @@ Only the extracted playlist id is stored, never the pasted URL, and the id is
 validated again every time the homepage renders it — so nothing that reaches
 the page can carry a scheme, a host or markup.
 
-`public/data/playlists.json` remains as the fallback when nothing is configured,
-and is the way to ship hosted audio files; that format is documented in
-`utils/data/playlists.ts`. With neither set, the player does not render at all.
+More playlists can be saved by name in `public/data/playlists.json`, which is
+also the way to ship hosted audio files; that format is documented in
+`utils/data/playlists.ts`. A bare link works as an entry too, named
+"Playlist 1", "Playlist 2" and so on:
+
+```json
+[
+  { "id": "agomoni", "name": "Agomoni", "youtube": "https://www.youtube.com/playlist?list=PL..." },
+  "https://www.youtube.com/playlist?list=PL..."
+]
+```
+
+A list button in the player opens a picker with the admin playlist first, as
+the default, followed by the saved ones. Visitors can also paste their own
+YouTube playlist link there; it goes through the same parser, plays only in
+their browser and is never sent to the site. The player shows even with
+nothing saved, so a link can still be pasted; unticking "Show the player" at
+/admin/playlist is what hides it.
 
 The YouTube embed stays visible as a small tile because YouTube's terms require
 their player to be shown while it plays.
diff --git a/RUNBOOK.md b/RUNBOOK.md
index 9b566ae..daa18e0 100644
--- a/RUNBOOK.md
+++ b/RUNBOOK.md
@@ -92,7 +92,10 @@ delete the profile and create it again.
 
 Set at **/admin/playlist** (super admin). Paste a YouTube playlist link; it must
 be **public or unlisted**, because YouTube refuses to embed a private playlist.
-Leave the field blank, or untick "Show the player", to hide the player.
+It is the default in the player's picker, listed ahead of the playlists saved
+in `public/data/playlists.json`; leave the field blank to offer only those.
+Visitors can paste their own playlist link in the picker, which plays only for
+them. To hide the player altogether, untick "Show the player".
 
 Only the playlist id is stored, and only after the link has been validated as a
 genuine YouTube playlist URL. Links to any other host are rejected.
diff --git a/app/admin/playlist/PlaylistClient.tsx b/app/admin/playlist/PlaylistClient.tsx
index fcb15f2..ad91734 100644
--- a/app/admin/playlist/PlaylistClient.tsx
+++ b/app/admin/playlist/PlaylistClient.tsx
@@ -61,9 +61,11 @@ export default function PlaylistClient() {
       if (!res.ok) throw new Error(data.error || 'Could not save')
 
       setCurrent(data)
-      setNotice(data.youtubePlaylistId
-        ? `Saved. The homepage will play playlist ${data.youtubePlaylistId}.`
-        : 'Saved. No playlist is set, so the player is hidden.')
+      setNotice(!data.isEnabled
+        ? 'Saved. The player is hidden on the homepage.'
+        : data.youtubePlaylistId
+          ? `Saved. The homepage will play playlist ${data.youtubePlaylistId} by default.`
+          : 'Saved. No playlist is set here, so the player offers only the saved playlists.')
     } catch (err) {
       setError(err instanceof Error ? err.message : 'Could not save')
     } finally {
@@ -78,7 +80,9 @@ export default function PlaylistClient() {
       <section className="admin-section-card" style={{ marginTop: 0 }}>
         <h3 style={{ marginTop: 0 }}>Homepage music</h3>
         <p className="text-muted" style={{ marginTop: 0 }}>
-          Paste a YouTube playlist link. It plays over the video in the middle of the home page.
+          Paste a YouTube playlist link. It is the default for the player over the video in the middle
+          of the home page, listed first in its picker ahead of the playlists saved in
+          <code>public/data/playlists.json</code>. Visitors can also paste a link of their own there.
           The playlist must be <strong>public or unlisted</strong> — YouTube will not embed a private one.
         </p>
 
@@ -95,7 +99,7 @@ export default function PlaylistClient() {
               style={field}
             />
             <small className="text-muted">
-              Leave blank to remove the playlist and hide the player.
+              Leave blank to offer only the saved playlists. To hide the player, untick the box below.
             </small>
           </div>
 
@@ -104,7 +108,7 @@ export default function PlaylistClient() {
               Display name
             </label>
             <input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Utsav" style={field} />
-            <small className="text-muted">Shown until YouTube reports the first track title.</small>
+            <small className="text-muted">Shown in the picker, and until YouTube reports the first track title.</small>
           </div>
 
           <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
@@ -132,7 +136,7 @@ export default function PlaylistClient() {
             <tbody>
               <tr>
                 <td>Playlist ID</td>
-                <td>{current?.youtubePlaylistId ? <code>{current.youtubePlaylistId}</code> : <span className="text-muted">none — player hidden</span>}</td>
+                <td>{current?.youtubePlaylistId ? <code>{current.youtubePlaylistId}</code> : <span className="text-muted">none — saved playlists only</span>}</td>
               </tr>
               <tr><td>Display name</td><td>{current?.name || '—'}</td></tr>
               <tr><td>Player</td><td><span className={`badge ${current?.isEnabled ? '' : 'badge--error'}`}>{current?.isEnabled ? 'SHOWN' : 'HIDDEN'}</span></td></tr>
diff --git a/app/admin/playlist/page.tsx b/app/admin/playlist/page.tsx
index 00f0068..6612512 100644
--- a/app/admin/playlist/page.tsx
+++ b/app/admin/playlist/page.tsx
@@ -18,7 +18,7 @@ export default async function AdminPlaylistPage() {
           <p className="section-label" style={{ marginBottom: '8px' }}>Site Content</p>
           <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>Homepage Music</h1>
           <p style={{ margin: '8px 0 0', color: '#718096' }}>
-            The playlist that plays over the video on the home page.
+            The default playlist for the music player over the video on the home page.
           </p>
         </div>
         <Link className="btn btn-primary" href="/admin">Dashboard &rarr;</Link>
diff --git a/app/page.tsx b/app/page.tsx
index 3bc30b7..40779a3 100644
--- a/app/page.tsx
+++ b/app/page.tsx
@@ -125,7 +125,7 @@ export default async function Home() {
             <div className="events-scene__hero scroll-reveal scroll-reveal--delay-1" id="events-hero-player">
               <img className="events-scene__hero-image events-scene__hero-poster" src="/assets/puja-poster.webp" alt="Bengali Puja Courtyard Celebration" width={1200} height={880} loading="lazy" decoding="async" />
               <CrossfadeVideo />
-              {playlists.length > 0 && <HeroPlaylist playlists={playlists} />}
+              {playlists && <HeroPlaylist playlists={playlists} />}
             </div>
 
             <div className="story-card__intro scroll-reveal" style={{ padding: '0 clamp(16px, 4vw, 48px)' }}>
diff --git a/components/hero-playlist.css b/components/hero-playlist.css
index 6886912..2d87cfb 100644
--- a/components/hero-playlist.css
+++ b/components/hero-playlist.css
@@ -114,7 +114,8 @@
   background: var(--brand-2, #8e3f2d);
 }
 
-.hero-playlist__btn--shuffle.is-on {
+.hero-playlist__btn--shuffle.is-on,
+.hero-playlist__btn--list.is-on {
   color: var(--brand, #b65a3c);
   background: rgba(182, 90, 60, 0.16);
 }
@@ -218,6 +219,201 @@
   outline-offset: 3px;
 }
 
+/* Playlist picker. The panel opens upward over the video, which clips its
+   overflow, so the video is made a size container and the panel is capped to
+   the room left above the bar, scrolling inside itself beyond that. */
+.events-scene__hero:has(> .hero-playlist) {
+  container-type: size;
+}
+
+.hero-playlist__picker {
+  display: flex;
+  flex-shrink: 0;
+}
+
+.hero-playlist__btn--list svg {
+  width: 18px;
+  height: 18px;
+}
+
+.hero-playlist__panel {
+  position: absolute;
+  right: 6px;
+  bottom: calc(100% + 8px);
+  width: min(320px, calc(100vw - 32px));
+  max-height: 340px;
+  max-height: min(340px, calc(100cqh - 100% - 40px));
+  overflow-y: auto;
+  overscroll-behavior: contain;
+
+  display: grid;
+  align-content: start;
+  gap: 10px;
+  padding: 10px;
+
+  border-radius: 18px;
+  border: 1px solid rgba(255, 255, 255, 0.55);
+  background: rgba(251, 245, 232, 0.96);
+  backdrop-filter: blur(10px);
+  -webkit-backdrop-filter: blur(10px);
+  box-shadow: 0 10px 28px rgba(47, 33, 20, 0.32);
+}
+
+.hero-playlist__panel[hidden] {
+  display: none;
+}
+
+.hero-playlist__options {
+  display: grid;
+  gap: 2px;
+  margin: 0;
+  padding: 0;
+  list-style: none;
+}
+
+.hero-playlist__option {
+  display: flex;
+  align-items: center;
+  gap: 8px;
+  width: 100%;
+  padding: 8px 10px;
+  border: 0;
+  border-radius: 10px;
+  background: transparent;
+  color: inherit;
+  font: inherit;
+  font-weight: 600;
+  text-align: left;
+  cursor: pointer;
+  transition: background-color 200ms ease, color 200ms ease;
+}
+
+/* A dot marks the playlist that is loaded, filled in when it is current. */
+.hero-playlist__option::before {
+  content: '';
+  flex-shrink: 0;
+  width: 7px;
+  height: 7px;
+  border-radius: 50%;
+  border: 1.5px solid rgba(110, 78, 52, 0.45);
+}
+
+.hero-playlist__option:hover {
+  background: rgba(182, 90, 60, 0.1);
+}
+
+.hero-playlist__option.is-current {
+  color: var(--brand-2, #8e3f2d);
+  background: rgba(182, 90, 60, 0.16);
+}
+
+.hero-playlist__option.is-current::before {
+  border-color: var(--brand, #b65a3c);
+  background: var(--brand, #b65a3c);
+}
+
+.hero-playlist__option:focus-visible {
+  outline: 2px solid var(--brand-2, #8e3f2d);
+  outline-offset: -2px;
+}
+
+.hero-playlist__option-name {
+  flex: 1 1 auto;
+  min-width: 0;
+  white-space: nowrap;
+  overflow: hidden;
+  text-overflow: ellipsis;
+}
+
+.hero-playlist__option-tag {
+  flex-shrink: 0;
+  color: #6b5b4c;
+  font-size: 0.68rem;
+  font-weight: 500;
+}
+
+.hero-playlist__custom {
+  display: grid;
+  gap: 6px;
+}
+
+.hero-playlist__options + .hero-playlist__custom {
+  padding-top: 10px;
+  border-top: 1px solid rgba(110, 78, 52, 0.18);
+}
+
+.hero-playlist__custom label {
+  padding: 0 2px;
+  color: #6b5b4c;
+  font-size: 0.72rem;
+  font-weight: 700;
+  letter-spacing: 0.02em;
+}
+
+.hero-playlist__custom-row {
+  display: flex;
+  gap: 6px;
+}
+
+.hero-playlist__input {
+  flex: 1 1 auto;
+  min-width: 0;
+  padding: 7px 10px;
+  border: 1px solid rgba(110, 78, 52, 0.3);
+  border-radius: 10px;
+  background: #fffaf0;
+  color: #3c2c1e;
+  font: inherit;
+  font-size: 0.78rem;
+}
+
+.hero-playlist__input::placeholder {
+  color: #8a7a6b;
+}
+
+.hero-playlist__input:focus-visible {
+  outline: 2px solid var(--brand-2, #8e3f2d);
+  outline-offset: 1px;
+}
+
+.hero-playlist__input[aria-invalid='true'] {
+  border-color: #a8412f;
+}
+
+.hero-playlist__go {
+  flex-shrink: 0;
+  padding: 7px 14px;
+  border: 0;
+  border-radius: 10px;
+  background: var(--brand, #b65a3c);
+  color: #fdf7ea;
+  font: inherit;
+  font-weight: 700;
+  cursor: pointer;
+  transition: background-color 200ms ease;
+}
+
+.hero-playlist__go:hover:not(:disabled) {
+  background: var(--brand-2, #8e3f2d);
+}
+
+.hero-playlist__go:disabled {
+  cursor: default;
+  opacity: 0.5;
+}
+
+.hero-playlist__go:focus-visible {
+  outline: 2px solid var(--brand-2, #8e3f2d);
+  outline-offset: 2px;
+}
+
+.hero-playlist__error {
+  margin: 0;
+  padding: 0 2px;
+  color: #9b2c1f;
+  font-size: 0.72rem;
+}
+
 @media (max-width: 560px) {
   .hero-playlist {
     width: calc(100% - 16px);
@@ -245,11 +441,22 @@
     width: 32px;
     height: 32px;
   }
+
+  .hero-playlist__option {
+    padding: 6px 8px;
+  }
+
+  /* Below 16px, iOS zooms the page when the field takes focus. */
+  .hero-playlist__input {
+    font-size: 16px;
+  }
 }
 
 @media (prefers-reduced-motion: reduce) {
 
-  .hero-playlist__btn {
+  .hero-playlist__btn,
+  .hero-playlist__option,
+  .hero-playlist__go {
     transition: none;
   }
 
diff --git a/components/hero-playlist.tsx b/components/hero-playlist.tsx
index 4276707..74beb78 100644
--- a/components/hero-playlist.tsx
+++ b/components/hero-playlist.tsx
@@ -3,6 +3,7 @@
 import { useCallback, useEffect, useId, useRef, useState } from 'react'
 import './hero-playlist.css'
 import type { Playlist } from '@/utils/data/playlists'
+import { parseYouTubePlaylistId } from '@/utils/data/youtube'
 
 /**
  * Music player overlaid on the events video on the homepage.
@@ -12,8 +13,13 @@ import type { Playlist } from '@/utils/data/playlists'
  *   - audio files hosted by the site, played through a plain <audio> element
  *
  * The events video itself is untouched and stays muted; the music sits on top
- * of it. Nothing loads until the visitor presses play, and playback never
- * starts on its own, because browsers block autoplaying audio.
+ * of it. Nothing plays until the visitor presses play or picks a playlist,
+ * because browsers block autoplaying audio.
+ *
+ * A picker in the bar lists the saved playlists by name and takes a YouTube
+ * playlist link pasted by the visitor. A pasted link is only ever reduced to
+ * its playlist id and handed to YouTube's player API, and it stays in this
+ * visitor's browser - nothing is sent to the site.
  */
 
 type YouTubePlayerInstance = {
@@ -109,6 +115,8 @@ type BarProps = {
   onShuffle: () => void
   onSeek: (seconds: number) => void
   children?: React.ReactNode
+  /** The playlist picker, placed at the end of the bar. */
+  picker?: React.ReactNode
 }
 
 /** The visible control bar. Shared by both engines so they look identical. */
@@ -126,6 +134,7 @@ function PlayerBar({
   onShuffle,
   onSeek,
   children,
+  picker,
 }: BarProps) {
   const seekMax = duration > 0 ? duration : 0
   const progress = seekMax > 0 ? (currentTime / seekMax) * 100 : 0
@@ -209,12 +218,20 @@ function PlayerBar({
           </span>
         </div>
       </div>
+
+      {picker}
     </div>
   )
 }
 
+type EngineProps = {
+  /** Start playing once loaded: set when the visitor picked this playlist. */
+  autoStart: boolean
+  picker: React.ReactNode
+}
+
 /** Plays audio files hosted by the site. */
-function AudioPlayer({ playlist }: { playlist: Playlist }) {
+function AudioPlayer({ playlist, autoStart, picker }: { playlist: Playlist } & EngineProps) {
   const tracks = playlist.tracks
 
   const audioRef = useRef<HTMLAudioElement>(null)
@@ -308,6 +325,13 @@ function AudioPlayer({ playlist }: { playlist: Playlist }) {
     audio.play().then(() => setIsPlaying(true), () => setIsPlaying(false))
   }, [index])
 
+  // A playlist the visitor just picked starts straight away. The engine is
+  // remounted per playlist, so this runs once for each pick.
+  useEffect(() => {
+    if (!autoStart) return
+    audioRef.current?.play().then(() => setIsPlaying(true), () => setIsPlaying(false))
+  }, [autoStart])
+
   if (!track) return null
 
   return (
@@ -326,6 +350,7 @@ function AudioPlayer({ playlist }: { playlist: Playlist }) {
         setCurrentTime(value)
         if (audioRef.current) audioRef.current.currentTime = value
       }}
+      picker={picker}
     >
       <audio
         ref={audioRef}
@@ -347,7 +372,7 @@ function AudioPlayer({ playlist }: { playlist: Playlist }) {
 }
 
 /** Plays a YouTube playlist through YouTube's own embedded player. */
-function YouTubePlayer({ playlistId, name }: { playlistId: string; name: string }) {
+function YouTubePlayer({ playlistId, name, autoStart, picker }: { playlistId: string; name: string } & EngineProps) {
   const mountId = useId().replace(/:/g, '')
   const hostRef = useRef<HTMLDivElement>(null)
   const playerRef = useRef<YouTubePlayerInstance | null>(null)
@@ -381,7 +406,7 @@ function YouTubePlayer({ playlistId, name }: { playlistId: string; name: string
           playerVars: {
             listType: 'playlist',
             list: playlistId,
-            // No autoplay: the visitor presses play.
+            // Never on page load; a picked playlist is started in onReady.
             autoplay: 0,
             controls: 0,
             modestbranding: 1,
@@ -395,6 +420,7 @@ function YouTubePlayer({ playlistId, name }: { playlistId: string; name: string
               // Show the real track and length straight away, rather than the
               // playlist name until the first state change arrives.
               readMetadata()
+              if (autoStart) playerRef.current?.playVideo()
             },
             onStateChange: (event) => {
               if (cancelled) return
@@ -422,7 +448,7 @@ function YouTubePlayer({ playlistId, name }: { playlistId: string; name: string
       playerRef.current?.destroy()
       playerRef.current = null
     }
-  }, [playlistId])
+  }, [playlistId, autoStart])
 
   // YouTube has no timeupdate event, so position is polled while playing.
   useEffect(() => {
@@ -472,6 +498,7 @@ function YouTubePlayer({ playlistId, name }: { playlistId: string; name: string
         setCurrentTime(value)
         playerRef.current?.seekTo(value, true)
       }}
+      picker={picker}
     >
       {/* Kept visible on purpose: YouTube's terms require their player to be
           shown while it is playing, so it sits in the bar as a small tile. */}
@@ -482,15 +509,242 @@ function YouTubePlayer({ playlistId, name }: { playlistId: string; name: string
   )
 }
 
+type Choice = Playlist & { custom?: boolean }
+
+type PickerProps = {
+  choices: Choice[]
+  selectedId: string | null
+  open: boolean
+  /** Put focus back on the toggle, since a pick remounts the bar. */
+  refocus: boolean
+  onOpenChange: (open: boolean) => void
+  onSelect: (id: string) => void
+  /** Returns an error message, or null once the link is playing. */
+  onAddLink: (link: string) => string | null
+}
+
+/** The list button in the bar, and the panel of playlists it opens above it. */
+function PlaylistPicker({ choices, selectedId, open, refocus, onOpenChange, onSelect, onAddLink }: PickerProps) {
+  const panelId = useId()
+  const inputId = useId()
+  const errorId = useId()
+  const rootRef = useRef<HTMLDivElement>(null)
+  const toggleRef = useRef<HTMLButtonElement>(null)
+  const inputRef = useRef<HTMLInputElement>(null)
+  const errorRef = useRef<HTMLParagraphElement>(null)
+
+  const [link, setLink] = useState('')
+  const [error, setError] = useState<string | null>(null)
+
+  // On a short video the panel scrolls, which can leave the message out of view.
+  useEffect(() => {
+    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
+  }, [error])
+
+  useEffect(() => {
+    if (refocus) toggleRef.current?.focus()
+  }, [refocus])
+
+  // With nothing saved, the link field is the only thing to do here.
+  useEffect(() => {
+    if (open && choices.length === 0) inputRef.current?.focus()
+  }, [open, choices.length])
+
+  // Closes like any popover: on a click outside it, or on Escape.
+  useEffect(() => {
+    if (!open) return
+
+    const onPointerDown = (event: PointerEvent) => {
+      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false)
+    }
+    const onKeyDown = (event: KeyboardEvent) => {
+      if (event.key !== 'Escape') return
+      onOpenChange(false)
+      toggleRef.current?.focus()
+    }
+
+    document.addEventListener('pointerdown', onPointerDown)
+    document.addEventListener('keydown', onKeyDown)
+    return () => {
+      document.removeEventListener('pointerdown', onPointerDown)
+      document.removeEventListener('keydown', onKeyDown)
+    }
+  }, [open, onOpenChange])
+
+  const pick = (id: string) => {
+    toggleRef.current?.focus()
+    onSelect(id)
+  }
+
+  const submit = (event: React.FormEvent<HTMLFormElement>) => {
+    event.preventDefault()
+    const message = onAddLink(link)
+    setError(message)
+    if (message) return
+    setLink('')
+    toggleRef.current?.focus()
+  }
+
+  return (
+    <div className="hero-playlist__picker" ref={rootRef}>
+      <button
+        ref={toggleRef}
+        type="button"
+        className={`hero-playlist__btn hero-playlist__btn--list ${open ? 'is-on' : ''}`}
+        onClick={() => onOpenChange(!open)}
+        aria-label="Choose a playlist"
+        aria-expanded={open}
+        aria-controls={panelId}
+      >
+        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
+          <path d="M4 6h12" />
+          <path d="M4 11h12" />
+          <path d="M4 16h7" />
+          <circle cx="16.5" cy="17.5" r="2.5" />
+          <path d="M19 17.5V9.5l2 1" />
+        </svg>
+      </button>
+
+      <div id={panelId} className="hero-playlist__panel" role="dialog" aria-label="Playlists" hidden={!open}>
+        {choices.length > 0 && (
+          <ul className="hero-playlist__options">
+            {choices.map((choice) => {
+              const current = choice.id === selectedId
+              return (
+                <li key={choice.id}>
+                  <button
+                    type="button"
+                    className={`hero-playlist__option ${current ? 'is-current' : ''}`}
+                    aria-pressed={current}
+                    onClick={() => pick(choice.id)}
+                  >
+                    <span className="hero-playlist__option-name" title={choice.name}>{choice.name}</span>
+                    {choice.custom && <span className="hero-playlist__option-tag">your link</span>}
+                  </button>
+                </li>
+              )
+            })}
+          </ul>
+        )}
+
+        <form className="hero-playlist__custom" onSubmit={submit} noValidate>
+          <label htmlFor={inputId}>Play a YouTube playlist</label>
+          <div className="hero-playlist__custom-row">
+            <input
+              ref={inputRef}
+              id={inputId}
+              className="hero-playlist__input"
+              type="text"
+              inputMode="url"
+              autoComplete="off"
+              spellCheck={false}
+              placeholder="Paste a playlist link"
+              value={link}
+              onChange={(e) => {
+                setLink(e.currentTarget.value)
+                if (error) setError(null)
+              }}
+              aria-invalid={error ? true : undefined}
+              aria-describedby={error ? errorId : undefined}
+            />
+            <button type="submit" className="hero-playlist__go" disabled={link.trim() === ''}>
+              Play
+            </button>
+          </div>
+          {error && <p ref={errorRef} id={errorId} className="hero-playlist__error" role="alert">{error}</p>}
+        </form>
+      </div>
+    </div>
+  )
+}
+
+const noop = () => {}
+
 export default function HeroPlaylist({ playlists }: { playlists: Playlist[] }) {
-  // One playlist drives the hero. Extra playlists stay in the data file for a
-  // future selector rather than being silently concatenated.
-  const playlist = playlists[0]
-  if (!playlist) return null
+  // Links pasted by this visitor. Kept in memory only; never sent anywhere.
+  const [custom, setCustom] = useState<Choice[]>([])
+  const [selectedId, setSelectedId] = useState<string | null>(playlists[0]?.id ?? null)
+  const [open, setOpen] = useState(false)
+  // Set by the first pick, so nothing plays until the visitor asks for it.
+  const [picked, setPicked] = useState(false)
+
+  const choices: Choice[] = [...playlists, ...custom]
+  const playlist = choices.find((choice) => choice.id === selectedId)
+
+  const select = (id: string) => {
+    setOpen(false)
+    if (id === selectedId) return
+    setSelectedId(id)
+    setPicked(true)
+  }
+
+  const addLink = (link: string) => {
+    const youtubePlaylistId = parseYouTubePlaylistId(link)
+    if (!youtubePlaylistId) {
+      return 'That is not a YouTube playlist link. Copy it from the playlist\'s Share button.'
+    }
+
+    const existing = choices.find((choice) => choice.youtubePlaylistId === youtubePlaylistId)
+    if (existing) {
+      select(existing.id)
+      return null
+    }
 
-  if (playlist.youtubePlaylistId) {
-    return <YouTubePlayer playlistId={playlist.youtubePlaylistId} name={playlist.name} />
+    const choice: Choice = {
+      id: `custom-${youtubePlaylistId}`,
+      name: custom.length === 0 ? 'Your playlist' : `Your playlist ${custom.length + 1}`,
+      youtubePlaylistId,
+      tracks: [],
+      custom: true,
+    }
+    setCustom((list) => [...list, choice])
+    select(choice.id)
+    return null
   }
 
-  return <AudioPlayer playlist={playlist} />
+  const picker = (
+    <PlaylistPicker
+      choices={choices}
+      selectedId={playlist?.id ?? null}
+      open={open}
+      refocus={picked}
+      onOpenChange={setOpen}
+      onSelect={select}
+      onAddLink={addLink}
+    />
+  )
+
+  // Keyed by playlist, so a pick starts the new one from a clean engine.
+  if (playlist?.youtubePlaylistId) {
+    return (
+      <YouTubePlayer
+        key={playlist.id}
+        playlistId={playlist.youtubePlaylistId}
+        name={playlist.name}
+        autoStart={picked}
+        picker={picker}
+      />
+    )
+  }
+
+  if (playlist) {
+    return <AudioPlayer key={playlist.id} playlist={playlist} autoStart={picked} picker={picker} />
+  }
+
+  // Nothing saved: the bar still shows, and play opens the picker.
+  return (
+    <PlayerBar
+      title="Choose a playlist"
+      isPlaying={false}
+      shuffle={false}
+      currentTime={0}
+      duration={0}
+      onToggle={() => setOpen(true)}
+      onNext={noop}
+      onPrevious={noop}
+      onShuffle={noop}
+      onSeek={noop}
+      picker={picker}
+    />
+  )
 }
diff --git a/utils/data/site-playlist.ts b/utils/data/site-playlist.ts
index bfdbc80..5ae8138 100644
--- a/utils/data/site-playlist.ts
+++ b/utils/data/site-playlist.ts
@@ -115,23 +115,28 @@ export async function setSitePlaylist(input: {
 }
 
 /**
- * What the homepage renders: the configured playlist when there is one, and
- * otherwise whatever public/data/playlists.json holds, so a developer can
- * still ship hosted audio files.
+ * The playlists the homepage player offers: the one set from the admin UI
+ * first, as the default, then the named playlists saved in
+ * public/data/playlists.json. The list may be empty - visitors can still paste
+ * a link of their own - so null, not [], is what hides the player.
  */
-export async function getHomepagePlaylists(): Promise<Playlist[]> {
+export async function getHomepagePlaylists(): Promise<Playlist[] | null> {
   const setting = await getSitePlaylistSetting()
+  if (!setting.isEnabled) return null
 
-  if (setting.isEnabled && setting.youtubePlaylistId) {
-    return [{
-      id: 'site',
-      name: setting.name,
-      youtubePlaylistId: setting.youtubePlaylistId,
-      tracks: [],
-    }]
-  }
+  const saved = getPlaylists()
+  if (!setting.youtubePlaylistId) return saved
 
-  if (!setting.isEnabled) return []
+  const site: Playlist = {
+    id: 'site',
+    name: setting.name,
+    youtubePlaylistId: setting.youtubePlaylistId,
+    tracks: [],
+  }
 
-  return getPlaylists()
+  // Listed once, even when the file saves the same playlist.
+  return [
+    site,
+    ...saved.filter((playlist) => playlist.id !== site.id && playlist.youtubePlaylistId !== site.youtubePlaylistId),
+  ]
 }
-- 
2.43.0
~~~~
