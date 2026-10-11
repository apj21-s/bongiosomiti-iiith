/**
 * What the gate scanner tells the person holding the phone, beyond the screen.
 *
 * At a busy food gate the admin is looking at the attendee, not the phone, so
 * every scan answers out loud: a different tone (and vibration, where the
 * browser has it) for a Veg plate, a Non-Veg plate, a pass that needs a
 * second look, and a pass that must be turned away. The tones are synthesised
 * with Web Audio so there are no sound files to ship or fail to load.
 */

import type { FoodKind } from './food-kind'

export { foodKind, mealSection } from './food-kind'
export type FeedbackKind = FoodKind | 'ok' | 'warn' | 'deny'

type Tone = { freq: number; start: number; dur: number; type?: OscillatorType }

const TONES: Record<FeedbackKind, Tone[]> = {
  veg: [
    { freq: 880, start: 0, dur: 0.09 },
    { freq: 1320, start: 0.12, dur: 0.14 },
  ],
  nonveg: [
    { freq: 660, start: 0, dur: 0.08 },
    { freq: 660, start: 0.12, dur: 0.08 },
    { freq: 660, start: 0.24, dur: 0.1 },
  ],
  // A check-in whose pass names no plate.
  ok: [{ freq: 1046, start: 0, dur: 0.16 }],
  warn: [
    { freq: 520, start: 0, dur: 0.16, type: 'triangle' },
    { freq: 390, start: 0.2, dur: 0.24, type: 'triangle' },
  ],
  deny: [{ freq: 180, start: 0, dur: 0.45, type: 'square' }],
}

const VIBRATION: Record<FeedbackKind, number[]> = {
  veg: [80],
  nonveg: [80, 60, 80],
  ok: [80],
  warn: [200, 100, 200],
  deny: [400],
}

let ctx: AudioContext | null = null

/**
 * Mobile browsers keep audio muted until the page is touched, so this must be
 * called from a tap. Resolves to whether sound is now live.
 */
export async function unlockAudio(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return false
      ctx = new Ctor()
    }
    if (ctx.state !== 'running') await ctx.resume()
    return ctx.state === 'running'
  } catch {
    return false
  }
}

export function playFeedback(kind: FeedbackKind) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(VIBRATION[kind])
    }
  } catch {}

  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  for (const tone of TONES[kind]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = tone.type || 'sine'
    osc.frequency.value = tone.freq
    // Short attack and release so the beeps don't click.
    const t0 = now + tone.start
    const t1 = t0 + tone.dur
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01)
    gain.gain.setValueAtTime(0.35, t1 - 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t1)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t1 + 0.02)
  }
}
