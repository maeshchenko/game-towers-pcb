# PCB TD — Milestone G2: Smart Placement & Balance

Status: Draft
Date: 2026-06-29

## Goal
Guarantee every generated level is **winnable AND balanced** ("not trivial, not impossible,
not a thousand towers in one spot, not one every meter") by using the real combat engine
(`Game`) as a **headless automated playtester** (Monte-Carlo-style), and auto-tuning the level's
economy so a *basic* defense strategy wins with a target leak band.

## Approach (reuses `Game` — pure logic, runs without Pixi)
- `src/game/sim.ts`:
  - `basicPlacement(game): void` — a reference strategy: arm the cheapest viable tower and build
    on the top-coverage spots in score order while gold allows (spots are already coverage-sorted,
    so this favours chokes/hairpins). Mix is simple (mostly cannon, a slow at a hairpin).
  - `simulate(level, seed, opts): SimResult` — headless: `new Game(level, seed)`, run `basicPlacement`,
    then for each wave `startWave()` and `tick(FIXED_DT)` in a loop until the wave clears or lose;
    between waves re-run `basicPlacement` (spend accrued gold). Returns
    `{ won: boolean, leaked: number, totalSpawned: number, leakFraction: number, wavesCleared: number }`.
    Deterministic (seeded). A hard tick cap prevents infinite loops.
- `src/game/balance.ts`:
  - `evaluate(level, seed): { leakFraction, won }` (one simulate run; could average a few seeds).
  - `autoBalance(level): Level` — adjust the level's economy knobs (start gold, and/or `meta.difficulty`
    → enemy hpScale, and/or spot budget) so `leakFraction` lands in `[TARGET_LO, TARGET_HI]`
    (e.g. 0.10–0.30). Bounded iterations; if it can't hit the band, pick the closest fair setting and
    `log` it. Returns a new Level with tuned fields.

## Integration
- `generateLevel` runs `autoBalance` on the produced level (or exposes `generateBalancedLevel`).
- The editor "Auto-Generate" uses the balanced generator so what the player sees is fair.

## Metrics / targets
- `leakFraction` = leaked enemies / total spawned across all waves under basic defense.
- Balanced = basic strategy wins (lives > 0) AND leakFraction in target band (some pressure).
- Quality guards (logged, not silently dropped): if a level needs an extreme tune (e.g. hp ×0.3),
  flag it.

## Testing (Vitest, headless — no Pixi)
- `simulate` is deterministic per seed; returns sane stats; terminates within the tick cap.
- A trivially-easy hand level (short path, strong towers) → won, low leak.
- An impossible hand level (no spots / huge hp) → not won (sanity).
- `autoBalance`: over N generated seeds, the tuned level is won by basic strategy with leakFraction
  in band (or flagged), deterministically.

## Out of scope
- Per-tower-type optimal AI, ML, multi-strategy search (single basic strategy suffices for the
  fairness guarantee). Visual/art polish. Save-progress.

## Open questions
- Exact target band + which knob to tune first (gold vs hp vs spot count) — pick gold first
  (least destructive), then hpScale, tune during implementation against the 100-seed test.
