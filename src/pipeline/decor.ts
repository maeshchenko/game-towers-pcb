import type { Board, Trace, TowerSpot, DecorItem } from '../model/level'
import type { Cell } from '../geom/types'
import { cellKey } from '../geom/grid'
import { makeRng } from './rng'
import { footprintCells } from '../render/decorBuilder'

// ---------- Occupancy helpers ----------

function blockedCells(trace: Trace, spots: TowerSpot[], specials: TowerSpot[]): Set<string> {
  const set = new Set<string>()
  const wp = trace.waypoints
  for (let i = 1; i < wp.length; i++) {
    const a = wp[i - 1], b = wp[i]
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
    for (let k = 0; k <= steps; k++) {
      const t = steps === 0 ? 0 : k / steps
      const cx = Math.round(a[0] + (b[0] - a[0]) * t)
      const cy = Math.round(a[1] + (b[1] - a[1]) * t)
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) set.add(cellKey([cx + dx, cy + dy]))
    }
  }
  for (const s of [...spots, ...specials])
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) set.add(cellKey([s.cell[0] + dx, s.cell[1] + dy]))
  return set
}

function fits(cell: Cell, w: number, h: number, occupied: Set<string>, board: Board): boolean {
  if (cell[0] < 0 || cell[1] < 0) return false
  if (cell[0] + w > board.cols || cell[1] + h > board.rows) return false
  for (let dx = 0; dx < w; dx++)
    for (let dy = 0; dy < h; dy++)
      if (occupied.has(cellKey([cell[0] + dx, cell[1] + dy]))) return false
  return true
}

function mark(cell: Cell, w: number, h: number, occupied: Set<string>): void {
  // footprint + 1-cell margin
  for (let dx = -1; dx <= w; dx++)
    for (let dy = -1; dy <= h; dy++)
      occupied.add(cellKey([cell[0] + dx, cell[1] + dy]))
}

// ---------- Placement helpers ----------

/**
 * Try to place `kind`/`variant`/`rot` at the given cell.
 * Returns a DecorItem on success, null on failure.
 */
function tryPlace(
  kind: string,
  variant: number,
  rot: 0 | 90 | 180 | 270,
  cell: Cell,
  occupied: Set<string>,
  board: Board,
  ref?: string,
): DecorItem | null {
  const fp = footprintCells(kind, variant, rot)
  if (!fits(cell, fp.w, fp.h, occupied, board)) return null
  mark(cell, fp.w, fp.h, occupied)
  return { kind, variant, cell, rot, scale: 1, ...(ref ? { ref } : {}) }
}

/**
 * Scan a rectangular region (shuffled) and place the first fitting location.
 */
function placeScan(
  kind: string,
  variant: number,
  rot: 0 | 90 | 180 | 270,
  x0: number, y0: number, x1: number, y1: number,
  occupied: Set<string>,
  board: Board,
  rng: () => number,
  ref?: string,
): DecorItem | null {
  // collect candidate cells and shuffle
  const candidates: Cell[] = []
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) candidates.push([x, y])
  // Fisher-Yates partial shuffle (try at most 60 random picks)
  const tries = Math.min(60, candidates.length)
  for (let i = 0; i < tries; i++) {
    const j = i + Math.floor(rng() * (candidates.length - i))
    const tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp
    const item = tryPlace(kind, variant, rot, candidates[i], occupied, board, ref)
    if (item) return item
  }
  return null
}

// ---------- Main export ----------

export function growDecor(args: {
  board: Board; trace: Trace; spots: TowerSpot[]; specialSpots: TowerSpot[]; seed: number
}): DecorItem[] {
  const { board } = args
  const rng = makeRng(args.seed)
  const occupied = blockedCells(args.trace, args.spots, args.specialSpots)
  const items: DecorItem[] = []

  let cCounter = 1  // C (capacitor) designator counter
  let rCounter = 1  // R (resistor) designator counter
  let uCounter = 1  // U (IC) designator counter
  let tpCounter = 1 // TP designator counter
  let qCounter = 1  // Q designator counter
  let dCounter = 1  // D designator counter
  let lCounter = 1  // L designator counter

  const nextC = () => `C${cCounter++}`
  const nextR = () => `R${rCounter++}`
  const nextU = () => `U${uCounter++}`
  const nextTP = () => `TP${tpCounter++}`
  const nextQ = () => `Q${qCounter++}`
  const nextD = () => `D${dCounter++}`
  const nextL = () => `L${lCounter++}`

  // ── 1. Mounting holes at 4 corners ──────────────────────────────────────────
  // Structural elements: always exactly 4, one per corner.  Bypasses the
  // occupied-check so trace / spots never prevent a corner hole from appearing.
  {
    const cornerOffsets: Cell[] = [
      [2, 2],
      [board.cols - 4, 2],
      [2, board.rows - 4],
      [board.cols - 4, board.rows - 4],
    ]
    const fp = footprintCells('mount', 1, 0)
    for (let i = 0; i < 4; i++) {
      const cell = cornerOffsets[i]
      mark(cell, fp.w, fp.h, occupied)   // reserve space so other items stay clear
      items.push({ kind: 'mount', variant: 1, cell, rot: 0, scale: 1, ref: `MH${i + 1}` })
    }
  }

  // ── 2. Major ICs ─────────────────────────────────────────────────────────────
  const icKinds = ['soic', 'soic', 'qfp', 'qfp', 'qfn', 'dip'] as const
  const icVariants: Record<string, number[]> = {
    soic: [8, 14, 16],
    qfp:  [32, 44, 64],
    qfn:  [16, 20, 24],
    dip:  [8, 16],
  }

  const icCount = 3 + Math.floor(rng() * 4) + Math.floor((board.cols * board.rows) / 600)
  const placedICs: { item: DecorItem; cx: number; cy: number; area: number }[] = []

  for (let attempt = 0; attempt < icCount * 8 && placedICs.length < Math.min(icCount, 10); attempt++) {
    const kind = icKinds[Math.floor(rng() * icKinds.length)]
    const variants = icVariants[kind]
    const variant = variants[Math.floor(rng() * variants.length)]
    const rot: 0 | 90 = rng() < 0.5 ? 0 : 90

    // Keep ICs away from board edges (≥3 cells) and from each other (≥4 cells)
    const fp = footprintCells(kind, variant, rot)
    const x0 = 3, y0 = 3
    const x1 = board.cols - fp.w - 3
    const y1 = board.rows - fp.h - 3
    if (x1 <= x0 || y1 <= y0) continue

    const item = placeScan(kind, variant, rot, x0, y0, x1, y1, occupied, board, rng, nextU())
    if (!item) { uCounter--; continue }  // undo ref increment if placement failed

    // Check separation from other ICs (≥4 cells center-to-center)
    const fp2 = footprintCells(item.kind, item.variant, item.rot)
    const cx = item.cell[0] + fp2.w / 2
    const cy = item.cell[1] + fp2.h / 2
    let tooClose = false
    for (const ic of placedICs) {
      if (Math.abs(cx - ic.cx) < 4 && Math.abs(cy - ic.cy) < 4) { tooClose = true; break }
    }
    if (tooClose) {
      // remove from occupancy is complex; just skip (mark stays, item not added)
      uCounter--
      continue
    }

    items.push(item)
    placedICs.push({ item, cx, cy, area: fp2.w * fp2.h })
  }

  // ── 3. Decoupling caps per IC (mlcc adjacent to IC body) ─────────────────────
  for (const { item: ic } of placedICs) {
    const icFp = footprintCells(ic.kind, ic.variant, ic.rot)
    const capCount = 2 + Math.floor(rng() * 3) // 2..4
    // Prefer placing caps just below the IC body
    const side = rng() < 0.5 ? 1 : -1 // below or above
    for (let c = 0; c < capCount; c++) {
      let placed = false
      // Try adjacent rows: just below, just above, just left, just right
      const offsets: Cell[] = [
        [ic.cell[0] + c, ic.cell[1] + icFp.h + 1],         // below
        [ic.cell[0] + c, ic.cell[1] - 2],                   // above
        [ic.cell[0] + icFp.w + 1, ic.cell[1] + c],          // right
        [ic.cell[0] - 2, ic.cell[1] + c],                   // left
      ]
      // Bias to one side
      const preferred = side > 0 ? offsets : [offsets[1], offsets[0], offsets[2], offsets[3]]
      for (const cell of preferred) {
        if (cell[0] < 0 || cell[1] < 0 || cell[0] >= board.cols || cell[1] >= board.rows) continue
        const item = tryPlace('mlcc', 1, 0, cell, occupied, board, nextC())
        if (item) { items.push(item); placed = true; break }
      }
      if (!placed) cCounter-- // undo if not placed
    }
  }

  // ── 4. Support passives per IC (rows of res/mlcc within ~5 cells) ────────────
  for (const { item: ic } of placedICs) {
    const icFp = footprintCells(ic.kind, ic.variant, ic.rot)
    const passiveCount = 3 + Math.floor(rng() * 4) // 3..6
    const rowRot: 0 | 90 = rng() < 0.5 ? 0 : 90
    const radius = 5
    const x0 = Math.max(0, ic.cell[0] - radius)
    const y0 = Math.max(0, ic.cell[1] - radius)
    const x1 = Math.min(board.cols, ic.cell[0] + icFp.w + radius)
    const y1 = Math.min(board.rows, ic.cell[1] + icFp.h + radius)

    // Place a contiguous row: pick a start cell, then extend in +x or +y
    const startCell: Cell = [
      x0 + Math.floor(rng() * Math.max(1, x1 - x0 - passiveCount)),
      y0 + Math.floor(rng() * Math.max(1, y1 - y0)),
    ]
    let rowX = startCell[0], rowY = startCell[1]
    for (let p = 0; p < passiveCount; p++) {
      const kind = rng() < 0.5 ? 'res' : 'mlcc'
      const ref = kind === 'res' ? nextR() : nextC()
      const item = tryPlace(kind, 1, rowRot, [rowX, rowY], occupied, board, ref)
      if (!item) { if (kind === 'res') rCounter--; else cCounter--; break }
      items.push(item)
      const fp = footprintCells(kind, 1, rowRot)
      if (rowRot === 0) rowX += fp.w + 1
      else rowY += fp.h + 1
    }
  }

  // ── 5. Crystal near the largest IC ───────────────────────────────────────────
  if (placedICs.length > 0) {
    const biggest = placedICs.reduce((a, b) => b.area > a.area ? b : a)
    const ic = biggest.item
    const icFp = footprintCells(ic.kind, ic.variant, ic.rot)
    const radius = 6
    const x0 = Math.max(0, ic.cell[0] - radius)
    const y0 = Math.max(0, ic.cell[1] - radius)
    const x1 = Math.min(board.cols - 2, ic.cell[0] + icFp.w + radius)
    const y1 = Math.min(board.rows - 2, ic.cell[1] + icFp.h + radius)
    const xtal = placeScan('crystal', 1, 0, x0, y0, x1, y1, occupied, board, rng, 'Y1')
    if (xtal) {
      items.push(xtal)
      // 2 load caps beside it
      for (let i = 0; i < 2; i++) {
        const offsets: Cell[] = [
          [xtal.cell[0] + i, xtal.cell[1] + 3],
          [xtal.cell[0] + i, xtal.cell[1] - 2],
          [xtal.cell[0] + 3, xtal.cell[1] + i],
        ]
        for (const cell of offsets) {
          const item = tryPlace('mlcc', 1, 0, cell, occupied, board, nextC())
          if (item) { items.push(item); break }
          else cCounter--
        }
      }
    }
  }

  // ── 6. Passive rows in open areas ────────────────────────────────────────────
  const targetPassiveRows = Math.floor((board.cols * board.rows) / 80)
  let rowsPlaced = 0
  let rowAttempts = 0
  while (rowsPlaced < targetPassiveRows && rowAttempts < targetPassiveRows * 6) {
    rowAttempts++
    const rowLen = 2 + Math.floor(rng() * 3) // 2..4
    const rowRot: 0 | 90 = rng() < 0.5 ? 0 : 90
    const startX = Math.floor(rng() * board.cols)
    const startY = Math.floor(rng() * board.rows)
    let rx = startX, ry = startY
    let placedInRow = 0
    for (let p = 0; p < rowLen; p++) {
      const kind = p % 2 === 0 ? 'res' : 'mlcc'
      const ref = kind === 'res' ? nextR() : nextC()
      const item = tryPlace(kind, 1, rowRot, [rx, ry], occupied, board, ref)
      if (!item) { if (kind === 'res') rCounter--; else cCounter--; break }
      items.push(item)
      placedInRow++
      const fp = footprintCells(kind, 1, rowRot)
      if (rowRot === 0) rx += fp.w + 1
      else ry += fp.h + 1
    }
    if (placedInRow > 0) rowsPlaced++
  }

  // ── 7. Vias ───────────────────────────────────────────────────────────────────
  const viaTarget = Math.floor((board.cols * board.rows) / 18)
  for (let i = 0; i < viaTarget * 4; i++) {
    if (items.filter(it => it.kind === 'via').length >= viaTarget) break
    const cell: Cell = [Math.floor(rng() * board.cols), Math.floor(rng() * board.rows)]
    const item = tryPlace('via', 1, 0, cell, occupied, board)
    if (item) items.push(item)
    // small clusters: try neighbours
    if (item && rng() < 0.3) {
      const neighbours: Cell[] = [[cell[0] + 2, cell[1]], [cell[0], cell[1] + 2]]
      for (const nc of neighbours) {
        const nItem = tryPlace('via', 1, 0, nc, occupied, board)
        if (nItem) items.push(nItem)
      }
    }
  }

  // ── 8. Test points ────────────────────────────────────────────────────────────
  const tpTarget = 8 + Math.floor(rng() * 13) // 8..20
  for (let i = 0; i < tpTarget * 4; i++) {
    if (tpCounter - 1 >= tpTarget) break
    const cell: Cell = [Math.floor(rng() * board.cols), Math.floor(rng() * board.rows)]
    const item = tryPlace('testpoint', 1, 0, cell, occupied, board, nextTP())
    if (!item) { tpCounter--; continue }
    items.push(item)
  }

  // ── 9. Electrolytics near a board edge ───────────────────────────────────────
  for (let e = 0; e < 2; e++) {
    // pick a random edge (top/bottom/left/right)
    const edge = Math.floor(rng() * 4)
    let x0: number, y0: number, x1: number, y1: number
    if (edge === 0) { x0 = 2; x1 = board.cols - 4; y0 = 1; y1 = 4 }
    else if (edge === 1) { x0 = 2; x1 = board.cols - 4; y0 = board.rows - 5; y1 = board.rows - 2 }
    else if (edge === 2) { x0 = 1; x1 = 4; y0 = 2; y1 = board.rows - 4 }
    else { x0 = board.cols - 5; x1 = board.cols - 2; y0 = 2; y1 = board.rows - 4 }
    const item = placeScan('electrolytic', 1, 0, x0, y0, x1, y1, occupied, board, rng, nextC())
    if (!item) { cCounter--; continue }
    items.push(item)
  }

  // ── 10. Optional extras: sot23, diode, led, inductor ─────────────────────────
  for (const { item: ic } of placedICs.slice(0, 2)) {
    const icFp = footprintCells(ic.kind, ic.variant, ic.rot)
    const radius = 4
    const x0 = Math.max(0, ic.cell[0] - radius)
    const y0 = Math.max(0, ic.cell[1] - radius)
    const x1 = Math.min(board.cols, ic.cell[0] + icFp.w + radius)
    const y1 = Math.min(board.rows, ic.cell[1] + icFp.h + radius)

    if (rng() < 0.6) {
      const item = placeScan('sot23', 1, 0, x0, y0, x1, y1, occupied, board, rng, nextQ())
      if (item) items.push(item); else qCounter--
    }
    if (rng() < 0.5) {
      const item = placeScan('diode', 1, 0, x0, y0, x1, y1, occupied, board, rng, nextD())
      if (item) items.push(item); else dCounter--
    }
    if (rng() < 0.4) {
      const item = placeScan('inductor', 1, 0, x0, y0, x1, y1, occupied, board, rng, nextL())
      if (item) items.push(item); else lCounter--
    }
    if (rng() < 0.3) {
      const item = placeScan('led', 1, 0, x0, y0, x1, y1, occupied, board, rng)
      if (item) items.push(item)
    }
  }

  return items
}
