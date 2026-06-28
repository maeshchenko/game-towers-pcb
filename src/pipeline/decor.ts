import type { Board, Trace, TowerSpot, DecorItem } from '../model/level'
import type { Cell } from '../geom/types'
import { cellKey } from '../geom/grid'
import { makeRng } from './rng'

interface Spec { kind: string; w: number; h: number; variants: number[]; weight: number }
const SPECS: Spec[] = [
  { kind: 'qfp', w: 4, h: 4, variants: [32, 44, 64], weight: 1 },
  { kind: 'soic', w: 3, h: 2, variants: [8, 14, 16], weight: 2 },
  { kind: 'dip', w: 5, h: 2, variants: [8, 16], weight: 1 },
  { kind: 'electrolytic', w: 2, h: 2, variants: [1], weight: 2 },
  { kind: 'smdRes', w: 2, h: 1, variants: [1], weight: 4 },
  { kind: 'smdCap', w: 1, h: 1, variants: [1], weight: 4 },
  { kind: 'via', w: 1, h: 1, variants: [1], weight: 3 },
]

function blockedCells(trace: Trace, spots: TowerSpot[], specials: TowerSpot[]): Set<string> {
  const set = new Set<string>()
  const wp = trace.waypoints
  for (let i = 1; i < wp.length; i++) {
    const a = wp[i - 1], b = wp[i]
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
    for (let k = 0; k <= steps; k++) {
      const t = steps === 0 ? 0 : k / steps
      const cx = Math.round(a[0] + (b[0] - a[0]) * t)
      const cy = Math.round(a[1] + (b[1] - a[1]) * t)
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) set.add(cellKey([cx + dx, cy + dy]))
    }
  }
  for (const s of [...spots, ...specials])
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) set.add(cellKey([s.cell[0] + dx, s.cell[1] + dy]))
  return set
}

function weightedPick(rng: () => number): Spec {
  const total = SPECS.reduce((a, s) => a + s.weight, 0)
  let r = rng() * total
  for (const s of SPECS) { r -= s.weight; if (r <= 0) return s }
  return SPECS[SPECS.length - 1]
}

export function growDecor(args: {
  board: Board; trace: Trace; spots: TowerSpot[]; specialSpots: TowerSpot[]; seed: number
}): DecorItem[] {
  const rng = makeRng(args.seed)
  const occupied = blockedCells(args.trace, args.spots, args.specialSpots)
  const items: DecorItem[] = []
  const fits = (cell: Cell, w: number, h: number): boolean => {
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) {
      const c: Cell = [cell[0] + dx, cell[1] + dy]
      if (c[0] >= args.board.cols || c[1] >= args.board.rows) return false
      if (occupied.has(cellKey(c))) return false
    }
    return true
  }
  const mark = (cell: Cell, w: number, h: number) => {
    for (let dx = -1; dx <= w; dx++) for (let dy = -1; dy <= h; dy++) occupied.add(cellKey([cell[0] + dx, cell[1] + dy]))
  }
  const attempts = args.board.cols * args.board.rows
  for (let i = 0; i < attempts; i++) {
    const spec = weightedPick(rng)
    const rot = (rng() < 0.5 ? 0 : 90) as 0 | 90
    const w = rot === 90 ? spec.h : spec.w
    const h = rot === 90 ? spec.w : spec.h
    const cell: Cell = [Math.floor(rng() * args.board.cols), Math.floor(rng() * args.board.rows)]
    if (!fits(cell, w, h)) continue
    const variant = spec.variants[Math.floor(rng() * spec.variants.length)]
    items.push({ kind: spec.kind, variant, cell, rot, scale: 1 })
    mark(cell, w, h)
  }
  return items
}
