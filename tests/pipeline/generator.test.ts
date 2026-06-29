import { describe, it, expect } from 'vitest'
import { generateLevel, minSpots, ARCHETYPES } from '../../src/pipeline/generator'
import { isOctilinear } from '../../src/geom/octilinear'

const MULTI_PATH_ARCHETYPES = new Set(['branching', 'multiSpawn', 'multiLane', 'cross'])

describe('generateLevel', () => {
  const board = { cols: 48, rows: 36, pitch: 24 }

  it('produces a valid octilinear connected trace', () => {
    const lvl = generateLevel({ board, difficulty: 3, seed: 1 })
    const wp = lvl.trace.waypoints
    expect(wp.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < wp.length; i++) expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
  })

  it('sets paths with trace as paths[0]', () => {
    const lvl = generateLevel({ board, difficulty: 3, seed: 1 })
    expect(lvl.paths).toBeDefined()
    expect(lvl.paths!.length).toBeGreaterThan(0)
    expect(lvl.paths![0]).toEqual(lvl.trace)
  })

  it('is deterministic per seed', () => {
    expect(generateLevel({ board, difficulty: 3, seed: 99 }))
      .toEqual(generateLevel({ board, difficulty: 3, seed: 99 }))
  })

  it('solvability invariant holds over 100 seeds', () => {
    for (let seed = 0; seed < 100; seed++) {
      const lvl = generateLevel({ board, difficulty: 4, seed })
      const allPaths = lvl.paths ?? [lvl.trace]
      for (const p of allPaths) {
        const wp = p.waypoints
        expect(wp.length).toBeGreaterThanOrEqual(2)
        for (let i = 1; i < wp.length; i++) expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
      }
      expect(lvl.spots.length + lvl.specialSpots.length).toBeGreaterThanOrEqual(minSpots(4))
      expect(ARCHETYPES as readonly string[]).toContain(lvl.meta.archetype)
    }
  })

  it('selector spans ≥5 distinct archetypes across 100 seeds', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 100; seed++) {
      const lvl = generateLevel({ board, difficulty: 4, seed })
      seen.add(lvl.meta.archetype!)
    }
    expect(seen.size).toBeGreaterThanOrEqual(5)
  })

  it('all archetypes are exercised across 100 seeds at difficulty 4', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 100; seed++) {
      const lvl = generateLevel({ board, difficulty: 4, seed })
      seen.add(lvl.meta.archetype!)
    }
    for (const arch of ARCHETYPES) expect(seen).toContain(arch)
  })

  describe('archetype override', () => {
    for (const arch of ARCHETYPES) {
      it(`${arch}: octilinear, bounding-box (union), spot count`, () => {
        for (let seed = 0; seed < 5; seed++) {
          const lvl = generateLevel({ board, difficulty: 3, seed, archetype: arch })
          const allPaths = lvl.paths ?? [lvl.trace]

          // Every path: ≥2 waypoints, all consecutive pairs octilinear
          for (const p of allPaths) {
            expect(p.waypoints.length).toBeGreaterThanOrEqual(2)
            for (let i = 1; i < p.waypoints.length; i++)
              expect(isOctilinear(p.waypoints[i - 1], p.waypoints[i])).toBe(true)
          }

          // Bounding box across ALL paths combined must span ≥60% of board
          const allWp = allPaths.flatMap(p => p.waypoints)
          const xs = allWp.map(c => c[0])
          const ys = allWp.map(c => c[1])
          expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(board.cols * 0.6)
          expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(board.rows * 0.6)

          expect(lvl.meta.archetype).toBe(arch)
          expect(lvl.spots.length + lvl.specialSpots.length).toBeGreaterThanOrEqual(minSpots(3))

          // Multi-path archetypes must have ≥2 paths
          if (MULTI_PATH_ARCHETYPES.has(arch)) {
            expect(allPaths.length).toBeGreaterThanOrEqual(2)
          }
        }
      })
    }

    it('multiSpawn: all paths share the same final (base) cell', () => {
      for (let seed = 0; seed < 5; seed++) {
        const lvl = generateLevel({ board, difficulty: 4, seed, archetype: 'multiSpawn' })
        const allPaths = lvl.paths!
        expect(allPaths.length).toBeGreaterThanOrEqual(2)
        const lastOf = (p: typeof allPaths[0]) => p.waypoints[p.waypoints.length - 1]
        const base = lastOf(allPaths[0])
        for (const p of allPaths) expect(lastOf(p)).toEqual(base)
      }
    })

    it('branching: both paths share START and FINISH cells', () => {
      for (let seed = 0; seed < 5; seed++) {
        const lvl = generateLevel({ board, difficulty: 3, seed, archetype: 'branching' })
        const [pA, pB] = lvl.paths!
        expect(pA.waypoints[0]).toEqual(pB.waypoints[0])
        const lastA = pA.waypoints[pA.waypoints.length - 1]
        const lastB = pB.waypoints[pB.waypoints.length - 1]
        expect(lastA).toEqual(lastB)
      }
    })
  })
})
