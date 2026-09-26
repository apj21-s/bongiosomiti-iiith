-- The music playlist shown on the homepage, editable from the admin UI.
--
-- Run this in the Supabase SQL editor. Additive and safe to re-run.
--
-- It lives in the database rather than in public/data/playlists.json because
-- the filesystem is read-only on Vercel - the same reason admin edits to
-- events.json do not survive a deploy. The JSON file stays as the fallback
-- when no row is set.
--
-- Only the extracted YouTube playlist id is stored, never a pasted URL. The
-- id is constrained to the character set YouTube actually uses, so nothing
-- that reaches the page can carry a scheme, a host or markup.

create table if not exists site_playlist (
  -- Single-row table: the id is pinned so an upsert always targets one row.
  id boolean primary key default true,
  constraint site_playlist_singleton check (id),

  -- e.g. PLKDZ1ig0uz-U. Validated in the app before it is written, and again
  -- when it is read.
  youtube_playlist_id text,
  constraint site_playlist_id_charset
    check (youtube_playlist_id is null or youtube_playlist_id ~ '^[A-Za-z0-9_-]{1,64}$'),

  -- Shown in the player before YouTube reports the first track title.
  name text not null default 'Playlist',

  is_enabled boolean not null default true,
  updated_at timestamptz default now(),
  updated_by text
);

-- Same posture as the other tables: denied to anon, reached only through the
-- service-role client in the API routes. The public homepage reads it through
-- a server component, not from the browser.
alter table site_playlist enable row level security;

grant all on table site_playlist to service_role;
