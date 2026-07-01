import type { Cell, Pt } from './types'
import { cellToPx, dist } from './grid'

export function pathSamples(waypoints: Cell[], pitch: number, stepCells = 0.5): Pt[] {
  const out: Pt[] = []
  const step = stepCells * pitch
  const pts = waypoints.map((c) => cellToPx(c, pitch))
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const segLen = dist(a, b)
    const n = Math.max(1, Math.round(segLen / step))
    for (let k = 0; k < n; k++) {
      const t = k / n
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

export function coverage(cell: Cell, rangeCells: number, samples: Pt[], pitch: number): number {
  const center = cellToPx(cell, pitch)
  const range = rangeCells * pitch
  let c = 0
  for (const s of samples) if (dist(center, s) <= range) c++
  return c
}
