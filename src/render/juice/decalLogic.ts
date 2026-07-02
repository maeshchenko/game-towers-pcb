// src/render/juice/decalLogic.ts
// Pure decal-pool math: no pixi imports so this is jsdom/node-testable in isolation.
// Decals.ts wraps this with pooled pixi Graphics for the actual scorch-mark rendering.

const FADE_SECONDS = 10
const START_ALPHA = 0.5

export interface DecalEntry {
  bornAt: number
  active: boolean
}

// Fixed-capacity ring buffer of decal slots. acquire() hands out slots in insertion order and,
// once full, reuses the slot acquired longest ago — a plain circular cursor achieves this without
// any per-call search since slots are always filled in age order.
export class DecalPool {
  readonly cap: number
  entries: DecalEntry[] = []
  private cursor = 0

  constructor(cap: number) {
    this.cap = cap
  }

  /** Returns the slot index to draw into: a fresh slot while under capacity, otherwise the
   * oldest-acquired slot (reused immediately, no fade-out grace period). */
  acquire(now: number): number {
    if (this.entries.length < this.cap) {
      const slot = this.entries.length
      this.entries.push({ bornAt: now, active: true })
      this.cursor = (slot + 1) % this.cap
      return slot
    }
    const slot = this.cursor
    this.entries[slot] = { bornAt: now, active: true }
    this.cursor = (this.cursor + 1) % this.cap
    return slot
  }

  /** Linear fade from 0.5 at birth to 0 at +10s. Unacquired/inactive slots are always 0. */
  alphaAt(slot: number, now: number): number {
    const e = this.entries[slot]
    if (!e || !e.active) return 0
    const age = now - e.bornAt
    if (age >= FADE_SECONDS) return 0
    return Math.max(0, START_ALPHA * (1 - age / FADE_SECONDS))
  }
}
