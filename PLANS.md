# PLANS — roadmap (live)

> **Keep this file current.** When something is finished, DELETE it from here (its record lives in git + `MEMORY.md`). When new work appears, ADD it. This file = only what is NOT done yet. Done ≠ documented here; done = gone from here.

Order = rough priority, top first. Tick `[x]` only as a momentary marker before deleting the line.

## Next up
- [ ] **Re-enable campaign decor.** Decor is hidden now (`SHOW_DECOR=false` in `Renderer.ts`) to focus on track+towers. Place it AROUND the tower spots via `LevelBuilder.fillBlocks` (footprint keeps a gap from path AND from spots), then flip `SHOW_DECOR=true` and tune density per level. (`src/levels/`, `src/render/Renderer.ts`.)
- [ ] **Finish T0 tile track.** Bridge over/under render (crossing visual), tile editor palette in `/editor`, save/load tile grids. (`src/tiles/`, `src/editor/`.)

## Polish backlog
- [ ] **Real enemy art** — enemies are simple neon tokens now; design themed glyphs/sprites per type.

