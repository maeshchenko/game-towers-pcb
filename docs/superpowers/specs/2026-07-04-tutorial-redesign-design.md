# Tutorial redesign — level 01 (2026-07-04)

## Problem

The level-01 tutorial guides the player to build **one level-0 cannon** on
`spotCells()[0] = [2,0]` — a corner spot on row 0 that covers only the top lane on a
single pass — then start wave 1. A level-0 cannon deals ~15 dps; wave-1 `normal`
enemies have 153 hp (base 45 × level `hpMul` 3.40). The lone cannon kills nothing and
**all 5 packets leak → −5 lives (25%)** on the player's first-ever wave. Bad first
impression that reads as "the tower I was told to build does nothing".

Root cause is the **spot**, not the tower count. The serpentine folds at rows 2 and 6;
a spot on row 4 (`[9,4]`, `[12,4]`, `[16,4]`) sits between the two lanes, so a range-6
tower covers **both** passes of the road. Simulation:

| Placement | wave-1 leak |
|---|---|
| 1 cannon @ `[2,0]` (current) | 5 / 5 |
| cannon+slow+tesla spread by coverage-score | 3 |
| cannon+slow+tesla on the row-4 fold cluster | 1 |

## Goal

Teach the three opening towers (cannon → slow → tesla) on the **fold cluster**, then
launch a winnable wave 1, then teach one upgrade. Confidence-building, variety-showing,
skippable. No global balance changes (waves 2–8 untouched).

## Design

### Spot selection — fold cells (with fallback)

Tried a runtime geometry cluster (best-coverage spot + 2 nearest) but it picked `[20,4]`
(far-right, weak) over `[9,4]` → leaked 4/7 across waves 1–2. The reliable trio is the
row-4 fold `[9,4] [12,4] [16,4]`. Level 01 is authored + stable, so the tutorial hardcodes
those cells, resolved to spot indices at runtime, with a **`buildOrder()` top-3 fallback**
if the placer ever re-lays the level and a cell is missing.

Assignment (sim-picked, V3 — best defender): **cannon → `[16,4]`** (highest coverage),
**tesla → `[12,4]`** (special centre; chain + range boost covers both lanes best),
**slow → `[9,4]`**. Teaching order stays cannon → slow → tesla; the special-pad copy lives
on the tesla step. Sim: wave 1 leak 0, wave 2 leak 1.

### Step flow

| Step | Guides | Copy teaches |
|---|---|---|
| 0 | START cell (existing) | "враги идут отсюда сюда" |
| 1 | build **cannon** on cluster cannon-spot | damage; place on the fold — one tower, two passes |
| 2 | build **slow** on cluster special-spot | 0 dmg but slows the pack → guns land more shots; special = bonus |
| 3 | build **tesla** on cluster third-spot | chains between clustered enemies |
| 4 | START WAVE button (was step 3) | launch wave 1 |
| 5 | START WAVE (after wave 1 clears) | hold through wave 2 — accrue upgrade gold |
| 6 | click cannon → **upgrade** (after wave 2 clears) | towers grow; spend bounty gold |
| end | — | `completeTutorial()`, destroy overlay |

**Why wave 2, not wave 1, for the upgrade:** start gold 145 − three chips (135) = 10; after
wave 1 (~+39) ≈ 49 gold, below the cheapest upgrade (55). After wave 2 the player has ~99,
enough for the cannon upgrade (60). No gold nudge needed — the economy converges on its own.

### Mechanics / hooks (all in `src/main.ts` + `TutorialOverlay`)

- **Per-step target spot + tower kind:** replace the single `tutorialSpotIndex` /
  hardcoded `'cannon'` with a small table keyed by step:
  `{1:{spot, kind:'cannon'}, 2:{spot, kind:'slow'}, 3:{spot, kind:'tesla'}}`.
  - Radial-menu force-kind (`main.ts:~1191`): use the table's kind for steps 1–3.
  - Click-to-build spot gate (`main.ts:~1151`): use the table's spot for steps 1–3.
  - `onBuild` (`main.ts:~700`): when the built `(kind,spot)` matches the current step's
    target, advance to the next step (1→2→3→4).
- **Steps 4/5 → start waves:** point at the START button; hide the ring/bubble when the wave
  launches. Do **not** complete the tutorial at wave start (removed the old `tutorialStep === 3`
  completion at the `game.startWave()` site).
- **Wave clears → next step:** at the wave→build transition (`main.ts:1382`,
  `lastPhase==='wave' && currentPhase==='build'`): `tutorialStep===4` → `runTutorialStep(5)`
  (prompt wave 2); `tutorialStep===5` → `runTutorialStep(6)` (point the ring at the cannon
  chip for the upgrade lesson).
- **Upgrade → complete:** when `game.upgrade(tower)` succeeds during step 6 (both the panel
  upgrade button and the `KeyU` path), `finishTutorialOnUpgrade()` calls `completeTutorial()`
  + destroys the overlay.

### i18n

New/updated keys (RU + EN) in `src/ui/i18n.ts`:
`tutorial.step1` (cannon+fold), `tutorial.step2` (slow), `tutorial.step3` (tesla),
`tutorial.step4` (start wave — reuse old step3 text), `tutorial.step5` (upgrade).
Old `tutorial.step2` (special-spot pointer) is removed/repurposed.

### Out of scope

- Balance of waves 2–8 (`hpMul`, wave ramp) — unchanged.
- Other levels' tutorials (only level 01 has one).
- Bestiary / enemy-intro cards.

## Files touched

- `src/main.ts` — `runTutorialStep`, radial force-kind, click-build gate, `onBuild`
  advance, wave-clear→step5 hook, upgrade→complete hook.
- `src/ui/i18n.ts` — tutorial step strings (RU/EN).
- Possibly `src/ui/TutorialOverlay.ts` — only if the upgrade step needs a new anchor mode
  (else reuse `showStep`).

## Verification

- Headless sim (temp test, deleted after): the chosen cluster clears wave 1 with ≤1 leak.
- Live browser (Chrome MCP): fresh save → tutorial → follow all 5 steps → wave 1 won →
  upgrade → tutorial ends; SKIP works at every step; 0 console errors.
- `tsc --noEmit` + `npm run lint` clean.
