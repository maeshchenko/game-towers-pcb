import { describe, it, expect } from 'vitest'
import { rollDailyMods } from '../../src/game/dailyMods'
import { Game } from '../../src/game/Game'
import { waveComposition } from '../../src/game/WaveManager'
import { startGold } from '../../src/game/difficulty'
import type { Level } from '../../src/model/level'

function miniLevel(): Level {
  return {
    version: 1, board: { cols: 16, rows: 12, pitch: 24 }, seed: 1,
    trace: { waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 },
    paths: [{ waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 }],
    spots: [{ cell: [3, 4], score: 5, kind: 'build' }], specialSpots: [], decor: [],
    meta: { name: 'mini', difficulty: 3 },
  }
}

describe('rollDailyMods', () => {
  it('is deterministic for the same stamp', () => {
    expect(rollDailyMods('20260704')).toEqual(rollDailyMods('20260704'))
  })

  it('rolls exactly two distinct modifiers', () => {
    for (const stamp of ['20260101', '20260315', '20260704', '20261231', '20270207']) {
      const m = rollDailyMods(stamp)
      expect(m.ids).toHaveLength(2)
      expect(new Set(m.ids).size).toBe(2)
    }
  })

  it('adjacent days do not collapse to the same first modifier', () => {
    // Regression: weak LCG warm-up made every day roll the same first mod.
    const firsts = new Set<string>()
    const all = new Map<string, number>()
    for (let d = 1; d <= 28; d++) {
      const m = rollDailyMods(`202607${String(d).padStart(2, '0')}`)
      firsts.add(m.ids[0])
      m.ids.forEach((id) => all.set(id, (all.get(id) ?? 0) + 1))
    }
    expect(firsts.size).toBeGreaterThan(2) // not all the same
    expect(all.size).toBe(5) // every modifier appears across a month
  })

  it('embargo never bans the cannon', () => {
    for (let d = 1; d <= 28; d++) {
      const m = rollDailyMods(`202607${String(d).padStart(2, '0')}`)
      if (m.banned !== null) {
        expect(m.ids).toContain('embargo')
        expect(m.banned).not.toBe('cannon')
      }
    }
  })
})

describe('Game daily-mod opts', () => {
  it('countMul scales wave sizes', () => {
    const base = new Game(miniLevel(), 1)
    const swarm = new Game(miniLevel(), 1, { countMul: 1.3 })
    const total = (g: Game) => [...waveComposition(g.peekWave(0)).values()].reduce((a, b) => a + b, 0)
    expect(total(swarm)).toBeGreaterThan(total(base))
  })

  it('goldDelta shifts the starting budget and never below the floor', () => {
    const g = new Game(miniLevel(), 1, { goldDelta: -40 })
    expect(g.state.gold).toBe(startGold(3) - 40)
    const broke = new Game(miniLevel(), 1, { goldDelta: -100000 })
    expect(broke.state.gold).toBe(40)
  })

  it('banned kind cannot be built, others can', () => {
    const g = new Game(miniLevel(), 1, { banned: 'tesla', goldDelta: 1000 })
    expect(g.build('tesla', 0)).toBe(false)
    expect(g.build('cannon', 0)).toBe(true)
  })
})
