import { describe, it, expect } from 'vitest'
import { routeCopper } from '../../src/pipeline/copper'
import type { DecorItem, Board, Trace } from '../../src/model/level'

// ── tiny hand-built level ───────────────────────────────────────────────────

const board: Board = { cols: 20, rows: 20, pitch: 24 }

// Enemy path along the top — well away from the components below
const trace: Trace = {
  waypoints: [[0, 0], [19, 0]] as [number, number][],
  cornerRadius: 0.5,
}

// Two 2×1 resistors separated by a gap
const decor: DecorItem[] = [
  { kind: 'smdRes', variant: 1, cell: [3, 10], rot: 0, scale: 1, ref: 'R1' },
  { kind: 'smdRes', variant: 1, cell: [8, 10], rot: 0, scale: 1, ref: 'R2' },
]

// One net connecting both resistors (decor indices 0 and 1)
const nets: number[][] = [[0, 1]]

// ── helpers ─────────────────────────────────────────────────────────────────

/** Returns true when every consecutive pair in `points` shares a row OR a column. */
function isOrthogonal(points: [number, number][]): boolean {
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]
    const [bx, by] = points[i]
    if (ax !== bx && ay !== by) return false
  }
  return true
}

/** Pad anchors for an smdRes at [cx,cy] rot=0: left=[cx, cy], right=[cx+1, cy]. */
function smdResPads(cell: [number, number]): [[number, number], [number, number]] {
  return [[cell[0], cell[1]], [cell[0] + 1, cell[1]]]
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('routeCopper', () => {
  it('returns at least one Copper polyline for a 2-item net', () => {
    const result = routeCopper({ decor, nets, board, trace })
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('all segments are orthogonal (each pair shares a row or column)', () => {
    const result = routeCopper({ decor, nets, board, trace })
    for (const copper of result) {
      expect(
        isOrthogonal(copper.points as [number, number][]),
        `polyline ${JSON.stringify(copper.points)} is not orthogonal`,
      ).toBe(true)
    }
  })

  it('endpoints land on pad anchors of the two items', () => {
    const result = routeCopper({ decor, nets, board, trace })
    expect(result.length).toBeGreaterThanOrEqual(1)

    const copper = result[0]
    const pA = smdResPads(decor[0].cell as [number, number])
    const pB = smdResPads(decor[1].cell as [number, number])
    const allPads = [...pA, ...pB]

    const startPt = copper.points[0] as [number, number]
    const endPt   = copper.points[copper.points.length - 1] as [number, number]

    // Endpoints are the TRUE (fractional) solder-pad positions of the drawn vintage part,
    // which sit within the item's pad cells — assert proximity, not exact integer identity.
    const isKnownPad = (pt: [number, number]) =>
      allPads.some(([px, py]) => Math.hypot(px - pt[0], py - pt[1]) <= 0.75)

    expect(isKnownPad(startPt), `start ${JSON.stringify(startPt)} is not near a pad anchor`).toBe(true)
    expect(isKnownPad(endPt),   `end   ${JSON.stringify(endPt)} is not near a pad anchor`).toBe(true)
  })

  it('is deterministic — two calls with the same inputs return identical results', () => {
    const a = routeCopper({ decor, nets, board, trace })
    const b = routeCopper({ decor, nets, board, trace })
    expect(a).toEqual(b)
  })

  it('returns empty array when nets is undefined', () => {
    const result = routeCopper({ decor, nets: undefined, board, trace })
    expect(result).toEqual([])
  })

  it('returns empty array when nets is empty', () => {
    const result = routeCopper({ decor, nets: [], board, trace })
    expect(result).toEqual([])
  })

  it('skips degenerate single-item nets', () => {
    const result = routeCopper({ decor, nets: [[0]], board, trace })
    expect(result).toEqual([])
  })
})

// ── level round-trip with optional copper field ───────────────────────────

import { serializeLevel, parseLevel, type Level } from '../../src/model/level'

describe('level round-trip with copper', () => {
  const baseSample: Level = {
    version: 1,
    board: { cols: 20, rows: 20, pitch: 24 },
    seed: 42,
    trace: { waypoints: [[0, 0], [19, 0]], cornerRadius: 0.5 },
    spots: [],
    specialSpots: [],
    decor,
    nets,
    meta: { name: 'Test', difficulty: 1 },
  }

  it('round-trips a level WITHOUT copper field', () => {
    expect(parseLevel(serializeLevel(baseSample))).toEqual(baseSample)
  })

  it('round-trips a level WITH copper field', () => {
    const withCopper: Level = {
      ...baseSample,
      copper: [{ points: [[3, 10], [8, 10], [8, 10]] }],
    }
    expect(parseLevel(serializeLevel(withCopper))).toEqual(withCopper)
  })
})
