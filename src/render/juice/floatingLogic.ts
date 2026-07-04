// src/render/juice/floatingLogic.ts
// Pure damage-batching math: no pixi imports so this is node/jsdom-testable in isolation.
// FloatingText.ts (and GameView) drive spawning off the batches this returns.

const BATCH_WINDOW = 0.25 // seconds: batches flush once this long has passed since their first hit

interface Batch {
  amount: number
  x: number
  y: number
  firstAt: number
}

// Accumulates per-key (per-enemy) damage hits into time-boxed batches. add() sums amounts and
// keeps the latest position; flush() returns (and removes) batches whose window has elapsed.
export class DamageAggregator {
  private batches = new Map<object, Batch>()

  add(key: object, amount: number, x: number, y: number, now: number): void {
    const existing = this.batches.get(key)
    if (existing) {
      existing.amount += amount
      existing.x = x
      existing.y = y
    } else {
      this.batches.set(key, { amount, x, y, firstAt: now })
    }
  }

  flush(now: number): Array<{ amount: number; x: number; y: number }> {
    const out: Array<{ amount: number; x: number; y: number }> = []
    for (const [key, batch] of this.batches) {
      if (now - batch.firstAt < BATCH_WINDOW) continue
      out.push({ amount: batch.amount, x: batch.x, y: batch.y })
      this.batches.delete(key)
    }
    return out
  }
}
