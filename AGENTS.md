# AGENTS

## Persistent notes → MEMORY.md
**Write all persistent project notes, decisions, conventions, and gotchas to `MEMORY.md`** (repo root) — that is the single source of truth. Read `MEMORY.md` at the start of work, and update it whenever a decision, invariant, or convention changes. Do not scatter notes elsewhere.

## Roadmap → PLANS.md
**`PLANS.md` (repo root) is the live roadmap — keep it current.** Read it at the start of work. When a task is finished, DELETE its line (the record lives in git + `MEMORY.md`); when new work appears, ADD it. PLANS.md holds only what is NOT done yet.

## Key rules (full detail in MEMORY.md)
- **Commits:** Russian, short, clear. Never mention AI/Claude/Opus/neural nets — not in messages, not in trailers. No `Co-Authored-By`. User controls git; don't propose commits/pushes.
- **Stack:** Pixi.js v8 + TypeScript (strict) + Vite + Vitest. True-2D, fake-3D via shading. `tsc` noEmit — no stray `.js` in `src/`/`tests/`.
- **Tests:** keep the suite green; TDD for new logic. `npm run build` must pass.
- **Tile track invariant:** every generated level has exactly ONE finish; all routes converge to it.
- Logic in `src/geom`, `src/pipeline`, `src/tiles`, `src/game` is framework-free and unit-tested; render/UI is thin.
