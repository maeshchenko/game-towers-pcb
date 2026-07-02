import type { Level, DecorItem } from '../model/level'
import { footprintCells } from '../render/decorBuilder'
import { routeOctilinear } from '../geom/router'
import type { Cell } from '../geom/types'
import { VFOOT, vintageLeadEnds, vintagePins, type VintageKind } from '../render/vintageDecor'

export interface Copper {
  points: [number, number][]
  /** Pin function names for the endpoints ('anode', 'VCC', '+', …) — rendered as silkscreen labels. */
  labelA?: string
  labelB?: string
}

// Pin names worth printing on the silkscreen — functional names read "engineer-stylish";
// generic terminal names (t1/x1/end1/A/B of passives, IO of ICs) would just be noise.
const LABELED_PINS = new Set(['anode', 'cathode', '+', '-', 'IN', 'OUT', 'GND', 'VCC', 'OSC', 'E', 'B', 'C', 'tip+', 'sleeve-'])
const UNLABELED_KINDS = new Set<VintageKind>(['resAxial', 'inductorAxial', 'ceramicDisc', 'filmCap', 'crystalHC49', 'trimpot'])
function padLabel(kind: VintageKind, padIdx: number): string | undefined {
  if (UNLABELED_KINDS.has(kind)) return undefined
  const name = vintagePins(kind)[padIdx]
  return name && LABELED_PINS.has(name) ? name : undefined
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
    // 2-pad radial parts: pads sit left/right of the body centre → the lead leaves sideways,
    // never up/down (vertical escapes made hook-shaped stubs on crystal/cap/LED links).
    case 'ceramicDisc': case 'filmCap': case 'electroRadial': case 'tantalum': case 'led5mm':
    case 'crystalHC49': case 'trimpot': case 'batteryClip':
      return padIdx === 0 ? { x: -1, y: 0 } : { x: 1, y: 0 }
    case 'to92': case 'to220': return { x: 0, y: 1 }
    case 'dipIC': return padIdx % 2 === 0 ? { x: 0, y: -1 } : { x: 0, y: 1 }
    default: return cy_cell < 4 ? { x: 0, y: 1 } : { x: 0, y: -1 }
  }
}

export function routeCopper(
  level: Pick<Level, 'decor' | 'nets' | 'board' | 'trace' | 'paths'> & { spots?: Cell[] },
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

  // Block tower spots + specials on the 2x grid, dilated by 1 ring — copper must never run under a
  // build/boost octagon (a trace visible under a spot reads as broken occupancy).
  if (level.spots) {
    const spotRing = new Set<string>()
    for (const [sx, sy] of level.spots) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) spotRing.add(cellKey(sx + dx, sy + dy))
    }
    for (const k of spotRing) {
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
      return { cx, cy, px, py, itemIdx, padIdx, kind: v }
    })
  }

  // 2b. Pad keep-out (kit2 discipline): every pad cell + its 4-neighbours is blocked so routes
  // never slide along a foreign pin row. The two pads of the segment being routed are unblocked
  // locally for the duration of that route.
  const padRing = new Map<string, string[]>() // `${itemIdx}_${padIdx}` → blocked cell keys
  for (let idx = 0; idx < decor.length; idx++) {
    for (const p of getItemPads2x(decor[idx], idx)) {
      const keys: string[] = []
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        keys.push(cellKey(p.cx + dx, p.cy + dy))
      }
      padRing.set(`${idx}_${p.padIdx}`, keys)
      for (const k of keys) blocked.add(k)
    }
  }

  const result: Copper[] = []
  const padNet = new Map<string, number>()

  // 3. Flatten nets into pad-to-pad tasks and route SHORTEST first (kit2 discipline):
  // greedy layouts come out much cleaner when short local links claim their lanes before
  // long ones have to detour around them.
  interface Task { netIdx: number; idxA: number; idxB: number; ord: number; dist: number }
  const tasks: Task[] = []
  const minPadDist = (idxA: number, idxB: number): number => {
    const a = getItemPads2x(decor[idxA], idxA), b = getItemPads2x(decor[idxB], idxB)
    let m = Infinity
    for (const pa of a) for (const pb of b) m = Math.min(m, Math.hypot(pa.cx - pb.cx, pa.cy - pb.cy))
    return m
  }
  nets.forEach((net, netIdx) => {
    if (net.length < 2) return
    for (let ni = 0; ni < net.length - 1; ni++) {
      const idxA = net[ni], idxB = net[ni + 1]
      if (!decor[idxA] || !decor[idxB]) continue
      tasks.push({ netIdx, idxA, idxB, ord: tasks.length, dist: minPadDist(idxA, idxB) })
    }
  })
  tasks.sort((a, b) => a.dist - b.dist || a.ord - b.ord)

  for (const { netIdx, idxA, idxB } of tasks) {
    {
      const itemA = decor[idxA]
      const itemB = decor[idxB]

      const padsA = getItemPads2x(itemA, idxA)
      const padsB = getItemPads2x(itemB, idxB)
      if (padsA.length === 0 || padsB.length === 0) continue

      // Find closest pad pair on the 2x grid, respecting padNet allocations.
      // No "ignore allocations" fallback: double-booking a pad reads as a wiring error.
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

      // Temporarily unblock local escape paths + the keep-out rings of the two pads being wired
      const unblocks = [
        cellKey(cellA[0], cellA[1]),
        cellKey(cellA[0] + dirA.x, cellA[1] + dirA.y),
        cellKey(escA[0], escA[1]),
        cellKey(cellB[0], cellB[1]),
        cellKey(cellB[0] + dirB.x, cellB[1] + dirB.y),
        cellKey(escB[0], escB[1]),
        ...(padRing.get(`${idxA}_${padA.padIdx}`) ?? []),
        ...(padRing.get(`${idxB}_${padB.padIdx}`) ?? []),
      ]
      const restored = unblocks.filter(k => blocked.has(k))
      unblocks.forEach(k => blocked.delete(k))

      // ── Connector templates, like a human board designer would lay them (kit2 look) ──
      // Preference order: dead-straight run → stub-channel-stub with crisp corners → A* only
      // as a last resort for awkward long links. A short link must NEVER wiggle.
      const inBounds = (c: Cell): boolean => c[0] >= 0 && c[1] >= 0 && c[0] < cols2 && c[1] < rows2
      const polyFree = (pts: Cell[]): boolean => {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i]
          const sx = Math.sign(b[0] - a[0]), sy = Math.sign(b[1] - a[1])
          const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
          for (let s = 0; s <= steps; s++) {
            const c: Cell = [a[0] + sx * s, a[1] + sy * s]
            if (!inBounds(c) || blocked.has(cellKey(c[0], c[1]))) return false
          }
        }
        return true
      }

      let finalPath2x: Cell[] | null = null

      // T1 — pads share a row/column: one straight etched run, enters both pads head-on.
      if ((cellA[0] === cellB[0] || cellA[1] === cellB[1]) && polyFree([cellA, cellB])) {
        finalPath2x = [cellA, cellB]
      }

      // T1.5 — single-corner L: pads on perpendicular escape axes close to each other get one
      // clean corner (chamfered to 45° at render time), the way a designer joins two nearby pads.
      if (!finalPath2x) {
        const manhattan = Math.abs(cellA[0] - cellB[0]) + Math.abs(cellA[1] - cellB[1])
        if (manhattan <= 10) {
          const corners: Cell[] = dirA.x !== 0
            ? [[cellB[0], cellA[1]], [cellA[0], cellB[1]]]
            : [[cellA[0], cellB[1]], [cellB[0], cellA[1]]]
          for (const corner of corners) {
            const cand: Cell[] = [cellA, corner, cellB]
            if (polyFree(cand)) { finalPath2x = cand; break }
          }
        }
      }

      // T2 — kit2 pair connector: perpendicular stub out of each pad, a shared straight
      // channel, head-on entry into the target. Try a few channel offsets before giving up.
      if (!finalPath2x) {
        const horizontalChannel = dirA.y !== 0 || dirB.y !== 0 || cellA[1] !== cellB[1]
        if (horizontalChannel) {
          const side = dirA.y < 0 || dirB.y < 0 ? -1 : 1
          const base = side < 0 ? Math.min(escA[1], escB[1]) : Math.max(escA[1], escB[1])
          for (let off = 0; off <= 4 && !finalPath2x; off++) {
            const ch = base + side * off
            const cand: Cell[] = [cellA, escA, [escA[0], ch], [escB[0], ch], escB, cellB]
            if (ch >= 0 && ch < rows2 && polyFree(cand)) finalPath2x = cand
          }
        } else {
          // both escapes horizontal and pads on different columns → vertical channel
          const side = dirA.x < 0 || dirB.x < 0 ? -1 : 1
          const base = side < 0 ? Math.min(escA[0], escB[0]) : Math.max(escA[0], escB[0])
          for (let off = 0; off <= 4 && !finalPath2x; off++) {
            const ch = base + side * off
            const cand: Cell[] = [cellA, escA, [ch, escA[1]], [ch, escB[1]], escB, cellB]
            if (ch >= 0 && ch < cols2 && polyFree(cand)) finalPath2x = cand
          }
        }
      }

      // T3 — last resort for long/awkward links: A* on the fine grid.
      if (!finalPath2x) {
        const cellPath = routeOctilinear({
          cols: cols2,
          rows: rows2,
          start: escA,
          goal: escB,
          blocked,
          turnPenalty: 2.5,
        })
        if (cellPath) {
          finalPath2x = [
            cellA,
            [cellA[0] + dirA.x, cellA[1] + dirA.y],
            ...(cellPath as Cell[]),
            [cellB[0] + dirB.x, cellB[1] + dirB.y],
            cellB,
          ]
        }
      }

      // Restore blocked obstacles
      restored.forEach(k => blocked.add(k))

      // No route found → skip this segment entirely (no wire is better than a fake one
      // cutting through components/spots).
      if (!finalPath2x) continue
      // Add path to blocked set for subsequent lines
      for (const p of finalPath2x) {
        blocked.add(cellKey(p[0], p[1]))
      }

      // Convert back to fractional cells on the 1x grid for the renderer
      const points = finalPath2x.map(c => [c[0] / scale, c[1] / scale] as [number, number])
      
      // Override endpoints with the TRUE pad positions of the drawn vintage parts (fractional
      // cell coords) — the trace must visibly touch the solder pad it claims to connect.
      points[0] = [padA.px / pitch - 0.5, padA.py / pitch - 0.5]
      points[points.length - 1] = [padB.px / pitch - 0.5, padB.py / pitch - 0.5]

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

      result.push({ points, labelA: padLabel(padA.kind, padA.padIdx), labelB: padLabel(padB.kind, padB.padIdx) })
    }
  }

  return result
}
