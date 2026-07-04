import { describe, it, expect } from 'vitest'
import { Enemy } from '../../src/game/Enemy'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'
import { Game } from '../../src/game/Game'
import type { Level } from '../../src/model/level'
import type { GameEvent } from '../../src/game/events'

const path = [{ x: 0, y: 0 }, { x: 1000, y: 0 }]

function miniLevel(waves: NonNullable<Level['meta']['waves']>): Level {
  return {
    version: 1, board: { cols: 16, rows: 12, pitch: 24 }, seed: 1,
    trace: { waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 },
    paths: [{ waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 }],
    spots: [{ cell: [3, 4], score: 5, kind: 'build' }], specialSpots: [], decor: [],
    meta: { name: 'mini', difficulty: 0, waves },
  }
}

describe('data-driven enemy abilities', () => {
  it('shield absorbs the first N hits regardless of damage size', () => {
    const e = new Enemy(ENEMY_DEFS.shielded, path, 1, 10)
    const hp0 = e.hp
    for (let i = 0; i < 6; i++) e.takeDamage(9999, 999)
    expect(e.hp).toBe(hp0)          // six charges ate six hits
    e.takeDamage(10, 0)
    expect(e.hp).toBe(hp0 - 10)     // seventh hit lands
  })

  it('erratic movement comes from the def, not a kind check', () => {
    const e = new Enemy(ENEMY_DEFS.rogue, path, 1, 10)
    e.update(0.1) // phase lo (0.3×): 10px/s * 0.1s * 0.3 = 0.3px
    expect(e.traveled).toBeCloseTo(0.3, 3)
  })

  it('boss phases: enraged at ≤2/3 hp, glitch dash at ≤1/3 hp, deterministic', () => {
    const e = new Enemy(ENEMY_DEFS.boss, path, 1, 10)
    e.update(0.1)
    expect(e.phase).toBe(1)
    e.hp = Math.floor(e.maxHp * 0.5)
    e.update(0.1)
    expect(e.phase).toBe(2)
    expect(e.phaseChanged).toBe(true)
    e.phaseChanged = false
    // phase 2 moves 1.35× faster than phase 1
    const before = e.traveled
    e.update(1)
    expect(e.traveled - before).toBeCloseTo(10 * 1.35, 1)
    e.hp = Math.floor(e.maxHp * 0.2)
    e.update(0.01)
    expect(e.phase).toBe(3)
    expect(e.phaseChanged).toBe(true)
  })

  it('boss stays slow-immune via the abilities flag', () => {
    const e = new Enemy(ENEMY_DEFS.boss, path, 1, 10)
    e.applySlow(0.3, 5)
    expect(e.isSlowed).toBe(false)
  })

  it('carrier splits into fragments at its death position, and Game emits their spawns', () => {
    const game = new Game(miniLevel([[{ kind: 'carrier', count: 1, interval: 1 }]]), 1)
    const events: GameEvent[] = []
    game.events.on((e) => events.push(e))
    game.startWave()
    let guard = 0
    while (game.enemies().length === 0 && guard++ < 200) game.tick(0.05)
    const carrier = game.enemies()[0]
    // let it walk a bit, then kill it (strip armor with pierce)
    for (let i = 0; i < 20; i++) game.tick(0.05)
    const deathTraveled = carrier.traveled
    carrier.takeDamage(99999, 999)
    game.tick(0.05)
    const frags = game.enemies().filter((e) => e.kind === 'fragment')
    expect(frags).toHaveLength(4)
    // placed near the death point (staggered up to 3×0.35 pitch behind, one tick of walk ahead)
    for (const f of frags) {
      expect(f.traveled).toBeGreaterThan(deathTraveled - 3 * 24 * 0.35 - 1)
      expect(f.traveled).toBeLessThan(deathTraveled + 6)
    }
    expect(events.filter((e) => e.type === 'enemySpawned' && e.kind === 'fragment')).toHaveLength(4)
  })

  it('discharge: AoE damage + slow at the clicked point, then a 45s cooldown', () => {
    const game = new Game(miniLevel([[{ kind: 'normal', count: 3, interval: 0.1 }]]), 1)
    expect(game.useDischarge({ x: 0, y: 0 })).toBe(false) // build phase — not usable
    game.startWave()
    let guard = 0
    while (game.enemies().length < 3 && guard++ < 400) game.tick(0.05)
    const target = game.enemies()[0]
    const hpBefore = target.hp
    expect(game.useDischarge({ x: target.pos.x, y: target.pos.y })).toBe(true)
    expect(target.hp).toBeLessThan(hpBefore)
    expect(target.isSlowed).toBe(true)
    expect(game.dischargeCooldown).toBeCloseTo(45, 1)
    expect(game.useDischarge({ x: target.pos.x, y: target.pos.y })).toBe(false) // on cooldown
    game.tick(1)
    expect(game.dischargeCooldown).toBeCloseTo(44, 1)
  })

  it('healing emits enemyHealed events and never overheals', () => {
    const game = new Game(miniLevel([[
      { kind: 'healer', count: 1, interval: 1 },
      { kind: 'normal', count: 1, interval: 1 },
    ]]), 1)
    const events: GameEvent[] = []
    game.events.on((e) => events.push(e))
    game.startWave()
    let guard = 0
    while (game.enemies().length < 2 && guard++ < 400) game.tick(0.05)
    const normal = game.enemies().find((e) => e.kind === 'normal')!
    normal.hp -= 20
    for (let i = 0; i < 10; i++) game.tick(0.05)
    expect(normal.hp).toBeGreaterThan(normal.maxHp - 20)
    expect(normal.hp).toBeLessThanOrEqual(normal.maxHp)
    expect(events.some((e) => e.type === 'enemyHealed')).toBe(true)
  })
})
