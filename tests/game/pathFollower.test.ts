import { describe, it, expect } from 'vitest'
import { PathFollower2D } from '../../src/game/PathFollower2D'

describe('PathFollower2D', () => {
  const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
  it('advances along the segment and reports traveled', () => {
    const f = new PathFollower2D(path, 50)
    f.advance(1)
    expect(f.pos.x).toBeCloseTo(50, 5)
    expect(f.traveled).toBeCloseTo(50, 5)
    expect(f.done).toBe(false)
  })
  it('finishes at the end', () => {
    const f = new PathFollower2D(path, 50)
    f.advance(10)
    expect(f.pos.x).toBeCloseTo(100, 5)
    expect(f.done).toBe(true)
  })
  it('a single-point path is immediately done', () => {
    expect(new PathFollower2D([{ x: 5, y: 5 }], 50).done).toBe(true)
  })
  it('knows its total length and the remaining distance to the end', () => {
    const f = new PathFollower2D([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }], 50)
    expect(f.totalLen).toBeCloseTo(150, 5)
    expect(f.remaining).toBeCloseTo(150, 5)
    f.advance(1) // 50 px
    expect(f.remaining).toBeCloseTo(100, 5)
    f.advance(10) // overshoot to the end
    expect(f.remaining).toBeCloseTo(0, 5)
  })
})
