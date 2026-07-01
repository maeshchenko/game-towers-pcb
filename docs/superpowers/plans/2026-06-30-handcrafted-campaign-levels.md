# Handcrafted Campaign Levels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the 12 seed-generated campaign levels with 12 hand-authored levels (custom paths +
hand-placed, properly-wired decor) that escalate in interest, via a small TypeScript level DSL.

**Architecture:** A framework-free `LevelBuilder` DSL composes enemy paths, build/special spots, and
decor blocks (from `pipeline/circuits.ts`) into a `Level`; copper is produced by the EXISTING
`pipeline/copper.ts:routeCopper` (pad-to-pad, no dangling). The campaign loads authored `Level`s
directly; the generator stays for `/editor`, "Новая карта", and `?t=` codes.

**Tech Stack:** Pixi.js v8, TypeScript (strict), Vite, Vitest.

## Global Constraints

- **Commits are user-controlled.** Do NOT run `git commit`/`git push` or propose them. Each task ends
  when its build + tests are green; the user commits when they choose.
- TypeScript strict, `tsc --noEmit` clean; `noUnusedLocals`/`noUnusedParameters` on — no dead symbols.
- Never emit `.js` into `src/`/`tests/`.
- `npm run build` (tsc + vite) and `npm test` (vitest) must stay green after every task.
- HARD INVARIANT: every level has exactly ONE finish; all paths converge to it.
- Logic in `src/levels`, `src/geom`, `src/pipeline` stays framework-free (no Pixi imports).
- Russian commit/UI text; never mention AI.
- Board pitch is `PITCH_PX` (30). Cells are `[col,row]`, integers, within `[0,cols)×[0,rows)`.

---

### Task 1: LevelBuilder DSL

**Files:**
- Create: `src/levels/dsl.ts`
- Test: `tests/levels/dsl.test.ts`

**Interfaces:**
- Consumes: `routeCopper` from `src/pipeline/copper.ts` (`routeCopper(level: Pick<Level,'decor'|'nets'|'board'|'trace'|'paths'>): Copper[]`); `BlockResult`, `RefAlloc` from `src/pipeline/circuits.ts`; `Board, Level, Trace, TowerSpot, DecorItem` from `src/model/level.ts`; `Cell` from `src/geom/types.ts`; `RENDER` from `src/style/palette.ts`.
- Produces: `class LevelBuilder` with methods `path(waypoints: Cell[], cornerRadius?: number): this`, `buildSpot(...cells: Cell[]): this`, `specialSpot(...cells: Cell[]): this`, `block(blk: BlockResult): this`, `part(kind: string, cell: Cell, rot?: 0|90|180|270, variant?: number): this`, `wire(a: number, b: number): this`, `decorCount(): number`, `build(): Level`; and `makeAlloc(): RefAlloc`. `build()` throws if 0 paths or finishes differ.

- [ ] **Step 1: Write the failing test**

```ts
// tests/levels/dsl.test.ts
import { describe, it, expect } from 'vitest'
import { LevelBuilder } from '../../src/levels/dsl'
import { powerSupply } from '../../src/pipeline/circuits'

const board = { cols: 24, rows: 18, pitch: 30 }
const meta = { name: 'test', difficulty: 1 }

describe('LevelBuilder', () => {
  it('assembles a level with one path, spots, and finish at the last waypoint', () => {
    const lvl = new LevelBuilder(board, 1, meta)
      .path([[0, 2], [10, 2], [10, 10], [23, 10]])
      .buildSpot([5, 3], [11, 9])
      .specialSpot([9, 9])
      .build()
    expect(lvl.version).toBe(1)
    expect(lvl.paths!.length).toBe(1)
    expect(lvl.trace.waypoints[lvl.trace.waypoints.length - 1]).toEqual([23, 10])
    expect(lvl.spots.length).toBe(2)
    expect(lvl.specialSpots.length).toBe(1)
  })

  it('throws when paths have different finishes', () => {
    expect(() =>
      new LevelBuilder(board, 1, meta)
        .path([[0, 2], [23, 2]])
        .path([[0, 16], [23, 16]])
        .build()
    ).toThrow(/one finish/i)
  })

  it('routes copper for a placed block (endpoints land on pads)', () => {
    const b = new LevelBuilder(board, 1, meta).path([[0, 0], [23, 0]])
    b.block(powerSupply([4, 8], b.alloc))
    const lvl = b.build()
    expect(lvl.decor.length).toBeGreaterThan(0)
    expect(lvl.nets!.length).toBeGreaterThan(0)
    expect(lvl.copper!.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/levels/dsl.test.ts`
Expected: FAIL — cannot find module `../../src/levels/dsl`.

- [ ] **Step 3: Write the DSL**

```ts
// src/levels/dsl.ts
import type { Board, Level, Trace, TowerSpot, DecorItem } from '../model/level'
import type { Cell } from '../geom/types'
import { RENDER } from '../style/palette'
import { routeCopper } from '../pipeline/copper'
import type { BlockResult, RefAlloc } from '../pipeline/circuits'

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
  /** wire two already-placed decor items (global indices) as a 2-node net */
  wire(a: number, b: number): this { this.nets.push([a, b]); return this }
  decorCount(): number { return this.decor.length }

  build(): Level {
    if (this.paths.length === 0) throw new Error('level has no path')
    const fin = new Set(this.paths.map((p) => {
      const w = p.waypoints[p.waypoints.length - 1]; return `${w[0]},${w[1]}`
    }))
    if (fin.size !== 1) throw new Error(`level must have exactly ONE finish, got ${fin.size}`)
    const trace = this.paths[0]
    const copper = routeCopper({ board: this.board, decor: this.decor, nets: this.nets, trace, paths: this.paths })
    return {
      version: 1, board: this.board, seed: this.seed, trace, paths: this.paths,
      spots: this.spots, specialSpots: this.specials, decor: this.decor,
      nets: this.nets, copper, meta: this.meta,
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/levels/dsl.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

---

### Task 2: Authored-level validation harness

**Files:**
- Create: `tests/levels/_harness.ts`
- Test: `tests/levels/_harness.test.ts`

**Interfaces:**
- Consumes: `padAnchors` from `src/render/decorBuilder.ts` (`padAnchors(item: DecorItem): Cell[]`); `evaluate` from `src/game/balance.ts` (`evaluate(level: Level, seed: number): { won: boolean; pressure: number }`); `Level` from `src/model/level.ts`.
- Produces: `assertOneFinish(level): void`, `assertCopperEndpointsOnPads(level): void`, `assertWinnable(level, lo?: number, hi?: number): { won: boolean; pressure: number }`. Used by Task 4 + every level task.

- [ ] **Step 1: Write the failing test**

```ts
// tests/levels/_harness.test.ts
import { describe, it, expect } from 'vitest'
import { LevelBuilder } from '../../src/levels/dsl'
import { powerSupply } from '../../src/pipeline/circuits'
import { assertOneFinish, assertCopperEndpointsOnPads } from './_harness'

const board = { cols: 24, rows: 18, pitch: 30 }

describe('authored harness', () => {
  it('passes a valid built level', () => {
    const b = new LevelBuilder(board, 1, { name: 't', difficulty: 1 }).path([[0, 1], [23, 1]])
    b.block(powerSupply([4, 8], b.alloc))
    const lvl = b.build()
    expect(() => assertOneFinish(lvl)).not.toThrow()
    expect(() => assertCopperEndpointsOnPads(lvl)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/levels/_harness.test.ts`
Expected: FAIL — cannot find module `./_harness`.

- [ ] **Step 3: Write the harness**

```ts
// tests/levels/_harness.ts
import { expect } from 'vitest'
import type { Level } from '../../src/model/level'
import { padAnchors } from '../../src/render/decorBuilder'
import { evaluate } from '../../src/game/balance'

export function assertOneFinish(level: Level): void {
  const paths = level.paths && level.paths.length ? level.paths : [level.trace]
  const fin = new Set(paths.map((p) => {
    const w = p.waypoints[p.waypoints.length - 1]; return `${w[0]},${w[1]}`
  }))
  expect(fin.size, 'exactly one finish').toBe(1)
}

/** Every copper polyline's endpoints must coincide with a real decor pad anchor (no dangling). */
export function assertCopperEndpointsOnPads(level: Level): void {
  const anchors = new Set<string>()
  for (const it of level.decor) for (const a of padAnchors(it)) anchors.add(`${a[0]},${a[1]}`)
  for (const c of level.copper ?? []) {
    expect(c.points.length, 'copper has >=2 points').toBeGreaterThanOrEqual(2)
    const a = c.points[0], b = c.points[c.points.length - 1]
    expect(anchors.has(`${a[0]},${a[1]}`), `copper start ${a} on a pad`).toBe(true)
    expect(anchors.has(`${b[0]},${b[1]}`), `copper end ${b} on a pad`).toBe(true)
  }
}

export function assertWinnable(level: Level, lo = 0.1, hi = 0.7): { won: boolean; pressure: number } {
  const v = evaluate(level, level.seed)
  expect(v.won, `level winnable by basic defence (pressure ${v.pressure.toFixed(2)})`).toBe(true)
  expect(v.pressure, 'pressure >= lo').toBeGreaterThanOrEqual(lo)
  expect(v.pressure, 'pressure <= hi').toBeLessThanOrEqual(hi)
  return v
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/levels/_harness.test.ts`
Expected: PASS.

---

### Task 3: drawCopper teardrop guard (clean up generated boards too)

**Files:**
- Modify: `src/render/Renderer.ts` (the `drawCopper` method)

**Interfaces:**
- Consumes: existing `getPadPixel`, `strokeCopper`, `chamfer45`, `filletPixels`.
- Produces: no new exports; only emits the endpoint teardrop when the endpoint resolved to a real pad.

- [ ] **Step 1: Edit drawCopper to track pad resolution**

Replace the body of the `for (const copper of level.copper)` loop so the teardrop is conditional:

```ts
    for (const copper of level.copper) {
      if (copper.points.length < 2) continue
      const g = new Graphics()
      const pts: Pt[] = copper.points.map(c => cellToPx(c, pitch))
      const startPad = this.getPadPixel(copper.points[0], level)
      const endPad = this.getPadPixel(copper.points[copper.points.length - 1], level)
      if (startPad) pts[0] = startPad
      if (endPad) pts[pts.length - 1] = endPad
      const styled = filletPixels(chamfer45(pts, pitch * 0.5), pitch * 0.35)
      strokeCopper(g, styled, {
        core: PALETTE.copperTrace, width: Math.max(1, pitch * 0.1), alpha: 0.55,
        bed: PALETTE.copperBed, bedAlpha: 0.4, bedMul: 2.2,
        // only teardrop a pad we actually resolved (no wedges into empty space)
        teardrop: (startPad && endPad)
          ? { r: Math.max(2, pitch * 0.14), color: PALETTE.copperTrace, alpha: 0.6 }
          : undefined,
      })
      this.layers.copper.addChild(g)
    }
```

- [ ] **Step 2: Build to verify**

Run: `npx tsc --noEmit && npm run build`
Expected: clean; vite build succeeds.

> Note: `strokeCopper` only draws teardrops when `style.teardrop` is set on BOTH ends; since authored
> levels route every endpoint onto a pad, they keep teardrops. Generated boards with an unresolved end
> simply skip the wedge.

---

### Task 4: Campaign integration (load authored levels)

**Files:**
- Create: `src/levels/index.ts`
- Create: `src/levels/campaign/level01.ts`
- Modify: `src/game/campaign.ts` (add `build?` to `CampaignLevelDef`, wire level 0)
- Modify: `src/main.ts` (add `loadAuthoredOrGenerated`, replace campaign call sites)
- Test: `tests/levels/authored.test.ts`

**Interfaces:**
- Consumes: `LevelBuilder` (Task 1); harness (Task 2); `CAMPAIGN_LEVELS`, `CampaignLevelDef` from `src/game/campaign.ts`.
- Produces: `AUTHORED_LEVELS: Array<(board: Board) => Level>` from `src/levels/index.ts`; `buildLevel01(board: Board): Level` from `src/levels/campaign/level01.ts`; `CampaignLevelDef.build?: (board: Board) => Level`; `loadAuthoredOrGenerated(index: number)` in `main.ts`.

- [ ] **Step 1: Write Level 01 (full, concrete — the template for all others)**

Board 24×18. START top-left, FINISH bottom-right (opposite corners). Gentle serpentine (3 lanes),
many soft turns (= EASY per research). Spots: one inside-corner (A), one hairpin fold (S), one beside
the mid lane (B); one special. Decor: a supply-rail block at the top edge + a couple of accent caps in
free space — wired pad-to-pad.

```ts
// src/levels/campaign/level01.ts
import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { powerSupply } from '../../pipeline/circuits'

export function buildLevel01(board: Board): Level {
  const b = new LevelBuilder(board, 101, { name: 'campaign.level0.name', difficulty: 1, archetype: 'serpentine' })
  // serpentine: start top-left → right → down → left → down → right → finish bottom-right
  b.path([
    [0, 2], [18, 2], [18, 6], [4, 6], [4, 10], [20, 10], [20, 14], [23, 14],
  ])
  // build spots (tiers): A inside-corner, S hairpin fold (between lane 1&2), B mid
  b.buildSpot([18, 4], [4, 8], [12, 11])
  b.specialSpot([9, 6])
  // decor: supply rail along the bottom-left free band (away from the path), wired pad-to-pad
  b.block(powerSupply([2, 16], b.alloc))
  return b.build()
}
```

- [ ] **Step 2: Write the authored test (covers level 01 now; extended per level later)**

```ts
// tests/levels/authored.test.ts
import { describe, it } from 'vitest'
import { AUTHORED_LEVELS } from '../../src/levels'
import { assertOneFinish, assertCopperEndpointsOnPads } from './_harness'

const board60 = { cols: 60, rows: 45, pitch: 30 }
// each level builder ignores board size it doesn't need; pass a generous board
describe('authored campaign levels', () => {
  it('all defined levels: one finish + copper lands on pads', () => {
    for (const build of AUTHORED_LEVELS) {
      const lvl = build(board60)
      assertOneFinish(lvl)
      assertCopperEndpointsOnPads(lvl)
    }
  })
})
```

- [ ] **Step 3: Create the index (only level 01 wired for now)**

```ts
// src/levels/index.ts
import type { Board, Level } from '../model/level'
import { buildLevel01 } from './campaign/level01'

// Authored campaign builders, index-aligned with CAMPAIGN_LEVELS. Filled in level by level.
export const AUTHORED_LEVELS: Array<(board: Board) => Level> = [
  buildLevel01,
]
```

- [ ] **Step 4: Add `build?` to the campaign def and wire level 0**

In `src/game/campaign.ts`: add the import and field, attach to level 0.

```ts
// near top:
import type { Board, Level } from '../model/level'
import { AUTHORED_LEVELS } from '../levels'

// in CampaignLevelDef interface, add:
  build?: (board: Board) => Level
```

After the `CAMPAIGN_LEVELS` array literal, attach authored builders by index:

```ts
AUTHORED_LEVELS.forEach((fn, i) => { if (CAMPAIGN_LEVELS[i]) CAMPAIGN_LEVELS[i].build = fn })
```

- [ ] **Step 5: Wire main.ts to prefer authored builders**

In `src/main.ts`, add a helper near `makeLevel` (after line ~92):

```ts
  // campaign: use a hand-authored level when available, else fall back to the generator
  function loadAuthoredOrGenerated(index: number): void {
    const def = CAMPAIGN_LEVELS[index]
    if (def.build) {
      resetPlay(); ui.showTower(null, 0)
      board = { cols: def.cols, rows: def.rows, pitch: PITCH_PX }; editor.state.board = board
      editor.state.loadLevel(def.build(board))
      editor.redraw(); frameLevel()
      updateLevelName(i18n.t(def.nameKey as any) || def.name)
      history.replaceState(null, '', `${location.pathname}?t=authored-${index + 1}`)
      if (seedLabel) seedLabel.textContent = (i18n.lang === 'ru' ? 'уровень ' : 'level ') + (index + 1)
    } else {
      makeLevel(def.cols, def.rows, def.difficulty, def.seed)
    }
  }
```

Replace the campaign-level build calls with `loadAuthoredOrGenerated(index)`:
- `src/main.ts:315` `makeLevel(lvlDef.cols, ...)` inside `onSelectLevel` → `loadAuthoredOrGenerated(index)`.
- The "next level" call (~line 619): `makeLevel(nextDef...)` → `loadAuthoredOrGenerated(activeCampaignLevelIndex!)` (after the index advances).
- The restart calls at ~625 and ~660 that use a `lvlDef` from `CAMPAIGN_LEVELS[activeCampaignLevelIndex]` → `loadAuthoredOrGenerated(activeCampaignLevelIndex!)`.
- Leave the `?t=` URL parser (`main.ts:386`) and "Новая карта" (`newRandomLevel`) on `makeLevel`.

> Read each call site before editing; keep the surrounding audio/tutorial logic intact. Do NOT change
> the `?t=COLSxROWS.DIFF.SEED` regex path.

- [ ] **Step 6: Run tests + build**

Run: `npx vitest run tests/levels && npx tsc --noEmit && npm run build`
Expected: all pass; build clean.

- [ ] **Step 7: Visual check**

Run `npm run dev`, open `/`, click level 1. Confirm: serpentine path framed/centered, spots visible,
the supply-rail decor is wired pad-to-pad (no wires into empty space), `drawRoutingWeb` texture present.

---

### Tasks 5–16: Author levels 02–12 (one task each)

Each level task has the SAME shape. Per task:

1. Create `src/levels/campaign/levelNN.ts` exporting `buildLevelNN(board): Level` using `LevelBuilder`
   — author `path()`(s), `buildSpot`/`specialSpot` (tiers S/A/B/C), and themed `block()`/`part()` decor
   placed in free regions OFF the path and wired pad-to-pad.
2. Add `buildLevelNN` to `AUTHORED_LEVELS` in `src/levels/index.ts` (index NN-1).
3. Add a per-level winnability assertion to `tests/levels/authored.test.ts`:

```ts
  it(`level NN is winnable`, () => {
    assertWinnable(buildLevelNN(boardForNN), /*lo,hi by tier*/)
  })
```
   Import `assertWinnable` + the builder. Tier bands: EASY (lvl 1–3) `lo=0.1, hi=0.45`; MEDIUM (4–7)
   `lo=0.2, hi=0.6`; HARD (8–12) `lo=0.3, hi=0.7`.
4. Run `npx vitest run tests/levels && npx tsc --noEmit`. **Tune the path/spots/decor coordinates until
   green** (per research: add turns/length to ease, add straights/spawns/chokes to harden).
5. `npm run dev`, open the level, screenshot, compare to `docs/design/refs/ref-A-board.png` /
   `ref-B-gameplay.png`; adjust geometry/decor for a clean, centered, interesting field.

Per-level briefs (board sizes from `CAMPAIGN_LEVELS`; START/FINISH on opposite edges/corners; keep
the path clear of decor; place decor in the open margins):

- **Task 5 — Level 02 «Поворот ключа» (24×18, d2):** serpentine + ONE tight hairpin (two parallel runs
  ~2 cells apart) → place an S-tier build spot in the fold (double coverage). 3 build + 1 special.
  Decor: an LED-indicator + series resistor near the hairpin, wired (`ledBar`/`part`).
- **Task 6 — Level 03 «Двойной контур» (32×24, d3):** branch & merge — one path forks into two arms of
  ~equal length and rejoins to one finish (two `path()` calls sharing first+last waypoints). Build spots
  on both arms + a B spot at the merge. Decor: two `opAmp` blocks, one per loop.
- **Task 7 — Level 04 «Шунт питания» (32×24, d4):** serpentine with a deliberate CHOKE kill-zone
  (50–75% of the path) — cluster 2 special + 2 build spots there. Decor centrepiece: `powerSupply`
  block (diode·electrolytic·7805·caps) by the top edge, fully wired.
- **Task 8 — Level 05 «Спиральный мост» (32×24, d5):** inward rectangular spiral toward a centre, with
  ONE crossing drawn as a bridge (two path segments cross; keep one finish). Central S-tier spot covers
  many passes. Decor: `timer555` + accent caps in corners.
- **Task 9 — Level 06 «Широкая магистраль» (44×33, d5):** long boustrophedon with wide lanes and clear
  pacing zones (open→choke→killzone→cleanup). 2 special + 4 build. Decor: `ledBar` row + `passiveBank`.
- **Task 10 — Level 07 «Сетка контактов» (44×33, d6):** branch ×2 (two forks) + light maze choke gates
  (short detours, NOT a full maze). High-value spots at the gates. Decor: `mcuCore` + decoupling caps.
- **Task 11 — Level 08 «Высокое напряжение» (44×33, d7):** TWO spawns (two `path()` from different
  edges) merging to a common spine → one finish. Tesla theme. Spots concentrated on the shared spine.
  Decor: `transistorSwitch` + `amplifierStage`.
- **Task 12 — Level 09 «Частотный разделитель» (60×45, d7):** branch into two near-parallel runs then
  merge; crystal/oscillator theme. Decor: `mcuCore` with crystal + `timer555`; spots on the parallel pair.
- **Task 13 — Level 10 «Многослойный мост» (60×45, d8):** multiple bridge crossings (2–3), single
  finish. Spots at the crossings (ultra-high value). Decor: `passiveBank` ×2 + `opAmp`.
- **Task 14 — Level 11 «Критический перегруз» (60×45, d8):** THREE spawns → collector spine → one
  finish. Dense waves. Spots along the spine + at convergence. Decor: `mcuCore` + `powerSupply`.
- **Task 15 — Level 12 «Финал: Генератор» (60×45, d9):** the showcase — 2–3 spawns + a branch/merge + a
  bridge crossing + a central spiral kill-zone, all to ONE finish. Decor centrepiece: `mcuCore`
  ("generator") in the middle ringed by supporting blocks, all wired. Strongest spot tiering.

- [ ] **Task 16: Final full-suite + visual sweep**

Run: `npm test && npm run build`. Expected: all green. Then `npm run dev`, walk levels 1→12,
screenshot each, confirm escalating interest, centered framing, clean pad-to-pad wiring, and
`drawRoutingWeb` texture throughout.

---

## Self-review notes

- **Spec coverage:** A1 DSL → Task 1; A2 reuse routeCopper → Task 1 (`build()` calls it) + Task 2
  endpoint check; A3 integration → Task 4; A4 teardrop guard → Task 3; Part B 12 levels → Tasks 4
  (L1) + 5–15 (L2–12); Part C validation/tests → Task 2 + per-level steps + Task 16.
- **No new module `blockRoute`** — superseded by reusing `routeCopper` (spec A2 updated).
- **Type consistency:** `LevelBuilder` methods + `makeAlloc`/`RefAlloc`, `AUTHORED_LEVELS`,
  `buildLevelNN`, `loadAuthoredOrGenerated`, harness `assert*` names are used identically across tasks.
- **Geometry is tuned, not placeholder:** each level task's deliverable is concrete code that passes
  `assertOneFinish` + `assertCopperEndpointsOnPads` + `assertWinnable` and matches its brief; exact
  cell coordinates are iterated against those tests + a screenshot (the only reliable way to hand-tune
  a TD map). Level 01 ships full coordinates as the worked template.
