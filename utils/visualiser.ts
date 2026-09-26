/**
 * The numbers behind the player's equaliser.
 *
 * Kept apart from the component, and free of any import, so the motion can be
 * checked on its own - the component around it is a rAF loop writing transforms,
 * which is not something a test can see.
 *
 * It is not a spectrum analyser and cannot be one: the music plays inside
 * YouTube's iframe, which is a different origin, so the page cannot read a
 * sample of its audio. What these functions do instead is follow the song in
 * the ways that are observable from outside it - see `hero-equaliser.tsx`.
 */

/** Where the bars sit when nothing is playing. */
export const REST = 0.12

/** A small stable hash, so a title always gives the same number. */
export function hashOf(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

export type Band = {
  /** 0 at the bass end, 1 at the treble end. */
  spread: number
  phase: number
  speed: number
  weight: number
}

/**
 * One band per bar. The low bands sweep slowly and loudly, the high ones
 * flicker and stay small, which is the difference you actually see on a meter.
 */
export function bandsFor(seed: string, count: number): Band[] {
  const bands: Band[] = []

  for (let i = 0; i < count; i += 1) {
    const spread = count > 1 ? i / (count - 1) : 0
    const wobble = hashOf(`${seed}:${i}`)
    bands.push({
      spread,
      phase: wobble * Math.PI * 2,
      speed: 1.05 + spread * 8.5 + wobble * 0.8,
      weight: 1 - 0.42 * spread,
    })
  }

  return bands
}

/** Somewhere between a slow dhemali and a fast one, fixed per song. */
export function beatsPerSecondFor(seed: string): number {
  return (86 + hashOf(seed) * 46) / 60
}

/**
 * The level a band is reaching for, at a given point in the song. Driven by the
 * playback clock, so the pattern holds when the song pauses and moves with it
 * when it is seeked.
 */
export function targetLevel(band: Band, clock: number, beatsPerSecond: number): number {
  const beat = 0.5 + 0.5 * Math.sin(clock * beatsPerSecond * Math.PI * 2 - band.spread * 0.9)
  const swell = 0.5 + 0.5 * Math.sin(clock * band.speed + band.phase)
  const detail = 0.5 + 0.5 * Math.sin(clock * band.speed * 1.73 + band.phase * 2.1)

  // The beat is felt at the bass end, where a drum lives; the treble carries
  // the fine movement instead. Weighted the other way round, the one pulse
  // every band shares swamps them and they all flicker at the same rate -
  // which is what the checks caught.
  const level =
    0.14 +
    band.weight *
      (0.34 * (1 - 0.6 * band.spread) * beat +
        0.4 * swell +
        (0.26 + 0.25 * band.spread) * detail)

  return level > 1 ? 1 : level
}

/**
 * Fast attack, slow release. A meter jumps at a note and falls away from it;
 * moving in and out symmetrically is what makes a fake one look fake.
 */
export function easeLevel(current: number, target: number): number {
  const rate = target > current ? 0.5 : 0.11
  return current + (target - current) * rate
}
