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

## Sources
- [Through-hole technology — Wikipedia](https://en.wikipedia.org/wiki/Through-hole_technology)
- [The Ultimate Guide to Through-Hole Component Identification — ALLPCB](https://www.allpcb.com/blog/pcb-assembly/the-ultimate-guide-to-through-hole-component-identification-a-beginners-handbook.html)
- [Through-Hole Resistors Guide — TechSparks](https://www.tech-sparks.com/through-hole-resistors/)
- [NASA Workmanship — Through-hole soldering radial components](https://workmanship.nasa.gov/lib/insp/2%20books/links/sections/610%20Radial%20Components.html)
- [Component Orientation and Polarity — Sierra Circuits](https://www.protoexpress.com/kb/component-orientation-and-polarity/)
