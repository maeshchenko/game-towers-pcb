import { expect } from 'vitest'
import type { Level } from '../../src/model/level'
import { padAnchors } from '../../src/render/decorBuilder'
import { evaluate } from '../../src/game/balance'

export function assertOneFinish(level: Level): void {
  const paths = level.paths && level.paths.length ? level.paths : [level.trace]
  const fin = new Set(paths.map((p) => {
    const w = p.waypoints[p.waypoints.length - 1]; return `${w[0]},${w[1]}`
  }))
  expect(fin.size, 'exactly one finish').toBe(1)
}

/**
 * Every copper polyline must START and END at (or within a sub-cell snap of) a real decor pad anchor —
 * i.e. wires lead component-to-component, never dangling into empty space. Tolerance `TOL` cells
 * absorbs the routeCopper sub-cell snap; a genuinely floating end would be many cells from any pad.
 */
export function assertCopperEndpointsOnPads(level: Level, tol = 1.5): void {
  const anchors: Array<[number, number]> = []
  for (const it of level.decor) for (const a of padAnchors(it)) anchors.push([a[0], a[1]])
  const nearPad = (p: [number, number]): number => {
    let m = Infinity
    for (const a of anchors) m = Math.min(m, Math.hypot(p[0] - a[0], p[1] - a[1]))
    return m
  }
  for (const c of level.copper ?? []) {
    expect(c.points.length, 'copper has >=2 points').toBeGreaterThanOrEqual(2)
    const a = c.points[0], b = c.points[c.points.length - 1]
    expect(nearPad(a), `copper start ${JSON.stringify(a)} near a pad`).toBeLessThanOrEqual(tol)
    expect(nearPad(b), `copper end ${JSON.stringify(b)} near a pad`).toBeLessThanOrEqual(tol)
  }
}

export function assertWinnable(level: Level, lo = 0.1, hi = 0.7): { won: boolean; pressure: number } {
  const v = evaluate(level, level.seed)
  expect(v.won, `level winnable by basic defence (pressure ${v.pressure.toFixed(2)})`).toBe(true)
  expect(v.pressure, 'pressure >= lo').toBeGreaterThanOrEqual(lo)
  expect(v.pressure, 'pressure <= hi').toBeLessThanOrEqual(hi)
  return v
}
