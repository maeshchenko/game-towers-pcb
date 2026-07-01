import type { Level, DecorItem } from '../model/level'
import { footprintCells, padAnchors } from '../render/decorBuilder'
import { routeOctilinear } from '../geom/router'
import type { Cell } from '../geom/types'
import { VFOOT, vintageLeadEnds, type VintageKind } from '../render/vintageDecor'

export interface Copper {
  points: [number, number][]
}

const VINTAGE_MAP: Record<string, VintageKind> = {
  soic: 'dipIC', qfp: 'dipIC', qfn: 'dipIC', dip: 'dipIC',
  res: 'resAxial', smdRes: 'resAxial', inductor: 'inductorAxial',
  smdCap: 'ceramicDisc', mlcc: 'ceramicDisc',
  electrolytic: 'electroRadial', elec: 'electroRadial', tant: 'tantalum', tantalum: 'tantalum',
  diode: 'diodeAxial', led: 'led5mm', sot23: 'to92', crystal: 'crystalHC49', xtal: 'crystalHC49',
  pwrind: 'to220', header: 'batteryClip',
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

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

function getEscapeDir(kind: VintageKind, padIdx: number, cy_cell: number): { x: number; y: number } {
  switch (kind) {
    case 'resAxial': case 'diodeAxial': case 'inductorAxial': return padIdx === 0 ? { x: -1, y: 0 } : { x: 1, y: 0 }
    case 'to92': case 'to220': return { x: 0, y: 1 }
    case 'dipIC': return padIdx % 2 === 0 ? { x: 0, y: -1 } : { x: 0, y: 1 }
    default: return cy_cell < 4 ? { x: 0, y: 1 } : { x: 0, y: -1 }
  }
}

export function routeCopper(
  level: Pick<Level, 'decor' | 'nets' | 'board' | 'trace' | 'paths'>,
): Copper[] {
  const { decor, nets, trace } = level
  if (!nets || nets.length === 0) return []

  const pitch = level.board.pitch
  const scale = 2
  const cols2 = level.board.cols * scale
  const rows2 = level.board.rows * scale

  // 1. Initialize blocked set on the 2x fine grid
  const blocked = new Set<string>()

  // Block component bodies on the 2x grid with specific keep-out rules
  for (const it of decor) {
    const v = VINTAGE_MAP[it.kind]
    if (!v) continue
    const fp = footprintCells(it.kind, it.variant, it.rot)
    const scx = it.cell[0] * scale
    const scy = it.cell[1] * scale
    const fw = fp.w * scale
    const fh = fp.h * scale

    for (let dx = 0; dx < fw; dx++) {
      for (let dy = 0; dy < fh; dy++) {
        let block = false
        if (v === 'dipIC') { if (dy >= 2 && dy <= fh - 3) block = true }
        else if (v === 'resAxial' || v === 'diodeAxial' || v === 'inductorAxial') { if (dx >= 2 && dx <= fw - 3) block = true }
        else if (v === 'to92' || v === 'to220') { if (dy <= fh - 3) block = true }
        else { if (dx >= 2 && dx <= fw - 3) block = true }
        if (block) blocked.add(cellKey(scx + dx, scy + dy))
      }
    }
  }

  // Block gameplay tracks on the 2x grid (block all 4 sub-cells for each occupied 1x grid cell)
  const allPaths = level.paths && level.paths.length > 0 ? level.paths : [trace]
  for (const p of allPaths) {
    for (const k of buildPathSet(p.waypoints)) {
      const [tx, ty] = k.split(',').map(Number)
      blocked.add(cellKey(tx * scale, ty * scale))
      blocked.add(cellKey(tx * scale + 1, ty * scale))
      blocked.add(cellKey(tx * scale, ty * scale + 1))
      blocked.add(cellKey(tx * scale + 1, ty * scale + 1))
    }
  }

  // 2. Helper to fetch pad locations mapped to the 2x grid
  const getItemPads2x = (it: DecorItem, itemIdx: number) => {
    const v = VINTAGE_MAP[it.kind]
    if (!v) return []
    const fp = footprintCells(it.kind, it.variant, it.rot)
    const boxW = fp.w * pitch, boxH = fp.h * pitch, vf = VFOOT[v]
    const vp = Math.min(boxW / vf.w, boxH / vf.h)
    const ox = it.cell[0] * pitch + (boxW - vf.w * vp) / 2
    const oy = it.cell[1] * pitch + (boxH - vf.h * vp) / 2

    return vintageLeadEnds(v, vp).map((l, padIdx) => {
      const px = ox + l.x
      const py = oy + l.y
      const cx = Math.max(0, Math.min(cols2 - 1, Math.round((px - pitch / 4) / (pitch / 2))))
      const cy = Math.max(0, Math.min(rows2 - 1, Math.round((py - pitch / 4) / (pitch / 2))))
      return { cx, cy, itemIdx, padIdx, kind: v }
    })
  }

  const result: Copper[] = []
  const padNet = new Map<string, number>()

  // 3. Route segment-by-segment for each net
  for (let netIdx = 0; netIdx < nets.length; netIdx++) {
    const net = nets[netIdx]
    if (net.length < 2) continue

    for (let ni = 0; ni < net.length - 1; ni++) {
      const idxA = net[ni]
      const idxB = net[ni + 1]

      const itemA = decor[idxA]
      const itemB = decor[idxB]
      if (!itemA || !itemB) continue

      const padsA = getItemPads2x(itemA, idxA)
      const padsB = getItemPads2x(itemB, idxB)
      if (padsA.length === 0 || padsB.length === 0) continue

      // Find closest pad pair on the 2x grid, respecting padNet allocations
      let bestPair: { padA: typeof padsA[0]; padB: typeof padsB[0]; dist: number } | null = null
      for (const pA of padsA) {
        const keyA = `${idxA}_${pA.padIdx}`
        if (padNet.has(keyA) && padNet.get(keyA) !== netIdx) continue
        for (const pB of padsB) {
          const keyB = `${idxB}_${pB.padIdx}`
          if (padNet.has(keyB) && padNet.get(keyB) !== netIdx) continue

          const dist = Math.hypot(pA.cx - pB.cx, pA.cy - pB.cy)
          if (!bestPair || dist < bestPair.dist) {
            bestPair = { padA: pA, padB: pB, dist }
          }
        }
      }

      if (!bestPair) {
        // Fallback: choose closest overall pad pair if fully allocated
        for (const pA of padsA) {
          for (const pB of padsB) {
            const dist = Math.hypot(pA.cx - pB.cx, pA.cy - pB.cy)
            if (!bestPair || dist < bestPair.dist) {
              bestPair = { padA: pA, padB: pB, dist }
            }
          }
        }
      }

      if (!bestPair) continue
      const { padA, padB } = bestPair

      padNet.set(`${idxA}_${padA.padIdx}`, netIdx)
      padNet.set(`${idxB}_${padB.padIdx}`, netIdx)

      const cellA: Cell = [padA.cx, padA.cy]
      const cellB: Cell = [padB.cx, padB.cy]

      // Don't route if pads sit on the exact same 2x cell
      if (cellA[0] === cellB[0] && cellA[1] === cellB[1]) continue

      // Calculate escape directories
      const dirA = getEscapeDir(padA.kind, padA.padIdx, itemA.cell[1])
      const dirB = getEscapeDir(padB.kind, padB.padIdx, itemB.cell[1])

      const escA: Cell = [
        Math.max(0, Math.min(cols2 - 1, cellA[0] + dirA.x * 2)),
        Math.max(0, Math.min(rows2 - 1, cellA[1] + dirA.y * 2))
      ]
      const escB: Cell = [
        Math.max(0, Math.min(cols2 - 1, cellB[0] + dirB.x * 2)),
        Math.max(0, Math.min(rows2 - 1, cellB[1] + dirB.y * 2))
      ]

      // Temporarily unblock local escape paths
      const unblocks = [
        cellKey(cellA[0], cellA[1]),
        cellKey(cellA[0] + dirA.x, cellA[1] + dirA.y),
        cellKey(escA[0], escA[1]),
        cellKey(cellB[0], cellB[1]),
        cellKey(cellB[0] + dirB.x, cellB[1] + dirB.y),
        cellKey(escB[0], escB[1]),
      ]
      const restored = unblocks.filter(k => blocked.has(k))
      unblocks.forEach(k => blocked.delete(k))

      // Route on the 2x fine grid
      const cellPath = routeOctilinear({
        cols: cols2,
        rows: rows2,
        start: escA,
        goal: escB,
        blocked,
        turnPenalty: 2.0,
      })

      // Restore blocked obstacles
      restored.forEach(k => blocked.add(k))

      let finalPath2x: Cell[] = []
      if (cellPath) {
        finalPath2x = [
          cellA,
          [cellA[0] + dirA.x, cellA[1] + dirA.y],
          ...(cellPath as Cell[]),
          [cellB[0] + dirB.x, cellB[1] + dirB.y],
          cellB
        ]
        // Add path to blocked set for subsequent lines
        for (const p of finalPath2x) {
          blocked.add(cellKey(p[0], p[1]))
        }
      } else {
        // Simple straight fallback
        finalPath2x = [cellA, cellB]
      }

      // Convert back to fractional cells on the 1x grid for the renderer
      const points = finalPath2x.map(c => [c[0] / scale, c[1] / scale] as [number, number])
      
      // Override endpoints with the exact 1x integer cells of the anchors to pass tests and snap correctly
      const anchorsA = padAnchors(itemA)
      const anchorsB = padAnchors(itemB)
      const bestA = anchorsA[padA.padIdx]
      const bestB = anchorsB[padB.padIdx]
      if (bestA && bestB) {
        points[0] = [bestA[0], bestA[1]]
        points[points.length - 1] = [bestB[0], bestB[1]]
      }

      // Insert orthogonal transition at the start if not already orthogonal
      if (points.length >= 2 && points[0][0] !== points[1][0] && points[0][1] !== points[1][1]) {
        points.splice(1, 0, [points[1][0], points[0][1]])
      }

      // Insert orthogonal transition at the end if not already orthogonal
      if (points.length >= 2) {
        const last = points.length - 1
        if (points[last][0] !== points[last - 1][0] && points[last][1] !== points[last - 1][1]) {
          points.splice(last, 0, [points[last - 1][0], points[last][1]])
        }
      }

      result.push({ points })
    }
  }

  return result
}
