import type { Level, Trace } from '../model/level'
import { levelPaths } from '../model/level'
import type { Cell, Pt } from '../geom/types'
import { cellToPx } from '../geom/grid'
import { filletPath } from '../geom/fillet'
import type { Enemy } from './Enemy'
import { Tower } from './Tower'
import type { TowerKind } from './towerTypes'
import { TOWER_DEFS, TOWER_BRANCHES } from './towerTypes'
import { applyShot } from './combat'
import { Projectile } from './Projectile'
import { WaveManager, mapWaves, type WaveEntry } from './WaveManager'
import { ENEMY_DEFS } from './enemyTypes'
import { GameState } from './GameState'
import { hpScale, SPEED_SCALE } from './difficulty'
import { EventBus } from './events'
import { SpatialGrid } from './SpatialGrid'

interface Spot { cell: Cell; pos: Pt; tower: Tower | null; special: boolean; score: number }

/** Mid-level save data — captured at build-phase boundaries only. */
export interface RunSnapshot {
  wave: number
  lives: number
  gold: number
  towers: { kind: TowerKind; spot: number; level: number; branch: 0 | 1 | null; targetMode: import('./Tower').TargetMode; spent: number }[]
}

/** A pulse bullet whose target died retargets the nearest live enemy within this many cells. */
const RETARGET_RADIUS_CELLS = 1.5

export class Game {
  readonly state: GameState
  readonly towers: Tower[] = []
  /** Run statistics for the victory/defeat debrief. */
  readonly runStats = { kills: 0, leaks: 0, goldEarned: 0 }
  speed = 1
  readonly events = new EventBus()
  private wm: WaveManager
  private spots: Spot[]
  readonly pitch: number
  private spent = new Map<Tower, number>()
  private _projectiles: Projectile[] = []
  get projectiles(): Projectile[] { return this._projectiles }
  private grid: SpatialGrid<Enemy>
  private _paths: Pt[][]
  /** World-space (px) filleted polylines — same recipe WaveManager uses, exposed for view-layer juice (Task 10 TracePulse). */
  get paths(): Pt[][] { return this._paths }

  constructor(level: Level, seed = 1, opts?: { hpMul?: number; endless?: boolean }) {
    this.pitch = level.board.pitch
    this.grid = new SpatialGrid<Enemy>(this.pitch)
    const paths = levelPaths(level).map((t: Trace) => filletPath(t.waypoints, t.cornerRadius, this.pitch))
    this._paths = paths
    const diff = level.meta.difficulty
    // Hand-authored wave script wins over the shared difficulty template. Kinds are validated
    // here because meta.waves is structurally typed (model must not depend on game).
    const script: WaveEntry[][] = level.meta.waves
      ? level.meta.waves.map((entries) => entries.map((e) => {
          if (!(e.kind in ENEMY_DEFS)) throw new Error(`level "${level.meta.name}": unknown enemy kind "${e.kind}" in meta.waves`)
          for (const mk of Object.keys(e.mix ?? {})) {
            if (!(mk in ENEMY_DEFS)) throw new Error(`level "${level.meta.name}": unknown mix kind "${mk}" in meta.waves`)
          }
          return { ...e, kind: e.kind as WaveEntry['kind'] }
        }))
      : mapWaves(diff)
    // countMul: multi-spawn maps split the defense across entrances, so the same wave size is
    // effectively N× harder there — such levels scale wave COUNTS down instead of gutting HP.
    const countMul = level.meta.tune?.countMul ?? 1
    const waves = script.map((entries) =>
      entries.map((e) => ({ ...e, count: Math.max(1, Math.round(e.count * countMul)) })),
    )
    this.state = new GameState(diff, waves.length)
    this.state.endless = opts?.endless ?? false
    this.wm = new WaveManager(paths, waves, hpScale(diff) * (level.meta.tune?.hpMul ?? 1) * (opts?.hpMul ?? 1), this.pitch * SPEED_SCALE, seed, diff)
    this.spots = [
      ...level.spots.map((s) => ({ cell: s.cell, pos: cellToPx(s.cell, this.pitch), tower: null, special: false, score: s.score ?? 0 })),
      ...level.specialSpots.map((s) => ({ cell: s.cell, pos: cellToPx(s.cell, this.pitch), tower: null, special: true, score: s.score ?? 0 })),
    ]
  }

  enemies(): Enemy[] { return this.wm.active }
  spotCells(): Cell[] { return this.spots.map((s) => s.cell) }
  /** spot indices ordered by strategic value (coverage) desc — a competent player's build priority */
  buildOrder(): number[] { return this.spots.map((_, i) => i).sort((a, b) => this.spots[b].score - this.spots[a].score) }
  canBuild(i: number): boolean { return (this.state.phase === 'build' || this.state.phase === 'wave') && !!this.spots[i] && !this.spots[i].tower }
  isSpecial(i: number): boolean { return !!this.spots[i]?.special }

  build(kind: TowerKind, i: number): boolean {
    if (!this.canBuild(i)) return false
    const cost = TOWER_DEFS[kind][0].cost
    if (!this.state.spend(cost)) return false
    const t = new Tower(kind, this.spots[i].pos, this.pitch)
    t.special = this.spots[i].special
    this.spots[i].tower = t
    this.towers.push(t)
    this.spent.set(t, cost)
    this.events.emit({ type: 'towerBuilt', kind, pos: t.pos })
    return true
  }
  upgrade(t: Tower): boolean {
    if (t.canBranch || t.level >= t.maxLevel) return false // tier-4 goes through upgradeBranch
    const cost = TOWER_DEFS[t.kind][t.level + 1].cost
    if (!this.state.spend(cost)) return false
    t.upgrade(); this.spent.set(t, (this.spent.get(t) ?? 0) + cost)
    this.events.emit({ type: 'towerUpgraded', kind: t.kind, pos: t.pos, level: t.level })
    return true
  }
  /** Tier-4 specialization: pick one of the two role-changing branches at max linear level. */
  upgradeBranch(t: Tower, b: 0 | 1): boolean {
    if (!t.canBranch) return false
    const cost = TOWER_BRANCHES[t.kind][b].cost
    if (!this.state.spend(cost)) return false
    t.chooseBranch(b); this.spent.set(t, (this.spent.get(t) ?? 0) + cost)
    this.events.emit({ type: 'towerUpgraded', kind: t.kind, pos: t.pos, level: t.level })
    return true
  }
  sellValue(t: Tower): number { return Math.floor((this.spent.get(t) ?? 0) * 0.6) }
  sell(t: Tower): void {
    this.state.add(this.sellValue(t))
    this.spent.delete(t)
    const idx = this.towers.indexOf(t); if (idx >= 0) this.towers.splice(idx, 1)
    const spot = this.spots.find((s) => s.tower === t); if (spot) spot.tower = null
    this.events.emit({ type: 'towerSold', kind: t.kind, pos: t.pos })
  }

  /** Next wave may be CALLED early while the current one still has live enemies — as soon as
   * the spawner is done (all forms have left the entry). Classic KR-style overlap. */
  canCallNextWave(): boolean {
    const hasNext = this.state.endless || this.state.wave + 1 < this.state.waveCount
    return this.state.phase === 'wave' && !this.wm.spawning && hasNext
  }

  /** Active ability: capacitor discharge — click-targeted AoE burst with a short stun-grade
   * slow. The player's "fire brigade" button for breaches; long cooldown keeps it a save,
   * not a strategy substitute. */
  static readonly DISCHARGE = { radiusCells: 3.5, damage: 90, slow: 0.15, slowDur: 2.0, cooldown: 45 }
  private dischargeCd = 0
  /** Seconds until the discharge is ready again (0 = ready). */
  get dischargeCooldown(): number { return this.dischargeCd }

  useDischarge(at: Pt): boolean {
    if (this.dischargeCd > 0 || this.state.phase !== 'wave') return false
    const r = Game.DISCHARGE.radiusCells * this.pitch
    for (const e of this.grid.queryCircle(at, r)) {
      if (!e.alive) continue
      e.takeDamage(Game.DISCHARGE.damage, 999)
      e.applySlow(Game.DISCHARGE.slow, Game.DISCHARGE.slowDur)
      this.events.emit({ type: 'enemyDamaged', kind: e.kind, amount: Game.DISCHARGE.damage, pos: { x: e.pos.x, y: e.pos.y }, enemy: e, from: at })
    }
    this.dischargeCd = Game.DISCHARGE.cooldown
    this.events.emit({ type: 'abilityUsed', ability: 'discharge', pos: { x: at.x, y: at.y }, radius: r })
    return true
  }

  /** Energy bonus for summoning the next wave onto the tail of the current one. Lives in the
   * sim (not the UI) so headless balance runs see the same economy an aggressive player does. */
  earlyCallBonus(): number { return 5 * (6 + this.state.waveNumber) }

  callNextWave(): boolean {
    if (!this.canCallNextWave()) return false
    const bonus = this.earlyCallBonus()         // priced off the CURRENT wave number, pre-advance
    this.state.advanceWaveEarly()               // banks the running wave's clear reward + advances counter
    this.state.add(bonus)
    const index = this.state.wave
    this.wm.startWave(index)                    // spawner queue is empty (guarded) → safe to load next wave
    this.events.emit({ type: 'waveStart', index })
    return true
  }

  startWave(): void {
    if (this.state.phase !== 'build') return
    const index = this.state.wave
    this.wm.startWave(this.state.wave)
    this.state.startWave()
    this.events.emit({ type: 'waveStart', index })
  }

  peekWave(waveIndex: number): import('./WaveManager').WaveEntry[] {
    return this.wm.peek(waveIndex)
  }

  /** Largest sim step towers/enemies ever see. Big frames (low FPS × speed multiplier) are
   * split into equal substeps so fast-forward never starves tower DPS: a tower fires at most
   * once per update() call, so one 0.5 s step would lose every shot past the first. */
  private static readonly MAX_STEP = 1 / 30

  /** Build-phase snapshot for mid-level saves: compact and deterministic to restore (towers
   * are re-placed through the normal build/upgrade path). Null during a wave — enemies and
   * projectiles are deliberately never serialized. */
  snapshot(): RunSnapshot | null {
    if (this.state.phase !== 'build') return null
    const towers = this.towers.map((t) => ({
      kind: t.kind,
      spot: this.spots.findIndex((s) => s.tower === t),
      level: Math.min(t.level, 2),
      branch: t.branch,
      targetMode: t.targetMode,
      spent: this.spent.get(t) ?? 0,
    })).filter((t) => t.spot >= 0)
    return { wave: this.state.wave, lives: this.state.lives, gold: this.state.gold, towers }
  }

  /** Rebuild a build-phase state from a snapshot. Costs are bypassed (the snapshot's gold is
   * already post-purchase); sell values stay honest via the recorded per-tower spend. */
  restore(snap: RunSnapshot): boolean {
    if (this.state.phase !== 'build' || this.towers.length > 0) return false
    for (const ts of snap.towers) {
      if (!this.spots[ts.spot] || this.spots[ts.spot].tower) return false
      const t = new Tower(ts.kind, this.spots[ts.spot].pos, this.pitch)
      t.special = this.spots[ts.spot].special
      for (let l = 0; l < ts.level; l++) t.upgrade()
      if (ts.branch !== null) t.chooseBranch(ts.branch)
      t.targetMode = ts.targetMode
      this.spots[ts.spot].tower = t
      this.towers.push(t)
      this.spent.set(t, ts.spent)
    }
    this.state.wave = snap.wave
    this.state.lives = snap.lives
    this.state.gold = snap.gold
    return true
  }

  tick(dt: number): void {
    const total = dt * this.speed
    // Ability recharge runs through build phases too — being between waves shouldn't stall it.
    if (this.dischargeCd > 0) this.dischargeCd = Math.max(0, this.dischargeCd - total)
    if (this.state.phase !== 'wave') return
    const n = Math.max(1, Math.ceil(total / Game.MAX_STEP))

    const sub = total / n
    for (let i = 0; i < n && this.state.phase === 'wave'; i++) this.step(sub)
  }

  private step(step: number): void {
    const spawned = this.wm.update(step)
    for (const e of spawned) this.events.emit({ type: 'enemySpawned', kind: e.kind, pos: { x: e.pos.x, y: e.pos.y } })
    const active = this.wm.active
    for (const e of active) e.update(step)
    this.grid.rebuild(active)

    // Data-driven abilities: healing (any enemy with abilities.heal) + boss phase transitions.
    for (const healer of active) {
      const heal = healer.abilities.heal
      if (!heal || !healer.alive) continue
      const near = this.grid.queryCircle(healer.pos, heal.radius * this.pitch)
      for (const target of near) {
        if (target === healer || !target.alive || target.hp >= target.maxHp) continue
        const amount = Math.min(target.maxHp - target.hp, (heal.flat + target.maxHp * heal.pct) * step)
        target.hp += amount
        // View layers throttle this themselves (fires every sim substep while healing).
        this.events.emit({ type: 'enemyHealed', kind: target.kind, amount, pos: { x: target.pos.x, y: target.pos.y }, enemy: target })
      }
    }
    for (const e of active) {
      if (e.phaseChanged) {
        e.phaseChanged = false
        this.events.emit({ type: 'bossPhase', phase: e.phase, pos: { x: e.pos.x, y: e.pos.y }, enemy: e })
      }
    }

    // leaks
    for (const e of [...active]) {
      if (e.reachedBase) {
        this.state.damageBase(e.leak)
        this.wm.remove(e)
        this.runStats.leaks += 1
        this.events.emit({ type: 'leak', kind: e.kind, livesLost: e.leak })
        this.events.emit({ type: 'baseHit', livesLost: e.leak })
      }
    }
    if (this.state.phase !== 'wave') return

    // towers fire
    for (const t of this.towers) {
      const shot = t.update(step, active, this.grid)
      if (!shot) continue
      if (shot.aura) {
        for (const e of this.grid.queryCircle(t.pos, shot.aura.range)) if (e.alive) e.applySlow(shot.aura.slow, 0.25)
        continue
      }
      const target = shot.target
      if (!target) continue
      this.events.emit({ type: 'shotFired', kind: t.kind, from: t.pos, to: { x: target.pos.x, y: target.pos.y }, towerLevel: t.level })
      const spd = t.stats.projectileSpeed
      if (spd) {
        // projectile weapons (cannon PULSE, mortar MISSILE): damage lands on arrival, not now.
        const speedPx = spd * this.pitch
        if (t.kind === 'mortar') {
          // lead the target: aim where it will be when the shell lands
          const eta = Math.hypot(target.pos.x - t.pos.x, target.pos.y - t.pos.y) / speedPx
          const aim = { x: target.pos.x + target.vel.x * eta, y: target.pos.y + target.vel.y * eta }
          this._projectiles.push(new Projectile(t.kind, t.pos, null, shot, speedPx, aim))
        } else {
          this._projectiles.push(new Projectile(t.kind, t.pos, target, shot, speedPx))
        }
      } else {
        // instant weapons (sniper beam, tesla arc) — resolve now; shotFired event above drives the beam view (BeamFx)
        applyShot(shot, active, this.pitch, (e) => this.events.emit(e), this.grid)
      }
    }

    // projectiles in flight: advance, resolve impact damage on arrival (before bounty so
    // projectile kills grant bounty the same tick)
    const survivors: Projectile[] = []
    for (const p of this._projectiles) {
      if (!p.update(step)) { survivors.push(p); continue }
      if (p.kind === 'mortar') {
        // full splash damage to all alive enemies within splashRadius of the impact point
        const r = (p.shot.splashRadius ?? 0) * this.pitch
        const hit = this.grid.queryCircle(p.pos, r)
        for (const e of hit) {
          if (!e.alive) continue
          e.takeDamage(p.shot.damage ?? 0, p.shot.pierce ?? 0)
          this.events.emit({ type: 'enemyDamaged', kind: e.kind, amount: p.shot.damage ?? 0, pos: { x: e.pos.x, y: e.pos.y }, enemy: e, from: { x: p.pos.x, y: p.pos.y } })
        }
      } else {
        // pulse bullet: hit its target, or retarget the nearest live enemy within 1.5 cells, else fizzle
        let victim = p.target && p.target.alive ? p.target : null
        if (!victim) {
          const near = this.grid.queryCircle(p.pos, RETARGET_RADIUS_CELLS * this.pitch).filter((e) => e.alive)
          near.sort((a, b) => Math.hypot(a.pos.x - p.pos.x, a.pos.y - p.pos.y) - Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y))
          victim = near[0] ?? null
        }
        if (victim) {
          victim.takeDamage(p.shot.damage ?? 0, p.shot.pierce ?? 0)
          this.events.emit({ type: 'enemyDamaged', kind: victim.kind, amount: p.shot.damage ?? 0, pos: { x: victim.pos.x, y: victim.pos.y }, enemy: victim, from: { x: p.from.x, y: p.from.y } })
          if (p.shot.slow && p.shot.slow < 1) victim.applySlow(p.shot.slow, 1.5)
        }
      }
      this.events.emit({ type: 'projectileImpact', kind: p.kind, pos: { x: p.pos.x, y: p.pos.y }, splashRadius: p.shot.splashRadius })
    }
    this._projectiles = survivors

    // deaths → bounty (+ death-splits: carriers burst into fragments at their path position)
    for (const e of [...this.wm.active]) {
      if (e.hp <= 0) {
        this.state.add(e.bounty)
        this.wm.remove(e)
        this.runStats.kills += 1
        this.runStats.goldEarned += e.bounty
        this.events.emit({ type: 'enemyDied', kind: e.kind, pos: { x: e.pos.x, y: e.pos.y }, bounty: e.bounty, enemy: e })
        const split = e.abilities.splitInto
        if (split) {
          for (let i = 0; i < split.count; i++) {
            // Stagger fragments slightly behind the death point so they don't stack into one pixel.
            const frag = this.wm.inject(split.kind, e.pathPoints, Math.max(0, e.traveled - i * this.pitch * 0.35))
            this.events.emit({ type: 'enemySpawned', kind: frag.kind, pos: { x: frag.pos.x, y: frag.pos.y } })
          }
        }
      }
    }

    if (this.wm.cleared()) {
      const index = this.state.wave
      this.state.endWave()
      this.events.emit({ type: 'waveEnd', index })
    }
  }
}
