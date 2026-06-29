import { describe, it, expect } from 'vitest'
import { WaveManager, mapWaves } from '../../src/game/WaveManager'

const p1 = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
const p2 = [{ x: 0, y: 50 }, { x: 100, y: 50 }]

describe('mapWaves', () => {
  it('produces 10 waves, wave 10 has a boss', () => {
    const w = mapWaves(3)
    expect(w).toHaveLength(10)
    expect(w[9].some((g) => g.kind === 'boss')).toBe(true)
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
