import { describe, it, expect } from 'vitest'
import { AUTHORED_LEVELS } from '../../src/levels'
import { footprintCells } from '../../src/render/decorBuilder'
import { levelPaths } from '../../src/model/level'

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

    it(`level ${n}: every decor footprint cell stays within board bounds`, () => {
      const lvl = build(boards[i])
      const { cols, rows } = lvl.board
      for (const it of lvl.decor) {
        const fp = footprintCells(it.kind, it.variant, it.rot)
        for (let dx = 0; dx < fp.w; dx++) {
          for (let dy = 0; dy < fp.h; dy++) {
            const cx = it.cell[0] + dx, cy = it.cell[1] + dy
            expect(
              cx >= 0 && cx < cols && cy >= 0 && cy < rows,
              `level ${n}: decor ${it.kind}@${it.cell} footprint cell ${cx},${cy} is outside board bounds (${cols}x${rows})`,
            ).toBe(true)
          }
        }
      }
    })

    it(`level ${n}: no decor footprint cell sits on or beside a path cell (1-cell margin, mounts exempt)`, () => {
      const lvl = build(boards[i])
      // Rasterize every waypoint segment of every enemy path into a set of path cells (same
      // technique as the copper/spot occupancy test above), then dilate by 1 ring for the margin.
      const pathSet = new Set<string>()
      for (const trace of levelPaths(lvl)) {
        const wp = trace.waypoints
        for (let k = 1; k < wp.length; k++) {
          const [ax, ay] = wp[k - 1]
          const [bx, by] = wp[k]
          const dx = bx - ax, dy = by - ay
          const len = Math.hypot(dx, dy)
          const steps = Math.max(1, Math.ceil(len / 0.25))
          for (let s = 0; s <= steps; s++) {
            const t = s / steps
            const cx = Math.floor(ax + dx * t)
            const cy = Math.floor(ay + dy * t)
            pathSet.add(`${cx},${cy}`)
          }
        }
      }
      const nearPath = (cx: number, cy: number): boolean => {
        for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
          if (gx !== 0 && gy !== 0) continue // orthogonal adjacency only (+ the cell itself)
          if (pathSet.has(`${cx + gx},${cy + gy}`)) return true
        }
        return false
      }

      for (const it of lvl.decor) {
        if (it.kind === 'mount') continue // mounting holes are exempt
        const fp = footprintCells(it.kind, it.variant, it.rot)
        for (let dx = 0; dx < fp.w; dx++) {
          for (let dy = 0; dy < fp.h; dy++) {
            const cx = it.cell[0] + dx, cy = it.cell[1] + dy
            expect(
              nearPath(cx, cy),
              `level ${n}: decor ${it.kind}@${it.cell} footprint cell ${cx},${cy} is on or adjacent to the enemy path`,
            ).toBe(false)
          }
        }
      }
    })
  })
})
