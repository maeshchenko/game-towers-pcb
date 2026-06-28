import { describe, it, expect } from 'vitest'
import { fitPitch } from '../../src/app/viewport'

describe('fitPitch', () => {
  it('fits the board to the viewport (limiting dimension wins)', () => {
    // 1600x900 view, 32x24 board: min(1600/32=50, 900/24=37.5) -> 37, clamped to 37 (<=48)
    expect(fitPitch(32, 24, 1600, 900)).toBe(37)
  })
  it('smaller board yields a larger pitch than a bigger board', () => {
    const small = fitPitch(32, 24, 1600, 900)
    const big = fitPitch(96, 72, 1600, 900)
    expect(small).toBeGreaterThan(big)
  })
  it('clamps to the max pitch', () => {
    expect(fitPitch(2, 2, 4000, 4000)).toBe(48)
  })
  it('clamps to the min pitch', () => {
    expect(fitPitch(2000, 2000, 800, 600)).toBe(8)
  })
})
