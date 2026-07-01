import { describe, it, expect } from 'vitest'
import { buildTileGrid } from '../../src/tiles/generator'
import { compileRoutes } from '../../src/tiles/compile'
import { isOctilinear, octilinearize } from '../../src/geom/octilinear'
import { generateLevel, minSpots } from '../../src/pipeline/generator'

const board = { cols: 48, rows: 36, pitch: 24 }
const ARCHETYPES = ['serpentineH', 'serpentineV', 'spiral', 'branching', 'multiSpawn', 'cross']

describe('tile generator', () => {
  it('every archetype compiles to >=1 connected octilinear route', () => {
    for (const a of ARCHETYPES) {
      for (let seed = 0; seed < 12; seed++) {
        const { grid } = buildTileGrid(board, 4, seed, a)
        const routes = compileRoutes(grid)
        expect(routes.length).toBeGreaterThanOrEqual(1)
        for (const r of routes) {
          const wp = octilinearize(r.waypoints)
          expect(wp.length).toBeGreaterThanOrEqual(2)
          for (let i = 1; i < wp.length; i++) expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
        }
      }
    }
  })
  it('multiSpawn/branching/cross produce multiple routes', () => {
    for (const a of ['branching', 'multiSpawn', 'cross']) {
      const { grid } = buildTileGrid(board, 5, 1, a)
      expect(compileRoutes(grid).length).toBeGreaterThanOrEqual(2)
    }
  })
  it('generateLevel sets tiles + derived paths + spots; deterministic', () => {
    const lvl = generateLevel({ board, difficulty: 4, seed: 7 })
    expect(lvl.tiles).toBeTruthy()
    expect(lvl.paths!.length).toBeGreaterThanOrEqual(1)
    expect(lvl.spots.length + lvl.specialSpots.length).toBeGreaterThanOrEqual(minSpots(4))
    expect(generateLevel({ board, difficulty: 4, seed: 7 })).toEqual(lvl)
  })
})

describe('generator robustness across boards/archetypes/difficulty', () => {
  const BOARDS = [
    { cols: 32, rows: 24, pitch: 24 }, // S
    { cols: 48, rows: 36, pitch: 24 }, // M
    { cols: 64, rows: 48, pitch: 24 }, // L
    { cols: 96, rows: 72, pitch: 24 }, // XL
  ]
  const ARCHES = ['serpentineH', 'serpentineV', 'spiral', 'branching', 'multiSpawn', 'cross']
  it('never throws and always yields connected octilinear routes to one finish', () => {
    for (const board of BOARDS)
      for (const a of ARCHES)
        for (const d of [0, 3, 6, 9])
          for (let s = 0; s < 4; s++) {
            const { grid } = buildTileGrid(board, d, s, a)
            const routes = compileRoutes(grid)
            expect(routes.length, `${board.cols}x${board.rows} ${a} d${d} s${s}`).toBeGreaterThanOrEqual(1)
            const finishes = new Set<string>()
            for (const r of routes) {
              const wp = octilinearize(r.waypoints)
              expect(wp.length).toBeGreaterThanOrEqual(2)
              for (let i = 1; i < wp.length; i++) expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
              finishes.add(wp[wp.length - 1].join(','))
            }
            expect(finishes.size, `${a} one finish`).toBe(1)
          }
  })
})
