import type { Level, Trace } from '../model/level'
import { levelPaths } from '../model/level'
import type { Cell, Pt } from '../geom/types'
import { cellToPx } from '../geom/grid'
import { filletPath } from '../geom/fillet'
import type { Enemy } from './Enemy'
import { Tower } from './Tower'
import type { TowerKind } from './towerTypes'
import { TOWER_DEFS } from './towerTypes'
import { applyShot } from './combat'
import { WaveManager, mapWaves } from './WaveManager'
import { GameState } from './GameState'
import { hpScale, SPEED_SCALE } from './difficulty'
import { EventBus } from './events'
import { SpatialGrid } from './SpatialGrid'

interface Spot { cell: Cell; pos: Pt; tower: Tower | null; special: boolean; score: number }

/** A transient fire effect for one shot, drawn as a fading beam. */
export interface Fx { from: Pt; to: Pt; kind: TowerKind; ttl: number }
const FX_TTL = 0.14

export class Game {
  readonly state: GameState
  readonly towers: Tower[] = []
  speed = 1
  readonly events = new EventBus()
  private wm: WaveManager
  private spots: Spot[]
  readonly pitch: number
  private spent = new Map<Tower, number>()
  private _fx: Fx[] = []
  get fx(): Fx[] { return this._fx }
  private grid: SpatialGrid<Enemy>

  constructor(level: Level, seed = 1) {
    this.pitch = level.board.pitch
    this.grid = new SpatialGrid<Enemy>(this.pitch)
    const paths = levelPaths(level).map((t: Trace) => filletPath(t.waypoints, t.cornerRadius, this.pitch))
    const diff = level.meta.difficulty
    const waves = mapWaves(diff)
    this.state = new GameState(diff, waves.length)
    this.wm = new WaveManager(paths, waves, hpScale(diff) * (level.meta.tune?.hpMul ?? 1), this.pitch * SPEED_SCALE, seed)
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
    if (t.level >= t.maxLevel) return false
    const cost = TOWER_DEFS[t.kind][t.level + 1].cost
    if (!this.state.spend(cost)) return false
    t.upgrade(); this.spent.set(t, (this.spent.get(t) ?? 0) + cost)
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

  tick(dt: number): void {
    const step = dt * this.speed
    this._fx = this._fx.filter((f) => (f.ttl -= step) > 0)

    if (this.state.phase !== 'wave') return
    const spawned = this.wm.update(step)
    for (const e of spawned) this.events.emit({ type: 'enemySpawned', kind: e.kind, pos: { x: e.pos.x, y: e.pos.y } })
    const active = this.wm.active
    for (const e of active) e.update(step)
    this.grid.rebuild(active)

    // healer healing logic
    for (const healer of active) {
      if (healer.kind === 'healer' && healer.alive) {
        const healRadius = 2.5 * this.pitch
        const near = this.grid.queryCircle(healer.pos, healRadius)
        for (const target of near) {
          if (target === healer || !target.alive) continue
          target.hp = Math.min(target.maxHp, target.hp + (15 + target.maxHp * 0.03) * step)
        }
      }
    }

    // leaks
    for (const e of [...active]) {
      if (e.reachedBase) {
        this.state.damageBase(e.leak)
        this.wm.remove(e)
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
        for (const e of active) if (e.alive && Math.hypot(e.pos.x - t.pos.x, e.pos.y - t.pos.y) <= shot.aura.range) e.applySlow(shot.aura.slow, 0.25)
      } else {
        if (shot.target) {
          this._fx.push({ from: t.pos, to: { x: shot.target.pos.x, y: shot.target.pos.y }, kind: t.kind, ttl: FX_TTL })
          this.events.emit({ type: 'shotFired', kind: t.kind, from: t.pos, to: { x: shot.target.pos.x, y: shot.target.pos.y }, towerLevel: t.level })
        }
        applyShot(shot, active, this.pitch, (e) => this.events.emit(e), this.grid)
      }
    }

    // deaths → bounty
    for (const e of [...this.wm.active]) {
      if (e.hp <= 0) {
        this.state.add(e.bounty)
        this.wm.remove(e)
        this.events.emit({ type: 'enemyDied', kind: e.kind, pos: { x: e.pos.x, y: e.pos.y }, bounty: e.bounty })
      }
    }

    if (this.wm.cleared()) {
      const index = this.state.wave
      this.state.endWave()
      this.events.emit({ type: 'waveEnd', index })
    }
  }
}
