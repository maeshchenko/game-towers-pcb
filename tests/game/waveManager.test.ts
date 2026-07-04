import { describe, it, expect } from 'vitest'
import { WaveManager, mapWaves, waveComposition } from '../../src/game/WaveManager'

const p1 = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
const p2 = [{ x: 0, y: 50 }, { x: 100, y: 50 }]

describe('mapWaves', () => {
  it('produces 10 waves, wave 10 has a boss', () => {
    const w = mapWaves(3)
    expect(w).toHaveLength(10)
    expect(w[9].some((g) => g.kind === 'boss')).toBe(true)
  })
  it('every wave is phased but never leaves the player staring at an empty track', () => {
    for (const diff of [1, 5, 9]) {
      const waves = mapWaves(diff)
      for (let i = 0; i < waves.length; i++) {
        const delays = waves[i].map((g) => g.delay ?? 0)
        // at least one later phase…
        expect(Math.max(...delays), `wave ${i + 1} diff ${diff}`).toBeGreaterThanOrEqual(4)
        // …and no gaping hole: consecutive phase starts are ≤10s apart (boss finale ≤15s)
        const sorted = [...new Set(delays)].sort((a, b) => a - b)
        const cap = i === waves.length - 1 ? 15 : 10
        for (let k = 1; k < sorted.length; k++) {
          expect(sorted[k] - sorted[k - 1], `wave ${i + 1} diff ${diff} phase gap`).toBeLessThanOrEqual(cap)
        }
      }
    }
  })
  it('jitter produces uneven spawn gaps; jitter 0 stays metronome-even', () => {
    const gaps = (jitter: number): number[] => {
      const wm = new WaveManager([p1], [[{ kind: 'normal', count: 10, interval: 0.5, jitter }]], 1, 50, 5)
      wm.startWave(0)
      const times: number[] = []
      for (let t = 0; t < 3000; t++) { if (wm.update(0.01).length > 0) times.push(t * 0.01) }
      return times.slice(1).map((t, i) => t - times[i])
    }
    const even = gaps(0)
    expect(Math.max(...even) - Math.min(...even)).toBeLessThan(0.03)
    const ragged = gaps(0.6)
    expect(Math.max(...ragged) - Math.min(...ragged)).toBeGreaterThan(0.2)
  })
})

describe('WaveManager', () => {
  it('spawns exactly the wave count over time', () => {
    const wm = new WaveManager([p1], [[{ kind: 'normal', count: 3, interval: 0.5 }]], 1, 50, 1)
    wm.startWave(0)
    let total = 0
    for (let t = 0; t < 10; t++) total += wm.update(0.5).length
    expect(total).toBe(3)
    expect(wm.cleared()).toBe(false) // still active (alive on path)
  })
  it('delay holds a group back: nothing spawns from it until the phase starts', () => {
    const wm = new WaveManager([p1], [[
      { kind: 'normal', count: 2, interval: 0.5 },
      { kind: 'fast', count: 2, interval: 0.5, delay: 5 },
    ]], 1, 50, 1)
    wm.startWave(0)
    const spawned: string[] = []
    for (let t = 0; t < 8; t++) spawned.push(...wm.update(0.5).map((e) => e.kind)) // 4 s total
    expect(spawned).toEqual(['normal', 'normal'])          // fast phase not started yet
    for (let t = 0; t < 6; t++) spawned.push(...wm.update(0.5).map((e) => e.kind)) // to 7 s
    expect(spawned.filter((k) => k === 'fast')).toHaveLength(2)
  })
  it('mixed group interleaves kinds by weight; homogeneous groups stay pure', () => {
    const wm = new WaveManager([p1], [[
      { kind: 'fast', count: 60, interval: 0.01, mix: { fast: 2, normal: 1 } },
      { kind: 'tank', count: 3, interval: 0.01, delay: 0 },
    ]], 1, 50, 7)
    wm.startWave(0)
    const kinds: string[] = []
    for (let t = 0; t < 200; t++) kinds.push(...wm.update(0.01).map((e) => e.kind))
    expect(kinds.filter((k) => k === 'tank')).toHaveLength(3)
    const fast = kinds.filter((k) => k === 'fast').length
    const normal = kinds.filter((k) => k === 'normal').length
    expect(fast + normal).toBe(60)
    expect(fast).toBeGreaterThan(normal)         // 2:1 weights dominate
    expect(normal).toBeGreaterThan(5)            // but the minority kind really shows up
    // the stream is INTERLEAVED, not two sorted blocks: a normal appears before the last fast
    const stream = kinds.filter((k) => k !== 'tank')
    expect(stream.indexOf('normal')).toBeLessThan(stream.lastIndexOf('fast'))
  })
  it('waveComposition splits mixed groups by weight for honest previews', () => {
    const comp = waveComposition([
      { kind: 'fast', count: 9, interval: 1, mix: { fast: 2, normal: 1 } },
      { kind: 'fast', count: 3, interval: 1 },
    ])
    expect(comp.get('fast')).toBe(9)   // 6 from the mix (2/3 of 9) + 3 pure
    expect(comp.get('normal')).toBe(3) // 1/3 of 9
  })
  it('assigns paths roughly uniformly across two paths (seeded)', () => {
    const wm = new WaveManager([p1, p2], [[{ kind: 'normal', count: 200, interval: 0.01 }]], 1, 50, 42)
    wm.startWave(0)
    for (let t = 0; t < 300; t++) wm.update(0.01)
    const ys = wm.active.map((e) => e.pos.y)
    const onP2 = ys.filter((y) => y >= 25).length
    expect(onP2).toBeGreaterThan(60)   // ~100 expected; loose bounds
    expect(onP2).toBeLessThan(140)
  })
})
