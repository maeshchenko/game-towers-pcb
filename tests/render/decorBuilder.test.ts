import { describe, it, expect } from 'vitest'
import { buildDecorShapes } from '../../src/render/decorBuilder'

describe('decorBuilder', () => {
  it('a chip emits a shadow, a body, and at least one pin/highlight shape', () => {
    const shapes = buildDecorShapes({ kind: 'soic', variant: 8, cell: [4, 4], rot: 0, scale: 1 }, 24)
    expect(shapes.length).toBeGreaterThanOrEqual(3)
    // first shape is the drop-shadow (dark, offset down-right from body)
    expect(shapes[0].type).toBe('rect')
  })
  it('a via emits a circular shape', () => {
    const shapes = buildDecorShapes({ kind: 'via', variant: 1, cell: [4, 4], rot: 0, scale: 1 }, 24)
    expect(shapes.some((s) => s.type === 'circle')).toBe(true)
  })
})
