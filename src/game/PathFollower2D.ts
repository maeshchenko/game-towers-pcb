import type { Pt } from '../geom/types'

export class PathFollower2D {
  pos: Pt
  done = false
  traveled = 0
  private target = 1
  constructor(private points: Pt[], private speedPx: number) {
    this.pos = { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0 }
    if (points.length < 2) this.done = true
  }
  advance(dt: number): void {
    if (this.done) return
    let budget = this.speedPx * dt
    while (budget > 0 && !this.done) {
      const tgt = this.points[this.target]
      const dx = tgt.x - this.pos.x, dy = tgt.y - this.pos.y
      const d = Math.hypot(dx, dy)
      if (d <= budget) {
        this.pos.x = tgt.x; this.pos.y = tgt.y
        budget -= d; this.traveled += d
        this.target += 1
        if (this.target >= this.points.length) { this.done = true; this.target = this.points.length - 1 }
      } else {
        const inv = budget / d
        this.pos.x += dx * inv; this.pos.y += dy * inv
        this.traveled += budget; budget = 0
      }
    }
  }
}
