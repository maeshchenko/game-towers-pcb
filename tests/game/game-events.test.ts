import { describe, it, expect } from 'vitest'
import { Game } from '../../src/game/Game'
import type { GameEvent } from '../../src/game/events'
import type { Level } from '../../src/model/level'
import { waveClearGold } from '../../src/game/difficulty'

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

function makeTestGame(): Game {
  return new Game(miniLevel(), 1)
}

describe('Game events', () => {
  it('emits towerBuilt on build', () => {
    const game = makeTestGame()
    const got: GameEvent[] = []
    game.events.on((e) => got.push(e))
    game.build('cannon', 0)
    expect(got.some((e) => e.type === 'towerBuilt' && e.kind === 'cannon')).toBe(true)
  })

  it('emits waveStart on startWave', () => {
    const game = makeTestGame()
    const got: GameEvent[] = []
    game.events.on((e) => got.push(e))
    game.startWave()
    expect(got.some((e) => e.type === 'waveStart' && e.index === 0)).toBe(true)
  })

  it('emits enemyDied with bounty and the dead enemy ref when enemy is killed in tick', () => {
    const game = makeTestGame()
    game.startWave()
    // run spawn, then kill first enemy directly
    game.tick(0.1)
    const e = game.enemies()[0]
    expect(e).toBeDefined()
    const got: GameEvent[] = []
    game.events.on((ev) => got.push(ev))
    e.takeDamage(999999, 999)
    game.tick(0.016)
    const died = got.find((ev) => ev.type === 'enemyDied')
    expect(died).toBeDefined()
    if (died?.type === 'enemyDied') expect(died.enemy).toBe(e)
  })

  it('emits enemyDamaged carrying the damaged enemy ref and the tower position as `from`', () => {
    const game = makeTestGame()
    game.build('cannon', 0)
    game.startWave()
    const got: GameEvent[] = []
    game.events.on((ev) => got.push(ev))
    let guard = 0
    while (guard++ < 200 && !got.some((ev) => ev.type === 'enemyDamaged')) game.tick(0.016)
    const dmg = got.find((ev) => ev.type === 'enemyDamaged')
    expect(dmg).toBeDefined()
    if (dmg?.type === 'enemyDamaged') {
      expect(dmg.enemy.pos).toEqual(dmg.pos) // enemy ref is the same object the pos snapshot came from
      expect(dmg.from).toEqual(game.towers[0].pos) // damage source is the firing tower
    }
  })
})

describe('early next-wave call', () => {
  it('callNextWave overlaps waves: reward banked, counter advanced, new spawns join live enemies', () => {
    const game = makeTestGame()
    game.startWave()
    // run until the first wave's spawner is done but enemies are still alive
    let guard = 0
    while (!game.canCallNextWave() && game.state.phase === 'wave' && guard++ < 20000) game.tick(0.05)
    expect(game.canCallNextWave()).toBe(true)
    const goldBefore = game.state.gold
    const waveBefore = game.state.wave
    const aliveBefore = game.enemies().length
    expect(game.callNextWave()).toBe(true)
    expect(game.state.wave).toBe(waveBefore + 1)          // counter advanced
    expect(game.state.gold).toBeGreaterThan(goldBefore)   // clear reward banked immediately
    expect(game.state.phase).toBe('wave')                 // no phase flip
    // spawner reloaded: new enemies join the still-alive old ones
    let spawnedMore = false
    for (let i = 0; i < 200 && !spawnedMore; i++) { game.tick(0.05); if (game.enemies().length > aliveBefore) spawnedMore = true }
    expect(spawnedMore).toBe(true)
  })

  it('banks the early-call risk bonus inside the sim (not the UI layer)', () => {
    const game = makeTestGame()
    game.startWave()
    let guard = 0
    while (!game.canCallNextWave() && game.state.phase === 'wave' && guard++ < 20000) game.tick(0.05)
    expect(game.canCallNextWave()).toBe(true)
    const goldBefore = game.state.gold
    const waveNumBefore = game.state.waveNumber
    const bonus = game.earlyCallBonus()
    expect(bonus).toBe(5 * (6 + waveNumBefore))
    expect(game.callNextWave()).toBe(true)
    expect(game.state.gold).toBe(goldBefore + waveClearGold(waveNumBefore) + bonus)
  })

  it('cannot call while the current wave is still spawning', () => {
    const game = makeTestGame()
    game.startWave()
    game.tick(0.05)
    expect(game.canCallNextWave()).toBe(false)
    expect(game.callNextWave()).toBe(false)
  })
})

describe('authored wave scripts (meta.waves)', () => {
  const twoPathLevel = (): Level => ({
    version: 1, board: { cols: 16, rows: 12, pitch: 24 }, seed: 1,
    trace: { waypoints: [[1, 3], [10, 3]], cornerRadius: 0.5 },
    paths: [
      { waypoints: [[1, 3], [10, 3]], cornerRadius: 0.5 },
      { waypoints: [[1, 9], [10, 9]], cornerRadius: 0.5 },
    ],
    spots: [{ cell: [3, 6], score: 5, kind: 'build' }], specialSpots: [], decor: [],
    meta: {
      name: 'two-path', difficulty: 0,
      waves: [
        [{ kind: 'normal', count: 3, interval: 0.2, pathIndex: 1 }],
        [{ kind: 'fast', count: 2, interval: 0.2 }],
      ],
    },
  })

  it('overrides the shared template: wave count and composition come from the script', () => {
    const game = new Game(twoPathLevel(), 1)
    expect(game.state.waveCount).toBe(2)
    expect(game.peekWave(0)).toEqual([{ kind: 'normal', count: 3, interval: 0.2, pathIndex: 1 }])
    expect(game.peekWave(1)[0].kind).toBe('fast')
  })

  it('pathIndex directs every enemy of the group to the chosen entrance', () => {
    const game = new Game(twoPathLevel(), 1)
    game.startWave()
    let guard = 0
    while (game.enemies().length < 3 && guard++ < 2000) game.tick(0.05)
    expect(game.enemies().length).toBe(3)
    // path 1 runs along row 9 → y = 9 * 24 + 12 = 228 px for every spawned enemy
    for (const e of game.enemies()) expect(e.pos.y).toBeCloseTo(9 * 24 + 12, 0)
  })

  it('rejects unknown enemy kinds with a clear error', () => {
    const lvl = twoPathLevel()
    lvl.meta.waves = [[{ kind: 'dragon', count: 1, interval: 1 }]]
    expect(() => new Game(lvl, 1)).toThrow(/unknown enemy kind "dragon"/)
  })
})
