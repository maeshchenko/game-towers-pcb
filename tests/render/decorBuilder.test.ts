import { describe, it, expect } from 'vitest'
import { buildDecorShapes } from '../../src/render/decorBuilder'
import { PALETTE } from '../../src/style/palette'

const PAD_GOLD = PALETTE.padGold
const SILK_WHITE = PALETTE.silkWhite

describe('decorBuilder', () => {
  it('soic emits shadow rect, gold pads, silk lines, and pin-1 circle', () => {
    const shapes = buildDecorShapes({ kind: 'soic', variant: 8, cell: [4, 4], rot: 0, scale: 1 }, 24)
    // shadow + body + bevel×2 + pads(4pins × 2sides) + pin-1 dot + silk(4 lines) + specular ≥ 20
    expect(shapes.length).toBeGreaterThanOrEqual(12)
    // first shape is drop-shadow (dark rect)
    expect(shapes[0].type).toBe('rect')
    // has at least one gold pad
    expect(shapes.some(s => s.type === 'rect' && (s as { type: 'rect'; color: number }).color === PAD_GOLD)).toBe(true)
    // has silkscreen lines
    expect(shapes.some(s => s.type === 'line')).toBe(true)
    // has pin-1 dot (circle)
    expect(shapes.some(s => s.type === 'circle')).toBe(true)
    // no designator text when ref is absent
    expect(shapes.some(s => s.type === 'text')).toBe(false)
  })

  it('soic with ref emits a white designator text shape', () => {
    const shapes = buildDecorShapes({ kind: 'soic', variant: 8, cell: [2, 2], rot: 0, scale: 1, ref: 'U3' }, 24)
    const text = shapes.find(s => s.type === 'text')
    expect(text).toBeDefined()
    if (text && text.type === 'text') {
      expect(text.text).toBe('U3')
      expect(text.color).toBe(SILK_WHITE)
      expect(text.size).toBeGreaterThan(0)
    }
  })

  it('via emits gold donut circles using r (not w)', () => {
    const shapes = buildDecorShapes({ kind: 'via', variant: 1, cell: [4, 4], rot: 0, scale: 1 }, 24)
    expect(shapes.some(s => s.type === 'circle')).toBe(true)
    const outer = shapes.find(s => s.type === 'circle')!
    expect(outer.type).toBe('circle')
    if (outer.type === 'circle') {
      expect(outer.r).toBeGreaterThan(0)
      // ShapeSpec circle has no `w` — TypeScript guarantees this, but runtime verify too
      expect((outer as Record<string, unknown>)['w']).toBeUndefined()
    }
  })

  it('smdRes emits body, two silver end pads, and silk lines', () => {
    const shapes = buildDecorShapes({ kind: 'smdRes', variant: 1, cell: [1, 1], rot: 0, scale: 1 }, 24)
    expect(shapes.length).toBeGreaterThanOrEqual(6)
    // has rects (body + pads)
    expect(shapes.some(s => s.type === 'rect')).toBe(true)
    // has silk lines
    expect(shapes.some(s => s.type === 'line')).toBe(true)
  })

  it('res renders as a clean dark chip with no value label (recedes behind the path)', () => {
    const shapes = buildDecorShapes({ kind: 'res', variant: 1, cell: [1, 1], rot: 0, scale: 1 }, 24)
    expect(shapes.some(s => s.type === 'rect')).toBe(true) // chip body + pads
    expect(shapes.some(s => s.type === 'text')).toBe(false) // no '100' label
  })

  it('unknown kind falls back to a generic rect without throwing', () => {
    expect(() => {
      const shapes = buildDecorShapes({ kind: 'bogus_xyz', variant: 0, cell: [0, 0], rot: 0, scale: 1 }, 24)
      expect(shapes.length).toBeGreaterThan(0)
      expect(shapes[0].type).toBe('rect')
    }).not.toThrow()
  })
})
