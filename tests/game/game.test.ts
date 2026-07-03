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
  it('branch upgrade spends gold, counts into sell value, and is blocked below max level', () => {
    const g = new Game(miniLevel(), 1)
    g.state.add(1000) // enough for the full upgrade path
    g.build('cannon', 0) // 40
    const t = g.towers[0]
    expect(g.upgradeBranch(t, 0)).toBe(false)  // level 0 — no branch yet
    g.upgrade(t) // 60
    g.upgrade(t) // 90
    expect(g.upgrade(t)).toBe(false)           // linear path exhausted
    const goldBefore = g.state.gold
    expect(g.upgradeBranch(t, 0)).toBe(true)   // overclock, 220
    expect(g.state.gold).toBe(goldBefore - 220)
    expect(t.level).toBe(3)
    // sell refunds 60% of EVERYTHING spent: 40+60+90+220 = 410 → 246
    expect(g.sellValue(t)).toBe(246)
  })

  it('sell refunds 60%', () => {
    const g = new Game(miniLevel(), 1)
    g.build('cannon', 0) // cost 40
    const t = g.towers[0]
    expect(g.sellValue(t)).toBe(24)
    g.sell(t)
    expect(g.towers).toHaveLength(0)
    expect(g.state.gold).toBe(130 - 40 + 24)
  })
  it('player difficulty hpMul scales enemy HP (casual < normal < veteran)', () => {
    const hpAt = (mul: number): number => {
      const g = new Game(miniLevel(), 1, { hpMul: mul })
      g.startWave()
      let guard = 0
      while (g.enemies().length === 0 && guard++ < 200) g.tick(0.05)
      return g.enemies()[0].maxHp
    }
    const casual = hpAt(0.75), normal = hpAt(1), veteran = hpAt(1.3)
    expect(casual).toBeLessThan(normal)
    expect(veteran).toBeGreaterThan(normal)
  })

  it('snapshot/restore round-trips a build-phase run (towers, branch, economy, wave)', () => {
    const g1 = new Game(miniLevel(), 1)
    g1.state.add(1000)
    g1.build('cannon', 0)
    const t = g1.towers[0]
    g1.upgrade(t); g1.upgrade(t); g1.upgradeBranch(t, 1)
    t.targetMode = 'strong'
    // play through wave 1 so the snapshot is mid-run, not pristine
    g1.startWave()
    let guard = 0
    while (g1.state.phase === 'wave' && guard++ < 30000) g1.tick(1 / 30)
    expect(g1.state.phase).toBe('build')
    const snap = g1.snapshot()!
    expect(snap.wave).toBe(1)

    const g2 = new Game(miniLevel(), 99)
    expect(g2.restore(snap)).toBe(true)
    expect(g2.state.wave).toBe(snap.wave)
    expect(g2.state.gold).toBe(snap.gold)
    expect(g2.state.lives).toBe(snap.lives)
    const r = g2.towers[0]
    expect(r.kind).toBe('cannon')
    expect(r.level).toBe(3)
    expect(r.branch).toBe(1)
    expect(r.targetMode).toBe('strong')
    expect(g2.sellValue(r)).toBe(g1.sellValue(t)) // spend history restored → honest sell price
    expect(g2.canBuild(0)).toBe(false)            // spot occupied
  })

  it('snapshot is null during a wave', () => {
    const g = new Game(miniLevel(), 1)
    g.startWave()
    expect(g.snapshot()).toBeNull()
  })

  it('peeks upcoming wave', () => {
    const g = new Game(miniLevel(), 1)
    const wave = g.peekWave(0)
    expect(wave.length).toBeGreaterThan(0)
    expect(wave[0].count).toBeGreaterThan(0)
  })
})
