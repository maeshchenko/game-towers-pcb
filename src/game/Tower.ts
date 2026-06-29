import type { Pt } from '../geom/types'
import { dist } from '../geom/grid'
import type { Enemy } from './Enemy'
import type { TowerKind, TowerLevel } from './towerTypes'
import { TOWER_DEFS } from './towerTypes'

export type TargetMode = 'first' | 'last' | 'strong' | 'weak'
export interface ShotResult {
  from: Pt; target?: Enemy; damage?: number; slow?: number
  splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number
  aura?: { slow: number; range: number }
}

export class Tower {
  private lvl = 0
  private cooldown: number
  targetMode: TargetMode = 'first'
  constructor(readonly kind: TowerKind, readonly pos: Pt, private pitch: number) {
    this.cooldown = 1 / TOWER_DEFS[kind][0].fireRate
  }
  get level(): number { return this.lvl }
  get stats(): TowerLevel { return TOWER_DEFS[this.kind][this.lvl] }
  get maxLevel(): number { return TOWER_DEFS[this.kind].length - 1 }
  cycleTargetMode(): void {
    const order: TargetMode[] = ['first', 'last', 'strong', 'weak']
    this.targetMode = order[(order.indexOf(this.targetMode) + 1) % order.length]
  }
  upgrade(): boolean { if (this.lvl >= this.maxLevel) return false; this.lvl += 1; return true }

  update(dt: number, enemies: Enemy[]): ShotResult | null {
    const s = this.stats
    const rangePx = s.range * this.pitch
    if (s.aura) return { aura: { slow: s.slow ?? 0, range: rangePx }, from: this.pos }
    this.cooldown -= dt
    let target: Enemy | undefined
    for (const e of enemies) {
      if (!e.alive || dist(e.pos, this.pos) > rangePx) continue
      if (!target) { target = e; continue }
      const better =
        this.targetMode === 'first' ? e.traveled > target.traveled :
        this.targetMode === 'last' ? e.traveled < target.traveled :
        this.targetMode === 'strong' ? e.hp > target.hp : e.hp < target.hp
      if (better) target = e
    }
    if (!target || this.cooldown > 0) return null
    this.cooldown = 1 / s.fireRate
    return {
      from: this.pos, target, damage: s.damage, slow: s.slow,
      splashRadius: s.splashRadius, chainCount: s.chainCount, chainRange: s.chainRange, pierce: s.pierce,
    }
  }
}
