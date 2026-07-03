import type { Pt } from '../geom/types'
import type { EnemyKind } from './enemyTypes'
import { ENEMY_DEFS } from './enemyTypes'
import { Enemy } from './Enemy'
import { makeRng } from '../pipeline/rng'

export interface WaveEntry {
  kind: EnemyKind
  count: number
  interval: number
  /** Spawn path for this group on multi-entrance maps (clamped to the path count).
   * Omitted → seeded-random per enemy, as before. Directed groups turn multi-spawn levels
   * into readable strategy ("wave 6 comes from the top entrance") instead of noise. */
  pathIndex?: number
  /** Seconds after the wave starts before this group begins spawning. Waves are authored in
   * PHASES (opening squad → breather → mixed push → tail) instead of every group clumping
   * at t=0 — a single splash shell must never delete a whole wave. */
  delay?: number
  /** Mixed stream: each spawn rolls a kind by weight (seeded RNG) instead of using `kind` —
   * "normal normal fast normal rogue…" interleaving. `kind` stays the DOMINANT type and is
   * what previews display. Homogeneous groups simply omit this. */
  mix?: Partial<Record<EnemyKind, number>>
}
interface Pending { kind: EnemyKind; interval: number; remaining: number; timer: number; pathIndex?: number; mix?: Partial<Record<EnemyKind, number>> }

/** Aggregate a wave's entries into displayable {kind → count} totals. Mixed groups are split
 * across their kinds proportionally to the weights (largest-remainder rounding), so previews
 * and banners show the REAL expected composition instead of just the dominant type. */
export function waveComposition(entries: WaveEntry[]): Map<EnemyKind, number> {
  const out = new Map<EnemyKind, number>()
  const add = (k: EnemyKind, n: number) => { if (n > 0) out.set(k, (out.get(k) ?? 0) + n) }
  for (const g of entries) {
    if (!g.mix) { add(g.kind, g.count); continue }
    const pairs = Object.entries(g.mix) as [EnemyKind, number][]
    const total = pairs.reduce((s, [, w]) => s + (w ?? 0), 0)
    if (total <= 0) { add(g.kind, g.count); continue }
    let assigned = 0
    const shares = pairs.map(([k, w]) => ({ k, exact: (g.count * (w ?? 0)) / total }))
    for (const s of shares) { const n = Math.floor(s.exact); add(s.k, n); assigned += n; s.exact -= n }
    shares.sort((a, b) => b.exact - a.exact)
    for (let i = 0; assigned < g.count; i++, assigned++) add(shares[i % shares.length].k, 1)
  }
  return out
}

/** Weighted seeded pick over a mix table. */
function rollKind(mix: Partial<Record<EnemyKind, number>>, rng: () => number): EnemyKind {
  let total = 0
  for (const w of Object.values(mix)) total += w ?? 0
  let roll = rng() * total
  for (const [kind, w] of Object.entries(mix) as [EnemyKind, number][]) {
    roll -= w
    if (roll <= 0) return kind
  }
  return Object.keys(mix)[0] as EnemyKind
}

export function mapWaves(difficulty: number): WaveEntry[][] {
  const b = Math.floor(difficulty * 1.5)
  const m2 = Math.floor(difficulty / 2)
  const m3 = Math.floor(difficulty / 3)
  // Spawn intervals tighten with difficulty: higher tiers must press with DENSITY, not only
  // count — otherwise a snowballed defense clears every mid wave with zero pressure and the
  // whole level's difficulty collapses into the boss wave (measured exactly that before).
  const iv = (base: number) => Math.max(0.25, Math.round(base * (1 - difficulty * 0.045) * 100) / 100)
  // Phase delays stretch slightly less on high difficulty (denser drama), never below 60%.
  const dl = (base: number) => Math.round(base * Math.max(0.6, 1 - difficulty * 0.03))
  const w: WaveEntry[][] = []

  // Every wave is authored in PHASES (delay = seconds from wave start): an opening squad, a
  // breather, a mixed middle push, and a tail. Stretched pacing means one splash shell can
  // never delete the whole wave, and mixed groups keep every counter-tool relevant.

  // Wave 1: Warmup — two small packs of normals with a breather between them.
  w.push([
    { kind: 'normal', count: 4 + b, interval: iv(1.3) },
    { kind: 'normal', count: 4 + b, interval: iv(1.0), delay: dl(12) },
  ])

  // Wave 2: Speed check — normals first, then two separated bursts of fast.
  w.push([
    { kind: 'normal', count: 4 + m2, interval: iv(1.1) },
    { kind: 'fast', count: 4 + m2, interval: iv(0.6), delay: dl(7) },
    { kind: 'fast', count: 5 + m2, interval: iv(0.5), delay: dl(18) },
    { kind: 'normal', count: 3 + m2, interval: iv(1.0), delay: dl(19) },
  ])

  // Wave 3: Armor check — a lone tank probes, then the armored push with escorts.
  w.push([
    { kind: 'tank', count: 1 + m3, interval: iv(3.0) },
    { kind: 'normal', count: 5 + b, interval: iv(1.0), delay: dl(3) },
    { kind: 'tank', count: 1 + m3, interval: iv(2.8), delay: dl(18) },
    { kind: 'fast', count: 4 + m2, interval: iv(0.55), delay: dl(20) },
  ])

  // Wave 4: Healing check — healer walks inside each pack, packs come in two pulses.
  w.push([
    { kind: 'fast', count: 5 + m2, interval: iv(0.6) },
    { kind: 'healer', count: 1, interval: iv(4.0), delay: dl(2) },
    { kind: 'rogue', count: 4 + m2, interval: iv(0.7), delay: dl(16) },
    { kind: 'healer', count: m3, interval: iv(4.0), delay: dl(18) },
    { kind: 'fast', count: 4 + m2, interval: iv(0.5), delay: dl(28) },
  ])

  // Wave 5: Swarm check — pulses bookend a long INTERLEAVED stream (fast/rogue/normal mixed).
  w.push([
    { kind: 'fast', count: 5 + m2, interval: iv(0.5) },
    { kind: 'fast', count: 9 + b, interval: iv(0.6), delay: dl(9), mix: { fast: 3, rogue: 2, normal: 2 } },
    { kind: 'fast', count: 5 + m2, interval: iv(0.45), delay: dl(27) },
  ])

  // Wave 6: Raw power check — brutes arrive one at a time with escorts between.
  // Difficulty 5+ (campaign level 6+): shielded capsules debut inside the escort stream.
  w.push([
    { kind: 'normal', count: 6 + b, interval: iv(0.9) },
    { kind: 'brute', count: 1, interval: iv(3.0), delay: dl(6) },
    ...(difficulty >= 5 ? [{ kind: 'shielded', count: 2 + m3, interval: iv(1.4), delay: dl(12) } as WaveEntry] : []),
    { kind: 'brute', count: m2, interval: iv(2.6), delay: dl(20) },
    { kind: 'fast', count: 6 + m2, interval: iv(0.55), delay: dl(22) },
    { kind: 'normal', count: 4 + b, interval: iv(0.8), delay: dl(34) },
  ])

  // Wave 7: Synergy check — armored core with a healer, then chaff, then a second core.
  // Difficulty 7+ (campaign level 8+): a lone carrier probes the exit defense.
  w.push([
    { kind: 'tank', count: 2 + m3, interval: iv(2.2) },
    { kind: 'healer', count: 1, interval: iv(4.0), delay: dl(3) },
    { kind: 'normal', count: 7 + b, interval: iv(0.85), delay: dl(15) },
    ...(difficulty >= 7 ? [{ kind: 'carrier', count: 1, interval: iv(3.0), delay: dl(24) } as WaveEntry] : []),
    { kind: 'tank', count: 1 + m2, interval: iv(2.0), delay: dl(28) },
    { kind: 'rogue', count: 5 + m3, interval: iv(0.5), delay: dl(30) },
  ])

  // Wave 8: Chaotic rush — one long ragged mixed stream with a healer hidden inside,
  // then a clean fast burst as the sting.
  w.push([
    { kind: 'rogue', count: 5 + m2, interval: iv(0.45) },
    { kind: 'rogue', count: 10 + b, interval: iv(0.5), delay: dl(8), mix: { rogue: 3, fast: 3, normal: 1 } },
    { kind: 'healer', count: 1, interval: iv(4.0), delay: dl(15) },
    { kind: 'fast', count: 6 + m2, interval: iv(0.4), delay: dl(26) },
  ])

  // Wave 9: Penultimate test — three distinct assaults; the middle one is a ragged mixed mob.
  w.push([
    { kind: 'tank', count: 2 + m2, interval: iv(1.8) },
    { kind: 'healer', count: 1 + m3, interval: iv(3.0), delay: dl(2) },
    difficulty >= 7
      ? { kind: 'rogue', count: 8 + b, interval: iv(0.7), delay: dl(15), mix: { rogue: 3, fast: 2, shielded: 2, carrier: 1 } }
      : { kind: 'rogue', count: 8 + b, interval: iv(0.7), delay: dl(15), mix: { rogue: 3, fast: 2, normal: 2, brute: 1 } },
    { kind: 'tank', count: 1 + m2, interval: iv(1.8), delay: dl(31) },
    { kind: 'fast', count: 6 + m2, interval: iv(0.5), delay: dl(33) },
  ])

  // Wave 10: Boss finale — scouts first, bosses arrive SPREAD OUT with their own escorts.
  const bosses = difficulty >= 6 ? 3 : difficulty >= 3 ? 2 : 1
  const finale: WaveEntry[] = [
    { kind: 'fast', count: 6 + m2, interval: iv(0.55) },
    { kind: 'boss', count: 1, interval: iv(4.0), delay: dl(10) },
    { kind: 'tank', count: 2 + m2, interval: iv(2.0), delay: dl(12) },
    { kind: 'normal', count: 6 + b, interval: iv(0.7), delay: dl(22) },
  ]
  if (bosses >= 2) {
    finale.push(
      { kind: 'boss', count: 1, interval: iv(4.0), delay: dl(34) },
      { kind: 'healer', count: 1 + Math.floor(difficulty / 5), interval: iv(3.0), delay: dl(36) },
      { kind: 'fast', count: 5 + m2, interval: iv(0.5), delay: dl(44) },
    )
  }
  if (bosses >= 3) {
    finale.push(
      { kind: 'boss', count: 1, interval: iv(4.0), delay: dl(58) },
      { kind: 'tank', count: 1 + m2, interval: iv(2.0), delay: dl(60) },
    )
  }
  w.push(finale)

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
    // timer starts at the group's phase delay; the first enemy spawns the moment it hits 0.
    this.queue = w.map((g) => ({ kind: g.kind, interval: g.interval, remaining: g.count, timer: g.delay ?? 0, pathIndex: g.pathIndex, mix: g.mix }))
  }
  update(dt: number): Enemy[] {
    const spawned: Enemy[] = []
    for (const g of this.queue) {
      g.timer -= dt
      while (g.remaining > 0 && g.timer <= 0) {
        const kind = g.mix ? rollKind(g.mix, this.rng) : g.kind
        const def = ENEMY_DEFS[kind]
        const path = g.pathIndex != null
          ? this.paths[Math.min(Math.max(0, g.pathIndex), this.paths.length - 1)]
          : this.paths[Math.floor(this.rng() * this.paths.length)] ?? this.paths[0]
        // Boss HP is balanced independently — the ramp applies to regular waves only.
        const ramp = kind === 'boss' ? 1 : 1 + this.currentWave * this.waveRamp
        const e = new Enemy(def, path, this.hpScale * ramp, def.speed * this.speedScale)
        this._active.push(e); spawned.push(e)
        g.remaining -= 1; g.timer += g.interval
      }
    }
    this.queue = this.queue.filter((g) => g.remaining > 0)
    return spawned
  }
  /** Spawn an extra enemy mid-wave (death-splits): placed `traveledPx` along `points`.
   * Uses the CURRENT wave's hp ramp so fragments scale like their parents. */
  inject(kind: EnemyKind, points: Pt[], traveledPx: number): Enemy {
    const def = ENEMY_DEFS[kind]
    const ramp = 1 + this.currentWave * this.waveRamp
    const e = new Enemy(def, points, this.hpScale * ramp, def.speed * this.speedScale)
    e.placeAt(traveledPx)
    this._active.push(e)
    return e
  }

  // Swap-remove: O(1) instead of an O(n) filter copy per death (mass mortar kills are O(n²) otherwise).
  // Order does not matter — every consumer (grid, targeting, views) treats `active` as a set.
  remove(e: Enemy): void {
    const i = this._active.indexOf(e)
    if (i < 0) return
    this._active[i] = this._active[this._active.length - 1]
    this._active.pop()
  }
  cleared(): boolean { return !this.spawning && this._active.length === 0 }
}
