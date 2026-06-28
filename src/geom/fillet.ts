import type { Cell, Pt } from './types'
import { cellToPx } from './grid'

function sub(a: Pt, b: Pt): Pt { return { x: a.x - b.x, y: a.y - b.y } }
function add(a: Pt, b: Pt): Pt { return { x: a.x + b.x, y: a.y + b.y } }
function scale(a: Pt, s: number): Pt { return { x: a.x * s, y: a.y * s } }
function norm(a: Pt): Pt { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l } }
function len(a: Pt): number { return Math.hypot(a.x, a.y) }

export function filletPath(waypoints: Cell[], radiusCells: number, pitch: number, arcSteps = 6): Pt[] {
  const pts = waypoints.map((c) => cellToPx(c, pitch))
  if (pts.length < 3) return pts
  const radius = radiusCells * pitch
  const out: Pt[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], cur = pts[i], next = pts[i + 1]
    const inDir = norm(sub(cur, prev))
    const outDir = norm(sub(next, cur))
    const r = Math.min(radius, len(sub(cur, prev)) / 2, len(sub(next, cur)) / 2)
    const start = sub(cur, scale(inDir, r))   // leave the corner early
    const end = add(cur, scale(outDir, r))    // rejoin after the corner
    out.push(start)
    for (let s = 1; s < arcSteps; s++) {
      const t = s / arcSteps
      // quadratic Bezier with the sharp vertex as control point => smooth fillet
      const a = scale(start, (1 - t) * (1 - t))
      const b = scale(cur, 2 * (1 - t) * t)
      const c = scale(end, t * t)
      out.push(add(add(a, b), c))
    }
    out.push(end)
  }
  out.push(pts[pts.length - 1])
  return out
}
