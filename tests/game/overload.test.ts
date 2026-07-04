import { describe, it, expect } from 'vitest'
import { Game } from '../../src/game/Game'
import { Tower } from '../../src/game/Tower'
import type { Level } from '../../src/model/level'

function miniLevel(): Level {
  return {
    version: 1, board: { cols: 16, rows: 12, pitch: 24 }, seed: 1,
    trace: { waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 },
    paths: [{ waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 }],
    spots: [{ cell: [3, 4], score: 5, kind: 'build' }], specialSpots: [], decor: [],
    meta: { name: 'mini', difficulty: 0 },
  }
}

describe('overload ability', () => {
  it('buffed tower fires faster while the buff lasts, then returns to normal', () => {
    const t = new Tower('cannon', { x: 24, y: 0 }, 24)
    const enemy = { pos: { x: 30, y: 0 }, alive: true, distToBase: 10, hp: 1e9, maxHp: 1e9 } as never
    const countShots = (seconds: number): number => {
      let n = 0
      for (let i = 0; i < seconds * 100; i++) if (t.update(0.01, [enemy])) n++
      return n
    }
    const base = countShots(4) // fireRate 1.5 → ~6
    t.applyRateBuff(1.7, 4)
    const buffed = countShots(4)
    expect(buffed).toBeGreaterThan(base * 1.4)
    const after = countShots(4)
    expect(after).toBe(base) // buff expired
  })

  it('useOverload buffs only towers in radius, refuses empty clicks, sets the cooldown', () => {
    const g = new Game(miniLevel(), 1)
    g.build('cannon', 0)
    const tower = g.towers[0]
    g.startWave()
    expect(g.useOverload({ x: tower.pos.x + 2000, y: 0 })).toBe(false) // nothing in radius — no cd burn
    expect(g.overloadCooldown).toBe(0)
    expect(g.useOverload(tower.pos)).toBe(true)
    expect(tower.isOverloaded).toBe(true)
    expect(g.overloadCooldown).toBeCloseTo(60, 3)
    expect(g.useOverload(tower.pos)).toBe(false) // on cooldown
  })

  it('overload cooldown survives the snapshot', () => {
    const g = new Game(miniLevel(), 1)
    g.build('cannon', 0)
    g.startWave()
    g.useOverload(g.towers[0].pos)
    let guard = 0
    while (g.state.phase === 'wave' && guard++ < 30000) g.tick(1 / 30)
    const snap = g.snapshot()!
    expect(snap.overloadCd).toBeGreaterThan(0)
    const g2 = new Game(miniLevel(), 1)
    expect(g2.restore(snap)).toBe(true)
    expect(g2.overloadCooldown).toBeCloseTo(snap.overloadCd!, 5)
  })
})
