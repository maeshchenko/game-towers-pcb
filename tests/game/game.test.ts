import { describe, it, expect } from 'vitest'
import { Game } from '../../src/game/Game'
import type { Level } from '../../src/model/level'

function miniLevel(): Level {
  // short straight path along row 5 from col 1..10 on a small board
  return {
    version: 1, board: { cols: 16, rows: 12, pitch: 24 }, seed: 1,
    trace: { waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 },
    paths: [{ waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 }],
    spots: [{ cell: [3, 4], score: 5, kind: 'build' }], specialSpots: [], decor: [],
    meta: { name: 'mini', difficulty: 0 },
  }
}

describe('Game', () => {
  it('build is gated by gold and spot occupancy', () => {
    const g = new Game(miniLevel(), 1)
    expect(g.canBuild(0)).toBe(true)
    expect(g.build('cannon', 0)).toBe(true)
    expect(g.towers).toHaveLength(1)
    expect(g.canBuild(0)).toBe(false)        // occupied
    expect(g.build('cannon', 0)).toBe(false)
  })
  it('a wave runs: enemies spawn, get shot or leak, and lives/gold change', () => {
    const g = new Game(miniLevel(), 1)
    g.build('cannon', 0)
    g.startWave()
    const goldAfterBuild = g.state.gold // 80 (built a 40-cost cannon from 120)
    let guard = 0
    while (g.state.phase === 'wave' && guard++ < 20000) g.tick(1 / 60)
    // wave resolved, and the wave actually did something: enemies were killed (gold rose
    // above the post-build 80, via bounty + wave-clear) OR leaked (lives fell below 20).
    expect(['build', 'win', 'lose']).toContain(g.state.phase)
    expect(g.state.gold > goldAfterBuild || g.state.lives < 20).toBe(true)
  })
  it('sell refunds 60%', () => {
    const g = new Game(miniLevel(), 1)
    g.build('cannon', 0) // cost 40
    const t = g.towers[0]
    expect(g.sellValue(t)).toBe(24)
    g.sell(t)
    expect(g.towers).toHaveLength(0)
    expect(g.state.gold).toBe(110 - 40 + 24)
  })
  it('peeks upcoming wave', () => {
    const g = new Game(miniLevel(), 1)
    const wave = g.peekWave(0)
    expect(wave.length).toBeGreaterThan(0)
    expect(wave[0].count).toBeGreaterThan(0)
  })
})
