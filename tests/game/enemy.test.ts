import { describe, it, expect } from 'vitest'
import { Enemy } from '../../src/game/Enemy'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'
import { Game } from '../../src/game/Game'

const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }]

describe('Enemy', () => {
  it('scales hp and dies when hp hits 0', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path, 2, 50)
    expect(e.maxHp).toBe(90)
    e.takeDamage(90)
    expect(e.alive).toBe(false)
  })
  it('armor reduces damage, pierce ignores it', () => {
    const e = new Enemy(ENEMY_DEFS.tank, path, 1, 50) // armor 6
    e.takeDamage(10)        // 10-6 = 4
    expect(e.hp).toBe(196)
    e.takeDamage(10, 6)     // pierce cancels armor → 10
    expect(e.hp).toBe(186)
  })
  it('slow reduces effective speed', () => {
    const fast = new Enemy(ENEMY_DEFS.normal, path, 1, 50)
    const slowed = new Enemy(ENEMY_DEFS.normal, path, 1, 50)
    slowed.applySlow(0.5, 10)
    fast.update(1); slowed.update(1)
    expect(slowed.traveled).toBeLessThan(fast.traveled)
  })
  it('reachedBase when it finishes alive', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path, 1, 50)
    e.update(10)
    expect(e.reachedBase).toBe(true)
  })
  it('boss is immune to slows', () => {
    const boss = new Enemy(ENEMY_DEFS.boss, path, 1, 50)
    boss.applySlow(0.5, 10)
    expect((boss as any).slowFactor).toBe(1)
  })
  it('rogue moves erratically and is stabilized by slow', () => {
    const rogue = new Enemy(ENEMY_DEFS.rogue, path, 1, 50)
    
    // 0.3s -> phase 0 -> speed factor 0.3
    rogue.update(0.3)
    expect(rogue.traveled).toBeCloseTo(4.5, 1)
    
    // 0.5s more -> total 0.8s -> phase 1 -> speed factor 2.2
    rogue.update(0.5)
    expect(rogue.traveled).toBeGreaterThan(4.5)
    
    // Now apply slow to stabilize rogue
    const slowedRogue = new Enemy(ENEMY_DEFS.rogue, path, 1, 50)
    slowedRogue.applySlow(0.5, 10)
    slowedRogue.update(0.3)
    expect(slowedRogue.traveled).toBeCloseTo(7.5, 1)
  })
  it('healer heals nearby enemies', () => {
    const lvl = {
      version: 1 as const, board: { cols: 16, rows: 12, pitch: 24 }, seed: 1,
      trace: { waypoints: [[1, 5], [10, 5]] as [number, number][], cornerRadius: 0.5 },
      paths: [{ waypoints: [[1, 5], [10, 5]] as [number, number][], cornerRadius: 0.5 }],
      spots: [], specialSpots: [], decor: [],
      meta: { name: 'mini', difficulty: 0 },
    }
    const game = new Game(lvl, 1)
    const healer = new Enemy(ENEMY_DEFS.healer, path, 1, 50)
    const normal = new Enemy(ENEMY_DEFS.normal, path, 1, 50)
    normal.hp = 20
    
    // Position healer close to normal
    healer.pos.x = 10; healer.pos.y = 10
    normal.pos.x = 12; normal.pos.y = 10 // distance = 2px, well within 2.5 * 24 = 60px radius
    
    // Inject enemies
    ;(game as any).wm._active = [healer, normal]
    game.state.startWave()
    
    game.tick(1)
    
    // Normal enemy should have healed: (15 + maxHp * 0.03) * 1 = 15 + 45 * 0.03 = 16.35
    expect(normal.hp).toBeGreaterThan(20)
    expect(normal.hp).toBeCloseTo(20 + 16.35, 1)
  })
})
