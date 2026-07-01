# Tower Defense Map Design — Taxonomy & Generator Theory

Research-backed reference for the procedural map generator. Sources cited inline.
Two earlier focused studies + one multi-agent deep-research (102 agents) feed this; claims
marked ✓ passed 3-vote adversarial verification.

---

## Part 1 — Map Archetypes (forms / types)

Tower-defense maps fall into a small set of structural archetypes. The generator should be
**archetype-driven**: pick an archetype (by difficulty / variety), then realize it.

| # | Archetype | How it works | Examples | Tower-placement effect | Gen difficulty |
|---|-----------|--------------|----------|------------------------|----------------|
| 1 | **Single fixed path** | One corridor spawn→exit | Kingdom Rush, GemCraft, Defender's Quest | Place along the corridor; corners are prime | Low |
| 2 | **Serpentine / boustrophedon** | Single path snakes back and forth in lanes | classic flash TD, BTD tracks | Tight lane pairs give one tower 2 passes (double coverage) | Low |
| 3 | **Spiral (in/out)** | Path winds in rings toward/from a center base | Defense Grid-ish | Central spot hits enemies 4–6× as they wind in | Medium |
| 4 | **Branching & merging** | Path forks then rejoins | Kingdom Rush richest maps | Forces splitting resources; junction = high value | Med-High |
| 5 | **Multi-lane (parallel)** | 2–4 separate non-merging paths | PvZ lanes, some BTD | Lane specialization; resource split | High |
| 6 | **Multi-spawn → one base** | Several spawns converge on one defended base | TowerMind model ✓, ACAS'22 tile gen ✓ | Defend convergence; **difficulty = #entryways (1→4)** ✓ | Medium |
| 7 | **Figure-8 / self-crossing loop** | Path crosses itself | — | Crossing tile = ultra-high-value spot | High |
| 8 | **Cross / junction** | Paths meet at a central junction | — | Junction dominates | High |
| 9 | **Open-field / maze TD** | No fixed path — towers ARE obstacles; enemies pathfind around them ✓ | Desktop TD, Gem TD | Player builds the maze; flow-field repath ✓ | Very High |
| 10 | **Ring / circular** | Path is a loop around a center | — | Inner spots cover the whole ring | Medium |

Notes:
- **Maze/open-field** (✓ Red Blob): towers placed anywhere act as obstacles that dynamically
  alter enemy paths; needs a single **flow-field/BFS from the exit** computed once for all
  enemies (not A* per enemy) ✓. Enables "juggling/yo-yoing": block to force the long way, sell,
  re-block — extends effective path length ✓.
- Our locked product decision is **fixed-path** (single winding) for v1, but the generator
  should be structured so archetypes 1–3, 6, 10 are selectable; maze (9) is a separate mode.
- **Non-scrolling, one-screen maps aid focus** ✓ (Defender's Quest) — keep the board view-fit.

---

## Part 2 — Layout principles (what makes a path good vs boring)

- **Difficulty ∝ shape & length** ✓ (Aalto thesis): paths with **many turns are EASIER** (a
  tower's range covers more path tiles → hits more enemies); **straight paths are HARDER**
  (most of the range is wasted); **longer paths are easier** (more reaction time). → Tune
  turns/length to set difficulty, don't just make it long.
- **Choke point = max dwell time under fire**, not merely the narrowest tile.
- **Hairpin / U-turn double-coverage**: when two parallel path runs are ≤ 2× tower range
  apart, one tower hits both → the single strongest placement in fixed-spot TD.
- **Path-doubling-back / spiral**: every tile that re-enters an earlier tower's range is a
  free extra pass; serpentine & spiral exploit this deliberately.
- **Pacing zones**: open/easy near spawn (0–25%), first choke ~25–50%, kill-zone / tightest
  geometry 50–75%, cleanup near exit. Layout is a difficulty script.
- **Start/exit on opposite edges/corners** (never same edge) so the path traverses the board.
- **Coverage overlap**: place spots so adjacent ranges overlap *on the path*, forcing choices.

---

## Part 3 — Build-spot placement theory

- Fixed-spot (ours), free-placement, and maze are the three models.
- **Spot placement is its own optimization layer** ✓ (GA paper): score by (a) proximity to
  path, (b) even distribution along the path, (c) **impact = number of path tiles within
  tower range**. **Random spot placement → unsolvable levels** ✓. Our coverage-greedy
  `computeTowerSpots` already encodes (a)+(c); it naturally favors hairpins (double coverage).
- Tier the spots: S = hairpin fold, A = inside 90° corner, B = adjacent to a choke, C = open
  straight. Guarantee ≥ 2–3 independent high-value spots so no single dominant strategy.

---

## Part 4 — Procedural generation methods

- **Geometric / direct waypoints** (what we do now): emit the archetype's corner waypoints
  directly (serpentine lanes, spiral rings). Deterministic, trivially connected. Best for a
  controlled archetype look.
- **Grid maze routing (A*/Lee)** ✓ refs: route start→exit on a grid with turn/wander cost
  shaping; guarantees connectivity by construction.
- **Random walk / Drunkard**: organic corridors; can self-trap, needs retries; bias toward
  center + toward last direction for longer corridors.
- **Tile / jigsaw (modular)** ✓ (ACAS'22): premade square tiles with edge "entryways"; start
  from a central **Base Tile**, place+rotate neighbors so roads line up; **edge sensors** keep
  only tiles that form a **dead-end-free** path → solvability guaranteed at gen time ✓.
  Difficulty = #entryways into the base (1–4) ✓.
- **Genetic algorithm** ✓: bit-string grid genotype (1=obstacle), start/end on edges, fitness
  = path-existence (0 if blocked; high if connected; else ∝ closeness; penalize diagonal-only);
  **obstacle density is the dominant solvability knob** (~62%) ✓; restart if no path ✓.
- **WFC for paths**: possible but no strong precedent.
- **Decomposition** ✓ (Kingdom Rush FDG'19): generate three independent building blocks —
  **road map, tower locations, wave sequence** — then assemble.

### Solvability / quality validation
- **Edge-sensor tile validity** (jigsaw) ✓ or **Monte-Carlo automated playtester** ✓ that
  simulates a basic defense and checks leakage (target ~15–30% leak on a basic strategy =
  balanced). We currently guarantee connectivity by construction + a spot-count invariant;
  a Monte-Carlo solvability check is a later upgrade (needs the gameplay sim).

### Quality metrics (computable)
- path length / board area (global density), turn count, choke count, coverage score
  (Σ path-tiles-in-range over candidate spots), # independent high-value spots.

---

## Part 5 — Good vs boring map
- **Boring** = fully solvable/optimizable once and then static (Defender's Quest essay), or a
  straight DPS-race line, or uniform geometry (every turn identical) with no decision points.
- **Good** = varied geometry (mix of tight hairpins, wide turns, one fork/choke), a clear
  pacing arc, 2–3 competing high-value spots, opposite-corner traversal, fits one screen.

---

## Part 6 — Generator design implied for THIS project

Make the generator **archetype-parameterized**:
```
generateLevel({ board, difficulty, seed, archetype? })
  archetype ∈ { serpentine, spiral, multiSpawn, branching, ring }  (default: weighted-random by seed/difficulty)
```
Each archetype produces orthogonal (45°-rounded) waypoints, then the shared pipeline runs
`computeTowerSpots` (coverage-greedy, corner/hairpin-biased) + `growDecor`.

Per-archetype realization:
- **serpentine** (done): horizontal lanes, varied gaps (tight mid = hairpins), pacing, fill height.
- **spiral**: concentric rectangular rings spiraling toward a center base; central spot S-tier.
- **multiSpawn**: 2–4 spawns at edges, each an A*/orthogonal route converging to one exit;
  #spawns scales with difficulty (1–4) ✓.
- **branching**: single path that forks once (equal-length branches ±15%) and rejoins.
- **ring**: closed-ish loop around a center with one spawn tap-in and one exit.

Difficulty knobs: archetype choice, lane/turn count, hairpin tightness mix, #spawns, path
length. Keep determinism (seed) + connectivity-by-construction + spot-count invariant + the
100-seed test (extend to assert per archetype).

## Sources
Red Blob Games (flow-field TD); ACAS'22 tile-jigsaw PCG (dl.acm.org/10.1145/3564982.3564993);
FDG'19 Kingdom Rush block decomposition (10.1145/3337722.3337723); GA TD PCG
(researchgate 351488584); Aalto thesis (path-shape difficulty); TowerMind (arXiv 2601.05899);
Gem TD / SC2 mazing wikis; Defender's Quest essay (fortressofdoors); designthegame.com;
Kingdom Rush design (gamedeveloper.com); Stardock Siege of Centauri.
