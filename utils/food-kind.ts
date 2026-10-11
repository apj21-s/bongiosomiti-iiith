/**
 * Which plate a pass is for, and how that plate is drawn.
 *
 * The scanner, the emailed QR and the pass page all need to tell Veg from
 * Non-Veg and paint it the same way, so the reading of `food_pref` and the
 * colours of the mark live here once.
 */

export type FoodKind = 'veg' | 'nonveg'

/**
 * `mark` is the FSSAI-style symbol; `qr` is a darker shade for the QR's
 * modules, dark enough against white that scanners read it like black.
 */
export const FOOD_COLORS: Record<FoodKind, { mark: string; qr: string }> = {
  veg: { mark: '#15803d', qr: '#14532d' },
  nonveg: { mark: '#7c2d12', qr: '#5c1d0c' },
}

/**
 * Which plate a ticket's `food_pref` admits to. The column is free text - the
 * pass type's label, e.g. "Veg", "Non-Veg", "Breakfast · Veg" or
 * "Non-Veg (Authentic Bhoj)" - so this matches on the words. Non-veg is tested
 * first because "non-veg" also contains "veg".
 */
export function foodKind(foodPref?: string | null): FoodKind | null {
  if (!foodPref) return null
  const s = foodPref.toLowerCase().replace(/[\s\-_]/g, '')
  if (s.includes('nonveg')) return 'nonveg'
  if (s.includes('veg')) return 'veg'
  return null
}

/** The meal a sectioned pass is for ("Breakfast" in "Breakfast · Veg"). */
export function mealSection(foodPref?: string | null): string | null {
  if (!foodPref || !foodPref.includes(' · ')) return null
  return foodPref.split(' · ')[0].trim() || null
}

/**
 * The veg / non-veg mark as a standalone SVG on a 100x100 box: a white tile
 * with a coloured border holding a dot (veg) or a triangle (non-veg). The
 * shape carries the meaning as well as the colour, so it still reads in black
 * and white. Geometry matches `utils/pass-qr.ts`, including the proportions
 * that keep it from reading as a QR finder pattern - see there.
 */
export function foodMarkSvg(kind: FoodKind): string {
  const c = FOOD_COLORS[kind].mark
  const inner = kind === 'veg'
    ? `<circle cx="50" cy="50" r="18" fill="${c}"/>`
    : `<polygon points="50,26 74,70 26,70" fill="${c}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect x="4" y="4" width="92" height="92" rx="10" fill="#fff" stroke="${c}" stroke-width="8"/>` +
    inner +
    `</svg>`
}
