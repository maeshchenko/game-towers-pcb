# Art reference images

Visual targets for the PCB tower-defense look. Use these when building/adjusting the design.
Full analysis & change plan: `docs/superpowers/specs/2026-06-29-art-direction-plan.md`.

## ref-A-board.png — "board mockup"
The path-as-hero board. Take from it:
- **Path = hero:** thick multi-lane glowing green ribbon (multiple parallel inner conductor lines),
  rounded 45° corners, soft outer glow — dominates the frame.
- **Build spots:** gold square brackets + center crosshair, glowing; **special spots:** cyan octagon.
- **START:** green rounded pad + ▶ + lead chevrons. **FINISH:** red rounded pad + ■.
- **Decor:** moderate-size dark chips at tasteful density (NOT a carpet of tiny parts), recessed.
- **Scale:** path arms spaced ~2× band width; chips ~comparable to band; whole board readable.

## ref-B-gameplay.png — "gameplay concept" (enemies + towers + HUD)
The richer in-game target. Take from it:
- **Enemies = neon tokens ON the lanes**, glowing, with a faint trail. 6 themed types w/ glyphs:
  SIGNAL (cyan ⊙), PACKET (red ■), BURST (gold pill), VIRUS (magenta ◆), CORRUPTED (orange ⬡),
  GLITCH (green △). [+ BOSS as a special.]
- **Towers = dark IC chips** with a bright neon icon + pin rows + colored glow. Types shown:
  PULSE, LASER (cyan beam), EMP, SLOW FIELD, TESLA (magenta lightning arc), MISSILE, SUPPORT.
  (We re-skin our 5 — Pulse/Laser/SlowField/Missile/Tesla; EMP+Support are a later gameplay add.)
- **Build pads (empty):** dashed cyan/teal square + crosshair.
- **HUD = top bar:** LEVEL nn + difficulty word (EASY/MEDIUM/HARD), WAVE x/N, LIVES n ❤,
  CREDITS n ⚡, transport ⏸ ▶ ⏩, menu ≡. Left rail: LEGEND + ENEMY TYPES + TOWER TYPES.
- **Decor detail:** dark recessed components + a faint **background copper-routing web**
  (thin teal traces + tiny via field) for authentic PCB texture; low contrast, sits behind the path.
- **Palette:** saturated neon (cyan / magenta / gold / green / red / orange) on near-black green.

## Real-PCB examples (correct soldering / routing — study these for accuracy)
User-provided photos of real through-hole boards. Use as the ground truth for trace + solder + layout.
- **pcb-traces-bare-1.jpeg / -2-qfp.jpg / -3.jpg** — bare etched/tinned boards. Take: traces are thin,
  run as **parallel bundles with equal gaps**, turn at **45° (or smooth)**, **NEVER cross**, go
  **pad→pad**; QFP fanout = each pin escapes straight out then joins the bundle; **annular ring pads**
  (donut: hole + ring); ground areas as open copper.
- **parts-leads-closeup.webp** — axial resistors + TO-92 on copper. Take: axial body **horizontal**,
  leads **bent 90°** into pads one body-length apart; TO-92 = 3 leads splayed into a **triangle** of
  pads; traces weave **between** pads without crossing; pads are annular rings.
- **board-assembled-led-row.jpg** — populated green board. Take: components in **tidy aligned rows**,
  consistent orientation, axial parts horizontal, TO-220 with heatsink, electrolytics upright, a
  **row of LEDs**, screw terminal; everything spaced on a grid.
- **board-assembled-radio.jpg / board-throughhole-empty.jpg / board-throughhole-ne555.jpg** — silk +
  pads + DIP + film/ceramic caps + axial parts. Take: **silkscreen outlines + designators**, square
  pad = pin 1, DIP centered, parts aligned, generous spacing, neat short traces.

### Camera: TOP-DOWN with pseudo-3D volume (board-topdown-reference.jpg)
ALL parts are drawn from a single **top-down** view (looking straight down at the board), but with
**pseudo-3D shading** so you read each part's height/volume (top face + a thin side wall + highlight
+ cast shadow). One consistent camera — never mix top/side/angled per part.
- electrolytic = **circle** (can seen from top: rim + vent/cross + a `−` arc on the rim), NOT a tall rectangle.
- TO-92 = **D outline** (flat-faced half-circle) top face, 3 leads off the flat side.
- TO-220 = rectangle top + metal tab strip with mount hole, 3 leads.
- axial R/diode/inductor = oblong top with bands, leads bent to pads at both ends.
- ceramic/film cap, LED, crystal, DIP = their top silhouettes (disc/rect/oval/rect) with a slight
  side wall + highlight for volume.
- Volume cue = lighter top face, a 1–2px darker side wall on the bottom/right edge, soft drop shadow.

### Hard rules taken from these (apply to kit2 + generator)
1. Traces **never cross** on one layer; **never run across/under unrelated pads/pins**.
2. Trace enters a pad **head-on**; one trace per pad; **45°/smooth** corners; parallel bundles equal gap.
3. **Annular ring pads** (donut), not flat dots; solder = **concave shiny fillet** on the ring.
4. Axial parts horizontal, leads bent 90° to pads; consistent orientation; aligned rows; grid spacing.
5. Connectors are **board pads/terminals**, not flying wires.

## Notes / requirements captured from review
- The **trace must be the centered hero** (camera frames the path bbox, ~70–80% of viewport).
- **Difficulty ramps per track:** EASY → MEDIUM → HARD (Auto-Generate climbs the ramp).
- Current build looks "thin path + bright sticker decor"; the fixes above invert that emphasis.
