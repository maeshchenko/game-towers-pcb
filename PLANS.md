# PLANS — roadmap (live)

> **Keep this file current.** When something is finished, DELETE it from here (its record lives in git + `MEMORY.md`). When new work appears, ADD it. This file = only what is NOT done yet. Done ≠ documented here; done = gone from here.

Order = rough priority, top first. Tick `[x]` only as a momentary marker before deleting the line.

## Next up
- [ ] **Top HUD restructure to reference.** Move HUD from bottom bar to top row: `LEVEL / HARD` · `WAVE n/N` · `LIVES ❤` · `CREDITS ⚡` · transport `⏸ ▶ ⏩` · menu. Match ref-B layout. (`src/ui/GameUI.ts`, `src/ui/styles.css`.)
- [ ] **Finish T0 tile track.** Bridge over/under render (crossing visual), tile editor palette in `/editor`, save/load tile grids. (`src/tiles/`, `src/editor/`.)

## Polish backlog
- [ ] **Balance tuning** across full difficulty ramp (1→9) — verify each preset size winnable + pressure in band; tune `DIFFICULTY_RAMP` / wave curves if needed.
- [ ] **Real enemy art** — enemies are simple neon tokens now; design themed glyphs/sprites per type.
- [ ] **Audio** — fire/build/hit/wave-start SFX + ambient.
- [ ] **Save progress** — persist campaign index / unlocked levels (localStorage).
- [ ] **Decor density/connectivity aesthetics** — tune big-block packing + MST link density so the full-board schematic reads cleanly at every preset.

## Ideas / unscheduled
- [ ] Mobile/touch layout + pinch-zoom.
- [ ] Shareable level codes UI (paste a `COLSxROWS.DIFF.SEED` to load).
