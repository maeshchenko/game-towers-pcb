import type { Board, Trace, TowerSpot, DecorItem } from '../model/level'
import type { Cell } from '../geom/types'
import { cellKey } from '../geom/grid'
import { makeRng } from './rng'
import { footprintCells } from '../render/decorBuilder'
import {
  powerSupply,
  mcuCore,
  opAmp,
  ledIndicator,
  transistorSwitch,
  passiveBank,
  amplifierStage,
  timer555,
  ledBar,
  type RefAlloc,
} from './circuits'

// ---------- Occupancy helpers ----------

function normalizeTraces(trace: Trace | Trace[]): Trace[] {
  return Array.isArray(trace) ? trace : [trace]
}

function blockedCells(trace: Trace | Trace[], spots: TowerSpot[], specials: TowerSpot[]): Set<string> {
  const set = new Set<string>()
  for (const tr of normalizeTraces(trace)) {
    const wp = tr.waypoints
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
 * Compute the bounding box (in cells) of a list of items.
 * Returns { minX, minY, maxX, maxY } relative to cell coords.
 */
function blockBBox(items: DecorItem[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const it of items) {
    const fp = footprintCells(it.kind, it.variant, it.rot)
    if (it.cell[0] < minX) minX = it.cell[0]
    if (it.cell[1] < minY) minY = it.cell[1]
    if (it.cell[0] + fp.w > maxX) maxX = it.cell[0] + fp.w
    if (it.cell[1] + fp.h > maxY) maxY = it.cell[1] + fp.h
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Try to place a block at a given origin. All items must fit (no overlap, within board).
 * On success marks occupancy and returns true; on failure returns false (no partial marking).
 */
function tryPlaceBlock(
  blockItems: DecorItem[],
  originOffset: Cell,
  occupied: Set<string>,
  board: Board,
): boolean {
  const [dx, dy] = originOffset
  // First check all items fit
  for (const it of blockItems) {
    const cell: Cell = [it.cell[0] + dx, it.cell[1] + dy]
    const fp = footprintCells(it.kind, it.variant, it.rot)
    if (!fits(cell, fp.w, fp.h, occupied, board)) return false
  }
  // Then mark all
  for (const it of blockItems) {
    const cell: Cell = [it.cell[0] + dx, it.cell[1] + dy]
    const fp = footprintCells(it.kind, it.variant, it.rot)
    mark(cell, fp.w, fp.h, occupied)
  }
  return true
}

/**
 * Scan for a valid placement of a block (which has items relative to [0,0]).
 * Returns the offset [ox,oy] that makes all items fit, or null.
 */
function scanBlock(
  blockItems: DecorItem[],
  x0: number, y0: number, x1: number, y1: number,
  occupied: Set<string>,
  board: Board,
  rng: () => number,
): Cell | null {
  const bbox = blockBBox(blockItems)
  const bw = bbox.maxX - bbox.minX
  const bh = bbox.maxY - bbox.minY
  // Adjust scan bounds so the block stays in-bounds
  const sx0 = x0, sy0 = y0
  const sx1 = Math.max(sx0, x1 - bw)
  const sy1 = Math.max(sy0, y1 - bh)

  const candidates: Cell[] = []
  for (let x = sx0; x <= sx1; x++) for (let y = sy0; y <= sy1; y++) candidates.push([x, y])
  const tries = Math.min(80, candidates.length)
  for (let i = 0; i < tries; i++) {
    const j = i + Math.floor(rng() * (candidates.length - i))
    const tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp
    const [cx, cy] = candidates[i]
    // offset so block's top-left bbox aligns to candidate
    const off: Cell = [cx - bbox.minX, cy - bbox.minY]
    if (tryPlaceBlock(blockItems, off, occupied, board)) return off
  }
  return null
}

/**
 * Apply an offset to all items in a block result and offset its net indices.
 * Net indices are already local to the block — just add the global item offset.
 */
function mergeBlock(
  blockItems: DecorItem[],
  blockNets: number[][],
  offset: Cell,
  globalItems: DecorItem[],
  globalNets: number[][],
): void {
  const idxOffset = globalItems.length
  for (const it of blockItems) {
    globalItems.push({
      ...it,
      cell: [it.cell[0] + offset[0], it.cell[1] + offset[1]],
    })
  }
  for (const net of blockNets) {
    globalNets.push(net.map(i => i + idxOffset))
  }
}

// ---------- Main exports ----------

export interface DecorWithNets {
  decor: DecorItem[]
  nets: number[][]
}

export function buildDecorWithNets(args: {
  board: Board; trace: Trace | Trace[]; spots: TowerSpot[]; specialSpots: TowerSpot[]; seed: number
}): DecorWithNets {
  const { board } = args
  const rng = makeRng(args.seed)
  const occupied = blockedCells(args.trace, args.spots, args.specialSpots)
  const items: DecorItem[] = []
  const nets: number[][] = []

  // Shared designator allocators (globally unique refs)
  let cN = 1, rN = 1, uN = 1, dN = 1, qN = 1, lN = 1, jN = 1, yN = 1, tpN = 1
  const alloc: RefAlloc = {
    nextC: () => `C${cN++}`,
    nextR: () => `R${rN++}`,
    nextU: () => `U${uN++}`,
    nextD: () => `D${dN++}`,
    nextQ: () => `Q${qN++}`,
    nextL: () => `L${lN++}`,
    nextJ: () => `J${jN++}`,
    nextY: () => `Y${yN++}`,
  }

  // ── 1. Mounting holes at 4 corners ─────────────────────────────────────────
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
      mark(cell, fp.w, fp.h, occupied)
      items.push({ kind: 'mount', variant: 1, cell, rot: 0, scale: 1, ref: `MH${i + 1}` })
    }
  }

  // ── 2. Power Supply block — near a board edge ───────────────────────────────
  {
    const ps = powerSupply([0, 0], alloc)
    // Try top edge first, then bottom edge
    const edgeCandidates: [number, number, number, number][] = [
      [3, 1, board.cols - 16, 4],
      [3, board.rows - 5, board.cols - 16, board.rows - 2],
      [1, 3, 4, board.rows - 5],
    ]
    let placed = false
    for (const [x0, y0, x1, y1] of edgeCandidates) {
      if (x1 <= x0 || y1 <= y0) continue
      const off = scanBlock(ps.items, x0, y0, x1, y1, occupied, board, rng)
      if (off) { mergeBlock(ps.items, ps.nets, off, items, nets); placed = true; break }
    }
    if (!placed) {
      // undo alloc side-effects — refs will be re-used in subsequent blocks, acceptable for fallback
    }
  }

  // ── 3. MCU Core block(s) — central region ──────────────────────────────────
  {
    const mcuCount = board.cols * board.rows > 900 ? 2 : 1
    for (let m = 0; m < mcuCount; m++) {
      const mcu = mcuCore([0, 0], alloc)
      const margin = 4
      const x0 = margin, y0 = margin
      const x1 = board.cols - margin, y1 = board.rows - margin
      const off = scanBlock(mcu.items, x0, y0, x1, y1, occupied, board, rng)
      if (off) mergeBlock(mcu.items, mcu.nets, off, items, nets)
    }
  }

  // ── 4. Secondary blocks: opAmp, transistorSwitch, ledIndicator ─────────────
  {
    const secondaryCount = 2 + Math.floor(rng() * 3) // 2..4
    const factories = [
      () => opAmp([0, 0], alloc),
      () => transistorSwitch([0, 0], alloc),
      () => ledIndicator([0, 0], alloc),
      () => opAmp([0, 0], alloc),
    ]
    for (let i = 0; i < secondaryCount; i++) {
      const blk = factories[i % factories.length]()
      const margin = 3
      const x0 = margin, y0 = margin
      const x1 = board.cols - margin, y1 = board.rows - margin
      const off = scanBlock(blk.items, x0, y0, x1, y1, occupied, board, rng)
      if (off) mergeBlock(blk.items, blk.nets, off, items, nets)
    }
  }

  // ── 5. Functional circuit blocks — fill the open space, then wire blocks together ──
  {
    // per placed block: global index of its first item (input side) and last item (output side)
    const blocks: { first: number; last: number }[] = []
    const placeBlk = (blk: { items: DecorItem[]; nets: number[][] }): void => {
      const off = scanBlock(blk.items, 2, 2, board.cols - 2, board.rows - 2, occupied, board, rng)
      if (off) { const base = items.length; mergeBlock(blk.items, blk.nets, off, items, nets); blocks.push({ first: base, last: base + blk.items.length - 1 }) }
    }
    const bigFactories = [
      () => amplifierStage([0, 0], alloc), () => timer555([0, 0], alloc),
      () => ledBar([0, 0], alloc, 4 + Math.floor(rng() * 4)), () => opAmp([0, 0], alloc),
      () => transistorSwitch([0, 0], alloc), () => mcuCore([0, 0], alloc),
    ]
    // big blocks — denser fill
    const bigTarget = Math.max(6, Math.floor((board.cols * board.rows) / 320))
    for (let b = 0; b < bigTarget; b++) placeBlk(bigFactories[Math.floor(rng() * bigFactories.length)]())
    // small clusters fill the remaining gaps
    const bankTarget = Math.floor((board.cols * board.rows) / 380)
    for (let b = 0; b < bankTarget; b++) placeBlk(passiveBank([0, 0], Math.floor(rng() * 9), alloc))

    // wire ALL blocks into ONE network: MST over blocks, each edge = OUTPUT of one block → INPUT of
    // the next (signal flows block-to-block), so it reads as a single connected schematic.
    const cellOf = (i: number): Cell => items[blocks[i].last].cell
    const dist = (a: number, b: number) => { const ca = cellOf(a), cb = cellOf(b); return Math.abs(ca[0] - cb[0]) + Math.abs(ca[1] - cb[1]) }
    if (blocks.length > 1) {
      const inTree = new Set<number>([0])
      while (inTree.size < blocks.length) {
        let bestA = -1, bestB = -1, bestD = Infinity
        for (const a of inTree) for (let b = 0; b < blocks.length; b++) {
          if (inTree.has(b)) continue
          const d = dist(a, b)
          if (d < bestD) { bestD = d; bestA = a; bestB = b }
        }
        if (bestB < 0) break
        inTree.add(bestB)
        // Skip the visual link when blocks are far apart — long copper snaking across the whole board
        // reads as crude. Distant clusters stay separate nets (as on real boards). out → in otherwise.
        if (bestD <= 18) nets.push([blocks[bestA].last, blocks[bestB].first])
      }
    }
  }

  // ── 6. Vias (singles + small clusters) ─────────────────────────────────────
  {
    const viaTarget = Math.floor((board.cols * board.rows) / 150)
    for (let i = 0; i < viaTarget * 4; i++) {
      if (items.filter(it => it.kind === 'via').length >= viaTarget) break
      const cell: Cell = [Math.floor(rng() * board.cols), Math.floor(rng() * board.rows)]
      const it = tryPlace('via', 1, 0, cell, occupied, board)
      if (it) {
        items.push(it)
        if (rng() < 0.3) {
          for (const nc of [[cell[0] + 2, cell[1]], [cell[0], cell[1] + 2]] as Cell[]) {
            const n2 = tryPlace('via', 1, 0, nc, occupied, board)
            if (n2) items.push(n2)
          }
        }
      }
    }
  }

  // ── 7. Test points ──────────────────────────────────────────────────────────
  {
    const tpTarget = 4 + Math.floor(rng() * 5)
    for (let i = 0; i < tpTarget * 4; i++) {
      if (tpN - 1 >= tpTarget) break
      const cell: Cell = [Math.floor(rng() * board.cols), Math.floor(rng() * board.rows)]
      const it = tryPlace('testpoint', 1, 0, cell, occupied, board, `TP${tpN}`)
      if (!it) { /* ref not consumed — tpN not incremented yet so just skip */ continue }
      tpN++
      items.push(it)
    }
  }

  return { decor: items, nets }
}

export function growDecor(args: {
  board: Board; trace: Trace | Trace[]; spots: TowerSpot[]; specialSpots: TowerSpot[]; seed: number
}): DecorItem[] {
  return buildDecorWithNets(args).decor
}
