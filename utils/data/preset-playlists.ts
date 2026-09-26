/**
 * The playlists offered in the player, before anyone pastes a link of their own.
 *
 * Five, covering what actually gets played at a Bengali puja: the Agomoni songs
 * of Mahalaya, Tagore, Nazrul, the modern Bengali songbook, and the bands.
 *
 * Each id was checked against YouTube's oEmbed endpoint on 27 September 2026 and
 * returned the title given here, so all five are public playlists rather than
 * plausible-looking ids. They are somebody else's playlists, though, and can be
 * taken down or made private without warning - a dead one shows as "Playlist
 * unavailable" in the bar rather than breaking the page. To change the offering,
 * edit this file: it is the only place these live.
 *
 * Nothing here is user input, but the shape is the same one everything else in
 * the player accepts, so a mistyped id is caught by the same validation rather
 * than reaching YouTube.
 */

export type PresetPlaylist = {
  /** YouTube playlist id, as it appears after list= in the URL. */
  id: string
  /** What the button says. Kept to a word or two so five fit across a phone. */
  name: string
  /** The tooltip, and what the bar shows while YouTube is still loading. */
  note: string
}

export const PRESET_PLAYLISTS: PresetPlaylist[] = [
  {
    id: 'PLKo6rL-9kxxQMW_1XGc5VO-Q8uw3QFz5B',
    name: 'Agomoni',
    note: 'Durga Puja Special Agomoni Songs',
  },
  {
    id: 'PLteSRTKLf30w5IIeF_lBDr87J3FgWNik4',
    name: 'Rabindra Sangeet',
    note: 'Best of Rabindranath Tagore Songs',
  },
  {
    id: 'PLC3FPEAM1FIPEsAcY6WI2XsHxLKEF0qJn',
    name: 'Nazrul Geeti',
    note: 'Nazrul Geeti, Bengali Music',
  },
  {
    id: 'PLzxTmXYDR-xX7xZdk2Hq8s2nn8Eg0NPM5',
    name: 'Adhunik',
    note: 'Bangla Adhunik Gaan, Best of Bengali Hits',
  },
  {
    id: 'PLLBpg_1JUZJichyFGwsczr93J7Jf-p_k7',
    name: 'Bangla Band',
    note: 'Chandrabindoo, Bangla Band',
  },
]

/**
 * What plays when nobody has chosen anything: the Agomoni songs, which are the
 * ones that actually belong to the run-up to the puja.
 */
export const DEFAULT_PLAYLIST = PRESET_PLAYLISTS[0]

/** The name to show for a playlist id, when it is one of ours. */
export function presetName(id: string | null): string | null {
  if (!id) return null
  const preset = PRESET_PLAYLISTS.find((entry) => entry.id === id)
  return preset ? preset.name : null
}
