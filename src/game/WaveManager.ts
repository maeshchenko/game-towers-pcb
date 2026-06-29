import type { Pt } from '../geom/types'
import type { EnemyKind } from './enemyTypes'
import { ENEMY_DEFS } from './enemyTypes'
import { Enemy } from './Enemy'
import { makeRng } from '../pipeline/rng'

export interface WaveEntry { kind: EnemyKind; count: number; interval: number }
interface Pending { kind: EnemyKind; interval: number; remaining: number; timer: number }

export function mapWaves(difficulty: number): WaveEntry[][] {
  const b = Math.floor(difficulty * 1.5)
  const m2 = Math.floor(difficulty / 2), m3 = Math.floor(difficulty / 3)
  const w: WaveEntry[][] = []
  for (let i = 0; i < 10; i++) {
    const g: WaveEntry[] = [{ kind: 'normal', count: 4 + b + i * 2, interval: 0.8 }]
    if (i >= 1) g.push({ kind: 'fast', count: 2 + m2 + i, interval: 0.5 })
    if (i >= 2) g.push({ kind: 'rogue', count: 2 + i + m3, interval: 0.4 })
    if (i >= 4) g.push({ kind: 'brute', count: m2 + Math.floor(i / 3), interval: 1.2 })
    if (i >= 5) g.push({ kind: 'tank', count: m2 + Math.floor((i - 3) / 2), interval: 1.5 })
    if (i >= 6 && i < 9) g.push({ kind: 'healer', count: 1 + Math.floor((i - 6) / 2), interval: 2.0 })
    if (i === 9) g.push({ kind: 'boss', count: difficulty >= 6 ? 3 : difficulty >= 3 ? 2 : 1, interval: 4.0 })
    w.push(g)
  }
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
