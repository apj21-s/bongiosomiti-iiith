CREATE TABLE IF NOT EXISTS public.album_photos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT,
    src TEXT NOT NULL,
    pos TEXT,
    sort_order INTEGER NOT NULL
);

ALTER TABLE public.album_photos ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on album_photos" 
ON public.album_photos FOR SELECT USING (true);

-- Allow service role to do everything (bypasses RLS anyway, but good practice)
-- Allow anon inserts/updates for the admin panel if no auth is set up yet
CREATE POLICY "Allow anon all on album_photos" 
ON public.album_photos FOR ALL USING (true) WITH CHECK (true);
