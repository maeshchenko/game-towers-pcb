import type { Cell } from '../geom/types'
import type { Trace } from '../model/level'
import type { Port, TileGrid } from './types'
import { tilePorts, portDelta, opposite, tileCenterCell } from './ports'
import { getTile } from './layout'

interface Walk { tc: number; tr: number; entry: Port | null; pts: Cell[] }

export function compileRoutes(grid: TileGrid, cornerRadius = 0.5): Trace[] {
  const routes: Trace[] = []
  const cap = grid.tcols * grid.trows + 4
  const starts: Walk[] = []
  for (let tr = 0; tr < grid.trows; tr++)
    for (let tc = 0; tc < grid.tcols; tc++) {
      const t = getTile(grid, tc, tr)
      if (t && t.type === 'start') starts.push({ tc, tr, entry: null, pts: [] })
    }

  for (const s of starts) {
    const stack: Walk[] = [{ ...s, pts: [tileCenterCell(s.tc, s.tr, grid.tileSize)] }]
    let steps = 0
    while (stack.length && steps++ < cap * 4) {
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
        stack.push({ tc: ntc, tr: ntr, entry: opposite(ex), pts: [...w.pts, tileCenterCell(ntc, ntr, grid.tileSize)] })
      }
    }
  }
  return routes
}
