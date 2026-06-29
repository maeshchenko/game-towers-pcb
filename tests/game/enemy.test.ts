import { describe, it, expect } from 'vitest'
import { Enemy } from '../../src/game/Enemy'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'

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
})
