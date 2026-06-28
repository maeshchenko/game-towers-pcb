import type { Trace } from '../model/level'
import type { Pt } from '../geom/types'
import { filletPath } from '../geom/fillet'
import { PALETTE, RENDER } from '../style/palette'

export interface StrokeSpec { points: Pt[]; width: number; color: number; alpha: number; blur: number }
export interface ChevronSpec { x: number; y: number; angle: number }

export function buildTraceStrokes(trace: Trace, pitch: number): StrokeSpec[] {
  const pts = filletPath(trace.waypoints, trace.cornerRadius, pitch)
  return [
    { points: pts, width: RENDER.traceBandWidth + 8, color: PALETTE.traceHalo, alpha: 0.5, blur: RENDER.haloBlur },
    { points: pts, width: RENDER.traceBandWidth, color: PALETTE.traceBand, alpha: 1, blur: 0 },
    { points: pts, width: RENDER.traceCoreWidth, color: PALETTE.traceCore, alpha: 1, blur: 0 },
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
