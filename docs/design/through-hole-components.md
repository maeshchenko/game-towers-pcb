# Through-hole (vintage, hand-soldered) component research

Why: current decor is modern tiny SMD → looks wrong vs the reference, which reads as an OLDER
hand-soldered board: big axial/radial parts with visible wire leads + solder joints, vintage
colors. This documents the parts, looks, colors, sizes, aspect ratios for a new `/kit2` set.
(Current SMD set stays; this is additive.)

## Universal traits of through-hole parts
- **Leads**: shiny tin/silver wire legs that leave the body and enter the board through a hole,
  ending in a **solder joint** (small shiny fillet/blob, light silver with a darker center).
- **Bigger** than SMD — give generous grid footprints so they read as chunky vintage parts.
- **Axial** = leads from both ends along the body axis (lies flat: resistor, diode).
- **Radial** = both leads from the bottom, body stands up (electrolytic, disc cap, film cap, LED).
- Bodies have rounded/cylindrical shading (strong highlight + shadow → fake-3D cylinder).

## Parts catalog (form · colors · size/aspect)

1. **Axial resistor** (carbon/metal film)
   - Form: horizontal cylinder, slightly bulged ends, two axial leads + solder joints. 4–5 **color
     bands** across the body (value code).
   - Colors: body **sandy beige/tan** (carbon film) OR **pale sky-blue / mint** (metal film). Bands:
     standard resistor colors (brown/red/orange/yellow/green/blue/violet/grey/white/black, gold/silver tolerance).
   - Size/aspect: body ≈ 3–4 : 1 (long:thin). Leads extend ~1 body-length each side.

2. **Ceramic disc capacitor** ("lollipop")
   - Form: round/oval flat disc on two close radial leads (stands up). Sometimes a blob, not perfect circle.
   - Colors: **ochre/orange-tan** disc, occasionally blue; dark printed value text.
   - Size/aspect: disc ≈ 1:1 (1–1.5 cells), leads splay down.

3. **Film capacitor (polyester/mylar / "greencap" / box)**
   - Form: flat rounded rectangle (dipped) or a hard box; radial leads bottom.
   - Colors: **red** (mylar), **green** (greencap), or **blue/cream box** (MKT). Printed text.
   - Size/aspect: ≈ 1.3–1.8 : 1 wide, medium.

4. **Radial electrolytic capacitor**
   - Form: upright **cylinder can**; top has a **+ / X vent** scoring; a **silver/white stripe with
     “–” minus marks** down one side (polarity). Sleeve is a heat-shrink wrap.
   - Colors: sleeve **deep blue**, **black**, or **dark purple/maroon**; stripe silver-white; top dark.
     Top-down view = ring; side view = tall rounded rectangle. Use **side view** (tall) on the board.
   - Size/aspect: tall, ≈ 1 : 1.6–2.2 (taller than wide), 2×3 to 3×4 cells.

5. **Tantalum capacitor (teardrop / dipped)**
   - Form: rounded teardrop/blob, radial leads. Often a stripe (+).
   - Colors: **yellow**, **orange**, or **dull blue**; dark text + a band marking +.
   - Size/aspect: ≈ 1:1, small-medium.

6. **TO-92 transistor**
   - Form: small **half-cylinder** — flat face + rounded back (D cross-section), 3 leads splaying out the bottom.
   - Colors: **matte black** plastic (sometimes dark blue/grey); faint part-number text on the flat face.
   - Size/aspect: body ≈ 1.2 : 1 (slightly tall), 2×2 cells + spread leads.

7. **TO-220 power transistor / voltage regulator**
   - Form: black rectangular body + a **metal heatsink tab** on top with a **mounting hole**; 3 thick leads bottom.
   - Colors: body **matte black**, tab **brushed silver/grey** with a dark hole. Big.
   - Size/aspect: body ≈ 1 : 1.1, tab adds ~40% height; 3×4 cells.

8. **Axial diode**
   - Form: small cylinder, axial leads; a **band** at the cathode end.
   - Colors: rectifier (1N400x) **matte black** body + **grey/white band**; small-signal (1N4148)
     **orange/red glass** + **black band**. Leads silver.
   - Size/aspect: ≈ 2.5–3 : 1 (shorter/fatter than a resistor).

9. **LED (5 mm domed)**
   - Form: round **domed** top (circle), short skirt/flange ring at base, 2 leads (one longer = anode);
     flat spot on the cathode side of the flange.
   - Colors: translucent **red / green / yellow / blue**, glossy dome highlight + bright emissive core.
   - Size/aspect: ≈ 1:1 dome.

10. **Trimmer potentiometer**
    - Form: small **blue or beige square** with a brass/white **adjustment screw cross** on top; 3 pins.
    - Colors: **blue** body, brass screw. Size ≈ 1:1, 2×2.

11. **Crystal (HC-49)**
    - Form: **metal oval can** (brushed silver), 2 leads, low.
    - Colors: brushed silver/grey, dark text. Aspect ≈ 2:1.

12. **Inductor / choke (axial or toroid)**
    - Axial: looks like a fat resistor with color bands (often **green/teal** body). Toroid: a
      ring with copper windings. Colors green/teal or black with copper.

13. **DIP IC** (through-hole IC — keep but vintage)
    - Form: black rectangle, two rows of **legs** bent under, a **notch / pin-1 dot** at one end.
    - Colors: matte/gloss black body, **silver legs**, white silk text. Bigger than SMD.

## Palette (vintage set)
- Leads/solder: `wireSilver 0xb8c0c0`, `solderTin 0xd8dee0` (joint highlight), joint center `0x8a9290`.
- Resistor body tan `0xc8a86a`, metal-film blue `0x7fb8c8`. Band colors: standard set.
- Ceramic disc `0xcf8a3c` (ochre). Film red `0xb83a2e`, greencap `0x2f7d4a`, box-blue `0x2f5fa8`.
- Electrolytic sleeve blue `0x1f3a7a` / black `0x14181c` / purple `0x432a55`; stripe `0xd8dee0`; top `0x0e1116`.
- Tantalum yellow `0xd8b13a` / orange `0xd07a28`.
- TO-92 / TO-220 body black `0x161616`; TO-220 tab silver `0x9aa3a0`.
- Diode body black `0x161616` band `0xcdd2cf`; glass orange `0xd0561f` band black.
- LED red `0xe23a3a` / green `0x3ad26a` (emissive core brighter).
- Trimpot blue `0x2f5fa8`, brass screw `0xc8a84c`.
- Crystal can `0x9aa3a0`.

## Rendering notes
- Draw **leads first** (under body): silver wire from body edge to a **solder joint** dot at the pad cell.
- Cylindrical parts: body fill + vertical highlight band (left-of-center, white low-alpha) + right
  shadow → reads round. Discs/domes: radial-ish via concentric.
- Keep bodies a touch brighter than SMD set (vintage parts are not black SMD) BUT still sit behind the
  neon path — tune on `/kit2`.
- Footprints larger than SMD; fewer parts, placed with leads toward nearby pads/routing.

## Functional blocks — what connects to what, and why
Real boards are clusters of recurring blocks. Draw these as connected groups (copper between
solder joints), not scattered parts.

1. **Linear power supply** (the classic edge block)
   - `AC/DC in → bridge (4 diodes) → big electrolytic (smoothing) → regulator TO-220 (e.g. 7805) →
     small electrolytic + ceramic decap → regulated out`.
   - Why: diodes rectify, the big electrolytic flattens ripple, the regulator fixes the voltage, the
     ceramic + small electrolytic kill noise/oscillation at the regulator out.

2. **LED indicator**
   - `rail → series resistor → LED → ground`. Why: resistor limits current so the LED survives.

3. **Crystal oscillator (clock)**
   - `crystal between two IC pins, each pin → a small ceramic cap → ground`. Why: crystal sets
     frequency; the two load caps make it oscillate cleanly.

4. **Transistor stage (switch/amp)**
   - `base resistor → transistor (TO-92) base; collector resistor → collector; emitter → (resistor) →
     ground; coupling film/ceramic caps on in/out`. Why: resistors bias the transistor; caps couple
     signal / block DC.

5. **IC decoupling**
   - `ceramic cap directly across each IC's power & ground pins`. Why: local charge reservoir, kills
     switching noise. Always near the IC.

6. **RC filter / timing**
   - `resistor + capacitor` (series or to ground). Why: smoothing, time constants, debouncing.

Layout rules for the generator: place a block's parts adjacent, route short copper between their
solder joints, keep decoupling caps hugging their IC, put the power block near a board edge.

## Pin functions (each lead does a different job — connections MUST respect this)
`vintagePins(kind)` returns labels in the SAME order as `vintageLeadEnds(kind)`.
- resistor / inductor: `A`, `B` — non-polar (either way).
- ceramic / film cap: `t1`, `t2` — non-polar.
- diode: `anode`, `cathode` — current flows anode→cathode; **band end = cathode**.
- electrolytic / tantalum: `+`, `-` — **polar** (stripe = −). `+` toward supply, `−` toward GND.
- LED: `anode`, `cathode` — long lead = anode (to +/through R); cathode → GND.
- transistor TO-92: `E`(emitter), `B`(base), `C`(collector) — signal into base, C/E carry load.
- regulator TO-220 (7805): `IN`, `GND`, `OUT` — unregulated in, common gnd, regulated out.
- battery / clip / jack: `+`, `-` (jack: `tip+`, `sleeve-`). Red wire = +, black = −.
- DIP IC: per-pin; here top-right = `VCC`, bottom-left = `GND`, two mids = `OSC`, rest `IO`.

Rules enforced in kit2: diode cathode→cap +; cap +→regulator IN; regulator OUT→VCC, GND→GND;
R→LED anode, LED cathode→GND; battery +→clip +; R→transistor base, collector→VCC via R, emitter→GND.

## Pairwise connection rules (which part wires to which, why) — kit2 §2
- battery 9V → battery clip (Krona): clip snaps onto the battery = power source.
- battery clip / DC power jack → board VCC/GND: power input to the board.
- resistor → LED: series R limits LED current (else LED burns).
- diode (bridge) → electrolytic: rectified DC is smoothed by the big cap.
- electrolytic → regulator (7805/TO-220): smoothed DC into the regulator input.
- regulator → ceramic cap: output decoupling / stability.
- crystal → IC oscillator pins (+ 2 load caps to GND): clock.
- IC + ceramic cap across its VCC/GND pins: decoupling (local charge, kills noise).
- resistor + capacitor: RC filter / timing / debounce.
- resistor → transistor (TO-92) base: bias; collector R → VCC; coupling caps on signal.
- trimpot → IC/node: adjustable input (gain/threshold).
- inductor + electrolytic: LC ripple filter on a supply.

## PCB routing rules (a trace that crosses a foreign pin/trace = a short)
- **No same-layer crossings.** Two nets must never touch. If they must cross, one drops to another
  layer through a **via** (drawn as a small ringed dot) and back — that's the only legal cross.
- **Route around pads/pins**, never straight over a pin you don't connect to (keep clearance ~3× trace width).
- **45° turns, not 90°** (no acute angles); smooth corners.
- **Ground plane / pour** instead of long GND traces: GND pins connect to the pour with a short
  **thermal via** (a ringed pad), so grounds don't need crossing wires.
- **Power rail** along an edge; parts **tap** it with a short stub + via (the tap ends ON the rail).
- **Teardrops**: pad↔trace junctions get a teardrop fillet (mechanical relief).
- **Solder joint**: a good joint is a small **concave, shiny** fillet around the lead at the pad —
  light tin with a slightly darker center, not a flat blob.

Implementation: kit2 §3 routes each net with the octilinear A* (`geom/router.ts`) over a grid where
component bodies + every foreign pin + already-routed traces are **blocked**, so routed copper never
overlaps; GND uses a pour + thermal vias; VCC is a rail with stub taps; unavoidable crossings get a via.

## Sources
- [PCB Routing Guide — Design Rules & Best Practices (PCBRunner)](https://www.pcbrunner.com/a-complete-guide-to-pcb-routing-design-rules-and-best-practices-for-success/)
- [Routing Traces in PCBs: Best Practices (Cadence)](https://resources.pcb.cadence.com/blog/2024-routing-traces-in-pcbs-best-practices)
- [Is it acceptable for PCB traces to cross on different layers? (Sierra)](https://sierraconnect.protoexpress.com/t/is-it-acceptable-for-pcb-traces-to-cross-on-different-layers/1634)
- [PCB Teardrops Roles and Rules (JHDPCB)](https://jhdpcb.com/blog/pcb-teardrops/)
- [Mastering Solder Joint Quality — IPC-A-610 fillets (ALLPCB)](https://www.allpcb.com/allelectrohub/mastering-solder-joint-quality-an-ipc-a-610-guide-to-acceptable-fillets)
- [Through-hole technology — Wikipedia](https://en.wikipedia.org/wiki/Through-hole_technology)
- [The Ultimate Guide to Through-Hole Component Identification — ALLPCB](https://www.allpcb.com/blog/pcb-assembly/the-ultimate-guide-to-through-hole-component-identification-a-beginners-handbook.html)
- [Through-Hole Resistors Guide — TechSparks](https://www.tech-sparks.com/through-hole-resistors/)
- [NASA Workmanship — Through-hole soldering radial components](https://workmanship.nasa.gov/lib/insp/2%20books/links/sections/610%20Radial%20Components.html)
- [Component Orientation and Polarity — Sierra Circuits](https://www.protoexpress.com/kb/component-orientation-and-polarity/)
