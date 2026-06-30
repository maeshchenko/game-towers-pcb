import { describe, it, expect } from 'vitest'
import { Tower } from '../../src/game/Tower'
import { Enemy } from '../../src/game/Enemy'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'

const PITCH = 24
const near = () => new Enemy(ENEMY_DEFS.normal, [{ x: 30, y: 0 }, { x: 31, y: 0 }], 1, 0)
const far = () => new Enemy(ENEMY_DEFS.normal, [{ x: 9000, y: 0 }, { x: 9001, y: 0 }], 1, 0)

describe('Tower', () => {
  it('fires at an in-range enemy once cooled down', () => {
    const t = new Tower('cannon', { x: 24, y: 0 }, PITCH) // range 6 cells = 144px
    const e = near()
    const shot = t.update(1, [e]) // 1s ≥ 1/1.5 cooldown
    expect(shot?.target).toBe(e)
    expect(shot?.damage).toBe(10)
  })
  it('does not fire when no enemy in range', () => {
    const t = new Tower('cannon', { x: 24, y: 0 }, PITCH)
    expect(t.update(1, [far()])).toBeNull()
  })
  it('respects cooldown', () => {
    const t = new Tower('cannon', { x: 24, y: 0 }, PITCH)
    const e = near()
    expect(t.update(1, [e])).not.toBeNull()
    expect(t.update(0.01, [e])).toBeNull()
  })
  it('slow tower returns an aura field', () => {
    const t = new Tower('slow', { x: 24, y: 0 }, PITCH)
    const shot = t.update(0.1, [near()])
    expect(shot?.aura?.slow).toBeCloseTo(0.60, 5)
  })
  it('upgrade raises level and damage', () => {
    const t = new Tower('cannon', { x: 24, y: 0 }, PITCH)
    expect(t.upgrade()).toBe(true)
    expect(t.stats.damage).toBe(22)
  })
})
