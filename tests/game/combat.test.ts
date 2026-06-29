import { describe, it, expect } from 'vitest'
import { applyShot } from '../../src/game/combat'
import { Enemy } from '../../src/game/Enemy'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'

const at = (x: number) => new Enemy(ENEMY_DEFS.normal, [{ x, y: 0 }, { x: x + 1, y: 0 }], 1, 0) // hp 45

describe('applyShot', () => {
  it('direct damage to target', () => {
    const e = at(0)
    applyShot({ from: { x: 0, y: 0 }, target: e, damage: 10 }, [e], 24)
    expect(e.hp).toBe(35)
  })
  it('splash hits all within radius', () => {
    const a = at(0), b = at(24), c = at(1000) // b is 1 cell away, c far
    applyShot({ from: { x: 0, y: 0 }, target: a, damage: 10, splashRadius: 2 }, [a, b, c], 24)
    expect(a.hp).toBe(35); expect(b.hp).toBe(35); expect(c.hp).toBe(45)
  })
  it('chain hits extra enemies at 60% damage', () => {
    const a = at(0), b = at(20)
    applyShot({ from: { x: 0, y: 0 }, target: a, damage: 10, chainCount: 1, chainRange: 3 }, [a, b], 24)
    expect(a.hp).toBe(35)             // full
    expect(b.hp).toBe(45 - 6)         // 60% of 10 = 6
  })
})
