import { describe, it, expect } from 'vitest'
import { hpScale, startLives, startGold, waveClearGold, effectiveDamage, SPEED_SCALE } from '../../src/game/difficulty'

describe('difficulty + economy', () => {
  it('hp scale ramps with difficulty', () => {
    expect(hpScale(0)).toBeCloseTo(1, 5)
    expect(hpScale(10)).toBeGreaterThan(hpScale(0))
  })
  it('economy curves', () => {
    expect(startLives).toBe(20)
    expect(startGold(0)).toBe(130)
    expect(startGold(5)).toBe(205)
    expect(waveClearGold(1)).toBe(19)
  })
  it('effective damage subtracts armor minus pierce, min 1', () => {
    expect(effectiveDamage(10, 0, 0)).toBe(10)
    expect(effectiveDamage(10, 6, 0)).toBe(4)
    expect(effectiveDamage(10, 6, 6)).toBe(10)
    expect(effectiveDamage(3, 6, 0)).toBe(1)
  })
  it('speed scale is positive', () => { expect(SPEED_SCALE).toBeGreaterThan(0) })
})
