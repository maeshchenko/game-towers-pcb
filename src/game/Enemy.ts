import type { Pt } from '../geom/types'
import type { EnemyDef, EnemyKind } from './enemyTypes'
import { PathFollower2D } from './PathFollower2D'
import { effectiveDamage } from './difficulty'

export class Enemy {
  hp: number
  readonly maxHp: number
  readonly bounty: number
  readonly armor: number
  readonly leak: number
  readonly kind: EnemyKind
  private follower: PathFollower2D
  private slowFactor = 1
  private slowTimer = 0

  private rogueTimer = 0

  constructor(def: EnemyDef, points: Pt[], hpScale: number, speedPx: number) {
    this.hp = Math.round(def.hp * hpScale)
    this.maxHp = this.hp
    this.bounty = def.bounty
    this.armor = def.armor
    this.leak = def.leak
    this.kind = def.kind
    this.follower = new PathFollower2D(points, speedPx)
  }

  get pos(): Pt { return this.follower.pos }
  get alive(): boolean { return this.hp > 0 && !this.follower.done }
  get reachedBase(): boolean { return this.follower.done && this.hp > 0 }
  get traveled(): number { return this.follower.traveled }

  update(dt: number): void {
    if (this.hp <= 0) return
    if (this.slowTimer > 0) {
      this.slowTimer -= dt
      if (this.slowTimer <= 0) this.slowFactor = 1
    }
    
    let speedFactor = this.slowFactor
    if (this.kind === 'rogue') {
      if (this.slowFactor < 1) {
        // Slow aura stabilizes the rogue's erratic speed to a constant slow speed
        speedFactor = this.slowFactor
      } else {
        this.rogueTimer += dt
        const phase = Math.floor(this.rogueTimer / 0.6) % 2
        speedFactor = phase === 0 ? 0.3 : 2.2
      }
    }
    
    this.follower.advance(dt * speedFactor)
  }

  takeDamage(n: number, pierce = 0): void {
    this.hp = Math.max(0, this.hp - effectiveDamage(n, this.armor, pierce))
  }

  applySlow(factor: number, dur: number): void {
    if (this.kind === 'boss') return // Boss is immune to slows
    this.slowFactor = Math.min(this.slowFactor, factor)
    this.slowTimer = Math.max(this.slowTimer, dur)
  }
}
