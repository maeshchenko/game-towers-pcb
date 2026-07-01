import type { Cell } from './types'

export function isOctilinear(a: Cell, b: Cell): boolean {
  const dx = Math.abs(b[0] - a[0])
  const dy = Math.abs(b[1] - a[1])
  if (dx === 0 && dy === 0) return false
  return dx === 0 || dy === 0 || dx === dy
}

function corner(a: Cell, b: Cell): Cell {
  // Diagonal run as long as possible, then straight. Corner = end of diagonal run.
  const sx = Math.sign(b[0] - a[0])
  const sy = Math.sign(b[1] - a[1])
  const diag = Math.min(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
  return [a[0] + sx * diag, a[1] + sy * diag]
}

export function octilinearize(points: Cell[]): Cell[] {
  const out: Cell[] = []
  const push = (c: Cell) => {
    const last = out[out.length - 1]
    if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c)
  }
  for (let i = 0; i < points.length; i++) {
    const cur = points[i]
    if (i === 0) { push(cur); continue }
    const prev = out[out.length - 1] ?? points[i - 1]
    if (!isOctilinear(prev, cur)) push(corner(prev, cur))
    push(cur)
  }
  return out
}
