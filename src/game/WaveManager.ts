import type { Pt } from '../geom/types'
import type { EnemyKind } from './enemyTypes'
import { ENEMY_DEFS } from './enemyTypes'
import { Enemy } from './Enemy'
import { makeRng } from '../pipeline/rng'

export interface WaveEntry { kind: EnemyKind; count: number; interval: number }
interface Pending { kind: EnemyKind; interval: number; remaining: number; timer: number }

export function mapWaves(difficulty: number): WaveEntry[][] {
  const b = Math.floor(difficulty * 1.5)
  const m2 = Math.floor(difficulty / 2)
  const m3 = Math.floor(difficulty / 3)
  const w: WaveEntry[][] = []

  // Wave 1: Warmup - only normal
  w.push([
    { kind: 'normal', count: 4 + b, interval: 1.2 }
  ])

  // Wave 2: Speed check - normal + fast
  w.push([
    { kind: 'normal', count: 3 + b, interval: 1.0 },
    { kind: 'fast', count: 4 + m2, interval: 0.6 }
  ])

  // Wave 3: Armor check - Tanks (slow but armored) + normals
  w.push([
    { kind: 'normal', count: 4 + b, interval: 1.0 },
    { kind: 'tank', count: 1 + Math.floor(difficulty / 4), interval: 3.0 }
  ])

  // Wave 4: Healing check - Healer + fast
  w.push([
    { kind: 'healer', count: 1, interval: 4.0 },
    { kind: 'fast', count: 6 + m2, interval: 0.5 }
  ])

  // Wave 5: Swarm check - fast + rogue (speed fluctuation)
  w.push([
    { kind: 'fast', count: 4 + m2, interval: 0.6 },
    { kind: 'rogue', count: 3 + m3, interval: 0.4 }
  ])

  // Wave 6: Raw power check - Brutes (high HP, no armor) + normals
  w.push([
    { kind: 'normal', count: 6 + b, interval: 0.8 },
    { kind: 'brute', count: 1 + m2, interval: 2.0 }
  ])

  // Wave 7: Synergy check - Tanks + Healers + normals (Tough)
  w.push([
    { kind: 'normal', count: 6 + b, interval: 0.8 },
    { kind: 'tank', count: 2 + m2, interval: 2.0 },
    { kind: 'healer', count: 1 + Math.floor(difficulty / 6), interval: 3.0 }
  ])

  // Wave 8: Chaotic rush - Rogues + Fast + Healer
  w.push([
    { kind: 'rogue', count: 5 + m3, interval: 0.4 },
    { kind: 'fast', count: 8 + m2, interval: 0.5 },
    { kind: 'healer', count: 1, interval: 4.0 }
  ])

  // Wave 9: Penultimate test - Tanks + Brutes + Healers + Rogues
  w.push([
    { kind: 'tank', count: 2 + m2, interval: 1.8 },
    { kind: 'brute', count: 2 + Math.floor(difficulty / 4), interval: 2.2 },
    { kind: 'healer', count: 2, interval: 2.5 },
    { kind: 'rogue', count: 4 + m3, interval: 0.4 }
  ])

  // Wave 10: Boss wave - Boss + supporting tanks/healers/fast
  w.push([
    { kind: 'boss', count: difficulty >= 6 ? 3 : difficulty >= 3 ? 2 : 1, interval: 5.0 },
    { kind: 'tank', count: 2 + m2, interval: 2.5 },
    { kind: 'healer', count: 1 + Math.floor(difficulty / 5), interval: 3.0 },
    { kind: 'fast', count: 5 + m2, interval: 0.8 }
  ])

  return w
}

export class WaveManager {
  private _active: Enemy[] = []
  private queue: Pending[] = []
  private rng: () => number
  constructor(
    private paths: Pt[][],
    private waves: WaveEntry[][],
    private hpScale: number,
    private speedScale: number,
    seed: number,
  ) { this.rng = makeRng(seed) }

  get active(): Enemy[] { return this._active }
  get spawning(): boolean { return this.queue.length > 0 }
  get waveCount(): number { return this.waves.length }
  peek(i: number): WaveEntry[] { return this.waves[i] ?? [] }

  startWave(i: number): void {
    const w = this.waves[i] ?? []
    this.queue = w.map((g) => ({ kind: g.kind, interval: g.interval, remaining: g.count, timer: 0 }))
  }
  update(dt: number): Enemy[] {
    const spawned: Enemy[] = []
    for (const g of this.queue) {
      g.timer -= dt
      while (g.remaining > 0 && g.timer <= 0) {
        const def = ENEMY_DEFS[g.kind]
        const path = this.paths[Math.floor(this.rng() * this.paths.length)] ?? this.paths[0]
        const e = new Enemy(def, path, this.hpScale, def.speed * this.speedScale)
        this._active.push(e); spawned.push(e)
        g.remaining -= 1; g.timer += g.interval
      }
    }
    this.queue = this.queue.filter((g) => g.remaining > 0)
    return spawned
  }
  remove(e: Enemy): void { this._active = this._active.filter((x) => x !== e) }
  cleared(): boolean { return !this.spawning && this._active.length === 0 }
}
