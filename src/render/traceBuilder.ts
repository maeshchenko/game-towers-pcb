import type { Trace } from '../model/level'
import type { Pt } from '../geom/types'
import { filletPath } from '../geom/fillet'
import { PALETTE, RENDER } from '../style/palette'

export interface StrokeSpec { points: Pt[]; width: number; color: number; alpha: number; blur: number }
export interface ChevronSpec { x: number; y: number; angle: number }

// The path is the visual hero: a thick multi-lane glowing ribbon. Rendered as nested concentric
// strokes of the SAME filleted polyline (round joins keep rounded corners for free): a soft outer
// glow, a mid-green band, then alternating bright "conductor" lanes and dark grooves carved inward —
// reads as several parallel traces running along the path.
export function buildTraceStrokes(trace: Trace, pitch: number): StrokeSpec[] {
  const pts = filletPath(trace.waypoints, trace.cornerRadius, pitch)
  const B = pitch * RENDER.traceBandMul
  const lane = (w: number, color: number, alpha = 1): StrokeSpec => ({ points: pts, width: w, color, alpha, blur: 0 })
  // Dark channel + 3 crisp teal conductor lanes carved by alternating bright/groove concentric
  // strokes (round joins = rounded corners). Subtle outer glow only — no fat green bloom.
  return [
    { points: pts, width: B + pitch * 0.5, color: PALETTE.traceHalo, alpha: 0.18, blur: RENDER.haloBlur },
    lane(B, PALETTE.traceBand),               // dark channel base
    lane(B * 0.82, PALETTE.traceLane),        // outer lane (bright)
    lane(B * 0.60, PALETTE.traceGroove),      // dark gap
    lane(B * 0.40, PALETTE.traceLane),        // mid lane
    lane(B * 0.20, PALETTE.traceGroove),      // dark gap
    lane(B * 0.10, PALETTE.traceLane),        // center lane
  ]
}

export function buildChevrons(trace: Trace, pitch: number, spacing: number): ChevronSpec[] {
  const pts = filletPath(trace.waypoints, trace.cornerRadius, pitch)
  const out: ChevronSpec[] = []
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const segLen = Math.hypot(b.x - a.x, b.y - a.y)
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    let d = spacing - acc
    while (d <= segLen) {
      const t = d / segLen
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle })
      d += spacing
    }
    acc = (acc + segLen) % spacing
  }
  return out
}
