# Tile-Based Track Foundation (T0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a tile grid the single source of truth for the enemy track (straight/corner/fork/bridge/start/finish tiles with matched ports → connected by construction), compiled to the existing `paths: Trace[]` + tower `spots` contract so render/decor/gameplay consume it unchanged.

**Architecture:** Pure tile modules in `src/tiles/` (model, ports, compiler, generator) — framework-free, fully unit-tested. Tiles compile to `Trace[]` (centerline polylines) + spots via existing `octilinearize`/`filletPath`/`computeTowerSpots`. Generator writes tile layouts from archetype skeletons (reusing the chain shapes), replacing the polyline path builders as the source of truth.

**Tech Stack:** TypeScript (strict), Vite, Pixi.js v8, Vitest. Reuses `geom` (`Cell`,`Pt`,`octilinearize`,`filletPath`), `model/level`, `pipeline/spots` (`computeTowerSpots`), `pipeline/decor` (`buildDecorWithNets`), `pipeline/rng`.

## Global Constraints
- TypeScript strict, ESM. Runtime dep limited to `pixi.js`. `tsc` has `noEmit`.
- Commits in **Russian**, short. **Never** mention AI/Claude/Opus/neural nets; no `Co-Authored-By`/AI trailers.
- Tile logic in `src/tiles/` is **pure** (no Pixi/DOM), unit-tested.
- `tileSize = 6` fine cells per tile. Ports orthogonal only (`N/E/S/W`); 45° is a render style of `corner`.
- Tile center in fine cells: `[tc*tileSize + floor(tileSize/2), tr*tileSize + floor(tileSize/2)]`.
- Canonical ports (rot 0), rotated clockwise by `rot` (N→E→S→W): straight `[N,S]`, corner `[N,E]`, fork `[W,E,S]`, bridge `[N,E,S,W]`, start `[N]`, finish `[N]`, empty `[]`.
- Connectivity guaranteed by the generator (matched ports); compiler degrades gracefully on dangling ports.
- `tiles` is source of truth; `paths`/`spots` are derived + stored. Gameplay/render contract (`levelPaths`+`spots`) unchanged.
- `bridge`: route entering a port exits the **opposite** port (N↔S and E↔W independent — a true crossing, not a merge).

---

### Task 1: Tile model + ports

**Files:**
- Create: `src/tiles/types.ts`, `src/tiles/ports.ts`
- Modify: `src/model/level.ts` (add `TileGrid`/`Tile` + `tiles?` on `Level`)
- Test: `tests/tiles/ports.test.ts`

**Interfaces:**
- Consumes: `Cell` from `src/geom/types`.
- Produces:
  - `type Port = 'N'|'E'|'S'|'W'`; `type TileType = 'straight'|'corner'|'fork'|'bridge'|'start'|'finish'|'empty'`
  - `type Rot = 0|90|180|270`
  - `interface Tile { type: TileType; rot: Rot; forkRule?: 'split5050'|'byType'|'timer'|'membrane' }`
  - `interface TileGrid { tileSize: number; tcols: number; trows: number; tiles: Tile[] }` (row-major, length `tcols*trows`)
  - `tilePorts(tile: Tile): Port[]` — canonical ports rotated by `rot`
  - `opposite(p: Port): Port`; `portDelta(p: Port): [number, number]` (tile-grid neighbor offset; N=[0,-1],E=[1,0],S=[0,1],W=[0,1] reversed... see code)
  - `rotatePort(p: Port, rot: Rot): Port`
  - `tileCenterCell(tc: number, tr: number, tileSize: number): Cell`
  - `Level.tiles?: TileGrid` (in `src/model/level.ts`)

- [ ] **Step 1: Write the failing test**

```ts
// tests/tiles/ports.test.ts
import { describe, it, expect } from 'vitest'
import { tilePorts, opposite, portDelta, tileCenterCell } from '../../src/tiles/ports'

describe('ports', () => {
  it('canonical straight is N/S, rotates to E/W at 90', () => {
    expect(new Set(tilePorts({ type: 'straight', rot: 0 }))).toEqual(new Set(['N', 'S']))
    expect(new Set(tilePorts({ type: 'straight', rot: 90 }))).toEqual(new Set(['E', 'W']))
  })
  it('corner N/E rotates clockwise', () => {
    expect(new Set(tilePorts({ type: 'corner', rot: 0 }))).toEqual(new Set(['N', 'E']))
    expect(new Set(tilePorts({ type: 'corner', rot: 90 }))).toEqual(new Set(['E', 'S']))
  })
  it('fork has 3 ports, bridge 4, start 1', () => {
    expect(tilePorts({ type: 'fork', rot: 0 })).toHaveLength(3)
    expect(tilePorts({ type: 'bridge', rot: 0 })).toHaveLength(4)
    expect(tilePorts({ type: 'start', rot: 0 })).toEqual(['N'])
    expect(tilePorts({ type: 'empty', rot: 0 })).toEqual([])
  })
  it('opposite + portDelta', () => {
    expect(opposite('N')).toBe('S'); expect(opposite('E')).toBe('W')
    expect(portDelta('N')).toEqual([0, -1]); expect(portDelta('E')).toEqual([1, 0]); expect(portDelta('W')).toEqual([-1, 0])
  })
  it('tileCenterCell maps tile to fine-cell center', () => {
    expect(tileCenterCell(0, 0, 6)).toEqual([3, 3])
    expect(tileCenterCell(2, 1, 6)).toEqual([15, 9])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tiles/ports.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/tiles/types.ts
export type Port = 'N' | 'E' | 'S' | 'W'
export type TileType = 'straight' | 'corner' | 'fork' | 'bridge' | 'start' | 'finish' | 'empty'
export type Rot = 0 | 90 | 180 | 270
export type ForkRule = 'split5050' | 'byType' | 'timer' | 'membrane'
export interface Tile { type: TileType; rot: Rot; forkRule?: ForkRule }
export interface TileGrid { tileSize: number; tcols: number; trows: number; tiles: Tile[] }
```

```ts
// src/tiles/ports.ts
import type { Cell } from '../geom/types'
import type { Port, Rot, Tile, TileType } from './types'

const ORDER: Port[] = ['N', 'E', 'S', 'W']
const CANONICAL: Record<TileType, Port[]> = {
  straight: ['N', 'S'], corner: ['N', 'E'], fork: ['W', 'E', 'S'],
  bridge: ['N', 'E', 'S', 'W'], start: ['N'], finish: ['N'], empty: [],
}
export function rotatePort(p: Port, rot: Rot): Port {
  return ORDER[(ORDER.indexOf(p) + rot / 90) % 4]
}
export function tilePorts(tile: Tile): Port[] {
  return CANONICAL[tile.type].map((p) => rotatePort(p, tile.rot))
}
export function opposite(p: Port): Port {
  return p === 'N' ? 'S' : p === 'S' ? 'N' : p === 'E' ? 'W' : 'E'
}
export function portDelta(p: Port): [number, number] {
  return p === 'N' ? [0, -1] : p === 'S' ? [0, 1] : p === 'E' ? [1, 0] : [-1, 0]
}
export function tileCenterCell(tc: number, tr: number, tileSize: number): Cell {
  const h = Math.floor(tileSize / 2)
  return [tc * tileSize + h, tr * tileSize + h]
}
```

In `src/model/level.ts` add (import the tile types):
```ts
import type { TileGrid } from '../tiles/types'
// ...add to interface Level:
  tiles?: TileGrid
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tiles/ports.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tiles/types.ts src/tiles/ports.ts src/model/level.ts tests/tiles/ports.test.ts
git commit -m "Тайлы: модель и порты (ротация, центр тайла)"
```

---

### Task 2: rotForPorts + layPath (tile-chain → tiles)

**Files:**
- Create: `src/tiles/layout.ts`
- Test: `tests/tiles/layout.test.ts`

**Interfaces:**
- Consumes: `Tile`, `TileType`, `Port`, `Rot`, `TileGrid`; `tilePorts`, `portDelta`, `opposite`.
- Produces:
  - `rotForPorts(type: TileType, desired: Port[]): Rot` — the rotation whose `tilePorts` set equals `desired` (first match of 0/90/180/270); throws if none.
  - `emptyGrid(tcols: number, trows: number, tileSize: number): TileGrid` (all `empty`)
  - `idx(grid, tc, tr): number`; `setTile(grid, tc, tr, tile)`; `getTile(grid, tc, tr): Tile | null` (null if OOB)
  - `layPath(grid: TileGrid, coords: [number,number][]): void` — given an ordered chain of orthogonally-adjacent tile coords, write `start` at coords[0] (port → coords[1]), `finish` at last (port → prev), and `straight`/`corner` between (ports = `{opposite(dirIn), dirOut}`), each with the rotation from `rotForPorts`. Does not overwrite an existing `fork`/`bridge` tile (so junctions placed by the generator survive).

- [ ] **Step 1: Write the failing test**

```ts
// tests/tiles/layout.test.ts
import { describe, it, expect } from 'vitest'
import { rotForPorts, emptyGrid, getTile, layPath } from '../../src/tiles/layout'
import { tilePorts } from '../../src/tiles/ports'

describe('layout', () => {
  it('rotForPorts finds rotation matching a desired port set', () => {
    expect(new Set(tilePorts({ type: 'corner', rot: rotForPorts('corner', ['E', 'S']) }))).toEqual(new Set(['E', 'S']))
    expect(new Set(tilePorts({ type: 'straight', rot: rotForPorts('straight', ['E', 'W']) }))).toEqual(new Set(['E', 'W']))
  })
  it('layPath writes start/finish and a corner at the bend', () => {
    const g = emptyGrid(5, 5, 6)
    // L-shape: (0,0)->(2,0)->(2,2): horizontal then down
    layPath(g, [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]])
    expect(getTile(g, 0, 0)!.type).toBe('start')
    expect(getTile(g, 2, 2)!.type).toBe('finish')
    expect(getTile(g, 1, 0)!.type).toBe('straight')
    expect(getTile(g, 2, 0)!.type).toBe('corner')          // the bend
    // corner connects W (came from) and S (going down)
    expect(new Set(tilePorts(getTile(g, 2, 0)!))).toEqual(new Set(['W', 'S']))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tiles/layout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/tiles/layout.ts
import type { Port, Rot, Tile, TileGrid, TileType } from './types'
import { tilePorts } from './ports'

const ROTS: Rot[] = [0, 90, 180, 270]
function sameSet(a: Port[], b: Port[]): boolean {
  if (a.length !== b.length) return false
  const sb = new Set(b); return a.every((p) => sb.has(p))
}
export function rotForPorts(type: TileType, desired: Port[]): Rot {
  for (const r of ROTS) if (sameSet(tilePorts({ type, rot: r }), desired)) return r
  throw new Error(`no rotation of ${type} matches ${desired.join('')}`)
}
export function emptyGrid(tcols: number, trows: number, tileSize: number): TileGrid {
  return { tileSize, tcols, trows, tiles: Array.from({ length: tcols * trows }, () => ({ type: 'empty', rot: 0 } as Tile)) }
}
export function idx(grid: TileGrid, tc: number, tr: number): number { return tr * grid.tcols + tc }
export function getTile(grid: TileGrid, tc: number, tr: number): Tile | null {
  if (tc < 0 || tr < 0 || tc >= grid.tcols || tr >= grid.trows) return null
  return grid.tiles[idx(grid, tc, tr)]
}
export function setTile(grid: TileGrid, tc: number, tr: number, tile: Tile): void {
  if (tc < 0 || tr < 0 || tc >= grid.tcols || tr >= grid.trows) return
  grid.tiles[idx(grid, tc, tr)] = tile
}
function dirPort(from: [number, number], to: [number, number]): Port {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  if (dx === 1) return 'E'; if (dx === -1) return 'W'; if (dy === 1) return 'S'; return 'N'
}
function opp(p: Port): Port { return p === 'N' ? 'S' : p === 'S' ? 'N' : p === 'E' ? 'W' : 'E' }

export function layPath(grid: TileGrid, coords: [number, number][]): void {
  for (let i = 0; i < coords.length; i++) {
    const [tc, tr] = coords[i]
    const existing = getTile(grid, tc, tr)
    if (existing && (existing.type === 'fork' || existing.type === 'bridge')) continue // keep junctions
    let type: TileType, desired: Port[]
    if (i === 0) { type = 'start'; desired = [dirPort(coords[0], coords[1])] }
    else if (i === coords.length - 1) { type = 'finish'; desired = [dirPort(coords[i], coords[i - 1])] }
    else {
      const pIn = opp(dirPort(coords[i - 1], coords[i]))
      const pOut = dirPort(coords[i], coords[i + 1])
      desired = [pIn, pOut]
      type = opp(pIn) === pOut ? 'straight' : 'corner'
    }
    setTile(grid, tc, tr, { type, rot: rotForPorts(type, desired) })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tiles/layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tiles/layout.ts tests/tiles/layout.test.ts
git commit -m "Тайлы: раскладка цепочки в тайлы (start/finish/прямая/угол)"
```

---

### Task 3: compileRoutes (tiles → Trace[])

**Files:**
- Create: `src/tiles/compile.ts`
- Test: `tests/tiles/compile.test.ts`

**Interfaces:**
- Consumes: `TileGrid`, `Tile`, `Port`; `tilePorts`, `portDelta`, `opposite`, `tileCenterCell`; `getTile`; `Trace` from `src/model/level`; `Cell`.
- Produces:
  - `compileRoutes(grid: TileGrid, cornerRadius?: number): Trace[]` — walk from each `start` to a `finish`, emitting tile-center waypoints; `fork` branches into multiple routes; `bridge` passes through opposite port. Returns one `Trace` per route. Guarded against loops by a step cap (`tcols*trows + 4`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/tiles/compile.test.ts
import { describe, it, expect } from 'vitest'
import { emptyGrid, layPath, setTile } from '../../src/tiles/layout'
import { compileRoutes } from '../../src/tiles/compile'
import { rotForPorts } from '../../src/tiles/layout'

describe('compileRoutes', () => {
  it('straight L-path compiles to one connected route', () => {
    const g = emptyGrid(5, 5, 6)
    layPath(g, [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]])
    const routes = compileRoutes(g)
    expect(routes).toHaveLength(1)
    const wp = routes[0].waypoints
    expect(wp[0]).toEqual([3, 3])                 // start tile (0,0) center
    expect(wp[wp.length - 1]).toEqual([15, 15])   // finish tile (2,2) center
  })
  it('a fork yields two routes that share the trunk start', () => {
    const g = emptyGrid(7, 7, 6)
    // trunk W->fork at (3,3); branches up to finish (3,1) and right to finish (5,3)
    layPath(g, [[1, 3], [2, 3], [3, 3]])                 // start..fork cell (overwritten next)
    setTile(g, 3, 3, { type: 'fork', rot: rotForPorts('fork', ['W', 'N', 'E']) }) // in W, out N+E
    layPath(g, [[3, 3], [3, 2], [3, 1]])  // keeps fork at (3,3); finish (3,1)
    layPath(g, [[3, 3], [4, 3], [5, 3]])  // keeps fork; finish (5,3)
    const routes = compileRoutes(g)
    expect(routes.length).toBe(2)
    for (const r of routes) expect(r.waypoints[0]).toEqual([9, 21]) // start tile (1,3) center
  })
  it('a bridge passes two routes through without merging', () => {
    const g = emptyGrid(5, 5, 6)
    setTile(g, 2, 2, { type: 'bridge', rot: 0 })
    layPath(g, [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]]) // vertical route through bridge
    layPath(g, [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]) // horizontal route through bridge
    const routes = compileRoutes(g)
    expect(routes.length).toBe(2) // independent crossing routes
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tiles/compile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/tiles/compile.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tiles/compile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tiles/compile.ts tests/tiles/compile.test.ts
git commit -m "Тайлы: компиляция в маршруты (развилка, мост, финиш)"
```

---

### Task 4: tileSpots (derive spots from compiled routes)

**Files:**
- Create: `src/tiles/spots.ts`
- Test: `tests/tiles/spots.test.ts`

**Interfaces:**
- Consumes: `TileGrid`, `Trace`, `Board`, `TowerSpot`; `computeTowerSpots` + `minSpots` (both from `src/pipeline/spots` — `minSpots` is relocated there in Task 5 to avoid a `generator ↔ tiles/spots` import cycle; `generator` re-exports it for back-compat).
- Produces: `tileSpots(args: { board: Board; routes: Trace[]; difficulty: number }): { spots: TowerSpot[]; specialSpots: TowerSpot[] }` — runs the existing coverage-greedy placement over ALL routes with the relax-retry loop guaranteeing `>= minSpots(difficulty)`. (Corner bias is emergent: bends carry the highest path-sample coverage.)

- [ ] **Step 1: Write the failing test**

```ts
// tests/tiles/spots.test.ts
import { describe, it, expect } from 'vitest'
import { tileSpots } from '../../src/tiles/spots'
import { minSpots } from '../../src/pipeline/generator'

const board = { cols: 48, rows: 36, pitch: 24 }
const routes = [{ waypoints: [[3, 3], [3, 30], [45, 30]] as [number, number][], cornerRadius: 0.5 }]

describe('tileSpots', () => {
  it('produces at least minSpots and never on a route cell', () => {
    const { spots, specialSpots } = tileSpots({ board, routes, difficulty: 4 })
    expect(spots.length + specialSpots.length).toBeGreaterThanOrEqual(minSpots(4))
  })
  it('is deterministic', () => {
    const a = tileSpots({ board, routes, difficulty: 4 })
    const b = tileSpots({ board, routes, difficulty: 4 })
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tiles/spots.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/tiles/spots.ts
import type { Board, Trace, TowerSpot } from '../model/level'
import { computeTowerSpots, minSpots } from '../pipeline/spots'

export function tileSpots(args: { board: Board; routes: Trace[]; difficulty: number }): { spots: TowerSpot[]; specialSpots: TowerSpot[] } {
  const target = minSpots(args.difficulty)
  const attempts = [
    { budget: target + 6, minSeparation: 3, rangeCells: 4 },
    { budget: target + 12, minSeparation: 2, rangeCells: 5 },
    { budget: target + 24, minSeparation: 1, rangeCells: 6 },
  ]
  let spots: TowerSpot[] = [], specialSpots: TowerSpot[] = []
  for (const a of attempts) {
    const res = computeTowerSpots({ board: args.board, trace: args.routes, budget: a.budget, minSeparation: a.minSeparation, rangeCells: a.rangeCells })
    spots = res.spots; specialSpots = res.specialSpots
    if (spots.length + specialSpots.length >= target) break
  }
  return { spots, specialSpots }
}
```

Note: `computeTowerSpots` already accepts `Trace | Trace[]` (multi-path infra). If its option key is `trace`, pass the array as `trace: args.routes`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tiles/spots.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tiles/spots.ts tests/tiles/spots.test.ts
git commit -m "Тайлы: расчёт спотов по маршрутам (>= minSpots)"
```

---

### Task 5: Tile generator (archetype → tiles) + wire into `generateLevel`

**Files:**
- Create: `src/tiles/generator.ts`
- Modify: `src/pipeline/generator.ts` (`generateLevel` builds tiles → compiles → sets `level.tiles`+`paths`+`spots`+decor; re-export `minSpots`), `src/pipeline/spots.ts` (add `minSpots`)
- Test: `tests/tiles/generator.test.ts`

**Interfaces:**
- Consumes: `emptyGrid`, `layPath`, `setTile`, `rotForPorts`; `compileRoutes`; `tileSpots`; `makeRng`; `octilinearize`; `buildDecorWithNets`; `Board`, `Level`, `TileGrid`.
- Produces:
  - `buildTileGrid(board: Board, difficulty: number, seed: number, archetype?: string): { grid: TileGrid; archetype: string }` — writes a tile layout for a chosen archetype (`serpentineH`,`serpentineV`,`spiral`,`branching`,`multiSpawn`,`cross`), connected by construction.
  - `generateLevel({ board, difficulty, seed, archetype? })` (rewritten in `src/pipeline/generator.ts`): `buildTileGrid` → `compileRoutes` → `octilinearize` each route → `tileSpots` → `buildDecorWithNets` over the routes → returns `Level` with `tiles`, `paths`, `trace=paths[0]`, `spots`, `specialSpots`, `decor`, `meta.archetype`.
  - **Relocate `minSpots`** to `src/pipeline/spots.ts` (`export function minSpots(difficulty: number): number { return Math.max(4, 6 + difficulty) }`) and in `src/pipeline/generator.ts` add `export { minSpots } from './spots'` (back-compat for existing tests/imports). This breaks the `generator ↔ tiles/spots` cycle.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tiles/generator.test.ts
import { describe, it, expect } from 'vitest'
import { buildTileGrid } from '../../src/tiles/generator'
import { compileRoutes } from '../../src/tiles/compile'
import { isOctilinear, octilinearize } from '../../src/geom/octilinear'
import { generateLevel, minSpots } from '../../src/pipeline/generator'

const board = { cols: 48, rows: 36, pitch: 24 }
const ARCHETYPES = ['serpentineH', 'serpentineV', 'spiral', 'branching', 'multiSpawn', 'cross']

describe('tile generator', () => {
  it('every archetype compiles to >=1 connected octilinear route', () => {
    for (const a of ARCHETYPES) {
      for (let seed = 0; seed < 12; seed++) {
        const { grid } = buildTileGrid(board, 4, seed, a)
        const routes = compileRoutes(grid)
        expect(routes.length).toBeGreaterThanOrEqual(1)
        for (const r of routes) {
          const wp = octilinearize(r.waypoints)
          expect(wp.length).toBeGreaterThanOrEqual(2)
          for (let i = 1; i < wp.length; i++) expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
        }
      }
    }
  })
  it('multiSpawn/branching/cross produce multiple routes', () => {
    for (const a of ['branching', 'multiSpawn', 'cross']) {
      const { grid } = buildTileGrid(board, 5, 1, a)
      expect(compileRoutes(grid).length).toBeGreaterThanOrEqual(2)
    }
  })
  it('generateLevel sets tiles + derived paths + spots; deterministic', () => {
    const lvl = generateLevel({ board, difficulty: 4, seed: 7 })
    expect(lvl.tiles).toBeTruthy()
    expect(lvl.paths!.length).toBeGreaterThanOrEqual(1)
    expect(lvl.spots.length + lvl.specialSpots.length).toBeGreaterThanOrEqual(minSpots(4))
    expect(generateLevel({ board, difficulty: 4, seed: 7 })).toEqual(lvl)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tiles/generator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tiles/generator.ts`**

Build a coarse tile grid (`tcols = floor(cols/6)`, `trows = floor(rows/6)`) and lay archetype chains with `layPath`; place `fork`/`bridge` tiles for junction archetypes. Provide a deterministic archetype picker. (Each archetype produces a connected chain of orthogonally-adjacent tile coords within `[1 .. tcols-2] × [1 .. trows-2]`.)

```ts
// src/tiles/generator.ts
import type { Board } from '../model/level'
import type { TileGrid } from './types'
import { emptyGrid, layPath, setTile, rotForPorts } from './layout'
import { makeRng } from '../pipeline/rng'

const ARCHES = ['serpentineH', 'serpentineV', 'spiral', 'branching', 'multiSpawn', 'cross'] as const
type Arch = typeof ARCHES[number]

function dims(board: Board): { tcols: number; trows: number; size: number } {
  const size = 6
  return { size, tcols: Math.max(5, Math.floor(board.cols / size)), trows: Math.max(5, Math.floor(board.rows / size)) }
}

// horizontal boustrophedon over tile rows
function serpentineH(g: TileGrid): void {
  const coords: [number, number][] = []
  const xL = 1, xR = g.tcols - 2
  const lanes = Math.min(g.trows - 2, Math.max(3, g.trows - 2))
  let yr = 1
  for (let i = 0; i < lanes; i++) {
    const row = Math.round(1 + (i / Math.max(1, lanes - 1)) * (g.trows - 3))
    if (i % 2 === 0) for (let x = xL; x <= xR; x++) coords.push([x, row])
    else for (let x = xR; x >= xL; x--) coords.push([x, row])
    // vertical connector to next lane handled by next lane's first coord being same column
    if (i < lanes - 1) {
      const x = i % 2 === 0 ? xR : xL
      const nrow = Math.round(1 + ((i + 1) / Math.max(1, lanes - 1)) * (g.trows - 3))
      for (let y = row + 1; y < nrow; y++) coords.push([x, y])
    }
    yr = row
  }
  // dedup consecutive duplicates
  const clean = coords.filter((c, i) => i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1])
  layPath(g, clean)
}

function serpentineV(g: TileGrid): void {
  // transpose of serpentineH
  const coords: [number, number][] = []
  const yT = 1, yB = g.trows - 2
  const lanes = Math.max(3, g.tcols - 2)
  for (let i = 0; i < lanes; i++) {
    const col = Math.round(1 + (i / Math.max(1, lanes - 1)) * (g.tcols - 3))
    if (i % 2 === 0) for (let y = yT; y <= yB; y++) coords.push([col, y])
    else for (let y = yB; y >= yT; y--) coords.push([col, y])
    if (i < lanes - 1) {
      const y = i % 2 === 0 ? yB : yT
      const ncol = Math.round(1 + ((i + 1) / Math.max(1, lanes - 1)) * (g.tcols - 3))
      for (let x = col + 1; x < ncol; x++) coords.push([x, y])
    }
  }
  const clean = coords.filter((c, i) => i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1])
  layPath(g, clean)
}

function spiral(g: TileGrid): void {
  let l = 1, r = g.tcols - 2, t = 1, b = g.trows - 2
  const coords: [number, number][] = []
  while (l <= r && t <= b) {
    for (let x = l; x <= r; x++) coords.push([x, t])
    for (let y = t + 1; y <= b; y++) coords.push([r, y])
    if (t < b) for (let x = r - 1; x >= l; x--) coords.push([x, b])
    if (l < r) for (let y = b - 1; y >= t + 1; y--) coords.push([l, y])
    l += 2; r -= 2; t += 2; b -= 2
  }
  const clean = coords.filter((c, i) => i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1])
  layPath(g, clean)
}

function branching(g: TileGrid): void {
  const midY = Math.floor(g.trows / 2)
  const fx = Math.floor(g.tcols / 2)
  layPath(g, range(1, fx).map((x) => [x, midY] as [number, number]))            // trunk → fork
  setTile(g, fx, midY, { type: 'fork', rot: rotForPorts('fork', ['W', 'N', 'S']) }) // in W, out N+S
  layPath(g, [[fx, midY], ...range(midY - 1, 1).map((y) => [fx, y] as [number, number]), ...range(fx + 1, g.tcols - 2).map((x) => [x, 1] as [number, number])])
  layPath(g, [[fx, midY], ...range(midY + 1, g.trows - 2).map((y) => [fx, y] as [number, number]), ...range(fx + 1, g.tcols - 2).map((x) => [x, g.trows - 2] as [number, number])])
}

function multiSpawn(g: TileGrid, n: number): void {
  const bx = g.tcols - 2, by = Math.floor(g.trows / 2)
  setTile(g, bx, by, { type: 'finish', rot: 0 }) // overwritten ports by layPath finishes; keep as base marker
  const rowsFor = [1, g.trows - 2, Math.floor(g.trows / 3)].slice(0, Math.max(2, n))
  for (const ry of rowsFor) layPath(g, range(1, bx).map((x) => [x, ry] as [number, number]).concat(by !== ry ? colSeg(bx, ry, by) : []))
}

function cross(g: TileGrid): void {
  const cx = Math.floor(g.tcols / 2), cy = Math.floor(g.trows / 2)
  setTile(g, cx, cy, { type: 'bridge', rot: 0 })
  layPath(g, range(1, g.tcols - 2).map((x) => [x, cy] as [number, number]))
  layPath(g, range(1, g.trows - 2).map((y) => [cx, y] as [number, number]))
}

function range(a: number, b: number): number[] { const out: number[] = []; const s = a <= b ? 1 : -1; for (let v = a; s > 0 ? v <= b : v >= b; v += s) out.push(v); return out }
function colSeg(x: number, y0: number, y1: number): [number, number][] { return range(y0, y1).map((y) => [x, y] as [number, number]) }

export function buildTileGrid(board: Board, difficulty: number, seed: number, archetype?: string): { grid: TileGrid; archetype: string } {
  const { tcols, trows, size } = dims(board)
  const g = emptyGrid(tcols, trows, size)
  const rng = makeRng(seed)
  const arch = (archetype as Arch) ?? ARCHES[Math.floor(rng() * ARCHES.length)]
  switch (arch) {
    case 'serpentineH': serpentineH(g); break
    case 'serpentineV': serpentineV(g); break
    case 'spiral': spiral(g); break
    case 'branching': branching(g); break
    case 'multiSpawn': multiSpawn(g, 2 + Math.floor(difficulty / 3)); break
    case 'cross': cross(g); break
    default: serpentineH(g)
  }
  return { grid: g, archetype: arch }
}
```

Then rewrite `generateLevel` in `src/pipeline/generator.ts`:
```ts
import { buildTileGrid } from '../tiles/generator'
import { compileRoutes } from '../tiles/compile'
import { tileSpots } from '../tiles/spots'
// keep: octilinearize, buildDecorWithNets, makeRng, types
export function generateLevel(params: { board: Board; difficulty: number; seed: number; archetype?: string }): Level {
  const { board, difficulty, seed } = params
  const { grid, archetype } = buildTileGrid(board, difficulty, seed, params.archetype)
  const routes = compileRoutes(grid).map((t) => ({ waypoints: octilinearize(t.waypoints), cornerRadius: 0.5 }))
  const paths = routes.length ? routes : [{ waypoints: [[1, 1], [board.cols - 2, board.rows - 2]] as Cell[], cornerRadius: 0.5 }]
  const { spots, specialSpots } = tileSpots({ board, routes: paths, difficulty })
  const { decor, nets } = buildDecorWithNets({ board, trace: paths, spots, specialSpots, seed })
  return { version: 1, board, seed, tiles: grid, trace: paths[0], paths, spots, specialSpots, decor, nets, meta: { name: `Level ${difficulty.toString().padStart(2, '0')}`, difficulty, archetype } }
}
```
(`minSpots` stays as-is. Old polyline archetype builders may be deleted or left unused — remove to satisfy `noUnusedLocals`, or keep only if still imported.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tiles/generator.test.ts && npx vitest run`
Expected: PASS (all suites; fix any test that asserted the old single-path shape to use `paths`/`tiles`).

- [ ] **Step 5: Commit**

```bash
git add src/tiles/generator.ts src/pipeline/generator.ts tests/tiles/generator.test.ts
git commit -m "Тайлы: генератор архетипов (раскладка тайлов) + generateLevel"
```

---

### Task 6: Bridge over/under render + optional tile-grid guide

**Files:**
- Modify: `src/render/Renderer.ts`
- Test: manual (`npm run build` + visual).

**Interfaces:**
- Consumes: `Level.tiles`, `levelPaths`; existing `TraceLayer` draw.

- [ ] **Step 1: Implement**

`compileRoutes` already feeds `paths`, so traces render via the existing path drawing with no change. Add:
- At each `bridge` tile center, after drawing traces, draw a short **substrate-colored gap** (over/under) across ONE axis of the crossing so it reads as a crossing, not a merge: a small `PALETTE.substrate` rounded rect (~`pitch*0.5` long) centered on the bridge tile's center cell, oriented along the route that should pass "under". (Pick the horizontal route as under.)
- Optional editor-only faint tile-grid guide in the overlay layer (lines every `tileSize` cells, `PALETTE.silk`, very low alpha) — only when not playing.

- [ ] **Step 2: Build + visual check**

Run: `npm run build` → succeeds.
Run: `npm run dev` → Auto-Generate repeatedly → each archetype renders; a `cross` level shows a real over/under crossing at the bridge (one trace dips under), not a merge.

- [ ] **Step 3: Commit**

```bash
git add src/render/Renderer.ts
git commit -m "Рендер: мост over/under на bridge-тайле, сетка-гайд"
```

---

### Task 7: Tile editor palette

**Files:**
- Create: `src/editor/TilePalette.ts`
- Modify: `src/editor/EditorState.ts` (hold an optional `tiles` grid + recompile), `src/main.ts` (mount palette, wire recompile)
- Test: `tests/editor/tilePalette.test.ts` (pure: placing a tile + recompiling yields routes)

**Interfaces:**
- Consumes: `TileGrid`, `Tile`, `TileType`, `Rot`; `emptyGrid`, `setTile`; `compileRoutes`; `tileSpots`; `buildDecorWithNets`; `octilinearize`; `Renderer`, `Camera`.
- Produces:
  - `recompileTiles(grid: TileGrid, board: Board, difficulty: number, seed: number): Pick<Level,'paths'|'trace'|'spots'|'specialSpots'|'decor'|'nets'>` — pure: tiles → derived level fields.
  - `class TilePalette` — DOM palette of tile types (+ rotate); exposes `selected(): { type: TileType } | null`. `mount(): HTMLElement`.
  - Editor: clicking a tile cell in tile-edit mode writes the selected tile (with a chosen rot), recompiles (debounced), redraws.

- [ ] **Step 1: Write the failing test**

```ts
// tests/editor/tilePalette.test.ts
import { describe, it, expect } from 'vitest'
import { recompileTiles } from '../../src/editor/TilePalette'
import { emptyGrid, layPath } from '../../src/tiles/layout'

describe('recompileTiles', () => {
  it('compiles an edited grid into derived level fields', () => {
    const g = emptyGrid(6, 6, 6)
    layPath(g, [[1, 1], [2, 1], [3, 1], [4, 1]])
    const out = recompileTiles(g, { cols: 36, rows: 36, pitch: 24 }, 3, 1)
    expect(out.paths!.length).toBeGreaterThanOrEqual(1)
    expect(out.spots.length + out.specialSpots.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/editor/tilePalette.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `recompileTiles` (pure) + `TilePalette` (DOM) + editor wiring.

```ts
// src/editor/TilePalette.ts (recompile is the tested core; palette is DOM)
import type { Board, Level } from '../model/level'
import type { TileGrid, TileType } from '../tiles/types'
import { compileRoutes } from '../tiles/compile'
import { tileSpots } from '../tiles/spots'
import { buildDecorWithNets } from '../pipeline/decor'
import { octilinearize } from '../geom/octilinear'

export function recompileTiles(grid: TileGrid, board: Board, difficulty: number, seed: number): Pick<Level, 'paths' | 'trace' | 'spots' | 'specialSpots' | 'decor' | 'nets'> {
  const routes = compileRoutes(grid).map((t) => ({ waypoints: octilinearize(t.waypoints), cornerRadius: 0.5 }))
  const paths = routes.length ? routes : [{ waypoints: [[1, 1], [board.cols - 2, 1]] as [number, number][], cornerRadius: 0.5 }]
  const { spots, specialSpots } = tileSpots({ board, routes: paths, difficulty })
  const { decor, nets } = buildDecorWithNets({ board, trace: paths, spots, specialSpots, seed })
  return { paths, trace: paths[0], spots, specialSpots, decor, nets }
}

const PALETTE_TYPES: TileType[] = ['straight', 'corner', 'fork', 'bridge', 'start', 'finish', 'empty']
export class TilePalette {
  private sel: TileType | null = null
  selected(): TileType | null { return this.sel }
  mount(): HTMLElement {
    const bar = document.createElement('div'); bar.className = 'pcb-tilepalette'
    for (const t of PALETTE_TYPES) {
      const b = document.createElement('button'); b.textContent = t; b.onclick = () => { this.sel = t }
      bar.appendChild(b)
    }
    document.body.appendChild(bar); return bar
  }
}
```

Wire in `src/main.ts`: a "Tiles" mode where clicking the canvas converts the world point to a tile coord (`floor(cell / tileSize)`), `setTile(grid, tc, tr, { type: selected, rot })`, then `recompileTiles` → apply to `editor.state.level` → redraw. Add a CSS block for `.pcb-tilepalette` matching the existing toolbar style. (Editor's freehand draw stays as a separate legacy mode.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/editor/tilePalette.test.ts`
Expected: PASS.

- [ ] **Step 5: Build + commit**

Run: `npm run build` → succeeds.
```bash
git add src/editor/TilePalette.ts src/editor/EditorState.ts src/main.ts src/ui/styles.css tests/editor/tilePalette.test.ts
git commit -m "Редактор: палитра тайлов и пересборка маршрутов"
```

---

### Task 8: Save/Load persists tiles + full-suite + visual integration

**Files:**
- Modify: `src/main.ts` (ensure Save serializes `tiles`; Load recompiles if `tiles` present but `paths` stale)
- Test: `tests/model/levelTiles.test.ts`

**Interfaces:**
- Consumes: `serializeLevel`/`parseLevel`; `recompileTiles`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/model/levelTiles.test.ts
import { describe, it, expect } from 'vitest'
import { serializeLevel, parseLevel } from '../../src/model/level'
import { generateLevel } from '../../src/pipeline/generator'

describe('level tiles round-trip', () => {
  it('serialize/parse preserves tiles and derived paths', () => {
    const lvl = generateLevel({ board: { cols: 48, rows: 36, pitch: 24 }, difficulty: 4, seed: 3 })
    const back = parseLevel(serializeLevel(lvl))
    expect(back.tiles).toEqual(lvl.tiles)
    expect(back.paths).toEqual(lvl.paths)
  })
})
```

- [ ] **Step 2: Run test to verify it fails (or passes if model already generic)**

Run: `npx vitest run tests/model/levelTiles.test.ts`
Expected: FAIL only if serialization drops `tiles`; since `serializeLevel` is `JSON.stringify`, this likely PASSES — in that case keep the test as a regression guard and proceed.

- [ ] **Step 3: Ensure Load recompiles when needed (`src/main.ts`)**

On Load, after `parseLevel`, if `level.tiles` is present, call `recompileTiles(level.tiles, level.board, level.meta.difficulty, level.seed)` and merge the derived fields (so a hand-edited/older file is consistent). Wire it in the existing `onLoad`.

- [ ] **Step 4: Full suite + build + visual**

Run: `npx vitest run` → ALL pass.
Run: `npm run build` → succeeds.
Run: `npm run dev` → Auto-Generate cycles archetypes (now tile-compiled); Tiles mode lets you place/rotate tiles and the path/spots/decor recompile live; Save then Load restores the tile level. Bridges show crossings; forks split.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts tests/model/levelTiles.test.ts
git commit -m "Тайлы: сохранение/загрузка уровня и пересборка при загрузке"
```

---

## Self-Review Notes (spec coverage)
- Tile model + ports + rotation → Task 1. Chain→tiles (layPath) → Task 2.
- Compiler tiles→routes (straight/corner/fork branch/bridge through/start-finish) → Task 3.
- Spots from routes (≥ minSpots, corner-biased emergent) → Task 4.
- Tile generator (6 archetypes as tile layouts) replacing polyline source + `generateLevel` → Task 5.
- Bridge over/under render + tile-grid guide → Task 6. Tile editor palette + recompile → Task 7.
- Format: `tiles` source of truth, derived `paths`/`spots`, round-trip + load recompile → Tasks 1,8.
- Render/decor/gameplay contract (`levelPaths`+`spots`) unchanged — verified by full suite staying green.

Out of scope (later): gameplay G1 (enemies/towers/waves — built on this contract); fork runtime behavior (data only); G2 Monte-Carlo optimizer; audio/save-progress/art.

After T0 is green, proceed to the G1 gameplay plan (`docs/superpowers/plans/2026-06-29-pcb-td-gameplay-g1.md`), which consumes `levelPaths`+`spots` unchanged.
