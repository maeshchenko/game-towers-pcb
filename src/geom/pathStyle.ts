import type { Cell } from './types'

// Octilinear path styling: makes generated routes look like real PCB traces — long straights get
// mid-run jogs (lateral bumps with 45° sides) and 90° corners get 45° chamfers. All transforms keep
// the FIRST and LAST waypoints fixed (so the one-finish invariant + start/finish stay intact) and
// only ever move along an axis or a 45° diagonal (stays octilinear).

function dedupe(wp: Cell[]): Cell[] {
  return wp.filter((c, i) => i === 0 || c[0] !== wp[i - 1][0] || c[1] !== wp[i - 1][1])
}

/** Collapse runs of collinear points so each straight run is a single long segment (jog needs this). */
export function mergeCollinear(wp: Cell[]): Cell[] {
  const d = dedupe(wp)
  if (d.length < 3) return d
  const out: Cell[] = [d[0]]
  for (let i = 1; i < d.length - 1; i++) {
    const a = out[out.length - 1], b = d[i], c = d[i + 1]
    const d1x = Math.sign(b[0] - a[0]), d1y = Math.sign(b[1] - a[1])
    const d2x = Math.sign(c[0] - b[0]), d2y = Math.sign(c[1] - b[1])
    if (d1x !== d2x || d1y !== d2y) out.push(b) // direction changes → keep the corner
  }
  out.push(d[d.length - 1])
  return out
}

/** Replace each 90° corner with a 45° chamfer of up to `cut` cells. */
export function chamferCorners(wp: Cell[], cut: number): Cell[] {
  if (wp.length < 3 || cut < 1) return wp
  const out: Cell[] = [wp[0]]
  for (let i = 1; i < wp.length - 1; i++) {
    const a = wp[i - 1], b = wp[i], c = wp[i + 1]
    const inH = b[1] === a[1], inV = b[0] === a[0]
    const outH = c[1] === b[1], outV = c[0] === b[0]
    const is90 = (inH && outV) || (inV && outH) // one axis in, the other out
    const lenIn = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
    const lenOut = Math.max(Math.abs(c[0] - b[0]), Math.abs(c[1] - b[1]))
    const k = Math.min(cut, Math.floor(lenIn / 2), Math.floor(lenOut / 2))
    if (is90 && k >= 1) {
      const inDir: Cell = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])]
      const outDir: Cell = [Math.sign(c[0] - b[0]), Math.sign(c[1] - b[1])]
      out.push([b[0] - inDir[0] * k, b[1] - inDir[1] * k])
      out.push([b[0] + outDir[0] * k, b[1] + outDir[1] * k])
    } else out.push(b)
  }
  out.push(wp[wp.length - 1])
  return dedupe(out)
}

/**
 * Break straight runs longer than `minLen` cells with a lateral bump of amplitude `amp`
 * (45° out, offset straight, 45° back). Deterministic via `rng` (bump direction). Endpoints fixed.
 */
export function jogStraights(wp: Cell[], minLen: number, amp: number, rng: () => number): Cell[] {
  if (wp.length < 2) return wp
  const out: Cell[] = [wp[0]]
  for (let i = 1; i < wp.length; i++) {
    const a = wp[i - 1], b = wp[i]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const horizontal = dy === 0 && dx !== 0
    const vertical = dx === 0 && dy !== 0
    const L = Math.max(Math.abs(dx), Math.abs(dy))
    // need room for the bump: (m-2d) + d + 2d + d ≈ m+2d ≤ L
    if ((horizontal || vertical) && L >= minLen && L >= 6 * amp) {
      const along: Cell = [Math.sign(dx), Math.sign(dy)]
      const side = rng() < 0.5 ? 1 : -1
      const perp: Cell = horizontal ? [0, side] : [side, 0]
      const d = amp
      const m = Math.floor(L / 2)
      const at = (n: number): Cell => [a[0] + along[0] * n, a[1] + along[1] * n]
      const a0 = at(m - 2 * d)
      const a1: Cell = [a0[0] + (along[0] + perp[0]) * d, a0[1] + (along[1] + perp[1]) * d] // 45° out
      const a2: Cell = [a1[0] + along[0] * 2 * d, a1[1] + along[1] * 2 * d]                 // offset straight
      const a3: Cell = [a2[0] + (along[0] - perp[0]) * d, a2[1] + (along[1] - perp[1]) * d] // 45° back to line
      out.push(a0, a1, a2, a3)
    }
    out.push(b)
  }
  return dedupe(out)
}

/** Full styling pass: jog long straights, then chamfer the remaining 90° corners. */
export function stylePath(wp: Cell[], rng: () => number, opts?: { jogMinLen?: number; jogAmp?: number; chamfer?: number }): Cell[] {
  const merged = mergeCollinear(wp)
  const jogged = jogStraights(merged, opts?.jogMinLen ?? 12, opts?.jogAmp ?? 2, rng)
  return chamferCorners(jogged, opts?.chamfer ?? 2)
}
