import { describe, it, expect } from 'vitest'
import { AUTHORED_LEVELS } from '../../src/levels'
import { footprintCells } from '../../src/render/decorBuilder'

// Occupancy: copper traces and decor footprints must never sit on a tower spot / special-spot cell —
// otherwise the build octagon renders on top of a wire or a component body ("занятость" per plan Task A).

const B24 = { cols: 24, rows: 18, pitch: 30 }
const B32 = { cols: 32, rows: 24, pitch: 30 }
const B44 = { cols: 44, rows: 33, pitch: 30 }
const B60 = { cols: 60, rows: 45, pitch: 30 }
const boards = [B24, B24, B32, B32, B32, B44, B44, B44, B60, B60, B60, B60]

describe('authored levels: copper and decor stay off tower spots', () => {
  AUTHORED_LEVELS.forEach((build, i) => {
    const n = String(i + 1).padStart(2, '0')

    it(`level ${n}: no copper segment passes through a spot cell`, () => {
      const lvl = build(boards[i])
      const spotSet = new Set<string>()
      for (const s of [...lvl.spots, ...lvl.specialSpots]) spotSet.add(`${s.cell[0]},${s.cell[1]}`)

      for (const copper of lvl.copper ?? []) {
        const pts = copper.points
        for (let k = 1; k < pts.length; k++) {
          const [ax, ay] = pts[k - 1]
          const [bx, by] = pts[k]
          const dx = bx - ax, dy = by - ay
          const len = Math.hypot(dx, dy)
          const steps = Math.max(1, Math.ceil(len / 0.25))
          for (let s = 0; s <= steps; s++) {
            const t = s / steps
            const cx = Math.floor(ax + dx * t)
            const cy = Math.floor(ay + dy * t)
            expect(
              spotSet.has(`${cx},${cy}`),
              `level ${n}: copper segment [${ax},${ay}]->[${bx},${by}] crosses spot cell ${cx},${cy}`,
            ).toBe(false)
          }
        }
      }
    })

    it(`level ${n}: no decor footprint cell overlaps a spot cell`, () => {
      const lvl = build(boards[i])
      const spotSet = new Set<string>()
      for (const s of [...lvl.spots, ...lvl.specialSpots]) spotSet.add(`${s.cell[0]},${s.cell[1]}`)

      for (const it of lvl.decor) {
        const fp = footprintCells(it.kind, it.variant, it.rot)
        for (let dx = 0; dx < fp.w; dx++) {
          for (let dy = 0; dy < fp.h; dy++) {
            const cx = it.cell[0] + dx, cy = it.cell[1] + dy
            expect(
              spotSet.has(`${cx},${cy}`),
              `level ${n}: decor ${it.kind}@${it.cell} footprint cell ${cx},${cy} overlaps a spot`,
            ).toBe(false)
          }
        }
      }
    })
  })
})
