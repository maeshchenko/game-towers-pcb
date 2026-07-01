// Shared copper-trace styling for /kit2 AND the in-game board, so wiring everywhere reads like a real
// PCB: 90° corners chamfered to 45° (chamfer45) then rounded (filletPixels), drawn as a dark relief
// bed + bright copper core (strokeCopper), merging into pads with a teardrop fillet (teardrop).
// Operates on PIXEL polylines (Pt[]) — callers in cells convert first.
import type { Graphics } from 'pixi.js'
import type { Pt } from '../geom/types'

function sub(a: Pt, b: Pt): Pt { return { x: a.x - b.x, y: a.y - b.y } }
function add(a: Pt, b: Pt): Pt { return { x: a.x + b.x, y: a.y + b.y } }
function scale(a: Pt, s: number): Pt { return { x: a.x * s, y: a.y * s } }
function len(a: Pt): number { return Math.hypot(a.x, a.y) }
function norm(a: Pt): Pt { const l = len(a) || 1; return { x: a.x / l, y: a.y / l } }

/** Drop consecutive duplicate points. */
function dedupe(pts: Pt[]): Pt[] {
  return pts.filter((p, i) => i === 0 || Math.abs(p.x - pts[i - 1].x) > 0.01 || Math.abs(p.y - pts[i - 1].y) > 0.01)
}

/**
 * Replace each ~90° axis-aligned corner with a 45° chamfer of up to `cut` px (pixel port of
 * geom/pathStyle.chamferCorners). Diagonal/obtuse corners are left untouched. Endpoints fixed.
 */
export function chamfer45(input: Pt[], cut: number): Pt[] {
  const pts = dedupe(input)
  if (pts.length < 3 || cut <= 0) return pts
  const out: Pt[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1]
    const inV = sub(b, a), outV = sub(c, b)
    const inDir = norm(inV), outDir = norm(outV)
    const inAxis = Math.abs(inDir.x) < 0.01 || Math.abs(inDir.y) < 0.01
    const outAxis = Math.abs(outDir.x) < 0.01 || Math.abs(outDir.y) < 0.01
    const perp = Math.abs(inDir.x * outDir.x + inDir.y * outDir.y) < 0.01 // ~90°
    const k = Math.min(cut, len(inV) / 2, len(outV) / 2)
    if (inAxis && outAxis && perp && k >= 1) {
      out.push(sub(b, scale(inDir, k)))   // leave corner early (45° start)
      out.push(add(b, scale(outDir, k)))  // rejoin after (45° end)
    } else out.push(b)
  }
  out.push(pts[pts.length - 1])
  return dedupe(out)
}

/** Round every interior vertex with a quadratic-Bézier fillet (pixel sibling of geom/fillet.filletPath). */
export function filletPixels(pts: Pt[], radius: number, arcSteps = 6): Pt[] {
  if (pts.length < 3) return pts
  const out: Pt[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], cur = pts[i], next = pts[i + 1]
    const inDir = norm(sub(cur, prev)), outDir = norm(sub(next, cur))
    const r = Math.min(radius, len(sub(cur, prev)) / 2, len(sub(next, cur)) / 2)
    const start = sub(cur, scale(inDir, r)), end = add(cur, scale(outDir, r))
    out.push(start)
    for (let s = 1; s < arcSteps; s++) {
      const t = s / arcSteps
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

export interface CopperStyle {
  core: number           // bright copper colour
  width: number          // core stroke width
  alpha?: number         // core alpha (default 0.9)
  bed?: number           // dark relief channel colour under the core (default: skip)
  bedAlpha?: number      // bed alpha (default 0.5)
  bedMul?: number        // bed width = width * bedMul (default 2.0)
  teardrop?: { r: number; color: number; alpha?: number } // teardrop fillet at both endpoints
}

/** Stroke a polyline as a PCB copper trace: dark relief bed + bright core, optional teardrop pads. */
export function strokeCopper(g: Graphics, pts: Pt[], style: CopperStyle): void {
  if (pts.length < 2) return
  const line = (w: number, color: number, alpha: number) => {
    g.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
    g.stroke({ color, width: w, alpha, cap: 'round', join: 'round' })
  }
  if (style.bed !== undefined) line(style.width * (style.bedMul ?? 2.0), style.bed, style.bedAlpha ?? 0.5)
  line(style.width, style.core, style.alpha ?? 0.9)
  if (style.teardrop) {
    const t = style.teardrop
    teardrop(g, pts[0], norm(sub(pts[1], pts[0])), t.r, style.width, t.color, t.alpha)
    const n = pts.length - 1
    teardrop(g, pts[n], norm(sub(pts[n - 1], pts[n])), t.r, style.width, t.color, t.alpha)
  }
}

/**
 * Teardrop fillet where a trace meets a pad: a trapezoid fattening from the trace width out to the
 * pad ring, so the junction looks moulded (IPC teardrop) instead of a flat dot. `dir` points from the
 * pad INTO the trace; `rPad` ≈ pad radius; `trackW` = trace width.
 */
export function teardrop(g: Graphics, pad: Pt, dir: Pt, rPad: number, trackW: number, color: number, alpha = 0.9): void {
  const perp = { x: -dir.y, y: dir.x }
  const baseHalf = rPad * 0.95
  const tip = add(pad, scale(dir, rPad * 2.6))
  const tipHalf = Math.max(trackW / 2, 0.6)
  const p1 = add(pad, scale(perp, baseHalf))
  const p2 = add(tip, scale(perp, tipHalf))
  const p3 = sub(tip, scale(perp, tipHalf))
  const p4 = sub(pad, scale(perp, baseHalf))
  g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y).lineTo(p4.x, p4.y).closePath().fill({ color, alpha })
}
