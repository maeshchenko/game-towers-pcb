/**
 * Copper trace router.
 *
 * For each electrical net (list of decor indices), builds L-shaped orthogonal
 * polylines connecting the closest pad pairs of consecutive items.
 * Bend cells are chosen to avoid component bodies and the enemy-path corridor
 * where possible.
 */

import type { Level, DecorItem } from '../model/level'
import { footprintCells } from '../render/decorBuilder'
import { padAnchors } from '../render/decorBuilder'

export interface Copper {
  /** Grid-cell coordinates forming a polyline (3 points for an L-route: A → bend → B). */
  points: [number, number][]
}

// ---------- helpers ----------

function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

/** Manhattan distance between two cells. */
function manhattan(a: [number, number], b: [number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

/** Build a set of all cells occupied by component bodies. */
function buildBodySet(decor: DecorItem[]): Set<string> {
  const set = new Set<string>()
  for (const item of decor) {
    const fp = footprintCells(item.kind, item.variant, item.rot)
    for (let dx = 0; dx < fp.w; dx++)
      for (let dy = 0; dy < fp.h; dy++)
        set.add(cellKey(item.cell[0] + dx, item.cell[1] + dy))
  }
  return set
}

/** Build a set of cells on the enemy-path corridor (segment-by-segment rasterisation). */
function buildPathSet(waypoints: [number, number][]): Set<string> {
  const set = new Set<string>()
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1], b = waypoints[i]
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
    for (let k = 0; k <= steps; k++) {
      const t = steps === 0 ? 0 : k / steps
      const px = Math.round(a[0] + (b[0] - a[0]) * t)
      const py = Math.round(a[1] + (b[1] - a[1]) * t)
      set.add(cellKey(px, py))
    }
  }
  return set
}

// ---------- public API ----------

export function routeCopper(
  level: Pick<Level, 'decor' | 'nets' | 'board' | 'trace' | 'paths'>,
): Copper[] {
  const { decor, nets, trace } = level
  if (!nets || nets.length === 0) return []

  const bodyCells = buildBodySet(decor)
  // Use ALL enemy paths as no-go corridor (not just trace)
  const allPaths = level.paths && level.paths.length > 0 ? level.paths : [trace]
  const pathCells = new Set<string>()
  for (const p of allPaths)
    for (const k of buildPathSet(p.waypoints)) pathCells.add(k)

  // Combined obstacle set used to prefer "clear" bend cells
  const blocked = new Set<string>()
  for (const k of bodyCells) blocked.add(k)
  for (const k of pathCells) blocked.add(k)

  const result: Copper[] = []

  for (const net of nets) {
    if (net.length < 2) continue

    for (let ni = 0; ni < net.length - 1; ni++) {
      const idxA = net[ni]
      const idxB = net[ni + 1]

      const itemA = decor[idxA]
      const itemB = decor[idxB]
      if (!itemA || !itemB) continue

      const anchorsA = padAnchors(itemA)
      const anchorsB = padAnchors(itemB)
      if (anchorsA.length === 0 || anchorsB.length === 0) continue

      // Find closest pad pair by Manhattan distance
      let bestA = anchorsA[0]
      let bestB = anchorsB[0]
      let bestDist = Infinity

      for (const a of anchorsA) {
        for (const b of anchorsB) {
          const d = manhattan(a, b)
          if (d < bestDist) {
            bestDist = d
            bestA = a
            bestB = b
          }
        }
      }

      // Skip degenerate (same cell) connections
      if (bestDist === 0) continue

      const [ax, ay] = bestA
      const [bx, by] = bestB

      // Candidate bend cells for the two L-route orientations
      const bendHV: [number, number] = [bx, ay]  // horizontal-then-vertical
      const bendVH: [number, number] = [ax, by]  // vertical-then-horizontal

      const hBlocked = blocked.has(cellKey(bendHV[0], bendHV[1]))
      const vBlocked = blocked.has(cellKey(bendVH[0], bendVH[1]))

      let bend: [number, number]
      if (!hBlocked) {
        bend = bendHV
      } else if (!vBlocked) {
        bend = bendVH
      } else {
        // Both obstructed — fall back to horizontal-then-vertical
        bend = bendHV
      }

      result.push({ points: [bestA, bend, bestB] })
    }
  }

  return result
}
