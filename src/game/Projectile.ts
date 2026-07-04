// A sim-side projectile: damage lands on arrival, not on fire. PULSE (cannon) homes on its
// target, MISSILE (mortar) flies ballistically to a fixed aim point (fast enemies can dodge — by
// design).
import type { Pt } from '../geom/types'
import type { Enemy } from './Enemy'
import type { TowerKind } from './towerTypes'
import type { ShotResult } from './Tower'

const HIT_DIST = 6 // px: close enough to count as a hit

export class Projectile {
  pos: Pt
  private aim: Pt
  readonly from: Pt

  constructor(
    readonly kind: TowerKind,
    from: Pt,
    public target: Enemy | null, // null → ballistic (mortar)
    readonly shot: ShotResult,
    private readonly speedPx: number,
    aimPoint?: Pt,
  ) {
    this.pos = { x: from.x, y: from.y }
    this.from = { x: from.x, y: from.y }
    this.aim = aimPoint ? { x: aimPoint.x, y: aimPoint.y } : { x: target!.pos.x, y: target!.pos.y }
  }

  /**
   * Distance traveled from spawn toward the current aim point, 0..1. Recomputed each call from
   * traveled/(traveled+remaining) so it tracks a homing target's shifting aim. Used by rendering
   * (missile arc).
   */
  get progress(): number {
    const traveled = Math.hypot(this.pos.x - this.from.x, this.pos.y - this.from.y)
    const remaining = Math.hypot(this.aim.x - this.pos.x, this.aim.y - this.pos.y)
    const total = traveled + remaining
    return total <= 0 ? 0 : Math.min(1, traveled / total)
  }

  /** Advance; returns true when arrived (impact resolved by Game). */
  update(dt: number): boolean {
    if (this.target) {
      if (this.target.alive) { this.aim.x = this.target.pos.x; this.aim.y = this.target.pos.y }
      else this.target = null // keep flying to last known position
    }
    const dx = this.aim.x - this.pos.x, dy = this.aim.y - this.pos.y
    const d = Math.hypot(dx, dy)
    const step = this.speedPx * dt
    if (d <= Math.max(HIT_DIST, step)) { this.pos.x = this.aim.x; this.pos.y = this.aim.y; return true }
    this.pos.x += (dx / d) * step
    this.pos.y += (dy / d) * step
    return false
  }
}
