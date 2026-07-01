# PCB TD Map Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser map editor for a PCB-styled 2D tower-defense game: draw an octilinear PCB trace, auto-compute tower spots, auto-grow procedural component decor, auto-generate full solvable levels, and save/load a versioned Level JSON.

**Architecture:** True-2D Pixi.js v8 app. Pure logic/geometry modules (grid, octilinear, fillet, sampling, A* router, spots, decor, generator) are framework-free and fully unit-tested. Render layers are split into pure *builder* functions (unit-tested without WebGL) plus thin Pixi draw wrappers. Editor orchestrates tools + debounced auto-pipeline.

**Tech Stack:** TypeScript (strict), Vite, Pixi.js v8, Vitest. No runtime deps beyond `pixi.js`. Algorithm references (not deps): PathFinding.js, Red Blob Games flow-field, balance.ts/Decor.ts from `../tower-defence-game`.

## Global Constraints

- TypeScript strict mode; ES2020 target; ESM modules.
- Runtime dependencies limited to `pixi.js` (v8.x). Dev deps: `vite`, `vitest`, `typescript`, `@types/node`.
- Renderer is **true-2D**; depth is faked via 2D shading only (no 3D engine).
- Trace geometry is **octilinear**: every stored trace segment direction is one of 8 (dx,dy ∈ {-1,0,1}, not both 0).
- Grid coordinates `Cell = [col, row]` are integers; pixel coordinates `Pt = {x, y}` are floats.
- Board default: `{ cols: 64, rows: 48, pitch: 24 }`.
- Level JSON `version` is the literal `1`.
- Palette/render constants live only in `src/style/`; no hex literals elsewhere.
- Visual target: 1:1 with the reference image (dark-green substrate, multi-stroke glowing traces with rounded corners, gold build brackets, cyan special octagons, green START / red FINISH pads, procedural package decor).
- Commit after every task with a Conventional Commit message.

---

### Task 1: Project scaffold + Pixi bootstrap

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`
- Create: `src/main.ts`, `src/app/PixiApp.ts`
- Test: `tests/app/pixiApp.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createPixiApp(opts: { width: number; height: number; background: number }): Promise<import('pixi.js').Application>` — async Pixi v8 init.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "game-towers-pcb",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": { "pixi.js": "^8.6.0" },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
export default defineConfig({ server: { port: 5173 } })
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } })
```

`index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>PCB TD Editor</title>
    <style>html,body{margin:0;height:100%;background:#0b1611;overflow:hidden}</style>
  </head>
  <body><div id="app"></div><script type="module" src="/src/main.ts"></script></body>
</html>
```

- [ ] **Step 3: Write the failing test**

```ts
// tests/app/pixiApp.test.ts
import { describe, it, expect } from 'vitest'
import { createPixiApp } from '../../src/app/PixiApp'

describe('createPixiApp', () => {
  it('exports a factory function', () => {
    expect(typeof createPixiApp).toBe('function')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm install && npx vitest run tests/app/pixiApp.test.ts`
Expected: FAIL — cannot find module `../../src/app/PixiApp`.

- [ ] **Step 5: Implement `src/app/PixiApp.ts` and `src/main.ts`**

```ts
// src/app/PixiApp.ts
import { Application } from 'pixi.js'

export async function createPixiApp(opts: { width: number; height: number; background: number }): Promise<Application> {
  const app = new Application()
  await app.init({ width: opts.width, height: opts.height, background: opts.background, antialias: true })
  return app
}
```

```ts
// src/main.ts
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'

async function boot() {
  const app = await createPixiApp({ width: window.innerWidth, height: window.innerHeight, background: PALETTE.substrate })
  document.getElementById('app')!.appendChild(app.canvas)
}
boot()
```

Note: `src/main.ts` imports `./style/palette` (created in Task 11). Until then, `npm run dev` will fail to resolve it; that is expected — `main.ts` is wired up incrementally. The unit test does not import `main.ts`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/app/pixiApp.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vite.config.ts vitest.config.ts index.html src tests
git commit -m "chore: scaffold vite+pixi+vitest project"
```

---

### Task 2: Grid + vector primitives

**Files:**
- Create: `src/geom/types.ts`, `src/geom/grid.ts`
- Test: `tests/geom/grid.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Cell = [number, number]`, `interface Pt { x: number; y: number }`
  - `cellToPx(c: Cell, pitch: number): Pt` — center of cell in pixels
  - `snapToCell(p: Pt, pitch: number): Cell`
  - `dist(a: Pt, b: Pt): number`
  - `cellKey(c: Cell): string`

- [ ] **Step 1: Write the failing test**

```ts
// tests/geom/grid.test.ts
import { describe, it, expect } from 'vitest'
import { cellToPx, snapToCell, dist, cellKey } from '../../src/geom/grid'

describe('grid', () => {
  it('cellToPx returns cell center', () => {
    expect(cellToPx([0, 0], 24)).toEqual({ x: 12, y: 12 })
    expect(cellToPx([2, 3], 24)).toEqual({ x: 60, y: 84 })
  })
  it('snapToCell is inverse of cellToPx center', () => {
    expect(snapToCell({ x: 60, y: 84 }, 24)).toEqual([2, 3])
    expect(snapToCell({ x: 13, y: 11 }, 24)).toEqual([0, 0])
  })
  it('dist is euclidean', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
  it('cellKey is stable and unique', () => {
    expect(cellKey([2, 3])).toBe('2,3')
    expect(cellKey([2, 3])).toBe(cellKey([2, 3]))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/geom/grid.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/geom/types.ts
export type Cell = [number, number]
export interface Pt { x: number; y: number }
```

```ts
// src/geom/grid.ts
import type { Cell, Pt } from './types'

export function cellToPx(c: Cell, pitch: number): Pt {
  return { x: c[0] * pitch + pitch / 2, y: c[1] * pitch + pitch / 2 }
}
export function snapToCell(p: Pt, pitch: number): Cell {
  return [Math.floor(p.x / pitch), Math.floor(p.y / pitch)]
}
export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
export function cellKey(c: Cell): string {
  return `${c[0]},${c[1]}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/geom/grid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/geom tests/geom/grid.test.ts
git commit -m "feat: grid and vector primitives"
```

---

### Task 3: Level model + JSON serialize/parse

**Files:**
- Create: `src/model/level.ts`
- Test: `tests/model/level.test.ts`

**Interfaces:**
- Consumes: `Cell` from `src/geom/types`.
- Produces:
  - `interface Board { cols: number; rows: number; pitch: number }`
  - `interface Trace { waypoints: Cell[]; cornerRadius: number }`
  - `interface TowerSpot { cell: Cell; score: number; kind: 'build' | 'special' }`
  - `interface DecorItem { kind: string; variant: number; cell: Cell; rot: 0|90|180|270; scale: number; svg?: string }`
  - `interface Level { version: 1; board: Board; seed: number; trace: Trace; spots: TowerSpot[]; specialSpots: TowerSpot[]; decor: DecorItem[]; meta: { name: string; difficulty: number } }`
  - `serializeLevel(l: Level): string`
  - `parseLevel(s: string): Level` (throws `Error` on version mismatch / malformed)

- [ ] **Step 1: Write the failing test**

```ts
// tests/model/level.test.ts
import { describe, it, expect } from 'vitest'
import { serializeLevel, parseLevel, type Level } from '../../src/model/level'

const sample: Level = {
  version: 1,
  board: { cols: 64, rows: 48, pitch: 24 },
  seed: 12345,
  trace: { waypoints: [[2, 4], [2, 20], [30, 20]], cornerRadius: 0.5 },
  spots: [{ cell: [9, 8], score: 12, kind: 'build' }],
  specialSpots: [{ cell: [20, 15], score: 0, kind: 'special' }],
  decor: [{ kind: 'soic', variant: 8, cell: [5, 30], rot: 90, scale: 1 }],
  meta: { name: 'Level 05', difficulty: 5 },
}

describe('level serialization', () => {
  it('round-trips losslessly', () => {
    expect(parseLevel(serializeLevel(sample))).toEqual(sample)
  })
  it('rejects wrong version', () => {
    const bad = serializeLevel(sample).replace('"version":1', '"version":2')
    expect(() => parseLevel(bad)).toThrow(/version/i)
  })
  it('rejects malformed json', () => {
    expect(() => parseLevel('{not json')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/model/level.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/model/level.ts
import type { Cell } from '../geom/types'

export interface Board { cols: number; rows: number; pitch: number }
export interface Trace { waypoints: Cell[]; cornerRadius: number }
export interface TowerSpot { cell: Cell; score: number; kind: 'build' | 'special' }
export interface DecorItem { kind: string; variant: number; cell: Cell; rot: 0 | 90 | 180 | 270; scale: number; svg?: string }
export interface Level {
  version: 1
  board: Board
  seed: number
  trace: Trace
  spots: TowerSpot[]
  specialSpots: TowerSpot[]
  decor: DecorItem[]
  meta: { name: string; difficulty: number }
}

export function serializeLevel(l: Level): string {
  return JSON.stringify(l)
}

export function parseLevel(s: string): Level {
  const obj = JSON.parse(s)
  if (obj?.version !== 1) throw new Error(`unsupported level version: ${obj?.version}`)
  return obj as Level
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/model/level.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model tests/model/level.test.ts
git commit -m "feat: level model and json round-trip"
```

---

### Task 4: Octilinear path builder

**Files:**
- Create: `src/geom/octilinear.ts`
- Test: `tests/geom/octilinear.test.ts`

**Interfaces:**
- Consumes: `Cell` from `src/geom/types`.
- Produces:
  - `isOctilinear(a: Cell, b: Cell): boolean` — true if the a→b segment is axis- or 45°-aligned.
  - `octilinearize(points: Cell[]): Cell[]` — given clicked cells, return waypoints where every consecutive pair is octilinear, inserting one corner cell for any non-octilinear segment (diagonal run first, then axis run). Collapses duplicate consecutive cells.

- [ ] **Step 1: Write the failing test**

```ts
// tests/geom/octilinear.test.ts
import { describe, it, expect } from 'vitest'
import { isOctilinear, octilinearize } from '../../src/geom/octilinear'

describe('octilinear', () => {
  it('detects octilinear segments', () => {
    expect(isOctilinear([0, 0], [0, 5])).toBe(true)   // vertical
    expect(isOctilinear([0, 0], [5, 0])).toBe(true)   // horizontal
    expect(isOctilinear([0, 0], [5, 5])).toBe(true)   // 45 deg
    expect(isOctilinear([0, 0], [5, 2])).toBe(false)  // shallow
    expect(isOctilinear([0, 0], [0, 0])).toBe(false)  // zero-length
  })
  it('passes through already-octilinear paths unchanged', () => {
    const p: [number, number][] = [[0, 0], [0, 5], [5, 5]]
    expect(octilinearize(p)).toEqual(p)
  })
  it('inserts a corner for a non-octilinear segment', () => {
    // (0,0) -> (5,2): diagonal 2 then horizontal 3 => corner at (2,2)
    const out = octilinearize([[0, 0], [5, 2]])
    expect(out).toEqual([[0, 0], [2, 2], [5, 2]])
    for (let i = 1; i < out.length; i++) expect(isOctilinear(out[i - 1], out[i])).toBe(true)
  })
  it('collapses duplicate consecutive cells', () => {
    expect(octilinearize([[1, 1], [1, 1], [1, 4]])).toEqual([[1, 1], [1, 4]])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/geom/octilinear.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/geom/octilinear.ts
import type { Cell } from './types'

export function isOctilinear(a: Cell, b: Cell): boolean {
  const dx = Math.abs(b[0] - a[0])
  const dy = Math.abs(b[1] - a[1])
  if (dx === 0 && dy === 0) return false
  return dx === 0 || dy === 0 || dx === dy
}

function corner(a: Cell, b: Cell): Cell {
  // Diagonal run as long as possible, then straight. Corner = end of diagonal run.
  const sx = Math.sign(b[0] - a[0])
  const sy = Math.sign(b[1] - a[1])
  const diag = Math.min(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
  return [a[0] + sx * diag, a[1] + sy * diag]
}

export function octilinearize(points: Cell[]): Cell[] {
  const out: Cell[] = []
  const push = (c: Cell) => {
    const last = out[out.length - 1]
    if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c)
  }
  for (let i = 0; i < points.length; i++) {
    const cur = points[i]
    if (i === 0) { push(cur); continue }
    const prev = out[out.length - 1] ?? points[i - 1]
    if (!isOctilinear(prev, cur)) push(corner(prev, cur))
    push(cur)
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/geom/octilinear.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/geom/octilinear.ts tests/geom/octilinear.test.ts
git commit -m "feat: octilinear path builder"
```

---

### Task 5: Corner fillet (render polyline)

**Files:**
- Create: `src/geom/fillet.ts`
- Test: `tests/geom/fillet.test.ts`

**Interfaces:**
- Consumes: `Cell`, `Pt` from `src/geom/types`; `cellToPx` from `src/geom/grid`.
- Produces:
  - `filletPath(waypoints: Cell[], radiusCells: number, pitch: number, arcSteps?: number): Pt[]` — returns a pixel polyline through cell centers with each interior vertex replaced by a circular-arc approximation of radius `radiusCells * pitch` (clamped to half the shorter adjacent segment). Endpoints are exact cell centers.

- [ ] **Step 1: Write the failing test**

```ts
// tests/geom/fillet.test.ts
import { describe, it, expect } from 'vitest'
import { filletPath } from '../../src/geom/fillet'
import { cellToPx, dist } from '../../src/geom/grid'

describe('filletPath', () => {
  const pitch = 24
  it('keeps endpoints exact', () => {
    const wp: [number, number][] = [[0, 0], [0, 4], [4, 4]]
    const out = filletPath(wp, 0.5, pitch)
    expect(out[0]).toEqual(cellToPx([0, 0], pitch))
    expect(out[out.length - 1]).toEqual(cellToPx([4, 4], pitch))
  })
  it('rounds the corner: no point sits exactly on the sharp vertex', () => {
    const wp: [number, number][] = [[0, 0], [0, 4], [4, 4]]
    const sharp = cellToPx([0, 4], pitch)
    const out = filletPath(wp, 0.5, pitch)
    const minToSharp = Math.min(...out.map((p) => dist(p, sharp)))
    expect(minToSharp).toBeGreaterThan(0)
  })
  it('a straight path (no interior turn) returns its endpoints', () => {
    const out = filletPath([[0, 0], [0, 6]], 0.5, pitch)
    expect(out[0]).toEqual(cellToPx([0, 0], pitch))
    expect(out[out.length - 1]).toEqual(cellToPx([0, 6], pitch))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/geom/fillet.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/geom/fillet.ts
import type { Cell, Pt } from './types'
import { cellToPx } from './grid'

function sub(a: Pt, b: Pt): Pt { return { x: a.x - b.x, y: a.y - b.y } }
function add(a: Pt, b: Pt): Pt { return { x: a.x + b.x, y: a.y + b.y } }
function scale(a: Pt, s: number): Pt { return { x: a.x * s, y: a.y * s } }
function norm(a: Pt): Pt { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l } }
function len(a: Pt): number { return Math.hypot(a.x, a.y) }

export function filletPath(waypoints: Cell[], radiusCells: number, pitch: number, arcSteps = 6): Pt[] {
  const pts = waypoints.map((c) => cellToPx(c, pitch))
  if (pts.length < 3) return pts
  const radius = radiusCells * pitch
  const out: Pt[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], cur = pts[i], next = pts[i + 1]
    const inDir = norm(sub(cur, prev))
    const outDir = norm(sub(next, cur))
    const r = Math.min(radius, len(sub(cur, prev)) / 2, len(sub(next, cur)) / 2)
    const start = sub(cur, scale(inDir, r))   // leave the corner early
    const end = add(cur, scale(outDir, r))    // rejoin after the corner
    out.push(start)
    for (let s = 1; s < arcSteps; s++) {
      const t = s / arcSteps
      // quadratic Bezier with the sharp vertex as control point => smooth fillet
      const a = scale(start, (1 - t) * (1 - t))
      const b = scale(cur, 2 * (1 - t) * t)
      const c = scale(end, t * t)
      out.push(add(add(a, b), c))
    }
    out.push(end)
  }
  out.push(pts[pts.length - 1])
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/geom/fillet.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/geom/fillet.ts tests/geom/fillet.test.ts
git commit -m "feat: corner fillet render polyline"
```

---

### Task 6: Path sampling + coverage

**Files:**
- Create: `src/geom/sampling.ts`
- Test: `tests/geom/sampling.test.ts`

**Interfaces:**
- Consumes: `Cell`, `Pt`; `cellToPx`, `dist`.
- Produces:
  - `pathSamples(waypoints: Cell[], pitch: number, stepCells?: number): Pt[]` — dense points along the centerline (default step 0.5 cells).
  - `coverage(cell: Cell, rangeCells: number, samples: Pt[], pitch: number): number` — count of samples within `rangeCells*pitch` of the cell center.

Port of `../tower-defence-game/src/sim/balance.ts` `pathSamples`/`coverage` (3D→2D).

- [ ] **Step 1: Write the failing test**

```ts
// tests/geom/sampling.test.ts
import { describe, it, expect } from 'vitest'
import { pathSamples, coverage } from '../../src/geom/sampling'

describe('sampling', () => {
  it('samples a straight segment at the given step', () => {
    const s = pathSamples([[0, 0], [0, 10]], 24, 1)
    expect(s.length).toBeGreaterThanOrEqual(10)
    expect(s[0]).toEqual({ x: 12, y: 12 })
  })
  it('coverage counts nearby samples', () => {
    const s = pathSamples([[0, 0], [0, 10]], 24, 1)
    const near = coverage([1, 0], 2, s, 24)   // adjacent column, range 2 cells
    const far = coverage([30, 30], 2, s, 24)
    expect(near).toBeGreaterThan(0)
    expect(far).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/geom/sampling.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/geom/sampling.ts
import type { Cell, Pt } from './types'
import { cellToPx, dist } from './grid'

export function pathSamples(waypoints: Cell[], pitch: number, stepCells = 0.5): Pt[] {
  const out: Pt[] = []
  const step = stepCells * pitch
  const pts = waypoints.map((c) => cellToPx(c, pitch))
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const segLen = dist(a, b)
    const n = Math.max(1, Math.round(segLen / step))
    for (let k = 0; k < n; k++) {
      const t = k / n
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

export function coverage(cell: Cell, rangeCells: number, samples: Pt[], pitch: number): number {
  const center = cellToPx(cell, pitch)
  const range = rangeCells * pitch
  let c = 0
  for (const s of samples) if (dist(center, s) <= range) c++
  return c
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/geom/sampling.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/geom/sampling.ts tests/geom/sampling.test.ts
git commit -m "feat: path sampling and coverage scoring"
```

---

### Task 7: A* octilinear router

**Files:**
- Create: `src/geom/router.ts`
- Test: `tests/geom/router.test.ts`

**Interfaces:**
- Consumes: `Cell`; `cellKey`; `isOctilinear`.
- Produces:
  - `routeOctilinear(opts: { cols: number; rows: number; start: Cell; goal: Cell; blocked?: Set<string>; turnPenalty?: number; wander?: number }): Cell[] | null` — 8-direction A* returning a connected octilinear cell path start→goal, or `null` if none. Avoids cells in `blocked`. `turnPenalty` discourages zig-zag; `wander` (0..1) adds a deterministic-by-cell cost jitter to vary routes.

- [ ] **Step 1: Write the failing test**

```ts
// tests/geom/router.test.ts
import { describe, it, expect } from 'vitest'
import { routeOctilinear } from '../../src/geom/router'
import { isOctilinear, octilinearize } from '../../src/geom/octilinear'
import { cellKey } from '../../src/geom/grid'

describe('routeOctilinear', () => {
  it('finds a connected octilinear path on an empty board', () => {
    const path = routeOctilinear({ cols: 20, rows: 20, start: [0, 0], goal: [19, 19] })!
    expect(path[0]).toEqual([0, 0])
    expect(path[path.length - 1]).toEqual([19, 19])
    // every consecutive pair is a single octilinear grid step
    for (let i = 1; i < path.length; i++) expect(isOctilinear(path[i - 1], path[i])).toBe(true)
  })
  it('returns null when fully blocked', () => {
    const blocked = new Set<string>()
    for (let y = 0; y < 20; y++) blocked.add(cellKey([10, y]))  // wall column
    const path = routeOctilinear({ cols: 20, rows: 20, start: [0, 0], goal: [19, 19], blocked })
    expect(path).toBeNull()
  })
  it('the produced corner-collapsed waypoints stay octilinear', () => {
    const path = routeOctilinear({ cols: 30, rows: 30, start: [1, 1], goal: [25, 7], turnPenalty: 2 })!
    const wp = octilinearize(path)
    for (let i = 1; i < wp.length; i++) expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/geom/router.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/geom/router.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/geom/router.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/geom/router.ts tests/geom/router.test.ts
git commit -m "feat: A* octilinear grid router"
```

---

### Task 8: Compute tower spots (coverage-greedy)

**Files:**
- Create: `src/pipeline/spots.ts`
- Test: `tests/pipeline/spots.test.ts`

**Interfaces:**
- Consumes: `Board`, `Trace`, `TowerSpot`; `pathSamples`, `coverage`; `cellKey`.
- Produces:
  - `computeTowerSpots(args: { board: Board; trace: Trace; budget: number; rangeCells?: number; minSeparation?: number; specialEvery?: number }): { spots: TowerSpot[]; specialSpots: TowerSpot[] }` — greedy coverage placement (port of `Level.fromPathStrategic`): score free non-path cells adjacent-ish to the path, pick highest non-clustered up to `budget`; every `specialEvery`-th pick is tagged `special`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline/spots.test.ts
import { describe, it, expect } from 'vitest'
import { computeTowerSpots } from '../../src/pipeline/spots'
import { cellKey } from '../../src/geom/grid'

const trace = { waypoints: [[2, 2], [2, 20], [25, 20]] as [number, number][], cornerRadius: 0.5 }
const board = { cols: 40, rows: 30, pitch: 24 }

describe('computeTowerSpots', () => {
  it('returns at most budget build spots', () => {
    const { spots } = computeTowerSpots({ board, trace, budget: 8 })
    expect(spots.length).toBeGreaterThan(0)
    expect(spots.length).toBeLessThanOrEqual(8)
  })
  it('never places a spot on a path cell', () => {
    const pathCells = new Set(['2,2', '2,20', '25,20'])
    const { spots } = computeTowerSpots({ board, trace, budget: 8 })
    for (const s of spots) expect(pathCells.has(cellKey(s.cell))).toBe(false)
  })
  it('respects minimum separation between spots', () => {
    const { spots } = computeTowerSpots({ board, trace, budget: 12, minSeparation: 3 })
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) {
        const d = Math.hypot(spots[i].cell[0] - spots[j].cell[0], spots[i].cell[1] - spots[j].cell[1])
        expect(d).toBeGreaterThanOrEqual(3)
      }
  })
  it('tags some special spots', () => {
    const { specialSpots } = computeTowerSpots({ board, trace, budget: 12, specialEvery: 4 })
    expect(specialSpots.every((s) => s.kind === 'special')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/spots.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/pipeline/spots.ts
import type { Board, Trace, TowerSpot } from '../model/level'
import type { Cell } from '../geom/types'
import { cellKey } from '../geom/grid'
import { pathSamples, coverage } from '../geom/sampling'

function pathCellSet(trace: Trace): Set<string> {
  const set = new Set<string>()
  const wp = trace.waypoints
  for (let i = 1; i < wp.length; i++) {
    const a = wp[i - 1], b = wp[i]
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
    for (let k = 0; k <= steps; k++) {
      const t = steps === 0 ? 0 : k / steps
      set.add(cellKey([Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)]))
    }
  }
  return set
}

export function computeTowerSpots(args: {
  board: Board; trace: Trace; budget: number
  rangeCells?: number; minSeparation?: number; specialEvery?: number
}): { spots: TowerSpot[]; specialSpots: TowerSpot[] } {
  const rangeCells = args.rangeCells ?? 4
  const minSeparation = args.minSeparation ?? 3
  const specialEvery = args.specialEvery ?? 5
  const samples = pathSamples(args.trace.waypoints, args.board.pitch)
  const onPath = pathCellSet(args.trace)

  const candidates: { cell: Cell; score: number }[] = []
  for (let x = 0; x < args.board.cols; x++)
    for (let y = 0; y < args.board.rows; y++) {
      const cell: Cell = [x, y]
      if (onPath.has(cellKey(cell))) continue
      const score = coverage(cell, rangeCells, samples, args.board.pitch)
      if (score > 0) candidates.push({ cell, score })
    }
  candidates.sort((a, b) => b.score - a.score)

  const chosen: { cell: Cell; score: number }[] = []
  for (const cand of candidates) {
    if (chosen.length >= args.budget) break
    const tooClose = chosen.some((c) =>
      Math.hypot(c.cell[0] - cand.cell[0], c.cell[1] - cand.cell[1]) < minSeparation)
    if (!tooClose) chosen.push(cand)
  }

  const spots: TowerSpot[] = []
  const specialSpots: TowerSpot[] = []
  chosen.forEach((c, i) => {
    if ((i + 1) % specialEvery === 0) specialSpots.push({ cell: c.cell, score: c.score, kind: 'special' })
    else spots.push({ cell: c.cell, score: c.score, kind: 'build' })
  })
  return { spots, specialSpots }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pipeline/spots.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/spots.ts tests/pipeline/spots.test.ts
git commit -m "feat: coverage-greedy tower spot placement"
```

---

### Task 9: Grow decor (seeded procedural placement)

**Files:**
- Create: `src/pipeline/rng.ts`, `src/pipeline/decor.ts`
- Test: `tests/pipeline/decor.test.ts`

**Interfaces:**
- Consumes: `Board`, `Trace`, `TowerSpot`, `DecorItem`; `cellKey`.
- Produces:
  - `makeRng(seed: number): () => number` — splitmix32 PRNG in [0,1). (Port of `Decor.ts` PRNG.)
  - `growDecor(args: { board: Board; trace: Trace; spots: TowerSpot[]; specialSpots: TowerSpot[]; seed: number }): DecorItem[]` — greedy placement of component footprints over free cells, respecting trace/spot/other-decor clearance. Deterministic for a given seed.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline/decor.test.ts
import { describe, it, expect } from 'vitest'
import { makeRng } from '../../src/pipeline/rng'
import { growDecor } from '../../src/pipeline/decor'
import { cellKey } from '../../src/geom/grid'

const board = { cols: 40, rows: 30, pitch: 24 }
const trace = { waypoints: [[2, 2], [2, 20], [25, 20]] as [number, number][], cornerRadius: 0.5 }
const spots = [{ cell: [5, 5] as [number, number], score: 5, kind: 'build' as const }]
const specialSpots: never[] = []

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = makeRng(42), b = makeRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('differs across seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)())
  })
})

describe('growDecor', () => {
  it('is deterministic for a seed', () => {
    const a = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    const b = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    expect(a).toEqual(b)
  })
  it('places at least one item and none on a path or spot cell', () => {
    const items = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    expect(items.length).toBeGreaterThan(0)
    const blocked = new Set<string>(['2,2', '2,20', '25,20', '5,5'])
    for (const it of items) expect(blocked.has(cellKey(it.cell))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/decor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/pipeline/rng.ts
export function makeRng(seed: number): () => number {
  let s = (seed + 0x9e3779b9) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

```ts
// src/pipeline/decor.ts
import type { Board, Trace, TowerSpot, DecorItem } from '../model/level'
import type { Cell } from '../geom/types'
import { cellKey } from '../geom/grid'
import { makeRng } from './rng'

interface Spec { kind: string; w: number; h: number; variants: number[]; weight: number }
const SPECS: Spec[] = [
  { kind: 'qfp', w: 4, h: 4, variants: [32, 44, 64], weight: 1 },
  { kind: 'soic', w: 3, h: 2, variants: [8, 14, 16], weight: 2 },
  { kind: 'dip', w: 5, h: 2, variants: [8, 16], weight: 1 },
  { kind: 'electrolytic', w: 2, h: 2, variants: [1], weight: 2 },
  { kind: 'smdRes', w: 2, h: 1, variants: [1], weight: 4 },
  { kind: 'smdCap', w: 1, h: 1, variants: [1], weight: 4 },
  { kind: 'via', w: 1, h: 1, variants: [1], weight: 3 },
]

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

function weightedPick(rng: () => number): Spec {
  const total = SPECS.reduce((a, s) => a + s.weight, 0)
  let r = rng() * total
  for (const s of SPECS) { r -= s.weight; if (r <= 0) return s }
  return SPECS[SPECS.length - 1]
}

export function growDecor(args: {
  board: Board; trace: Trace; spots: TowerSpot[]; specialSpots: TowerSpot[]; seed: number
}): DecorItem[] {
  const rng = makeRng(args.seed)
  const occupied = blockedCells(args.trace, args.spots, args.specialSpots)
  const items: DecorItem[] = []
  const fits = (cell: Cell, w: number, h: number): boolean => {
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) {
      const c: Cell = [cell[0] + dx, cell[1] + dy]
      if (c[0] >= args.board.cols || c[1] >= args.board.rows) return false
      if (occupied.has(cellKey(c))) return false
    }
    return true
  }
  const mark = (cell: Cell, w: number, h: number) => {
    for (let dx = -1; dx <= w; dx++) for (let dy = -1; dy <= h; dy++) occupied.add(cellKey([cell[0] + dx, cell[1] + dy]))
  }
  const attempts = args.board.cols * args.board.rows
  for (let i = 0; i < attempts; i++) {
    const spec = weightedPick(rng)
    const rot = (rng() < 0.5 ? 0 : 90) as 0 | 90
    const w = rot === 90 ? spec.h : spec.w
    const h = rot === 90 ? spec.w : spec.h
    const cell: Cell = [Math.floor(rng() * args.board.cols), Math.floor(rng() * args.board.rows)]
    if (!fits(cell, w, h)) continue
    const variant = spec.variants[Math.floor(rng() * spec.variants.length)]
    items.push({ kind: spec.kind, variant, cell, rot, scale: 1 })
    mark(cell, w, h)
  }
  return items
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pipeline/decor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/rng.ts src/pipeline/decor.ts tests/pipeline/decor.test.ts
git commit -m "feat: seeded procedural decor placement"
```

---

### Task 10: Level generator + solvability invariant

**Files:**
- Create: `src/pipeline/generator.ts`
- Test: `tests/pipeline/generator.test.ts`

**Interfaces:**
- Consumes: `Board`, `Level`; `routeOctilinear`; `octilinearize`; `computeTowerSpots`; `growDecor`; `cellKey`; `makeRng`.
- Produces:
  - `generateLevel(params: { board: Board; difficulty: number; seed: number }): Level` — picks START/FINISH on opposite edges, A*-routes a trace with difficulty-scaled wander/turn settings, computes spots and decor. Guarantees a connected trace and `spots.length + specialSpots.length >= minSpots(difficulty)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline/generator.test.ts
import { describe, it, expect } from 'vitest'
import { generateLevel } from '../../src/pipeline/generator'
import { isOctilinear } from '../../src/geom/octilinear'

describe('generateLevel', () => {
  const board = { cols: 48, rows: 36, pitch: 24 }

  it('produces a valid octilinear connected trace', () => {
    const lvl = generateLevel({ board, difficulty: 3, seed: 1 })
    const wp = lvl.trace.waypoints
    expect(wp.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < wp.length; i++) expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
  })

  it('is deterministic per seed', () => {
    expect(generateLevel({ board, difficulty: 3, seed: 99 }))
      .toEqual(generateLevel({ board, difficulty: 3, seed: 99 }))
  })

  it('solvability invariant holds over 100 seeds', () => {
    for (let seed = 0; seed < 100; seed++) {
      const lvl = generateLevel({ board, difficulty: 4, seed })
      const wp = lvl.trace.waypoints
      expect(wp.length).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < wp.length; i++) expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
      expect(lvl.spots.length + lvl.specialSpots.length).toBeGreaterThanOrEqual(4)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/generator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/pipeline/generator.ts
import type { Board, Level } from '../model/level'
import type { Cell } from '../geom/types'
import { routeOctilinear } from '../geom/router'
import { octilinearize } from '../geom/octilinear'
import { computeTowerSpots } from './spots'
import { growDecor } from './decor'
import { makeRng } from './rng'

function minSpots(difficulty: number): number { return Math.max(4, 6 + difficulty) }

export function generateLevel(params: { board: Board; difficulty: number; seed: number }): Level {
  const { board, difficulty, seed } = params
  const rng = makeRng(seed)
  const start: Cell = [1, 1 + Math.floor(rng() * (board.rows - 2))]
  const goal: Cell = [board.cols - 2, 1 + Math.floor(rng() * (board.rows - 2))]
  const wander = Math.min(0.9, 0.2 + difficulty * 0.1)
  const turnPenalty = 1 + (1 - wander)

  let raw = routeOctilinear({ cols: board.cols, rows: board.rows, start, goal, wander, turnPenalty })
  // Guaranteed: empty board always has a path; fall back to straight route if router is over-constrained.
  if (!raw) raw = routeOctilinear({ cols: board.cols, rows: board.rows, start, goal })!
  const waypoints = octilinearize(raw)

  const budget = minSpots(difficulty) + 6
  const { spots, specialSpots } = computeTowerSpots({ board, trace: { waypoints, cornerRadius: 0.5 }, budget })
  const decor = growDecor({ board, trace: { waypoints, cornerRadius: 0.5 }, spots, specialSpots, seed })

  return {
    version: 1,
    board,
    seed,
    trace: { waypoints, cornerRadius: 0.5 },
    spots,
    specialSpots,
    decor,
    meta: { name: `Level ${difficulty.toString().padStart(2, '0')}`, difficulty },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pipeline/generator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/generator.ts tests/pipeline/generator.test.ts
git commit -m "feat: solvable level generator"
```

---

### Task 11: Style — palette + render constants

**Files:**
- Create: `src/style/palette.ts`
- Test: `tests/style/palette.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PALETTE` — readonly record of hex color numbers (keys per spec: substrate, substrateEdge, silk, traceHalo, traceBand, traceCore, chevron, startGreen, finishRed, buildGold, specialCyan, icBody, pinSilver, textDim).
  - `RENDER` — readonly record of numeric render constants (traceBandWidth, traceCoreWidth, haloBlur, chevronSpacing, cornerRadiusCells, spotBracket, padRadius).

- [ ] **Step 1: Write the failing test**

```ts
// tests/style/palette.test.ts
import { describe, it, expect } from 'vitest'
import { PALETTE, RENDER } from '../../src/style/palette'

describe('style', () => {
  it('exposes all required palette keys as numbers', () => {
    const keys = ['substrate','substrateEdge','silk','traceHalo','traceBand','traceCore',
      'chevron','startGreen','finishRed','buildGold','specialCyan','icBody','pinSilver','textDim']
    for (const k of keys) expect(typeof (PALETTE as Record<string, number>)[k]).toBe('number')
  })
  it('exposes numeric render constants', () => {
    expect(RENDER.traceBandWidth).toBeGreaterThan(0)
    expect(RENDER.cornerRadiusCells).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/style/palette.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/style/palette.ts
export const PALETTE = {
  substrate: 0x0b1611,
  substrateEdge: 0x0d1f17,
  silk: 0x1c3a2b,
  traceHalo: 0x1f8f4d,
  traceBand: 0x2bd06a,
  traceCore: 0x6cf2a0,
  chevron: 0x8effbe,
  startGreen: 0x35e07a,
  finishRed: 0xe8503a,
  buildGold: 0xe8c84a,
  specialCyan: 0x3fb6d8,
  icBody: 0x14140f,
  pinSilver: 0x9aa0a0,
  textDim: 0x6f8f7e,
} as const

export const RENDER = {
  traceBandWidth: 14,
  traceCoreWidth: 4,
  haloBlur: 8,
  chevronSpacing: 36,
  cornerRadiusCells: 0.5,
  spotBracket: 10,
  padRadius: 7,
} as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/style/palette.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/style/palette.ts tests/style/palette.test.ts
git commit -m "feat: palette and render constants"
```

---

### Task 12: Trace stroke builder (pure)

**Files:**
- Create: `src/render/traceBuilder.ts`
- Test: `tests/render/traceBuilder.test.ts`

**Interfaces:**
- Consumes: `Trace`, `Board`; `filletPath`; `RENDER`.
- Produces:
  - `interface StrokeSpec { points: Pt[]; width: number; color: number; alpha: number; blur: number }`
  - `interface ChevronSpec { x: number; y: number; angle: number }`
  - `buildTraceStrokes(trace: Trace, pitch: number): StrokeSpec[]` — ordered halo→band→core strokes along the filleted polyline.
  - `buildChevrons(trace: Trace, pitch: number, spacing: number): ChevronSpec[]` — evenly spaced direction markers along the path.

- [ ] **Step 1: Write the failing test**

```ts
// tests/render/traceBuilder.test.ts
import { describe, it, expect } from 'vitest'
import { buildTraceStrokes, buildChevrons } from '../../src/render/traceBuilder'

const trace = { waypoints: [[1, 1], [1, 10], [12, 10]] as [number, number][], cornerRadius: 0.5 }

describe('traceBuilder', () => {
  it('builds halo, band, and core strokes (3 layers) over the same polyline', () => {
    const strokes = buildTraceStrokes(trace, 24)
    expect(strokes.length).toBe(3)
    // widest first (halo), narrowest last (core)
    expect(strokes[0].width).toBeGreaterThan(strokes[2].width)
    expect(strokes[0].points.length).toBe(strokes[2].points.length)
  })
  it('emits chevrons spaced along the path', () => {
    const ch = buildChevrons(trace, 24, 36)
    expect(ch.length).toBeGreaterThan(0)
    for (const c of ch) expect(Number.isFinite(c.angle)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/traceBuilder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/render/traceBuilder.ts
import type { Trace } from '../model/level'
import type { Pt } from '../geom/types'
import { filletPath } from '../geom/fillet'
import { PALETTE, RENDER } from '../style/palette'

export interface StrokeSpec { points: Pt[]; width: number; color: number; alpha: number; blur: number }
export interface ChevronSpec { x: number; y: number; angle: number }

export function buildTraceStrokes(trace: Trace, pitch: number): StrokeSpec[] {
  const pts = filletPath(trace.waypoints, trace.cornerRadius, pitch)
  return [
    { points: pts, width: RENDER.traceBandWidth + 8, color: PALETTE.traceHalo, alpha: 0.5, blur: RENDER.haloBlur },
    { points: pts, width: RENDER.traceBandWidth, color: PALETTE.traceBand, alpha: 1, blur: 0 },
    { points: pts, width: RENDER.traceCoreWidth, color: PALETTE.traceCore, alpha: 1, blur: 0 },
  ]
}

export function buildChevrons(trace: Trace, pitch: number, spacing: number): ChevronSpec[] {
  const pts = filletPath(trace.waypoints, trace.cornerRadius, pitch)
  const out: ChevronSpec[] = []
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const segLen = Math.hypot(b.x - a.x, b.y - a.y)
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    let d = spacing - acc
    while (d <= segLen) {
      const t = d / segLen
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle })
      d += spacing
    }
    acc = (acc + segLen) % spacing
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/traceBuilder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/traceBuilder.ts tests/render/traceBuilder.test.ts
git commit -m "feat: pure trace stroke and chevron builders"
```

---

### Task 13: Decor draw-spec builder (pure, fake-3D)

**Files:**
- Create: `src/render/decorBuilder.ts`
- Test: `tests/render/decorBuilder.test.ts`

**Interfaces:**
- Consumes: `DecorItem`; `PALETTE`.
- Produces:
  - `interface ShapeSpec { type: 'rect' | 'circle'; x: number; y: number; w: number; h: number; color: number; alpha: number }`
  - `buildDecorShapes(item: DecorItem, pitch: number): ShapeSpec[]` — fake-3D package geometry: drop-shadow rect (offset, dark), body rect/circle (bevel via two stacked rects light/dark), pins (silver ticks for chip kinds), specular highlight. Returns ordered back-to-front shapes positioned at the item's cell in pixels.

- [ ] **Step 1: Write the failing test**

```ts
// tests/render/decorBuilder.test.ts
import { describe, it, expect } from 'vitest'
import { buildDecorShapes } from '../../src/render/decorBuilder'

describe('decorBuilder', () => {
  it('a chip emits a shadow, a body, and at least one pin/highlight shape', () => {
    const shapes = buildDecorShapes({ kind: 'soic', variant: 8, cell: [4, 4], rot: 0, scale: 1 }, 24)
    expect(shapes.length).toBeGreaterThanOrEqual(3)
    // first shape is the drop-shadow (dark, offset down-right from body)
    expect(shapes[0].type).toBe('rect')
  })
  it('a via emits a circular shape', () => {
    const shapes = buildDecorShapes({ kind: 'via', variant: 1, cell: [4, 4], rot: 0, scale: 1 }, 24)
    expect(shapes.some((s) => s.type === 'circle')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/decorBuilder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/render/decorBuilder.ts
import type { DecorItem } from '../model/level'
import { PALETTE } from '../style/palette'

export interface ShapeSpec { type: 'rect' | 'circle'; x: number; y: number; w: number; h: number; color: number; alpha: number }

const FOOTPRINT: Record<string, { w: number; h: number }> = {
  qfp: { w: 4, h: 4 }, soic: { w: 3, h: 2 }, dip: { w: 5, h: 2 },
  electrolytic: { w: 2, h: 2 }, smdRes: { w: 2, h: 1 }, smdCap: { w: 1, h: 1 }, via: { w: 1, h: 1 },
}

export function buildDecorShapes(item: DecorItem, pitch: number): ShapeSpec[] {
  const fp = FOOTPRINT[item.kind] ?? { w: 2, h: 2 }
  const w = (item.rot === 90 || item.rot === 270 ? fp.h : fp.w) * pitch * item.scale
  const h = (item.rot === 90 || item.rot === 270 ? fp.w : fp.h) * pitch * item.scale
  const x = item.cell[0] * pitch
  const y = item.cell[1] * pitch
  const shapes: ShapeSpec[] = []

  if (item.kind === 'via') {
    shapes.push({ type: 'circle', x: x + w / 2, y: y + h / 2, w: w * 0.5, h: h * 0.5, color: PALETTE.pinSilver, alpha: 1 })
    shapes.push({ type: 'circle', x: x + w / 2, y: y + h / 2, w: w * 0.22, h: h * 0.22, color: PALETTE.substrate, alpha: 1 })
    return shapes
  }
  if (item.kind === 'electrolytic') {
    shapes.push({ type: 'circle', x: x + w / 2 + 2, y: y + h / 2 + 2, w: w * 0.5, h: h * 0.5, color: 0x000000, alpha: 0.45 }) // shadow
    shapes.push({ type: 'circle', x: x + w / 2, y: y + h / 2, w: w * 0.5, h: h * 0.5, color: PALETTE.icBody, alpha: 1 })
    shapes.push({ type: 'circle', x: x + w / 2, y: y + h / 2, w: w * 0.32, h: h * 0.32, color: PALETTE.pinSilver, alpha: 0.8 }) // top ring
    shapes.push({ type: 'circle', x: x + w * 0.4, y: y + h * 0.4, w: w * 0.12, h: h * 0.12, color: 0xffffff, alpha: 0.25 }) // specular
    return shapes
  }

  // generic chip / SMD: shadow -> body -> bevel -> pins -> specular
  shapes.push({ type: 'rect', x: x + 2, y: y + 3, w, h, color: 0x000000, alpha: 0.45 })        // drop shadow
  shapes.push({ type: 'rect', x, y, w, h, color: PALETTE.icBody, alpha: 1 })                    // body
  shapes.push({ type: 'rect', x, y, w, h: Math.max(1, h * 0.18), color: 0xffffff, alpha: 0.08 })// top bevel light
  shapes.push({ type: 'rect', x, y: y + h - Math.max(1, h * 0.18), w, h: Math.max(1, h * 0.18), color: 0x000000, alpha: 0.25 }) // bottom bevel dark
  const isChip = item.kind === 'qfp' || item.kind === 'soic' || item.kind === 'dip'
  if (isChip) {
    const pinCount = Math.max(2, Math.floor((item.variant || 8) / 2))
    for (let i = 0; i < pinCount; i++) {
      const px = x + ((i + 0.5) / pinCount) * w
      shapes.push({ type: 'rect', x: px - 1, y: y - 3, w: 2, h: 3, color: PALETTE.pinSilver, alpha: 0.9 })       // top pins
      shapes.push({ type: 'rect', x: px - 1, y: y + h, w: 2, h: 3, color: PALETTE.pinSilver, alpha: 0.9 })       // bottom pins
    }
  } else {
    // SMD end caps
    shapes.push({ type: 'rect', x: x - 2, y, w: 3, h, color: PALETTE.pinSilver, alpha: 0.9 })
    shapes.push({ type: 'rect', x: x + w - 1, y, w: 3, h, color: PALETTE.pinSilver, alpha: 0.9 })
  }
  shapes.push({ type: 'rect', x: x + w * 0.12, y: y + h * 0.12, w: w * 0.3, h: h * 0.12, color: 0xffffff, alpha: 0.12 }) // specular
  return shapes
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/decorBuilder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/decorBuilder.ts tests/render/decorBuilder.test.ts
git commit -m "feat: fake-3D decor draw-spec builder"
```

---

### Task 14: Pixi render layers + camera (thin draw wrappers)

**Files:**
- Create: `src/render/Camera.ts`, `src/render/Renderer.ts`
- Test: `tests/render/camera.test.ts`

**Interfaces:**
- Consumes: `Application`, `Container` (pixi.js); `Level`; `buildTraceStrokes`, `buildChevrons`, `buildDecorShapes`; spot/board helpers; `PALETTE`, `RENDER`.
- Produces:
  - `class Camera { x: number; y: number; zoom: number; apply(stage: Container): void; panBy(dx: number, dy: number): void; zoomAt(px: number, py: number, factor: number): void }`
  - `class Renderer { constructor(app: Application); render(level: Level): void; readonly layers: { board: Container; trace: Container; spot: Container; decor: Container; overlay: Container } }`

Only `Camera` is unit-tested (pure math). `Renderer` draw code is exercised manually via `npm run dev` (WebGL not available in Vitest node env).

- [ ] **Step 1: Write the failing test**

```ts
// tests/render/camera.test.ts
import { describe, it, expect } from 'vitest'
import { Camera } from '../../src/render/Camera'

describe('Camera', () => {
  it('pans by delta', () => {
    const c = new Camera()
    c.panBy(10, -5)
    expect(c.x).toBe(10)
    expect(c.y).toBe(-5)
  })
  it('zooms toward a point, keeping that point stationary in world space', () => {
    const c = new Camera()
    const beforeWorldX = (100 - c.x) / c.zoom
    c.zoomAt(100, 100, 2)
    const afterWorldX = (100 - c.x) / c.zoom
    expect(afterWorldX).toBeCloseTo(beforeWorldX, 5)
    expect(c.zoom).toBeCloseTo(2, 5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/camera.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `Camera` then `Renderer`**

```ts
// src/render/Camera.ts
import type { Container } from 'pixi.js'

export class Camera {
  x = 0; y = 0; zoom = 1
  panBy(dx: number, dy: number): void { this.x += dx; this.y += dy }
  zoomAt(px: number, py: number, factor: number): void {
    const worldX = (px - this.x) / this.zoom
    const worldY = (py - this.y) / this.zoom
    this.zoom = Math.max(0.25, Math.min(4, this.zoom * factor))
    this.x = px - worldX * this.zoom
    this.y = py - worldY * this.zoom
  }
  apply(stage: Container): void {
    stage.position.set(this.x, this.y)
    stage.scale.set(this.zoom)
  }
}
```

```ts
// src/render/Renderer.ts
import { Application, Container, Graphics } from 'pixi.js'
import type { Level } from '../model/level'
import { PALETTE, RENDER } from '../style/palette'
import { buildTraceStrokes, buildChevrons } from './traceBuilder'
import { buildDecorShapes } from './decorBuilder'
import { cellToPx } from '../geom/grid'

export class Renderer {
  readonly world = new Container()
  readonly layers = {
    board: new Container(), decor: new Container(), trace: new Container(),
    spot: new Container(), overlay: new Container(),
  }
  constructor(private app: Application) {
    this.world.addChild(this.layers.board, this.layers.decor, this.layers.trace, this.layers.spot, this.layers.overlay)
    this.app.stage.addChild(this.world)
  }

  render(level: Level): void {
    for (const c of Object.values(this.layers)) c.removeChildren()
    this.drawBoard(level)
    this.drawDecor(level)
    this.drawTrace(level)
    this.drawSpots(level)
  }

  private drawBoard(level: Level): void {
    const g = new Graphics()
    g.rect(0, 0, level.board.cols * level.board.pitch, level.board.rows * level.board.pitch).fill(PALETTE.substrate)
    for (let x = 0; x <= level.board.cols; x++)
      g.moveTo(x * level.board.pitch, 0).lineTo(x * level.board.pitch, level.board.rows * level.board.pitch)
    for (let y = 0; y <= level.board.rows; y++)
      g.moveTo(0, y * level.board.pitch).lineTo(level.board.cols * level.board.pitch, y * level.board.pitch)
    g.stroke({ color: PALETTE.silk, width: 1, alpha: 0.4 })
    this.layers.board.addChild(g)
  }

  private drawDecor(level: Level): void {
    for (const item of level.decor) {
      const g = new Graphics()
      for (const s of buildDecorShapes(item, level.board.pitch)) {
        if (s.type === 'rect') g.rect(s.x, s.y, s.w, s.h).fill({ color: s.color, alpha: s.alpha })
        else g.circle(s.x, s.y, s.w).fill({ color: s.color, alpha: s.alpha })
      }
      this.layers.decor.addChild(g)
    }
  }

  private drawTrace(level: Level): void {
    if (level.trace.waypoints.length < 2) return  // nothing to draw (e.g. after "New")
    for (const stroke of buildTraceStrokes(level.trace, level.board.pitch)) {
      const g = new Graphics()
      stroke.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
      g.stroke({ color: stroke.color, width: stroke.width, alpha: stroke.alpha, cap: 'round', join: 'round' })
      this.layers.trace.addChild(g)
    }
    for (const ch of buildChevrons(level.trace, level.board.pitch, RENDER.chevronSpacing)) {
      const g = new Graphics()
      g.moveTo(-4, -4).lineTo(2, 0).lineTo(-4, 4).stroke({ color: PALETTE.chevron, width: 2, alpha: 0.8 })
      g.position.set(ch.x, ch.y); g.rotation = ch.angle
      this.layers.trace.addChild(g)
    }
    this.drawPad(level.trace.waypoints[0], PALETTE.startGreen, level.board.pitch)
    this.drawPad(level.trace.waypoints[level.trace.waypoints.length - 1], PALETTE.finishRed, level.board.pitch)
  }

  private drawPad(cell: [number, number], color: number, pitch: number): void {
    const p = cellToPx(cell, pitch)
    const g = new Graphics()
    g.rect(p.x - pitch * 0.7, p.y - pitch * 0.7, pitch * 1.4, pitch * 1.4).stroke({ color, width: 3 })
    g.rect(p.x - pitch * 0.35, p.y - pitch * 0.35, pitch * 0.7, pitch * 0.7).fill({ color, alpha: 0.8 })
    this.layers.trace.addChild(g)
  }

  private drawSpots(level: Level): void {
    const b = RENDER.spotBracket
    for (const s of level.spots) {
      const p = cellToPx(s.cell, level.board.pitch)
      const g = new Graphics()
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        g.moveTo(p.x + sx * b, p.y + sy * b - sy * (b / 2)).lineTo(p.x + sx * b, p.y + sy * b)
          .lineTo(p.x + sx * b - sx * (b / 2), p.y + sy * b)
      }
      g.stroke({ color: PALETTE.buildGold, width: 2 })
      g.moveTo(p.x - 3, p.y).lineTo(p.x + 3, p.y).moveTo(p.x, p.y - 3).lineTo(p.x, p.y + 3)
        .stroke({ color: PALETTE.buildGold, width: 1, alpha: 0.8 })
      this.layers.spot.addChild(g)
    }
    for (const s of level.specialSpots) {
      const p = cellToPx(s.cell, level.board.pitch)
      const g = new Graphics()
      g.circle(p.x, p.y, b).stroke({ color: PALETTE.specialCyan, width: 2 })
      g.circle(p.x, p.y, b * 0.45).fill({ color: PALETTE.specialCyan, alpha: 0.7 })
      this.layers.spot.addChild(g)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/camera.test.ts`
Expected: PASS.

- [ ] **Step 5: Manual smoke check**

Wire a generated level in `src/main.ts` temporarily:
```ts
// in boot(), after appending canvas:
import { Renderer } from './render/Renderer'
import { generateLevel } from './pipeline/generator'
const renderer = new Renderer(app)
renderer.render(generateLevel({ board: { cols: 64, rows: 48, pitch: 24 }, difficulty: 5, seed: 5 }))
```
Run: `npm run dev` → open http://localhost:5173 → expect a dark-green board with a glowing green octilinear trace (rounded corners, chevrons, green START + red FINISH pads), gold build brackets, cyan special spots, and procedural chips/SMD decor. Compare side-by-side with the reference image.

- [ ] **Step 6: Commit**

```bash
git add src/render/Camera.ts src/render/Renderer.ts src/main.ts tests/render/camera.test.ts
git commit -m "feat: pixi render layers and camera"
```

---

### Task 15: Editor state, tools, and live auto-pipeline

**Files:**
- Create: `src/editor/EditorState.ts`, `src/editor/Editor.ts`
- Test: `tests/editor/editorState.test.ts`

**Interfaces:**
- Consumes: `Level`, `Board`, `Cell`; `octilinearize`; `computeTowerSpots`; `growDecor`; `snapToCell`.
- Produces:
  - `class EditorState` with:
    - `board: Board`, `seed: number`, `draftPoints: Cell[]`, `level: Level | null`
    - `addPoint(cell: Cell): void` — append to draft (octilinearized incrementally)
    - `commitTrace(): void` — finalize draft into `level.trace` and run `recompute()`
    - `recompute(): void` — rebuild spots + decor from current trace+seed into `level`
    - `reseed(seed: number): void`
    - `loadLevel(l: Level): void`, `clear(): void`
  - `class Editor` — binds pointer events on the Pixi canvas to `EditorState` + `Renderer`, with a debounced recompute on draft changes. (Event wiring is manual-tested; the pure state machine is unit-tested.)

- [ ] **Step 1: Write the failing test**

```ts
// tests/editor/editorState.test.ts
import { describe, it, expect } from 'vitest'
import { EditorState } from '../../src/editor/EditorState'
import { isOctilinear } from '../../src/geom/octilinear'

const board = { cols: 40, rows: 30, pitch: 24 }

describe('EditorState', () => {
  it('octilinearizes the draft as points are added', () => {
    const s = new EditorState(board, 1)
    s.addPoint([0, 0]); s.addPoint([5, 2])
    for (let i = 1; i < s.draftPoints.length; i++)
      expect(isOctilinear(s.draftPoints[i - 1], s.draftPoints[i])).toBe(true)
  })
  it('commitTrace builds a level with spots and decor', () => {
    const s = new EditorState(board, 1)
    s.addPoint([2, 2]); s.addPoint([2, 20]); s.addPoint([25, 20])
    s.commitTrace()
    expect(s.level).not.toBeNull()
    expect(s.level!.trace.waypoints.length).toBeGreaterThanOrEqual(3)
    expect(s.level!.spots.length + s.level!.specialSpots.length).toBeGreaterThan(0)
    expect(s.level!.decor.length).toBeGreaterThan(0)
  })
  it('reseed changes decor deterministically', () => {
    const s = new EditorState(board, 1)
    s.addPoint([2, 2]); s.addPoint([2, 20]); s.addPoint([25, 20]); s.commitTrace()
    const before = JSON.stringify(s.level!.decor)
    s.reseed(2)
    const after = JSON.stringify(s.level!.decor)
    expect(after).not.toEqual(before)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/editor/editorState.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `EditorState` then `Editor`**

```ts
// src/editor/EditorState.ts
import type { Board, Level } from '../model/level'
import type { Cell } from '../geom/types'
import { octilinearize } from '../geom/octilinear'
import { computeTowerSpots } from '../pipeline/spots'
import { growDecor } from '../pipeline/decor'

export class EditorState {
  draftPoints: Cell[] = []
  level: Level | null = null
  constructor(public board: Board, public seed: number) {}

  addPoint(cell: Cell): void {
    this.draftPoints = octilinearize([...this.rawDraft(), cell])
  }
  private rawDraft(): Cell[] { return this.draftPoints }

  commitTrace(): void {
    if (this.draftPoints.length < 2) return
    this.level = {
      version: 1, board: this.board, seed: this.seed,
      trace: { waypoints: [...this.draftPoints], cornerRadius: 0.5 },
      spots: [], specialSpots: [], decor: [],
      meta: { name: 'Untitled', difficulty: 1 },
    }
    this.recompute()
  }

  recompute(): void {
    if (!this.level) return
    const budget = 14
    const { spots, specialSpots } = computeTowerSpots({ board: this.board, trace: this.level.trace, budget })
    this.level.spots = spots
    this.level.specialSpots = specialSpots
    this.level.decor = growDecor({ board: this.board, trace: this.level.trace, spots, specialSpots, seed: this.seed })
  }

  reseed(seed: number): void {
    this.seed = seed
    if (this.level) { this.level.seed = seed; this.recompute() }
  }

  loadLevel(l: Level): void { this.level = l; this.board = l.board; this.seed = l.seed; this.draftPoints = [...l.trace.waypoints] }
  clear(): void { this.draftPoints = []; this.level = null }
}
```

```ts
// src/editor/Editor.ts
import type { Application } from 'pixi.js'
import { EditorState } from './EditorState'
import { Renderer } from '../render/Renderer'
import { Camera } from '../render/Camera'
import { snapToCell } from '../geom/grid'
import type { Board } from '../model/level'

export class Editor {
  state: EditorState
  private debounce: ReturnType<typeof setTimeout> | null = null
  constructor(private app: Application, private renderer: Renderer, private camera: Camera, board: Board, seed: number) {
    this.state = new EditorState(board, seed)
    this.bind()
  }

  private worldFromEvent(e: PointerEvent): { x: number; y: number } {
    const r = this.app.canvas.getBoundingClientRect()
    return { x: (e.clientX - r.left - this.camera.x) / this.camera.zoom, y: (e.clientY - r.top - this.camera.y) / this.camera.zoom }
  }

  private bind(): void {
    this.app.canvas.addEventListener('pointerdown', (e) => {
      const w = this.worldFromEvent(e as PointerEvent)
      this.state.addPoint(snapToCell(w, this.state.board.pitch))
      this.scheduleRecompute()
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { this.state.commitTrace(); this.redraw() }
    })
    this.app.canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const r = this.app.canvas.getBoundingClientRect()
      this.camera.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.1 : 0.9)
      this.camera.apply(this.renderer.world)
    }, { passive: false })
  }

  private scheduleRecompute(): void {
    if (this.debounce) clearTimeout(this.debounce)
    this.debounce = setTimeout(() => { this.state.commitTrace(); this.redraw() }, 120)
  }

  redraw(): void {
    if (this.state.level) this.renderer.render(this.state.level)
    this.camera.apply(this.renderer.world)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/editor/editorState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor tests/editor/editorState.test.ts
git commit -m "feat: editor state machine and live pipeline"
```

---

### Task 16: Toolbar, save/load, map size, side panels, integration

**Files:**
- Create: `src/app/viewport.ts`, `src/ui/Toolbar.ts`, `src/ui/Panels.ts`, `src/ui/styles.css`
- Modify: `src/main.ts` (final wiring)
- Test: `tests/app/viewport.test.ts`, `tests/ui/io.test.ts`

**Interfaces:**
- Consumes: `Level`, `Board`; `serializeLevel`, `parseLevel`; `generateLevel`; `EditorState`/`Editor`/`Renderer`/`Camera`.
- Produces:
  - `MAP_PRESETS: { label: string; cols: number; rows: number }[]` — `S 32×24`, `M 48×36`, `L 64×48`, `XL 96×72`.
  - `fitPitch(cols: number, rows: number, viewW: number, viewH: number, opts?: { minPitch?: number; maxPitch?: number }): number` — integer pixels-per-cell so the board fits the viewport (`min(viewW/cols, viewH/rows)`), clamped to `[minPitch=8, maxPitch=48]`. Smaller boards → larger pitch; bigger boards → smaller pitch.
  - `levelToBlobUrl(level: Level): string` — JSON object-URL for download.
  - `readLevelFile(file: File): Promise<Level>` — parse an uploaded JSON file into a `Level`.
  - `mountToolbar(opts: { onNew(): void; onGenerate(): void; onSave(): void; onLoad(file: File): void; onReseed(): void; onResize(cols: number, rows: number): void }): HTMLElement` — includes S/M/L/XL preset buttons and manual cols×rows number inputs that call `onResize`.
  - `mountPanels(level: Level | null): HTMLElement` — LEGEND / TIPS / LEVEL-info panels styled to the reference.

- [ ] **Step 1: Write the failing fit-pitch test**

```ts
// tests/app/viewport.test.ts
import { describe, it, expect } from 'vitest'
import { fitPitch } from '../../src/app/viewport'

describe('fitPitch', () => {
  it('fits the board to the viewport (limiting dimension wins)', () => {
    // 1600x900 view, 32x24 board: min(1600/32=50, 900/24=37.5) -> 37, clamped to 37 (<=48)
    expect(fitPitch(32, 24, 1600, 900)).toBe(37)
  })
  it('smaller board yields a larger pitch than a bigger board', () => {
    const small = fitPitch(32, 24, 1600, 900)
    const big = fitPitch(96, 72, 1600, 900)
    expect(small).toBeGreaterThan(big)
  })
  it('clamps to the max pitch', () => {
    expect(fitPitch(2, 2, 4000, 4000)).toBe(48)
  })
  it('clamps to the min pitch', () => {
    expect(fitPitch(2000, 2000, 800, 600)).toBe(8)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/app/viewport.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/viewport.ts`**

```ts
// src/app/viewport.ts
export const MAP_PRESETS: { label: string; cols: number; rows: number }[] = [
  { label: 'S', cols: 32, rows: 24 },
  { label: 'M', cols: 48, rows: 36 },
  { label: 'L', cols: 64, rows: 48 },
  { label: 'XL', cols: 96, rows: 72 },
]

export function fitPitch(
  cols: number, rows: number, viewW: number, viewH: number,
  opts: { minPitch?: number; maxPitch?: number } = {},
): number {
  const min = opts.minPitch ?? 8
  const max = opts.maxPitch ?? 48
  const raw = Math.floor(Math.min(viewW / cols, viewH / rows))
  return Math.max(min, Math.min(max, raw))
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/app/viewport.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing IO test**

```ts
// tests/ui/io.test.ts
import { describe, it, expect } from 'vitest'
import { readLevelFile } from '../../src/ui/Toolbar'
import { serializeLevel, type Level } from '../../src/model/level'

const sample: Level = {
  version: 1, board: { cols: 64, rows: 48, pitch: 24 }, seed: 1,
  trace: { waypoints: [[1, 1], [1, 9]], cornerRadius: 0.5 },
  spots: [], specialSpots: [], decor: [], meta: { name: 'T', difficulty: 1 },
}

describe('level file IO', () => {
  it('readLevelFile parses a serialized level back', async () => {
    const file = new File([serializeLevel(sample)], 'level.json', { type: 'application/json' })
    const parsed = await readLevelFile(file)
    expect(parsed).toEqual(sample)
  })
  it('readLevelFile rejects bad json', async () => {
    const file = new File(['{bad'], 'x.json', { type: 'application/json' })
    await expect(readLevelFile(file)).rejects.toThrow()
  })
})
```

Note: this test uses the browser `File` API. Add `environment: 'jsdom'` for this file via a top-of-file directive.

Add to the top of `tests/ui/io.test.ts`:
```ts
// @vitest-environment jsdom
```
And add `jsdom` to devDependencies:
```bash
npm install -D jsdom
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/ui/io.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `Toolbar.ts`, `Panels.ts`, `styles.css`**

```ts
// src/ui/Toolbar.ts
import type { Level } from '../model/level'
import { serializeLevel, parseLevel } from '../model/level'
import { MAP_PRESETS } from '../app/viewport'

export function levelToBlobUrl(level: Level): string {
  return URL.createObjectURL(new Blob([serializeLevel(level)], { type: 'application/json' }))
}

export function readLevelFile(file: File): Promise<Level> {
  return file.text().then((t) => parseLevel(t))
}

export function mountToolbar(opts: {
  onNew(): void; onGenerate(): void; onSave(): void; onLoad(file: File): void; onReseed(): void
  onResize(cols: number, rows: number): void
}): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'pcb-toolbar'
  const btn = (label: string, fn: () => void) => {
    const b = document.createElement('button'); b.textContent = label; b.onclick = fn; bar.appendChild(b); return b
  }
  btn('New', opts.onNew)
  btn('Auto-Generate', opts.onGenerate)
  btn('Reseed', opts.onReseed)
  btn('Save', opts.onSave)
  const file = document.createElement('input'); file.type = 'file'; file.accept = 'application/json'
  file.style.display = 'none'
  file.onchange = () => { if (file.files?.[0]) opts.onLoad(file.files[0]) }
  const load = btn('Load', () => file.click()); load.appendChild(file)

  // map-size controls: presets + manual cols×rows
  const colsIn = document.createElement('input'); colsIn.type = 'number'; colsIn.value = '64'; colsIn.className = 'pcb-size'; colsIn.title = 'cols'
  const rowsIn = document.createElement('input'); rowsIn.type = 'number'; rowsIn.value = '48'; rowsIn.className = 'pcb-size'; rowsIn.title = 'rows'
  for (const p of MAP_PRESETS)
    btn(p.label, () => { colsIn.value = String(p.cols); rowsIn.value = String(p.rows); opts.onResize(p.cols, p.rows) })
  bar.appendChild(colsIn); bar.appendChild(document.createTextNode('×')); bar.appendChild(rowsIn)
  const apply = () => {
    const c = Math.max(8, Math.min(256, Math.floor(Number(colsIn.value) || 0)))
    const r = Math.max(8, Math.min(256, Math.floor(Number(rowsIn.value) || 0)))
    colsIn.value = String(c); rowsIn.value = String(r); opts.onResize(c, r)
  }
  colsIn.onchange = apply; rowsIn.onchange = apply

  document.body.appendChild(bar)
  return bar
}
```

```ts
// src/ui/Panels.ts
import type { Level } from '../model/level'

export function mountPanels(level: Level | null): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'pcb-panels'
  wrap.innerHTML = `
    <div class="pcb-panel pcb-legend">
      <h3>LEGEND</h3>
      <ul>
        <li><span class="sw trace"></span> ENEMY PATH</li>
        <li><span class="sw build"></span> BUILD SPOT</li>
        <li><span class="sw special"></span> SPECIAL SPOT</li>
        <li><span class="sw start"></span> START</li>
        <li><span class="sw finish"></span> FINISH</li>
      </ul>
    </div>
    <div class="pcb-panel pcb-info">
      <h3>${level?.meta.name ?? 'LEVEL --'}</h3>
      <div>WAVE 0/30</div><div>LIVES 20</div><div>CURRENCY 650</div>
    </div>
    <div class="pcb-panel pcb-tips">
      <h3>TIPS</h3><p>BUILD TOWERS TO STOP ENEMIES FROM REACHING THE FINISH</p>
    </div>`
  document.body.appendChild(wrap)
  return wrap
}
```

```css
/* src/ui/styles.css */
.pcb-toolbar { position: fixed; top: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 10; }
.pcb-toolbar button { background: #0d1f17; color: #6cf2a0; border: 1px solid #1f8f4d; padding: 6px 12px; font: 12px monospace; cursor: pointer; }
.pcb-toolbar button:hover { background: #14140f; }
.pcb-toolbar .pcb-size { width: 46px; background: #0d1f17; color: #6cf2a0; border: 1px solid #1f8f4d; font: 12px monospace; padding: 5px 4px; }
.pcb-toolbar { align-items: center; color: #6f8f7e; font: 12px monospace; }
.pcb-panels { position: fixed; inset: 0; pointer-events: none; }
.pcb-panel { position: fixed; background: rgba(13,31,23,0.85); border: 1px solid #1f8f4d; color: #6f8f7e; padding: 10px 14px; font: 12px monospace; }
.pcb-legend { top: 70px; left: 16px; } .pcb-info { top: 16px; right: 16px; } .pcb-tips { bottom: 16px; left: 16px; max-width: 200px; }
.pcb-panel h3 { color: #6cf2a0; margin: 0 0 6px; letter-spacing: 2px; }
.pcb-panel ul { list-style: none; margin: 0; padding: 0; } .pcb-panel li { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
.sw { width: 14px; height: 14px; display: inline-block; }
.sw.trace { background: #2bd06a; } .sw.build { border: 2px solid #e8c84a; } .sw.special { border: 2px solid #3fb6d8; border-radius: 50%; }
.sw.start { background: #35e07a; } .sw.finish { background: #e8503a; }
```

- [ ] **Step 8: Final wiring in `src/main.ts`**

`board` is mutable state. `applyBoard(cols, rows)` recomputes `pitch` via `fitPitch` so the map fills the viewport (smaller map → larger cells, bigger map → smaller cells), updates the editor's board, and redraws. `onResize` calls it.

```ts
// src/main.ts
import './ui/styles.css'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import { Renderer } from './render/Renderer'
import { Camera } from './render/Camera'
import { Editor } from './editor/Editor'
import { generateLevel } from './pipeline/generator'
import { fitPitch } from './app/viewport'
import { mountToolbar, levelToBlobUrl, readLevelFile } from './ui/Toolbar'
import { mountPanels } from './ui/Panels'
import type { Board } from './model/level'

async function boot() {
  const app = await createPixiApp({ width: window.innerWidth, height: window.innerHeight, background: PALETTE.substrate })
  document.getElementById('app')!.appendChild(app.canvas)
  const renderer = new Renderer(app)
  const camera = new Camera()

  const view = () => ({ w: window.innerWidth, h: window.innerHeight })
  let board: Board = { cols: 64, rows: 48, pitch: fitPitch(64, 48, view().w, view().h) }
  const editor = new Editor(app, renderer, camera, board, 1)
  mountPanels(null)

  const emptyLevel = (): import('./model/level').Level => ({
    version: 1, board, seed: editor.state.seed, trace: { waypoints: [], cornerRadius: 0.5 },
    spots: [], specialSpots: [], decor: [], meta: { name: 'Untitled', difficulty: 1 },
  })

  const applyBoard = (cols: number, rows: number) => {
    board = { cols, rows, pitch: fitPitch(cols, rows, view().w, view().h) }
    editor.state.board = board
    if (editor.state.level) { editor.state.level.board = board; editor.state.recompute(); editor.redraw() }
    else renderer.render(emptyLevel())
  }

  let seedCounter = 1
  mountToolbar({
    onNew: () => { editor.state.clear(); renderer.render(emptyLevel()) },
    onGenerate: () => { editor.state.loadLevel(generateLevel({ board, difficulty: 5, seed: ++seedCounter })); editor.redraw() },
    onReseed: () => { editor.state.reseed(++seedCounter); editor.redraw() },
    onSave: () => { if (!editor.state.level) return; const a = document.createElement('a'); a.href = levelToBlobUrl(editor.state.level); a.download = 'level.json'; a.click() },
    onLoad: async (file) => { editor.state.loadLevel(await readLevelFile(file)); board = editor.state.board; editor.redraw() },
    onResize: applyBoard,
  })
}
boot()
```

- [ ] **Step 9: Run tests + manual integration check**

Run: `npx vitest run` → Expected: all suites PASS.
Run: `npm run dev` → verify: pick a size preset (S/M/L/XL) or type cols×rows → board rescales (smaller map = larger cells, bigger = smaller); draw a trace by clicking (Enter to finish) → spots+decor appear; Auto-Generate makes a full level at the chosen size; Reseed reshuffles decor; Save downloads JSON; Load restores it (including its board size). Compare against the reference image for 1:1 styling; tune `src/style/palette.ts` constants if needed.

- [ ] **Step 10: Commit**

```bash
git add src/app/viewport.ts src/ui src/main.ts package.json tests/app/viewport.test.ts tests/ui/io.test.ts
git commit -m "Тулбар, save/load, панели, размер карты, интеграция"
```

---

## Self-Review Notes (spec coverage)

- Renderer/stack, true-2D, fake-3D shading → Tasks 1, 11, 13, 14.
- Octilinear 45° + rounded corners → Tasks 4, 5, 12.
- Grid snapping → Tasks 2, 15.
- Draw-trace → auto-spots → auto-decor, live recompute → Tasks 8, 9, 15.
- User-selectable map size (presets + manual) + auto-fit pitch (scale follows size) → Task 16 (`fitPitch`, `MAP_PRESETS`, `onResize`).
- Single START→FINISH path → Tasks 4, 10, 14 (pads).
- Procedural package decor (1:1) → Tasks 9, 13.
- A* router + generator solvability invariant → Tasks 7, 10.
- Level JSON contract + save/load → Tasks 3, 16.
- Side panels (LEGEND/TIPS/LEVEL) → Task 16.
- Tests: octilinear/fillet/router/coverage/decor/round-trip/generator-100-seeds → Tasks 4,5,7,6,9,3,10.

Out of scope (no tasks, intentionally): enemies/towers/projectiles/waves/economy runtime, audio, persistence/profiles.
