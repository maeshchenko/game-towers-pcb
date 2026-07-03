import type { Pt } from '../geom/types'
import { dist } from '../geom/grid'
import type { Enemy } from './Enemy'
import type { TowerKind, TowerLevel } from './towerTypes'
import { TOWER_DEFS, TOWER_BRANCHES } from './towerTypes'
import type { SpatialGrid } from './SpatialGrid'

export type TargetMode = 'first' | 'last' | 'strong' | 'weak'
export interface ShotResult {
  from: Pt; target?: Enemy; damage?: number; slow?: number
  splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number
  aura?: { slow: number; range: number }
}

export class Tower {
  private lvl = 0
  private br: 0 | 1 | null = null
  private cooldown: number
  targetMode: TargetMode = 'first'
  special = false // placed on a special spot → boosted range + damage
  constructor(readonly kind: TowerKind, readonly pos: Pt, private pitch: number) {
    this.cooldown = 1 / TOWER_DEFS[kind][0].fireRate
  }
  /** 0..2 linear, 3 once a branch is chosen. */
  get level(): number { return this.br !== null ? TOWER_DEFS[this.kind].length : this.lvl }
  get branch(): 0 | 1 | null { return this.br }
  get stats(): TowerLevel { return this.br !== null ? TOWER_BRANCHES[this.kind][this.br] : TOWER_DEFS[this.kind][this.lvl] }
  /** Top tier including the branch specialization (linear levels + 1). */
  get maxLevel(): number { return TOWER_DEFS[this.kind].length }
  /** True at max linear level with no specialization picked yet. */
  get canBranch(): boolean { return this.br === null && this.lvl === TOWER_DEFS[this.kind].length - 1 }
  cycleTargetMode(): void {
    const order: TargetMode[] = ['first', 'last', 'strong', 'weak']
    this.targetMode = order[(order.indexOf(this.targetMode) + 1) % order.length]
  }
  /** Linear upgrade only; the tier-4 step goes through chooseBranch. */
  upgrade(): boolean { if (this.lvl >= TOWER_DEFS[this.kind].length - 1) return false; this.lvl += 1; return true }
  chooseBranch(b: 0 | 1): boolean { if (!this.canBranch) return false; this.br = b; return true }

  update(dt: number, enemies: Enemy[], grid?: SpatialGrid<Enemy>): ShotResult | null {
    const s = this.stats
    const k = this.special ? 1.35 : 1 // special-spot boost
    const rangePx = s.range * this.pitch * k
    // Aura towers: slow is a speed MULTIPLIER (lower = stronger), so the spot boost goes
    // into range only — multiplying the factor would make a boosted SLOW weaker.
    if (s.aura) return { aura: { slow: s.slow ?? 0, range: rangePx }, from: this.pos }
    this.cooldown -= dt
    if (this.cooldown > 0) return null // still reloading — skip target selection entirely
    const candidates = grid ? grid.queryCircle(this.pos, rangePx) : enemies
    let target: Enemy | undefined
    for (const e of candidates) {
      if (!e.alive || dist(e.pos, this.pos) > rangePx) continue
      if (!target) { target = e; continue }
      const better =
        this.targetMode === 'first' ? e.traveled > target.traveled :
        this.targetMode === 'last' ? e.traveled < target.traveled :
        this.targetMode === 'strong' ? e.hp > target.hp : e.hp < target.hp
      if (better) target = e
    }
    // No target: don't bank negative cooldown into a burst when one appears later.
    if (!target) { this.cooldown = 0; return null }
    // Carry the remainder so the long-run rate is exactly fireRate regardless of dt size.
    this.cooldown += 1 / s.fireRate
    return {
      from: this.pos, target, damage: s.damage * k, slow: s.slow,
      splashRadius: s.splashRadius, chainCount: s.chainCount, chainRange: s.chainRange, pierce: s.pierce,
    }
  }
}
