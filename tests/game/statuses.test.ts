import { describe, it, expect } from 'vitest'
import { Enemy } from '../../src/game/Enemy'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'

const path = [{ x: 0, y: 0 }, { x: 1000, y: 0 }]

describe('status effects (tier-4 weapons)', () => {
  it('burn ticks hp over time and refreshes instead of stacking', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path, 10, 0)
    const hp0 = e.hp
    e.applyBurn(10, 2)
    e.update(1)
    expect(e.hp).toBeCloseTo(hp0 - 10, 3)
    e.applyBurn(10, 2) // refresh mid-burn — no double dps
    e.update(1)
    expect(e.hp).toBeCloseTo(hp0 - 20, 3)
    e.update(3) // remaining 1s of burn, then expired
    expect(e.hp).toBeCloseTo(hp0 - 30, 3)
    expect(e.isBurning).toBe(false)
  })

  it('shred lowers effective armor for its duration only', () => {
    const e = new Enemy(ENEMY_DEFS.tank, path, 1, 0)
    expect(e.armor).toBeGreaterThan(0)
    const h0 = e.hp
    e.takeDamage(20, 0)
    const armoredHit = h0 - e.hp // 20 − armor
    e.applyShred(999, 1)
    const h1 = e.hp
    e.takeDamage(20, 0)
    expect(h1 - e.hp).toBe(20) // full damage while shredded
    e.update(2) // shred expired
    const h2 = e.hp
    e.takeDamage(20, 0)
    expect(h2 - e.hp).toBeCloseTo(armoredHit, 3) // armor restored
  })

  it('burn ignores shields (it burns from inside)', () => {
    const e = new Enemy(ENEMY_DEFS.shielded, path, 10, 0)
    const hp0 = e.hp
    e.applyBurn(5, 1)
    e.update(1)
    expect(e.hp).toBeCloseTo(hp0 - 5, 3)
    expect(e.shieldHits).toBeGreaterThan(0) // shield charges untouched
  })
})
