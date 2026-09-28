import { NextResponse } from 'next/server';
import { getGallery } from '@/utils/data/gallery';

export const revalidate = 0; // Prevent caching so album updates are instant

/**
 * The gallery, from one place only.
 *
 * public/gallery/gallery.csv is the single source of truth: add a row there
 * and drop the image in public/gallery/<event year>/. Nothing else feeds this
 * endpoint.
 *
 * It used to fall back to the album_photos table and then to
 * public/data/album.json, which meant the same gallery could be changed from
 * three places at once and the winner depended on which happened to be
 * non-empty. Both are retired - see others/retired-album-sources/ - and the
 * admin sync route that wrote to the table has gone with them. The table
 * itself is left alone in Supabase rather than dropped; nothing reads it.
 */
export async function GET() {
  const photos = getGallery();

  if (photos.length === 0) {
    console.error('Album is empty: public/gallery/gallery.csv is missing or has no usable rows.');
  }

  return NextResponse.json(photos);
}
