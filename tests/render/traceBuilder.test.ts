import { describe, it, expect } from 'vitest'
import { buildTraceStrokes, buildChevrons } from '../../src/render/traceBuilder'

const trace = { waypoints: [[1, 1], [1, 10], [12, 10]] as [number, number][], cornerRadius: 0.5 }

describe('traceBuilder', () => {
  it('builds a layered multi-lane ribbon (glow + band + lanes) over the same polyline', () => {
    const strokes = buildTraceStrokes(trace, 24)
    expect(strokes.length).toBeGreaterThanOrEqual(5) // glow layers + band + bright lanes/grooves
    // widest first (outer glow), narrowest last (center lane)
    expect(strokes[0].width).toBeGreaterThan(strokes[strokes.length - 1].width)
    // every stroke follows the SAME filleted polyline
    expect(strokes[0].points.length).toBe(strokes[strokes.length - 1].points.length)
    // corridor width scales with pitch
    expect(strokes[1].width).toBeGreaterThan(10)
  })
  it('emits chevrons spaced along the path', () => {
    const ch = buildChevrons(trace, 24, 36)
    expect(ch.length).toBeGreaterThan(0)
    for (const c of ch) expect(Number.isFinite(c.angle)).toBe(true)
  })
})
