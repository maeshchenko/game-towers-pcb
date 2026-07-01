import { describe, it, expect } from 'vitest'
import { makeRng } from '../../src/pipeline/rng'
import { growDecor, buildDecorWithNets } from '../../src/pipeline/decor'
import { footprintCells } from '../../src/render/decorBuilder'
import { cellKey } from '../../src/geom/grid'

const board = { cols: 40, rows: 30, pitch: 24 }
const trace = { waypoints: [[2, 2], [2, 20], [25, 20]] as [number, number][], cornerRadius: 0.5 }
const spots = [{ cell: [5, 5] as [number, number], score: 5, kind: 'build' as const }]
const specialSpots: never[] = []

/** Build the set of all cells that any item's footprint occupies. */
function itemCells(items: ReturnType<typeof growDecor>): Map<string, string> {
  const map = new Map<string, string>()
  for (const it of items) {
    const fp = footprintCells(it.kind, it.variant, it.rot)
    for (let dx = 0; dx < fp.w; dx++)
      for (let dy = 0; dy < fp.h; dy++)
        map.set(cellKey([it.cell[0] + dx, it.cell[1] + dy]), it.kind)
  }
  return map
}

/** Build the path no-go set the same way blockedCells does (3×3 around each path cell). */
function pathCells(waypoints: [number, number][]): Set<string> {
  const set = new Set<string>()
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1], b = waypoints[i]
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
    for (let k = 0; k <= steps; k++) {
      const t = steps === 0 ? 0 : k / steps
      const cx = Math.round(a[0] + (b[0] - a[0]) * t)
      const cy = Math.round(a[1] + (b[1] - a[1]) * t)
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) set.add(cellKey([cx + dx, cy + dy]))
    }
  }
  return set
}

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = makeRng(42), b = makeRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('differs across seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)())
  })
})

describe('growDecor', () => {
  it('(1) is deterministic for a seed — deep-equal two runs', () => {
    const a = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    const b = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    expect(a).toEqual(b)
  })

  it('(2) produces a non-empty item list', () => {
    const items = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    expect(items.length).toBeGreaterThan(0)
  })

  it('(3) no item footprint (except structural mounts) overlaps a path cell or a spot cell', () => {
    const items = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    const noGo = pathCells(trace.waypoints as [number, number][])
    // add spot 3×3 neighbourhood
    for (const s of spots)
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
        noGo.add(cellKey([s.cell[0] + dx, s.cell[1] + dy]))

    // Mounting holes are structural (always at corners) — they may share space with path/spots
    const nonMount = items.filter(it => it.kind !== 'mount')
    const occupied = itemCells(nonMount)
    for (const [key, kind] of occupied) {
      expect(noGo.has(key), `kind=${kind} footprint cell ${key} is in no-go zone`).toBe(false)
    }
  })

  it('(4) at least one IC (soic/qfp/qfn/dip) has at least one mlcc within 2 cells (decoupling cluster)', () => {
    const items = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    const ICS = ['soic', 'qfp', 'qfn', 'dip']
    const ics = items.filter(it => ICS.includes(it.kind))
    const caps = items.filter(it => it.kind === 'mlcc')

    expect(ics.length).toBeGreaterThan(0)

    let foundCluster = false
    for (const ic of ics) {
      const icFp = footprintCells(ic.kind, ic.variant, ic.rot)
      const icCx = ic.cell[0] + icFp.w / 2
      const icCy = ic.cell[1] + icFp.h / 2
      for (const cap of caps) {
        const capFp = footprintCells(cap.kind, cap.variant, cap.rot)
        const capCx = cap.cell[0] + capFp.w / 2
        const capCy = cap.cell[1] + capFp.h / 2
        const dist = Math.max(Math.abs(capCx - icCx) - (icFp.w + capFp.w) / 2,
                              Math.abs(capCy - icCy) - (icFp.h + capFp.h) / 2)
        if (dist <= 2) { foundCluster = true; break }
      }
      if (foundCluster) break
    }
    expect(foundCluster, 'expected at least one IC with an adjacent mlcc decoupling cap within 2 cells').toBe(true)
  })

  it('(6) exactly 4 mounting holes with refs MH1–MH4', () => {
    const items = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    const mounts = items.filter(it => it.kind === 'mount')
    expect(mounts).toHaveLength(4)
    const refs = new Set(mounts.map(m => m.ref))
    expect(refs).toEqual(new Set(['MH1', 'MH2', 'MH3', 'MH4']))
  })

  it('(5) every IC has a ref starting with "U"', () => {
    const items = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    const ICS = ['soic', 'qfp', 'qfn', 'dip']
    const ics = items.filter(it => ICS.includes(it.kind))
    expect(ics.length).toBeGreaterThan(0)
    for (const ic of ics) {
      expect(ic.ref, `IC kind=${ic.kind} at ${ic.cell} missing ref`).toBeDefined()
      expect(ic.ref!.startsWith('U'), `IC ref "${ic.ref}" does not start with U`).toBe(true)
    }
  })
})

describe('buildDecorWithNets', () => {
  const args = { board, trace, spots, specialSpots, seed: 7 }

  it('returns a non-empty nets array', () => {
    const { nets } = buildDecorWithNets(args)
    expect(nets.length).toBeGreaterThan(0)
  })

  it('all net indices are valid decor indices', () => {
    const { decor, nets } = buildDecorWithNets(args)
    for (const net of nets) {
      for (const idx of net) {
        expect(idx, `net index ${idx} out of range (decor.length=${decor.length})`).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(decor.length)
      }
    }
  })

  it('is deterministic — two runs produce identical decor and nets', () => {
    const a = buildDecorWithNets(args)
    const b = buildDecorWithNets(args)
    expect(a).toEqual(b)
  })

  it('decor matches growDecor output', () => {
    const { decor } = buildDecorWithNets(args)
    const legacy = growDecor(args)
    expect(decor).toEqual(legacy)
  })
})
