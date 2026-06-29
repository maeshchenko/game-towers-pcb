import type { Cell } from '../geom/types'
import type { Trace } from '../model/level'
import type { Port, TileGrid } from './types'
import { tilePorts, portDelta, opposite, tileCenterCell } from './ports'
import { getTile } from './layout'

interface Walk { tc: number; tr: number; entry: Port | null; pts: Cell[]; seen: Set<string> }

// state key = tile + entry direction; revisiting the same (tile, entry) means a cycle.
// Per-walk `seen` (copied on each branch) stops cycles from looping forever or starving
// sibling branches — important for hand-edited grids that may contain loops.
function stateKey(tc: number, tr: number, entry: Port | null): string { return `${tc},${tr},${entry ?? '-'}` }

export function compileRoutes(grid: TileGrid, cornerRadius = 0.5): Trace[] {
  const routes: Trace[] = []
  const starts: Walk[] = []
  for (let tr = 0; tr < grid.trows; tr++)
    for (let tc = 0; tc < grid.tcols; tc++) {
      const t = getTile(grid, tc, tr)
      if (t && t.type === 'start') starts.push({ tc, tr, entry: null, pts: [], seen: new Set() })
    }

  for (const s of starts) {
    const stack: Walk[] = [{ tc: s.tc, tr: s.tr, entry: null, pts: [tileCenterCell(s.tc, s.tr, grid.tileSize)], seen: new Set([stateKey(s.tc, s.tr, null)]) }]
    while (stack.length) {
      const w = stack.pop()!
      const tile = getTile(grid, w.tc, w.tr)
      if (!tile) continue
      if (tile.type === 'finish' && w.entry !== null) { routes.push({ waypoints: w.pts, cornerRadius }); continue }
      const ports = tilePorts(tile)
      // exits: bridge → opposite(entry) only; others → all ports except entry
      let exits: Port[]
      if (tile.type === 'bridge' && w.entry) exits = ports.includes(opposite(w.entry)) ? [opposite(w.entry)] : []
      else exits = ports.filter((p) => p !== w.entry)
      for (const ex of exits) {
        const [dx, dy] = portDelta(ex)
        const ntc = w.tc + dx, ntr = w.tr + dy
        const nb = getTile(grid, ntc, ntr)
        if (!nb || !tilePorts(nb).includes(opposite(ex))) continue // unmatched / dangling → skip
        const key = stateKey(ntc, ntr, opposite(ex))
        if (w.seen.has(key)) continue // cycle: already passed through this tile in this direction
        stack.push({ tc: ntc, tr: ntr, entry: opposite(ex), pts: [...w.pts, tileCenterCell(ntc, ntr, grid.tileSize)], seen: new Set(w.seen).add(key) })
      }
    }
  }
  return routes
}
