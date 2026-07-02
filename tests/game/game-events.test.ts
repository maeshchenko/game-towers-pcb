import { describe, it, expect } from 'vitest'
import { Game } from '../../src/game/Game'
import type { GameEvent } from '../../src/game/events'
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

  it('emits enemyDied with bounty when enemy is killed in tick', () => {
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
    expect(got.some((ev) => ev.type === 'enemyDied')).toBe(true)
  })
})
