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
})
