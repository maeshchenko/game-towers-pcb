// Hand-authored level DSL: compose enemy paths, build/special spots, and decor blocks into a Level.
// Framework-free (no Pixi). Copper is produced by the existing pad-to-pad router (pipeline/copper.ts),
// so every wire lands on a real pad — no dangling. See docs/superpowers/specs/2026-06-30-*.
import type { Board, Level, Trace, TowerSpot, DecorItem } from '../model/level'
import type { Cell } from '../geom/types'
import { RENDER } from '../style/palette'
import { routeCopper } from '../pipeline/copper'
import { computeTowerSpots } from '../pipeline/spots'
import { pathSamples } from '../geom/sampling'
import { cellToPx, dist } from '../geom/grid'
import type { BlockResult, RefAlloc } from '../pipeline/circuits'
import { footprintCells as decorFootprint } from '../render/decorBuilder'

export function makeAlloc(): RefAlloc {
  let c = 1, r = 1, u = 1, d = 1, q = 1, l = 1, j = 1, y = 1
  return {
    nextC: () => `C${c++}`, nextR: () => `R${r++}`, nextU: () => `U${u++}`, nextD: () => `D${d++}`,
    nextQ: () => `Q${q++}`, nextL: () => `L${l++}`, nextJ: () => `J${j++}`, nextY: () => `Y${y++}`,
  }
}

export class LevelBuilder {
  private paths: Trace[] = []
  private spots: TowerSpot[] = []
  private specials: TowerSpot[] = []
  private decor: DecorItem[] = []
  private nets: number[][] = []
  readonly alloc: RefAlloc = makeAlloc()

  constructor(readonly board: Board, readonly seed: number, readonly meta: Level['meta']) {}

  path(waypoints: Cell[], cornerRadius: number = RENDER.cornerRadiusCells): this {
    this.paths.push({ waypoints, cornerRadius }); return this
  }
  /**
   * Hand-authored wave script for this level (overrides the shared mapWaves template).
   * Outer array = waves, inner = spawn groups; group.pathIndex directs a group to a specific
   * entrance on multi-path maps. Enemy kinds are validated by Game on load.
   */
  waves(script: NonNullable<Level['meta']['waves']>): this {
    this.meta.waves = script; return this
  }
  buildSpot(...cells: Cell[]): this {
    for (const c of cells) this.spots.push({ cell: c, score: 1, kind: 'build' }); return this
  }
  specialSpot(...cells: Cell[]): this {
    for (const c of cells) this.specials.push({ cell: c, score: 1, kind: 'special' }); return this
  }
  /** place a circuit block; rebase its LOCAL nets into global decor indices */
  block(blk: BlockResult): this {
    const off = this.decor.length
    this.decor.push(...blk.items)
    this.nets.push(...blk.nets.map((n) => n.map((i) => i + off)))
    return this
  }
  /** place a single accent part (not auto-wired) */
  part(kind: string, cell: Cell, rot: 0 | 90 | 180 | 270 = 0, variant = 1): this {
    this.decor.push({ kind, variant, cell, rot, scale: 1 }); return this
  }
  /**
   * Fill build/special spots with the proven coverage-greedy placer over ALL paths (excludes on-path
   * cells, scores by path-tiles-in-range). Guarantees solid coverage on multi-path levels. Call after
   * adding paths. Appends to any hand-placed spots.
   */
  /** cells covered by placed decor, dilated by `gap` rings — so spots keep clear of components */
  private occupiedByDecor(gap = 1): Set<string> {
    const occ = new Set<string>()
    for (const it of this.decor) {
      const fp = decorFootprint(it.kind, it.variant, it.rot)
      for (let dx = -gap; dx < fp.w + gap; dx++)
        for (let dy = -gap; dy < fp.h + gap; dy++)
          occ.add(`${it.cell[0] + dx},${it.cell[1] + dy}`)
    }
    return occ
  }
  autoSpots(budget: number, specialEvery = 5): this {
    // Spots are the PRIMARY element — placed with full freedom (only a gap from the trace). Decor is
    // secondary and is fitted around the spots afterwards (fillBlocks), never the other way round.
    const { spots, specialSpots } = computeTowerSpots({
      board: this.board, trace: this.paths, budget, specialEvery, pathGap: 1,
    })
    this.spots.push(...spots); this.specials.push(...specialSpots)
    return this
  }
  /** wire two already-placed decor items (global indices) as a 2-node net */
  wire(a: number, b: number): this { this.nets.push([a, b]); return this }
  decorCount(): number { return this.decor.length }

  /** path cells dilated by `gap` rings — the keep-out zone around the trace */
  private pathBlocked(gap: number): Set<string> {
    const s = new Set<string>()
    for (const t of this.paths) {
      const wp = t.waypoints
      for (let i = 1; i < wp.length; i++) {
        const a = wp[i - 1], b = wp[i]
        const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
        for (let k = 0; k <= steps; k++) {
          const tt = steps ? k / steps : 0
          const cx = Math.round(a[0] + (b[0] - a[0]) * tt), cy = Math.round(a[1] + (b[1] - a[1]) * tt)
          for (let gx = -gap; gx <= gap; gx++) for (let gy = -gap; gy <= gap; gy++) s.add(`${cx + gx},${cy + gy}`)
        }
      }
    }
    return s
  }
  /** the raw footprint cells of a built block (no gap) */
  private blockCells(blk: BlockResult): Array<[number, number]> {
    const out: Array<[number, number]> = []
    for (const it of blk.items) {
      const fp = decorFootprint(it.kind, it.variant, it.rot)
      for (let dx = 0; dx < fp.w; dx++) for (let dy = 0; dy < fp.h; dy++) out.push([it.cell[0] + dx, it.cell[1] + dy])
    }
    return out
  }
  /**
   * Place each circuit block at the first origin (scanned coarsely so they spread out) whose entire
   * footprint stays inside the board AND keeps `gap` empty cells from the trace and from every block
   * already placed. Blocks that don't fit anywhere are skipped. Guarantees: decor never touches the
   * road or another component. Spots placed afterwards (autoSpots) then keep clear of this decor too.
   */
  fillBlocks(makers: Array<(origin: Cell, alloc: RefAlloc) => BlockResult>, opts: { gap?: number; margin?: number; stride?: number } = {}): this {
    const gap = opts.gap ?? 2, margin = opts.margin ?? 1, stride = opts.stride ?? 2
    const blocked = this.pathBlocked(gap)
    for (const k of this.occupiedByDecor(gap)) blocked.add(k)   // respect already hand-placed decor
    const { cols, rows } = this.board
    for (const make of makers) {
      // measure the block's relative cells with a throwaway allocator
      const probe = make([0, 0], makeAlloc())
      const rel = this.blockCells(probe)
      const minX = Math.min(...rel.map((c) => c[0])), maxX = Math.max(...rel.map((c) => c[0]))
      const minY = Math.min(...rel.map((c) => c[1])), maxY = Math.max(...rel.map((c) => c[1]))
      let placed = false
      for (let oy = margin - minY; oy <= rows - 1 - maxY - margin && !placed; oy += stride) {
        for (let ox = margin - minX; ox <= cols - 1 - maxX - margin && !placed; ox += stride) {
          let ok = true
          for (const [rx, ry] of rel) {
            const cx = ox + rx, cy = oy + ry
            if (cx < 0 || cy < 0 || cx >= cols || cy >= rows || blocked.has(`${cx},${cy}`)) { ok = false; break }
          }
          if (!ok) continue
          const blk = make([ox, oy], this.alloc)
          this.block(blk)
          for (const [cx, cy] of this.blockCells(blk))
            for (let gx = -gap; gx <= gap; gx++) for (let gy = -gap; gy <= gap; gy++) blocked.add(`${cx + gx},${cy + gy}`)
          placed = true
        }
      }
    }
    return this
  }

  /**
   * Deliberate tower placement: PRIMARY game element. Two stages →
   *  (1) NEAT — generate candidate pads that hug each lane at a fixed perpendicular `offset`, evenly
   *      spaced, always one gap-cell off the trace (tidy rows parallel to the road).
   *  (2) STRATEGIC — greedy set-cover: repeatedly take the candidate that covers the most
   *      still-uncovered track, until `targetCover` of the path is in range. Fewest pads, best spots.
   * Result: the "ideal number of towers in ideal places". `coverageOf()` verifies the result.
   */
  /**
   * Patrol-line tower placement (deliberate TD logic). Walk each path SPAWN -> FINISH and drop a pad
   * every `spacing` cells, pushed `offset` cells off the lane into the gap beside it. Result: even,
   * full-length defence of the whole route, in tidy lines that follow the track; corners get a pad on
   * the inside (covering the doubled-back lane twice). Spawn-first order means a gold-limited defence
   * fortifies the entrance first (keeps levels winnable). `coverageOf()` verifies the result.
   */
  patrolSpots(opts: { count?: number; spacing?: number; offset?: number; specialEvery?: number; minSep?: number } = {}): this {
    const offset = opts.offset ?? 2, specialEvery = opts.specialEvery ?? 4, minSep = opts.minSep ?? 2.5
    // derive even spacing from a target tower COUNT (the gold economy wants few strong towers, not many
    // weak ones) — spacing = total path length / count, so pads spread evenly over the whole route.
    let totalLen = 0
    for (const t of this.paths) { const wp = t.waypoints; for (let i = 1; i < wp.length; i++) totalLen += Math.hypot(wp[i][0] - wp[i - 1][0], wp[i][1] - wp[i - 1][1]) }
    const spacing = opts.spacing ?? (opts.count ? Math.max(2, totalLen / opts.count) : 4)
    const { cols, rows } = this.board
    const blocked = this.pathBlocked(1)
    for (const k of this.occupiedByDecor(1)) blocked.add(k)   // spots must never land on a component
    const chosen: Cell[] = []
    const tryPlace = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= cols || y >= rows || blocked.has(`${x},${y}`)) return false
      if (chosen.some((c) => Math.hypot(c[0] - x, c[1] - y) < minSep)) return false
      chosen.push([x, y]); return true
    }
    for (const t of this.paths) {
      const wp = t.waypoints
      for (let i = 1; i < wp.length; i++) {
        const a = wp[i - 1], b = wp[i]
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy)
        if (len === 0) continue
        const ux = dx / len, uy = dy / len, px = -uy, py = ux
        for (let d = spacing / 2; d < len; d += spacing) {
          const mx = a[0] + ux * d, my = a[1] + uy * d
          // try each side at offset, then offset+1, take the first that fits (handles edges/bands)
          const tries: Array<[number, number]> = []
          for (const off of [offset, offset + 1]) for (const side of [1, -1])
            tries.push([Math.round(mx + px * off * side), Math.round(my + py * off * side)])
          for (const [cx, cy] of tries) if (tryPlace(cx, cy)) break
        }
      }
    }
    const pitch = this.board.pitch
    const samples = this.paths.flatMap((t) => pathSamples(t.waypoints, pitch))
    const score = (c: Cell): number => {
      const ctr = cellToPx(c, pitch); const r = 4 * pitch; let n = 0
      for (const sp of samples) if (dist(ctr, sp) <= r) n++; return n
    }
    chosen.forEach((c, idx) => {
      const sc = score(c)
      if ((idx + 1) % specialEvery === 0) this.specials.push({ cell: c, score: sc, kind: 'special' })
      else this.spots.push({ cell: c, score: sc, kind: 'build' })
    })
    return this
  }
  neatSpots(opts: {
    offset?: number; spacing?: number; minSep?: number; specialEvery?: number; max?: number
  } = {}): this {
    const offset = opts.offset ?? 2, spacing = opts.spacing ?? 3
    const minSep = opts.minSep ?? 3, specialEvery = opts.specialEvery ?? 4
    const { cols, rows } = this.board
    const blocked = this.pathBlocked(1)
    // (1) NEAT candidates: hug each lane at fixed perpendicular offsets, evenly spaced, off the trace.
    const cand: Cell[] = []; const seen = new Set<string>()
    for (const t of this.paths) {
      const wp = t.waypoints
      for (let i = 1; i < wp.length; i++) {
        const a = wp[i - 1], b = wp[i]
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy)
        if (len === 0) continue
        const ux = dx / len, uy = dy / len, px = -uy, py = ux
        for (let d = 0; d <= len; d += spacing) for (const off of [offset, offset + 1]) for (const side of [1, -1]) {
          const cx = Math.round(a[0] + ux * d + px * off * side)
          const cy = Math.round(a[1] + uy * d + py * off * side)
          const k = `${cx},${cy}`
          if (cx < 0 || cy < 0 || cx >= cols || cy >= rows || blocked.has(k) || seen.has(k)) continue
          seen.add(k); cand.push([cx, cy])
        }
      }
    }
    // (2) STRATEGIC: the proven coverage-greedy selector, restricted to the neat candidate set.
    const { spots, specialSpots } = computeTowerSpots({
      board: this.board, trace: this.paths, budget: opts.max ?? cand.length,
      minSeparation: minSep, specialEvery, pathGap: 1,
      occupied: this.occupiedByDecor(1), candidateCells: cand,
    })
    this.spots.push(...spots); this.specials.push(...specialSpots)
    return this
  }
  /** fraction of the path within range of at least one placed spot — the strategic-coverage check */
  coverageOf(rangeCells = 4): number {
    const pitch = this.board.pitch
    const samples = this.paths.flatMap((t) => pathSamples(t.waypoints, pitch))
    const range = rangeCells * pitch
    const all = [...this.spots, ...this.specials]
    let cov = 0
    for (const sp of samples) {
      let hit = false
      for (const s of all) { if (dist(cellToPx(s.cell, pitch), sp) <= range) { hit = true; break } }
      if (hit) cov++
    }
    return samples.length ? cov / samples.length : 0
  }

  build(): Level {
    if (this.paths.length === 0) throw new Error('level has no path')
    // Composition invariants (user rule): every segment is 0/45/90° — PCB traces never slur —
    // and every waypoint stays on the board. Fails the BUILD, not silently ships broken art.
    for (const p of this.paths) {
      for (let i = 1; i < p.waypoints.length; i++) {
        const [ax, ay] = p.waypoints[i - 1], [bx, by] = p.waypoints[i]
        const dx = Math.abs(bx - ax), dy = Math.abs(by - ay)
        if (!(dx === 0 || dy === 0 || dx === dy)) {
          throw new Error(`level "${this.meta.name}": segment [${ax},${ay}]→[${bx},${by}] is not octilinear (dx=${dx}, dy=${dy})`)
        }
      }
      for (const [x, y] of p.waypoints) {
        if (x < 0 || y < 0 || x >= this.board.cols || y >= this.board.rows) {
          throw new Error(`level "${this.meta.name}": waypoint [${x},${y}] is outside the ${this.board.cols}x${this.board.rows} board`)
        }
      }
    }
    const fin = new Set(this.paths.map((p) => {
      const w = p.waypoints[p.waypoints.length - 1]; return `${w[0]},${w[1]}`
    }))
    if (fin.size !== 1) throw new Error(`level must have exactly ONE finish, got ${fin.size}`)
    const trace = this.paths[0]
    const copper = routeCopper({
      board: this.board, decor: this.decor, nets: this.nets, trace, paths: this.paths,
      spots: [...this.spots, ...this.specials].map((s) => s.cell),
    })
    return {
      version: 1, board: this.board, seed: this.seed, trace, paths: this.paths,
      spots: this.spots, specialSpots: this.specials, decor: this.decor,
      nets: this.nets, copper, meta: this.meta,
    }
  }
}
