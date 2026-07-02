// src/render/juice/HitStop.ts
// Brief freezes of SIM time on impactful kills for punch, without pausing render/tweens/particles:
// main.ts filters only the dt handed to game.tick() through this; gameView.update() still gets
// raw dt every frame. A cooldown skips new triggers fired too soon after the last accepted one so
// dense kill-streaks (e.g. wave clears at 4x speed) can't stutter-lock the sim into a near-permanent
// freeze.
import { juice } from './motion'

const COOLDOWN = 0.25 // seconds; new triggers within this window of the last one are ignored

export class HitStop {
  private remaining = 0
  // Time since the last ACCEPTED trigger. Starts at COOLDOWN so the very first trigger call
  // is never blocked by the cooldown.
  private sinceLast = COOLDOWN

  /** Cancels any active freeze and re-arms the cooldown (e.g. on level reset). */
  reset(): void {
    this.remaining = 0
    this.sinceLast = COOLDOWN
  }

  /** Requests a freeze of `seconds`; overlapping freezes take the max, not the sum. No-op when
   * reducedFx is set, or when a trigger already fired within the last COOLDOWN seconds. */
  trigger(seconds: number): void {
    if (juice.reducedFx) return
    if (this.sinceLast < COOLDOWN) return
    this.remaining = Math.max(this.remaining, seconds)
    this.sinceLast = 0
  }

  /** Ticks on raw dt every frame. Returns 0 while frozen (consuming the freeze), otherwise
   * passes dt straight through. */
  filter(dt: number): number {
    this.sinceLast += dt
    if (this.remaining > 0) {
      this.remaining -= dt
      return 0
    }
    return dt
  }
}
