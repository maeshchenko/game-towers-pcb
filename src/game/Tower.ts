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
  /** Status payloads (tier-4 weapons) — applied to every enemy the shot damages. */
  burnDps?: number; burnDur?: number; shredArmor?: number; shredDur?: number
  /** Source tower — hit resolvers credit damage/kill stats through it. */
  tower?: Tower
}

export class Tower {
  private lvl = 0
  private br: 0 | 1 | null = null
  private cooldown: number
  targetMode: TargetMode = 'first'
  special = false // placed on a special spot → boosted range + damage
  /** Global damage multiplier from station meta-upgrades (firmware track); 1 = no meta. */
  damageMul = 1
  /** Lifetime combat stats (per-tower panel line + debrief "best tower"). */
  damageDealt = 0
  kills = 0
  /** Temporary fire-rate buff (the OVERLOAD ability). */
  private buffMul = 1
  private buffT = 0
  get isOverloaded(): boolean { return this.buffT > 0 }
  applyRateBuff(mul: number, dur: number): void {
    this.buffMul = mul
    this.buffT = Math.max(this.buffT, dur)
  }
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
    if (this.buffT > 0) this.buffT -= dt
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
      // first/last compare remaining distance to the base (comparable across different
      // paths on multi-entrance maps — absolute `traveled` is not). strong keys off maxHp
      // so a wounded boss keeps the focus; weak stays on current hp (finish kills).
      const better =
        this.targetMode === 'first' ? e.distToBase < target.distToBase :
        this.targetMode === 'last' ? e.distToBase > target.distToBase :
        this.targetMode === 'strong' ? e.maxHp > target.maxHp : e.hp < target.hp
      if (better) target = e
    }
    // No target: don't bank negative cooldown into a burst when one appears later.
    if (!target) { this.cooldown = 0; return null }
    // Carry the remainder so the long-run rate is exactly fireRate regardless of dt size.
    this.cooldown += 1 / (s.fireRate * (this.buffT > 0 ? this.buffMul : 1))
    return {
      from: this.pos, target, damage: s.damage * k * this.damageMul, slow: s.slow,
      splashRadius: s.splashRadius, chainCount: s.chainCount, chainRange: s.chainRange, pierce: s.pierce,
      burnDps: s.burnDps, burnDur: s.burnDur, shredArmor: s.shredArmor, shredDur: s.shredDur,
      tower: this,
    }
  }
}
