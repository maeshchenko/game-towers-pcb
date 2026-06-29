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

interface Spot { cell: Cell; pos: Pt; tower: Tower | null }

/** A transient fire effect for one shot, drawn as a fading beam. */
export interface Fx { from: Pt; to: Pt; kind: TowerKind; ttl: number }
const FX_TTL = 0.14

export class Game {
  readonly state: GameState
  readonly towers: Tower[] = []
  speed = 1
  private wm: WaveManager
  private spots: Spot[]
  readonly pitch: number
  private spent = new Map<Tower, number>()
  private _fx: Fx[] = []
  get fx(): Fx[] { return this._fx }

  constructor(level: Level, seed = 1) {
    this.pitch = level.board.pitch
    const paths = levelPaths(level).map((t: Trace) => filletPath(t.waypoints, t.cornerRadius, this.pitch))
    const diff = level.meta.difficulty
    const waves = mapWaves(diff)
    this.state = new GameState(diff, waves.length)
    this.wm = new WaveManager(paths, waves, hpScale(diff), this.pitch * SPEED_SCALE, seed)
    this.spots = [...level.spots, ...level.specialSpots].map((s) => ({ cell: s.cell, pos: cellToPx(s.cell, this.pitch), tower: null }))
  }

  enemies(): Enemy[] { return this.wm.active }
  spotCells(): Cell[] { return this.spots.map((s) => s.cell) }
  canBuild(i: number): boolean { return (this.state.phase === 'build' || this.state.phase === 'wave') && !!this.spots[i] && !this.spots[i].tower }

  build(kind: TowerKind, i: number): boolean {
    if (!this.canBuild(i)) return false
    const cost = TOWER_DEFS[kind][0].cost
    if (!this.state.spend(cost)) return false
    const t = new Tower(kind, this.spots[i].pos, this.pitch)
    this.spots[i].tower = t
    this.towers.push(t)
    this.spent.set(t, cost)
    return true
  }
  upgrade(t: Tower): boolean {
    if (t.level >= t.maxLevel) return false
    const cost = TOWER_DEFS[t.kind][t.level + 1].cost
    if (!this.state.spend(cost)) return false
    t.upgrade(); this.spent.set(t, (this.spent.get(t) ?? 0) + cost)
    return true
  }
  sellValue(t: Tower): number { return Math.floor((this.spent.get(t) ?? 0) * 0.6) }
  sell(t: Tower): void {
    this.state.add(this.sellValue(t))
    this.spent.delete(t)
    const idx = this.towers.indexOf(t); if (idx >= 0) this.towers.splice(idx, 1)
    const spot = this.spots.find((s) => s.tower === t); if (spot) spot.tower = null
  }

  startWave(): void {
    if (this.state.phase !== 'build') return
    this.wm.startWave(this.state.wave)
    this.state.startWave()
  }

  tick(dt: number): void {
    if (this.state.phase !== 'wave') return
    const step = dt * this.speed
    this.wm.update(step)
    const active = this.wm.active
    for (const e of active) e.update(step)

    // leaks
    for (const e of [...active]) {
      if (e.reachedBase) { this.state.damageBase(e.leak); this.wm.remove(e) }
    }
    if (this.state.phase !== 'wave') return

    // towers fire
    for (const t of this.towers) {
      const shot = t.update(step, active)
      if (!shot) continue
      if (shot.aura) {
        for (const e of active) if (e.alive && Math.hypot(e.pos.x - t.pos.x, e.pos.y - t.pos.y) <= shot.aura.range) e.applySlow(shot.aura.slow, 0.25)
      } else {
        if (shot.target) this._fx.push({ from: t.pos, to: { x: shot.target.pos.x, y: shot.target.pos.y }, kind: t.kind, ttl: FX_TTL })
        applyShot(shot, active, this.pitch)
      }
    }

    // deaths → bounty
    for (const e of [...this.wm.active]) {
      if (e.hp <= 0) { this.state.add(e.bounty); this.wm.remove(e) }
    }

    // decay fire effects
    this._fx = this._fx.filter((f) => (f.ttl -= step) > 0)

    if (this.wm.cleared()) this.state.endWave()
  }
}
