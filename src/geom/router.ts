import type { Cell } from './types'
import { cellKey } from './grid'

const DIRS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

function hash(c: Cell): number { return c[0] * 100000 + c[1] }

export function routeOctilinear(opts: {
  cols: number; rows: number; start: Cell; goal: Cell
  blocked?: Set<string>; turnPenalty?: number; wander?: number
}): Cell[] | null {
  const { cols, rows, start, goal } = opts
  const blocked = opts.blocked ?? new Set<string>()
  const turnPenalty = opts.turnPenalty ?? 1
  const wander = opts.wander ?? 0

  const h = (c: Cell) => Math.max(Math.abs(c[0] - goal[0]), Math.abs(c[1] - goal[1]))
  const gScore = new Map<string, number>()
  const cameFrom = new Map<string, { c: Cell; dir: Cell | null }>()
  const open: { c: Cell; dir: Cell | null; f: number }[] = []
  const startKey = cellKey(start)
  gScore.set(startKey, 0)
  open.push({ c: start, dir: null, f: h(start) })

  while (open.length) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i
    const cur = open.splice(bi, 1)[0]
    const curKey = cellKey(cur.c)
    if (cur.c[0] === goal[0] && cur.c[1] === goal[1]) {
      const path: Cell[] = [cur.c]
      let k = curKey
      while (cameFrom.has(k)) { const prev = cameFrom.get(k)!; path.push(prev.c); k = cellKey(prev.c) }
      return path.reverse()
    }
    for (const d of DIRS) {
      const nc: Cell = [cur.c[0] + d[0], cur.c[1] + d[1]]
      if (nc[0] < 0 || nc[1] < 0 || nc[0] >= cols || nc[1] >= rows) continue
      const nk = cellKey(nc)
      if (blocked.has(nk)) continue
      const stepCost = d[0] !== 0 && d[1] !== 0 ? Math.SQRT2 : 1
      const turn = cur.dir && (cur.dir[0] !== d[0] || cur.dir[1] !== d[1]) ? turnPenalty : 0
      const jitter = wander ? ((hash(nc) % 17) / 17) * wander : 0
      const tentative = (gScore.get(curKey) ?? Infinity) + stepCost + turn + jitter
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentative)
        cameFrom.set(nk, { c: cur.c, dir: cur.dir })
        open.push({ c: nc, dir: d, f: tentative + h(nc) })
      }
    }
  }
  return null
}
