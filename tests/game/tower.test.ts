import { describe, it, expect } from 'vitest'
import { Tower } from '../../src/game/Tower'
import { Enemy } from '../../src/game/Enemy'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'
import { TOWER_DEFS } from '../../src/game/towerTypes'

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
  it('special spot boosts aura range but never weakens the slow factor', () => {
    const base = new Tower('slow', { x: 24, y: 0 }, PITCH)
    const boosted = new Tower('slow', { x: 24, y: 0 }, PITCH)
    boosted.special = true
    const a = base.update(0.1, [near()])!.aura!
    const b = boosted.update(0.1, [near()])!.aura!
    // slow is a speed MULTIPLIER (lower = stronger): the boost must not raise it
    expect(b.slow).toBeLessThanOrEqual(a.slow)
    expect(b.range).toBeCloseTo(TOWER_DEFS.slow[0].range * PITCH * 1.35, 5)
  })
  it('keeps the exact fire rate over time (cooldown remainder is not dropped)', () => {
    const t = new Tower('cannon', { x: 24, y: 0 }, PITCH)
    const e = near()
    let shots = 0
    // 10 s in 1000 substeps; fireRate 1.5/s → period 2/3 s → 15 shots with exact remainder
    // carry (the old reset-to-full-period behaviour dropped the remainder and gave 14)
    for (let i = 0; i < 1000; i++) if (t.update(0.01, [e])) shots++
    expect(shots).toBe(15)
  })
  it('tier-4 branch: only at max linear level, changes stats, locks the other branch', () => {
    const t = new Tower('tesla', { x: 24, y: 0 }, PITCH)
    expect(t.canBranch).toBe(false)
    expect(t.chooseBranch(0)).toBe(false)      // not at max linear level yet
    t.upgrade(); t.upgrade()
    expect(t.level).toBe(2)
    expect(t.canBranch).toBe(true)
    expect(t.upgrade()).toBe(false)            // linear path ends at 2 — tier 4 is a branch
    expect(t.chooseBranch(0)).toBe(true)       // arcmatrix
    expect(t.level).toBe(3)
    expect(t.stats.chainCount).toBe(8)
    expect(t.chooseBranch(1)).toBe(false)      // branch choice is permanent
    expect(t.canBranch).toBe(false)
  })

  it('does not bank shots while idle: no burst after a long dry spell', () => {
    const t = new Tower('cannon', { x: 24, y: 0 }, PITCH)
    t.update(10, [far()]) // long idle, nothing in range
    const e = near()
    expect(t.update(0.001, [e])).not.toBeNull()  // fires once immediately
    expect(t.update(0.001, [e])).toBeNull()      // but only once — no banked backlog
  })
})
