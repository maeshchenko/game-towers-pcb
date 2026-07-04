import type { Pt } from '../geom/types'
import type { EnemyDef, EnemyKind, EnemyAbilities } from './enemyTypes'
import type { Tower } from './Tower'
import { PathFollower2D } from './PathFollower2D'
import { effectiveDamage } from './difficulty'

/** Boss phase 3 dash rhythm: 1.5 s glitch-dash at the start of every 6 s window. Deterministic
 * from accumulated update time, so headless simulate() reproduces it exactly. */
const DASH_WINDOW = 6
const DASH_LEN = 1.5
const DASH_SPEED = 2.4

export class Enemy {
  hp: number
  readonly maxHp: number
  readonly bounty: number
  readonly armor: number
  readonly leak: number
  readonly kind: EnemyKind
  readonly abilities: EnemyAbilities
  /** Remaining shield charges: each absorbs one full hit (see EnemyAbilities.shield). */
  shieldHits = 0
  /** Path polyline (px) — kept so death-splits can drop fragments onto the same path. */
  readonly pathPoints: Pt[]
  private follower: PathFollower2D
  private slowFactor = 1
  private slowTimer = 0
  private erraticTimer = 0
  private clock = 0
  /** 1 → 2 (≤66% hp, enraged) → 3 (≤33% hp, glitch dashes). Always 1 without bossPhases. */
  private currentPhase = 1
  /** Set by update() on a phase transition; Game consumes it and emits a bossPhase event. */
  phaseChanged = false
  /** px/sec, updated each update(dt>0) from position delta — used for missile lead-aim. */
  readonly vel: Pt = { x: 0, y: 0 }
  /** Last tower whose hit connected — the kill is credited to it (per-tower stats). */
  lastHitBy: Tower | null = null
  /** Active status effects (tier-4 weapons). Reapplication refreshes, never stacks. */
  private burnDps = 0
  private burnT = 0
  private shredAmount = 0
  private shredT = 0
  get isBurning(): boolean { return this.burnT > 0 }
  get armorShred(): number { return this.shredT > 0 ? this.shredAmount : 0 }

  constructor(def: EnemyDef, points: Pt[], hpScale: number, speedPx: number) {
    this.hp = Math.round(def.hp * hpScale)
    this.maxHp = this.hp
    this.bounty = def.bounty
    this.armor = def.armor
    this.leak = def.leak
    this.kind = def.kind
    this.abilities = def.abilities ?? {}
    this.shieldHits = this.abilities.shield?.hits ?? 0
    this.pathPoints = points
    this.follower = new PathFollower2D(points, speedPx)
  }

  get pos(): Pt { return this.follower.pos }
  get alive(): boolean { return this.hp > 0 && !this.follower.done }
  get reachedBase(): boolean { return this.follower.done && this.hp > 0 }
  get traveled(): number { return this.follower.traveled }
  /** Px left to the base — the honest "who gets there first" metric on multi-path maps. */
  get distToBase(): number { return this.follower.remaining }
  get phase(): number { return this.currentPhase }
  get isSlowed(): boolean { return this.slowFactor < 1 }

  /** Place this enemy a raw distance along its path (fragments start where the carrier died). */
  placeAt(traveledPx: number): void { this.follower.advanceDistance(traveledPx) }

  update(dt: number): void {
    if (this.hp <= 0) return
    this.clock += dt
    if (this.slowTimer > 0) {
      this.slowTimer -= dt
      if (this.slowTimer <= 0) this.slowFactor = 1
    }
    // Burn ticks straight through armor and shields (it's already inside). The tick is
    // clamped to the remaining burn time so a big dt can't over-burn past expiry.
    if (this.burnT > 0) {
      const burnTick = Math.min(dt, this.burnT)
      this.burnT -= dt
      this.hp = Math.max(0, this.hp - this.burnDps * burnTick)
      if (this.hp <= 0) return // died to the fire — skip movement this step
    }
    if (this.shredT > 0) this.shredT -= dt

    let speedFactor = this.slowFactor
    const err = this.abilities.erratic
    if (err) {
      if (this.slowFactor < 1) {
        // Slow aura stabilizes the erratic speed to a constant slow speed
        speedFactor = this.slowFactor
      } else {
        this.erraticTimer += dt
        const phase = Math.floor(this.erraticTimer / err.period) % 2
        speedFactor = phase === 0 ? err.lo : err.hi
      }
    }

    if (this.abilities.bossPhases) {
      const frac = this.hp / this.maxHp
      const next = frac <= 1 / 3 ? 3 : frac <= 2 / 3 ? 2 : 1
      if (next !== this.currentPhase) { this.currentPhase = next; this.phaseChanged = true }
      if (this.currentPhase === 2) speedFactor *= 1.35
      else if (this.currentPhase === 3) {
        // Glitch dash: violent burst, then a crawl — readable rhythm the player can exploit.
        const t = this.clock % DASH_WINDOW
        speedFactor *= t < DASH_LEN ? DASH_SPEED : 0.85
      }
    }

    const prev = { x: this.pos.x, y: this.pos.y }
    this.follower.advance(dt * speedFactor)
    if (dt > 0) {
      this.vel.x = (this.pos.x - prev.x) / dt
      this.vel.y = (this.pos.y - prev.y) / dt
    }
  }

  /** Returns the hp actually removed (0 when a shield charge ate the hit) — callers use it
   * to credit per-tower damage stats honestly. */
  takeDamage(n: number, pierce = 0): number {
    // A charged shield eats the whole hit, whatever its size — burst weapons overkill it,
    // rapid-fire strips it. Chain/splash hits consume charges too.
    if (this.shieldHits > 0) { this.shieldHits -= 1; return 0 }
    const armor = Math.max(0, this.armor - this.armorShred)
    const dealt = Math.min(this.hp, effectiveDamage(n, armor, pierce))
    this.hp -= dealt
    return dealt
  }

  /** Ignite: hp/sec for dur seconds. Refresh-not-stack keeps the DoT predictable. */
  applyBurn(dps: number, dur: number): void {
    this.burnDps = Math.max(this.burnDps * (this.burnT > 0 ? 1 : 0), dps)
    this.burnT = Math.max(this.burnT, dur)
  }

  /** Armor shred: −amount armor for dur seconds (floored at 0 in takeDamage). */
  applyShred(amount: number, dur: number): void {
    this.shredAmount = Math.max(this.shredT > 0 ? this.shredAmount : 0, amount)
    this.shredT = Math.max(this.shredT, dur)
  }

  applySlow(factor: number, dur: number): void {
    if (this.abilities.slowImmune) return
    this.slowFactor = Math.min(this.slowFactor, factor)
    this.slowTimer = Math.max(this.slowTimer, dur)
  }
}
