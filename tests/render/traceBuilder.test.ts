import { describe, it, expect } from 'vitest'
import { buildTraceStrokes, buildChevrons } from '../../src/render/traceBuilder'

const trace = { waypoints: [[1, 1], [1, 10], [12, 10]] as [number, number][], cornerRadius: 0.5 }

describe('traceBuilder', () => {
  it('builds halo, band, and core strokes (3 layers) over the same polyline', () => {
    const strokes = buildTraceStrokes(trace, 24)
    expect(strokes.length).toBe(3)
    // widest first (halo), narrowest last (core)
    expect(strokes[0].width).toBeGreaterThan(strokes[2].width)
    expect(strokes[0].points.length).toBe(strokes[2].points.length)
  })
  it('emits chevrons spaced along the path', () => {
    const ch = buildChevrons(trace, 24, 36)
    expect(ch.length).toBeGreaterThan(0)
    for (const c of ch) expect(Number.isFinite(c.angle)).toBe(true)
  })
})
