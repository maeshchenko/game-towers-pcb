# Map Archetypes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add serpentineV and spiral path builders to the level generator, plus an archetype selector, so each generated level uses one of three map forms.

**Architecture:** Each archetype is a pure function `(board, difficulty, rng) => Cell[]` returning orthogonal corner waypoints; the selector picks one deterministically from seed+difficulty; the existing `octilinearize` + spots + decor pipeline runs unchanged. `Level.meta` gains an optional `archetype` field.

**Tech Stack:** TypeScript, Vitest. No new dependencies.

## Global Constraints

- Single polyline (no branching/multi-spawn) — each builder returns ONE `Cell[]` start→finish.
- Margin `m=2` for all builders.
- Waypoints are orthogonal segments only (dx=0 or dy=0 for every consecutive pair, so `isOctilinear` passes without extra corner-insertion by `octilinearize`).
- Deterministic from passed `rng` (seeded from `seed`).
- Ring gap ≥ 3 for spiral (tower coverage between rings).
- `spots + specialSpots >= minSpots(difficulty)` after the relax-retry loop.
- Commit message in Russian; no AI attribution.

---

### Task 1: Add `archetype?` to `Level.meta`

**Files:**
- Modify: `src/model/level.ts:22`

**Interfaces:**
- Produces: `Level['meta'] = { name: string; difficulty: number; archetype?: string }`

- [ ] **Step 1: Read the current meta type**

`src/model/level.ts` line 22: `meta: { name: string; difficulty: number }`

- [ ] **Step 2: Add the optional field**

Change line 22 to:
```typescript
  meta: { name: string; difficulty: number; archetype?: string }
```

- [ ] **Step 3: Verify build still passes**

```bash
cd /Users/rabota/Study/game-towers-pcb && npx tsc --noEmit
```
Expected: no errors.

---

### Task 2: Refactor + implement path builders in `generator.ts`

**Files:**
- Modify: `src/pipeline/generator.ts`

**Interfaces:**
- Produces:
  - `buildSerpentineH(board, difficulty, rng): Cell[]` — existing logic, renamed
  - `buildSerpentineV(board, difficulty, rng): Cell[]` — vertical lanes
  - `buildSpiral(board, _difficulty, rng): Cell[]` — inward rectangular spiral
  - `ARCHETYPES: readonly string[]` — exported for tests
  - `selectArchetype(rng, difficulty, override?): string`
  - `generateLevel({ board, difficulty, seed, archetype? }): Level` — updated signature

- [ ] **Step 1: Write failing tests (Task 4 prerequisite — skip for now, done in Task 4)**

- [ ] **Step 2: Rename `buildSerpentine` → `buildSerpentineH`**

In `generator.ts`, rename the function declaration and all internal references.

- [ ] **Step 3: Implement `buildSerpentineV`**

Add after `buildSerpentineH`:

```typescript
// Vertical-lane boustrophedon: columns swept left→right, joined at alternating top/bottom.
// START top-left, FINISH at the right side. Pacing: tight column gaps in middle third.
function buildSerpentineV(board: Board, difficulty: number, rng: () => number): Cell[] {
  const m = 2
  const lanes = Math.max(4, Math.min(8, 4 + Math.floor(difficulty / 1.5)))
  const yT = m + Math.floor(rng() * 2)
  const yB = board.rows - 1 - m - Math.floor(rng() * 2)

  const xs: number[] = []
  let x = m + Math.floor(rng() * 2)
  for (let i = 0; i < lanes; i++) {
    xs.push(x)
    const t = lanes > 1 ? i / (lanes - 1) : 0
    const r = rng()
    let gap: number
    if (t > 0.4 && t < 0.78)      gap = r < 0.6 ? 2 : 3
    else if (t < 0.2 || t > 0.85) gap = 4 + Math.floor(r * 3)
    else                            gap = 3 + Math.floor(r * 2)
    x += gap
  }
  // Normalize xs to span full board width (left margin → right margin).
  const left = m, right = board.cols - 1 - m
  const span = xs[xs.length - 1] - xs[0] || 1
  for (let i = 0; i < xs.length; i++)
    xs[i] = Math.round(left + ((xs[i] - xs[0]) / span) * (right - left))

  const wp: Cell[] = []
  for (let i = 0; i < lanes; i++) {
    const topFirst = i % 2 === 0
    const a: Cell = topFirst ? [xs[i], yT] : [xs[i], yB]
    const b: Cell = topFirst ? [xs[i], yB] : [xs[i], yT]
    wp.push(a, b)
  }
  return wp
}
```

Connector between consecutive lanes: (xs[i], yB)→(xs[i+1], yB) or (xs[i], yT)→(xs[i+1], yT) — same y, so already octilinear.

- [ ] **Step 4: Implement `buildSpiral`**

Add after `buildSerpentineV`:

```typescript
// Inward rectangular spiral: outer top-left → right → down → left → up, each lap inset by gap.
// All segments are orthogonal; the FINISH is near the board center.
function buildSpiral(board: Board, _difficulty: number, rng: () => number): Cell[] {
  const m = 2
  const gap = 3 + Math.floor(rng() * 2) // 3 or 4 — ensures tower coverage between rings

  let l = m, t = m, r = board.cols - 1 - m, b = board.rows - 1 - m
  const wp: Cell[] = [[l, t]] // START = outer top-left

  while (true) {
    if (r - l < gap + 1 || b - t < 1) break // ring too small
    wp.push([r, t]) // → right along top
    wp.push([r, b]) // ↓ down along right
    const nextL = l + gap
    if (nextL >= r - gap) break
    wp.push([nextL, b]) // ← left along bottom (stop at next ring's left)
    const nextT = t + gap
    if (nextT >= b - gap) { break }
    wp.push([nextL, nextT]) // ↑ up along left (to next ring's top)
    l = nextL; t = nextT; r -= gap; b -= gap
  }
  return wp
}
```

Each push creates a point with a shared x or y with its predecessor → all consecutive pairs are octilinear.

- [ ] **Step 5: Add archetype selector and update `generateLevel`**

Replace the `generateLevel` export with:

```typescript
export const ARCHETYPES = ['serpentineH', 'serpentineV', 'spiral'] as const
export type ArchetypeName = typeof ARCHETYPES[number]

function selectArchetype(rng: () => number, difficulty: number, override?: string): ArchetypeName {
  if (override && (ARCHETYPES as readonly string[]).includes(override))
    return override as ArchetypeName
  // Slight spiral bias at difficulty ≥ 5
  const weights = difficulty >= 5 ? [1, 1, 2] : [1, 1, 1]
  const total = weights.reduce((a, b) => a + b, 0)
  const pick = rng() * total
  let acc = 0
  for (let i = 0; i < ARCHETYPES.length; i++) {
    acc += weights[i]
    if (pick < acc) return ARCHETYPES[i]
  }
  return ARCHETYPES[0]
}

export function generateLevel(params: {
  board: Board; difficulty: number; seed: number; archetype?: string
}): Level {
  const { board, difficulty, seed, archetype: archetypeOverride } = params
  const rng = makeRng(seed)

  const archetype = selectArchetype(rng, difficulty, archetypeOverride)
  let rawWaypoints: Cell[]
  if (archetype === 'serpentineV')       rawWaypoints = buildSerpentineV(board, difficulty, rng)
  else if (archetype === 'spiral')       rawWaypoints = buildSpiral(board, difficulty, rng)
  else /* serpentineH */                 rawWaypoints = buildSerpentineH(board, difficulty, rng)

  const waypoints = octilinearize(rawWaypoints)
  const trace = { waypoints, cornerRadius: 0.5 }

  const target = minSpots(difficulty)
  const attempts = [
    { budget: target + 6,  minSeparation: 3, rangeCells: 4 },
    { budget: target + 12, minSeparation: 2, rangeCells: 5 },
    { budget: target + 24, minSeparation: 1, rangeCells: 6 },
  ]
  let spots: TowerSpot[] = []
  let specialSpots: TowerSpot[] = []
  for (const a of attempts) {
    const res = computeTowerSpots({
      board, trace, budget: a.budget,
      minSeparation: a.minSeparation, rangeCells: a.rangeCells,
    })
    spots = res.spots
    specialSpots = res.specialSpots
    if (spots.length + specialSpots.length >= target) break
  }

  const { decor, nets } = buildDecorWithNets({ board, trace, spots, specialSpots, seed })
  const copper = routeCopper({ decor, nets, board, trace })

  return {
    version: 1,
    board,
    seed,
    trace,
    spots,
    specialSpots,
    decor,
    nets,
    copper,
    meta: { name: `Level ${difficulty.toString().padStart(2, '0')}`, difficulty, archetype },
  }
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/rabota/Study/game-towers-pcb && npx tsc --noEmit
```
Expected: no errors.

---

### Task 3: Extend tests in `generator.test.ts`

**Files:**
- Modify: `tests/pipeline/generator.test.ts`

**Interfaces:**
- Consumes: `generateLevel`, `minSpots`, `ARCHETYPES` from `../../src/pipeline/generator`
- Consumes: `isOctilinear` from `../../src/geom/octilinear`

- [ ] **Step 1: Update import to include `ARCHETYPES`**

```typescript
import { generateLevel, minSpots, ARCHETYPES } from '../../src/pipeline/generator'
```

- [ ] **Step 2: Extend the 100-seed test to check archetype field**

Add inside the 100-seed loop after existing assertions:
```typescript
      expect(ARCHETYPES as readonly string[]).toContain(lvl.meta.archetype)
```

- [ ] **Step 3: Add test confirming all archetypes are exercised across 100 seeds**

```typescript
  it('all archetypes are exercised across 100 seeds at difficulty 4', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 100; seed++) {
      const lvl = generateLevel({ board, difficulty: 4, seed })
      seen.add(lvl.meta.archetype!)
    }
    for (const arch of ARCHETYPES) expect(seen).toContain(arch)
  })
```

- [ ] **Step 4: Add per-archetype forced tests**

```typescript
  describe('archetype override', () => {
    for (const arch of ARCHETYPES) {
      it(`${arch}: octilinear, connected, bounding-box, spot count`, () => {
        for (let seed = 0; seed < 5; seed++) {
          const lvl = generateLevel({ board, difficulty: 3, seed, archetype: arch })
          const wp = lvl.trace.waypoints
          expect(wp.length).toBeGreaterThanOrEqual(2)
          for (let i = 1; i < wp.length; i++)
            expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
          // Bounding box must span ≥ 60% of the board in each dimension
          const xs = wp.map((c) => c[0])
          const ys = wp.map((c) => c[1])
          expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(board.cols * 0.6)
          expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(board.rows * 0.6)
          expect(lvl.meta.archetype).toBe(arch)
          expect(lvl.spots.length + lvl.specialSpots.length).toBeGreaterThanOrEqual(minSpots(3))
        }
      })
    }
  })
```

- [ ] **Step 5: Run all tests**

```bash
cd /Users/rabota/Study/game-towers-pcb && npx vitest run
```
Expected: all pass.

---

### Task 4: Full build + report

- [ ] **Step 1: Run build**

```bash
cd /Users/rabota/Study/game-towers-pcb && npm run build
```
Expected: success (exit 0).

- [ ] **Step 2: Write report to `.superpowers/sdd/archetypes-report.md`**

- [ ] **Step 3: Commit**

```bash
git add src/model/level.ts src/pipeline/generator.ts tests/pipeline/generator.test.ts
git commit -m "Генератор: архетипы карт (гор/верт серпантин, спираль) + выбор формы"
```
