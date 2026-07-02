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
  // Spawn intervals tighten with difficulty: higher tiers must press with DENSITY, not only
  // count — otherwise a snowballed defense clears every mid wave with zero pressure and the
  // whole level's difficulty collapses into the boss wave (measured exactly that before).
  const iv = (base: number) => Math.max(0.25, Math.round(base * (1 - difficulty * 0.045) * 100) / 100)
  const w: WaveEntry[][] = []

  // Wave 1: Warmup - only normal
  w.push([
    { kind: 'normal', count: 7 + b * 2, interval: iv(1.0) }
  ])

  // Wave 2: Speed check - normal + fast
  w.push([
    { kind: 'normal', count: 5 + b, interval: iv(0.9) },
    { kind: 'fast', count: 7 + b, interval: iv(0.5) }
  ])

  // Wave 3: Armor check - Tanks (slow but armored) + normals
  w.push([
    { kind: 'normal', count: 7 + b, interval: iv(0.8) },
    { kind: 'tank', count: 2 + Math.floor(difficulty / 3), interval: iv(2.6) },
    { kind: 'fast', count: 4 + m2, interval: iv(0.5) }
  ])

  // Wave 4: Healing check - Healer + fast
  w.push([
    { kind: 'healer', count: 1 + m3, interval: iv(3.5) },
    { kind: 'fast', count: 9 + b, interval: iv(0.45) },
    { kind: 'rogue', count: 4 + m2, interval: iv(0.4) }
  ])

  // Wave 5: Swarm check - fast + rogue (speed fluctuation)
  w.push([
    { kind: 'fast', count: 7 + b, interval: iv(0.5) },
    { kind: 'rogue', count: 7 + m2, interval: iv(0.35) },
    { kind: 'normal', count: 5 + b, interval: iv(0.8) }
  ])

  // Wave 6: Raw power check - Brutes (high HP, no armor) + normals
  w.push([
    { kind: 'normal', count: 9 + b * 2, interval: iv(0.7) },
    { kind: 'brute', count: 1 + m2, interval: iv(2.0) },
    { kind: 'fast', count: 6 + m2, interval: iv(0.5) }
  ])

  // Wave 7: Synergy check - Tanks + Healers + normals (Tough)
  w.push([
    { kind: 'normal', count: 9 + b, interval: iv(0.7) },
    { kind: 'tank', count: 3 + m2, interval: iv(1.8) },
    { kind: 'healer', count: 1 + m3, interval: iv(3.0) },
    { kind: 'rogue', count: 5 + m3, interval: iv(0.4) }
  ])

  // Wave 8: Chaotic rush - Rogues + Fast + Healer
  w.push([
    { kind: 'rogue', count: 9 + b, interval: iv(0.35) },
    { kind: 'fast', count: 12 + b, interval: iv(0.4) },
    { kind: 'healer', count: 2, interval: iv(3.5) }
  ])

  // Wave 9: Penultimate test - Tanks + Brutes + Healers + Rogues
  w.push([
    { kind: 'tank', count: 3 + m2, interval: iv(1.6) },
    { kind: 'brute', count: 2 + Math.floor(difficulty / 3), interval: iv(2.0) },
    { kind: 'healer', count: 2 + m3, interval: iv(2.4) },
    { kind: 'rogue', count: 6 + m2, interval: iv(0.35) },
    { kind: 'fast', count: 7 + m2, interval: iv(0.45) }
  ])

  // Wave 10: Boss wave - Boss + supporting tanks/healers/fast
  w.push([
    { kind: 'boss', count: difficulty >= 6 ? 3 : difficulty >= 3 ? 2 : 1, interval: iv(4.0) },
    { kind: 'tank', count: 3 + m2, interval: iv(1.8) },
    { kind: 'healer', count: 2 + Math.floor(difficulty / 5), interval: iv(2.6) },
    { kind: 'fast', count: 9 + b, interval: iv(0.5) },
    { kind: 'normal', count: 7 + b, interval: iv(0.6) }
  ])

  return w
}

export class WaveManager {
  private _active: Enemy[] = []
  private queue: Pending[] = []
  private rng: () => number
  private currentWave = 0
  /** Per-wave HP ramp: the defense snowballs (more towers + upgrades every wave), so late waves
   * must outgrow it or all pressure collapses into the boss wave (measured exactly that). */
  private waveRamp: number
  constructor(
    private paths: Pt[][],
    private waves: WaveEntry[][],
    private hpScale: number,
    private speedScale: number,
    seed: number,
    difficulty = 1,
  ) { this.rng = makeRng(seed); this.waveRamp = 0.04 + difficulty * 0.008 }

  get active(): Enemy[] { return this._active }
  get spawning(): boolean { return this.queue.length > 0 }
  get waveCount(): number { return this.waves.length }
  peek(i: number): WaveEntry[] { return this.waves[i] ?? [] }

  startWave(i: number): void {
    this.currentWave = i
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
        // Boss HP is balanced independently — the ramp applies to regular waves only.
        const ramp = g.kind === 'boss' ? 1 : 1 + this.currentWave * this.waveRamp
        const e = new Enemy(def, path, this.hpScale * ramp, def.speed * this.speedScale)
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
