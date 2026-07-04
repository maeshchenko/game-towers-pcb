import type { Level, Trace } from '../model/level'
import { levelPaths } from '../model/level'
import type { Cell, Pt } from '../geom/types'
import { cellToPx } from '../geom/grid'
import { filletPath } from '../geom/fillet'
import type { Enemy } from './Enemy'
import { Tower, type TargetMode } from './Tower'
import type { TowerKind } from './towerTypes'
import { TOWER_DEFS, TOWER_BRANCHES } from './towerTypes'
import { applyShot, applyStatuses } from './combat'
import { Projectile } from './Projectile'
import { WaveManager, mapWaves, type WaveEntry } from './WaveManager'
import { ENEMY_DEFS } from './enemyTypes'
import { GameState } from './GameState'
import { hpScale, startLives, SPEED_SCALE } from './difficulty'
import { NO_META, type MetaEffects } from './metaUpgrades'
import { EventBus } from './events'
import { SpatialGrid } from './SpatialGrid'

interface Spot { cell: Cell; pos: Pt; tower: Tower | null; special: boolean; score: number }

/** Mid-level save data — captured at build-phase boundaries only. */
export interface RunSnapshot {
  wave: number
  lives: number
  gold: number
  /** Seconds left on the discharge cooldown. Absent in saves written before it was added
   * (a reload used to reset the 45 s cooldown — free save-scumming). */
  dischargeCd?: number
  /** Seconds left on the overload cooldown (same save-scum guard). */
  overloadCd?: number
  /** Debrief counters. Absent in older saves — the debrief simply starts from zero. */
  stats?: { kills: number; leaks: number; goldEarned: number; earlyCalls?: number; dischargeKills?: number }
  towers: { kind: TowerKind; spot: number; level: number; branch: 0 | 1 | null; targetMode: TargetMode; spent: number }[]
}

const TARGET_MODES: readonly TargetMode[] = ['first', 'last', 'strong', 'weak']
/** Sanity ceiling for restored gold — anything above is a corrupt/hand-edited save. */
const MAX_SAVED_GOLD = 1_000_000

/** A pulse bullet whose target died retargets the nearest live enemy within this many cells. */
const RETARGET_RADIUS_CELLS = 1.5

export class Game {
  readonly state: GameState
  readonly towers: Tower[] = []
  /** Run statistics for the victory/defeat debrief (and achievement checks). */
  readonly runStats = { kills: 0, leaks: 0, goldEarned: 0, earlyCalls: 0, dischargeKills: 0 }
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

  /** Station meta-upgrades (identity when absent). Campaign/endless pass the player's tree;
   * daily deliberately does NOT — the shared board must stay a level playing field. */
  private readonly meta: MetaEffects

  /** Tower kind banned for this run (daily "embargo" modifier). */
  readonly banned: TowerKind | null

  constructor(level: Level, seed = 1, opts?: {
    hpMul?: number; endless?: boolean; meta?: MetaEffects
    /** daily modifiers */ countMul?: number; goldDelta?: number; banned?: TowerKind | null
  }) {
    this.meta = opts?.meta ?? NO_META
    this.banned = opts?.banned ?? null
    this.pitch = level.board.pitch
    this.grid = new SpatialGrid<Enemy>(this.pitch)
    const paths = levelPaths(level).map((t: Trace) => filletPath(t.waypoints, t.cornerRadius, this.pitch))
    this._paths = paths
    const diff = level.meta.difficulty
    // Hand-authored wave script wins over the shared difficulty template. Kinds are validated
    // here because meta.waves is structurally typed (model must not depend on game).
    const script: WaveEntry[][] = level.meta.waves
      ? level.meta.waves.map((entries, wi) => entries.map((e) => {
          const bad = (what: string): never => { throw new Error(`level "${level.meta.name}": ${what} in meta.waves[${wi}]`) }
          if (!(e.kind in ENEMY_DEFS)) bad(`unknown enemy kind "${e.kind}"`)
          for (const mk of Object.keys(e.mix ?? {})) {
            if (!(mk in ENEMY_DEFS)) bad(`unknown mix kind "${mk}"`)
          }
          // Value sanity — an authoring typo must fail the build, not silently become an
          // "instant wall" (interval 0 dumps the whole group into one substep; jitter ≥ 1
          // allows zero/negative gaps).
          if (!(e.count >= 1)) bad(`count ${e.count} < 1`)
          if (!(e.interval > 0)) bad(`interval ${e.interval} ≤ 0`)
          if (e.jitter !== undefined && !(e.jitter >= 0 && e.jitter < 1)) bad(`jitter ${e.jitter} outside [0, 1)`)
          if (e.delay !== undefined && !(e.delay >= 0)) bad(`negative delay ${e.delay}`)
          return { ...e, kind: e.kind as WaveEntry['kind'] }
        }))
      : mapWaves(diff)
    // countMul: multi-spawn maps split the defense across entrances, so the same wave size is
    // effectively N× harder there — such levels scale wave COUNTS down instead of gutting HP.
    const countMul = (level.meta.tune?.countMul ?? 1) * (opts?.countMul ?? 1)
    const waves = script.map((entries) =>
      entries.map((e) => ({ ...e, count: Math.max(1, Math.round(e.count * countMul)) })),
    )
    this.state = new GameState(diff, waves.length)
    this.state.endless = opts?.endless ?? false
    if (this.meta.startGold > 0) this.state.add(this.meta.startGold)
    if (this.meta.lives > 0) this.state.lives += this.meta.lives
    // Daily budget twist — floor keeps the cheapest opening (one cannon) always affordable.
    if (opts?.goldDelta) this.state.gold = Math.max(40, this.state.gold + opts.goldDelta)
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
    if (kind === this.banned) return false
    if (!this.canBuild(i)) return false
    const cost = TOWER_DEFS[kind][0].cost
    if (!this.state.spend(cost)) return false
    const t = new Tower(kind, this.spots[i].pos, this.pitch)
    t.special = this.spots[i].special
    t.damageMul = this.meta.damageMul
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
  sellValue(t: Tower): number { return Math.floor((this.spent.get(t) ?? 0) * this.meta.sellRefund) }
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
    // The grid is normally rebuilt inside step(); fired between startWave and the first
    // substep it would query the PREVIOUS wave's stale grid and hit nothing.
    this.grid.rebuild(this.wm.active)
    const r = Game.DISCHARGE.radiusCells * this.pitch
    for (const e of this.grid.queryCircle(at, r)) {
      if (!e.alive) continue
      const dealt = e.takeDamage(Game.DISCHARGE.damage, 999)
      if (dealt > 0 && e.hp <= 0) {
        // The finishing blow was the player's, not a tower's.
        this.runStats.dischargeKills += 1
        e.lastHitBy = null
      }
      e.applySlow(Game.DISCHARGE.slow, Game.DISCHARGE.slowDur)
      this.events.emit({ type: 'enemyDamaged', kind: e.kind, amount: Game.DISCHARGE.damage, pos: { x: e.pos.x, y: e.pos.y }, enemy: e, from: at })
    }
    this.dischargeCd = this.dischargeCooldownMax
    this.events.emit({ type: 'abilityUsed', ability: 'discharge', pos: { x: at.x, y: at.y }, radius: r })
    return true
  }

  /** Full cooldown for this run — the capacitor meta track shaves seconds off the base 45. */
  get dischargeCooldownMax(): number {
    return Math.max(5, Game.DISCHARGE.cooldown - this.meta.dischargeCdReduction)
  }

  /** Second active: OVERLOAD — a targeted fire-rate surge for towers in the radius.
   * Discharge is the panic button against a breach; overload is the PLANNED power play
   * (pop it as the boss enters your kill-zone). Long cooldown keeps it once-per-siege. */
  static readonly OVERLOAD = { radiusCells: 3.2, rateMul: 1.7, dur: 6, cooldown: 60 }
  private overloadCd = 0
  get overloadCooldown(): number { return this.overloadCd }

  useOverload(at: Pt): boolean {
    if (this.overloadCd > 0 || this.state.phase !== 'wave') return false
    const r = Game.OVERLOAD.radiusCells * this.pitch
    let any = false
    for (const t of this.towers) {
      if (Math.hypot(t.pos.x - at.x, t.pos.y - at.y) <= r) {
        t.applyRateBuff(Game.OVERLOAD.rateMul, Game.OVERLOAD.dur)
        any = true
      }
    }
    if (!any) return false // an empty click must not eat the 60 s cooldown
    this.overloadCd = Game.OVERLOAD.cooldown
    this.events.emit({ type: 'abilityUsed', ability: 'overload', pos: { x: at.x, y: at.y }, radius: r })
    return true
  }

  /** Per-tower stat bookkeeping for hits resolved outside combat.applyShot (projectiles). */
  private creditHit(tower: Tower | undefined, enemy: Enemy, dealt: number): void {
    if (!tower) return
    tower.damageDealt += dealt
    enemy.lastHitBy = tower
  }

  /** Energy bonus for summoning the next wave onto the tail of the current one. Lives in the
   * sim (not the UI) so headless balance runs see the same economy an aggressive player does. */
  earlyCallBonus(): number { return 5 * (6 + this.state.waveNumber) }

  callNextWave(): boolean {
    if (!this.canCallNextWave()) return false
    const bonus = this.earlyCallBonus()         // priced off the CURRENT wave number, pre-advance
    this.state.advanceWaveEarly()               // banks the running wave's clear reward + advances counter
    this.state.add(bonus)
    this.runStats.earlyCalls += 1
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
      // Linear level only — the tier-4 step is replayed via `branch` on restore.
      spot: this.spots.findIndex((s) => s.tower === t),
      level: Math.min(t.level, TOWER_DEFS[t.kind].length - 1),
      branch: t.branch,
      targetMode: t.targetMode,
      spent: this.spent.get(t) ?? 0,
    })).filter((t) => t.spot >= 0)
    return {
      wave: this.state.wave, lives: this.state.lives, gold: this.state.gold,
      dischargeCd: this.dischargeCd, overloadCd: this.overloadCd, stats: { ...this.runStats }, towers,
    }
  }

  /** True when the snapshot is internally consistent AND applicable to THIS game — checked
   * in full before any mutation so a corrupt save can never leave half a board behind. */
  private validSnapshot(snap: RunSnapshot): boolean {
    const int = (n: unknown, lo: number, hi: number): boolean =>
      typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi
    const waveMax = this.state.endless ? Number.MAX_SAFE_INTEGER : Math.max(0, this.state.waveCount - 1)
    if (!int(snap.wave, 0, waveMax) || !int(snap.lives, 1, startLives) || !int(snap.gold, 0, MAX_SAVED_GOLD)) return false
    if (snap.dischargeCd !== undefined && !(typeof snap.dischargeCd === 'number' && snap.dischargeCd >= 0)) return false
    if (!Array.isArray(snap.towers)) return false
    const seen = new Set<number>()
    for (const ts of snap.towers) {
      if (!(ts.kind in TOWER_DEFS)) return false
      if (!int(ts.spot, 0, this.spots.length - 1) || seen.has(ts.spot) || this.spots[ts.spot].tower) return false
      seen.add(ts.spot)
      if (!int(ts.level, 0, TOWER_DEFS[ts.kind].length - 1)) return false
      if (ts.branch !== null && ts.branch !== 0 && ts.branch !== 1) return false
      if (!TARGET_MODES.includes(ts.targetMode)) return false
      if (typeof ts.spent !== 'number' || !Number.isFinite(ts.spent) || ts.spent < 0) return false
    }
    return true
  }

  /** Rebuild a build-phase state from a snapshot. Costs are bypassed (the snapshot's gold is
   * already post-purchase); sell values stay honest via the recorded per-tower spend.
   * Validates everything up front — returns false with the game UNTOUCHED on corrupt data. */
  restore(snap: RunSnapshot): boolean {
    if (this.state.phase !== 'build' || this.towers.length > 0) return false
    if (!this.validSnapshot(snap)) return false
    for (const ts of snap.towers) {
      const t = new Tower(ts.kind, this.spots[ts.spot].pos, this.pitch)
      t.special = this.spots[ts.spot].special
      t.damageMul = this.meta.damageMul
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
    if (snap.dischargeCd !== undefined) this.dischargeCd = Math.min(snap.dischargeCd, Game.DISCHARGE.cooldown)
    if (snap.overloadCd !== undefined && snap.overloadCd >= 0) this.overloadCd = Math.min(snap.overloadCd, Game.OVERLOAD.cooldown)
    if (snap.stats) {
      this.runStats.kills = snap.stats.kills || 0
      this.runStats.leaks = snap.stats.leaks || 0
      this.runStats.goldEarned = snap.stats.goldEarned || 0
      this.runStats.earlyCalls = snap.stats.earlyCalls || 0
      this.runStats.dischargeKills = snap.stats.dischargeKills || 0
    }
    return true
  }

  /** Largest total sim time one tick() may consume. rAF can hand back MINUTES after a
   * background tab wakes up — without a cap that whole stretch plays out "off screen"
   * (leaks, defeat) in a single frozen frame. 1 s never throttles real frames (even 4×
   * speed at 20 fps is 0.2 s) but caps the hidden-tab catch-up at one lost second. */
  private static readonly MAX_FRAME = 1

  tick(dt: number): void {
    const total = Math.min(dt * this.speed, Game.MAX_FRAME)
    // Ability recharge runs through build phases too — being between waves shouldn't stall it.
    if (this.dischargeCd > 0) this.dischargeCd = Math.max(0, this.dischargeCd - total)
    if (this.overloadCd > 0) this.overloadCd = Math.max(0, this.overloadCd - total)
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
          this.creditHit(p.shot.tower, e, e.takeDamage(p.shot.damage ?? 0, p.shot.pierce ?? 0))
          applyStatuses(p.shot, e)
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
          this.creditHit(p.shot.tower, victim, victim.takeDamage(p.shot.damage ?? 0, p.shot.pierce ?? 0))
          applyStatuses(p.shot, victim)
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
        if (e.lastHitBy) e.lastHitBy.kills += 1 // discharge kills carry no tower — uncredited
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
