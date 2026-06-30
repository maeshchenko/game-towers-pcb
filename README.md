# PCB Tower Defense

A 2D tower-defense game styled as a printed circuit board: dark-green substrate, thick multi-lane glowing octilinear traces (the enemy path is the visual hero), gold build-spot brackets, cyan special-spot octagons, green START / red FINISH pads, and realistic procedural vintage through-hole PCB decor.

**Stack:** Pixi.js v8 (WebGL2) · TypeScript (strict) · Vite (multi-page) · Vitest. True-2D; depth is faked with 2D shading (bevel/shadow/specular/glow) — no 3D engine.

## Run

```bash
npm install
npm run dev              # http://localhost:5173
npm run build            # tsc (noEmit) + vite build
npm test                 # vitest
npm run balance:optimize # per-map balance: recommends meta.tune.hpMul per campaign level
```

## Routes (dev)

| URL | What |
| --- | --- |
| `/` | Game — plays immediately on a fresh random level; "Новая карта" rolls the next. |
| `/editor` | Level editor (author / generate / save levels). |
| `/kit2` | Component library: parts, connections, hand-laid board, large circuits. |
| `/kit` | Archive of the earlier component page. |

## Reproducible tracks

Every random track is deterministic from a code `COLSxROWS.DIFF.SEED` (e.g. `60x45.4.882641`). The code shows bottom-right (copyable) and lives in the URL as `?t=...` — open the same URL to get the exact same track. The **12 campaign levels are hand-authored** (`src/levels/`, not seed-generated) and deep-link as `?t=authored-N` (N = 1..12).

## Project notes

`MEMORY.md` (repo root) is the single source of truth for architecture, decisions, invariants, conventions, and gotchas. `AGENTS.md` holds the working rules. Read `MEMORY.md` first.
