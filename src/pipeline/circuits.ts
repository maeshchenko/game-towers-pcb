/**
 * Functional circuit block library.
 * Each block factory returns placed DecorItems (positions relative to an origin cell)
 * plus a local net list (indices into the returned items array).
 *
 * Blocks are compact and mimic real PCB layout conventions:
 *  - decoupling caps adjacent/touching their IC
 *  - series components placed end-to-end
 *  - power chain laid out as a line
 */

import type { DecorItem } from '../model/level'
import type { Cell } from '../geom/types'

export interface BlockResult {
  items: DecorItem[]
  /** Each net is a list of LOCAL item indices that are electrically connected. */
  nets: number[][]
}

/** Simple allocator passed in from the caller so refs stay globally unique. */
export interface RefAlloc {
  nextC: () => string
  nextR: () => string
  nextU: () => string
  nextD: () => string
  nextQ: () => string
  nextL: () => string
  nextJ: () => string
  nextY: () => string
}

function item(
  kind: string,
  variant: number,
  cell: Cell,
  rot: 0 | 90 | 180 | 270,
  ref?: string,
): DecorItem {
  return { kind, variant, cell, rot, scale: 1, ...(ref ? { ref } : {}) }
}

// ── 1. Power Supply ───────────────────────────────────────────────────────────
//  J(power-in) → D(reverse-protect) → C(bulk) → U(regulator) → 2×C(output)
//  Laid out as a horizontal line from the origin.
//
//  Footprints: header=2×1, diode=2×1, electrolytic=2×2, soic=3×2, mlcc=1×1 each
//  Total width: 2+1+2+1+2+1+3+1+1+1+1 = ~15 cols; height: 2 rows
export function powerSupply(origin: Cell, alloc: RefAlloc): BlockResult {
  const [ox, oy] = origin
  const jRef  = alloc.nextJ()
  const dRef  = alloc.nextD()
  const cBulk = alloc.nextC()
  const uRef  = alloc.nextU()
  const cOut1 = alloc.nextC()
  const cOut2 = alloc.nextC()

  // header (J): 2-pin, 2×1 footprint
  const j   = item('header',      2, [ox,       oy], 0, jRef)
  // diode (D): 2×1
  const d   = item('diode',       1, [ox + 3,   oy], 0, dRef)
  // electrolytic (C-bulk): 2×2
  const cb  = item('electrolytic',1, [ox + 6,   oy], 0, cBulk)
  // soic (U, regulator): 3×2
  const u   = item('soic',        8, [ox + 9,   oy], 0, uRef)
  // output caps: 1×1 each, placed right of regulator
  const co1 = item('mlcc',        1, [ox + 13,  oy], 0, cOut1)
  const co2 = item('mlcc',        1, [ox + 13,  oy + 1], 0, cOut2)

  const items = [j, d, cb, u, co1, co2]
  //  indices:  0  1   2  3   4    5

  // Net 0 (VIN path): J → D → C-bulk → U.in  (items 0,1,2,3)
  // Net 1 (VCC out):  U.out → co1, co2        (items 3,4,5)
  // Net 2 (GND):      D.cathode/C-/U.gnd/caps' ground ends (model as one net)
  const nets: number[][] = [
    [0, 1, 2, 3],  // VIN
    [3, 4, 5],     // VCC
    [1, 2, 3, 4, 5], // GND rail
  ]

  return { items, nets }
}

// ── 2. MCU Core ───────────────────────────────────────────────────────────────
//  QFP/QFN(U) center + 4 decoupling MLCCs hugging edges + crystal + 2 load caps
//  + 1 pull-up resistor + 1 programming header
//
//  QFP 4×4 footprint — origin is top-left of QFP
export function mcuCore(origin: Cell, alloc: RefAlloc): BlockResult {
  const [ox, oy] = origin
  const uRef = alloc.nextU()
  const c1   = alloc.nextC()
  const c2   = alloc.nextC()
  const c3   = alloc.nextC()
  const c4   = alloc.nextC()
  const yRef = alloc.nextY()
  const cy1  = alloc.nextC()
  const cy2  = alloc.nextC()
  const rPU  = alloc.nextR()
  const jRef = alloc.nextJ()

  // QFP 4×4 at origin
  const u   = item('qfp', 32, [ox,       oy    ], 0, uRef)
  // Decoupling caps: top-left, top-right, bottom-left, bottom-right (just outside IC)
  const dc1 = item('mlcc', 1,  [ox,       oy - 2], 0, c1)  // above-left
  const dc2 = item('mlcc', 1,  [ox + 3,   oy - 2], 0, c2)  // above-right
  const dc3 = item('mlcc', 1,  [ox,       oy + 5], 0, c3)  // below-left
  const dc4 = item('mlcc', 1,  [ox + 3,   oy + 5], 0, c4)  // below-right
  // Crystal: placed to the right of QFP, 2×2
  const xtal = item('crystal', 1, [ox + 6,  oy    ], 0, yRef)
  // Crystal load caps adjacent to crystal
  const lc1 = item('mlcc', 1,  [ox + 6,   oy + 3], 0, cy1)
  const lc2 = item('mlcc', 1,  [ox + 7,   oy + 3], 0, cy2)
  // Pull-up resistor near top-right corner of QFP
  const rpu = item('res',  1,  [ox + 6,   oy - 2], 0, rPU)
  // Programming header (3-pin) to the right
  const j   = item('header', 3, [ox + 6,   oy + 5], 0, jRef)

  const items = [u, dc1, dc2, dc3, dc4, xtal, lc1, lc2, rpu, j]
  //  indices:  0   1    2    3    4    5      6    7    8   9

  const nets: number[][] = [
    [0, 1],      // VCC decoupling (U ↔ dc1)
    [0, 2],      // VCC decoupling (U ↔ dc2)
    [0, 3],      // VCC decoupling (U ↔ dc3)
    [0, 4],      // VCC decoupling (U ↔ dc4)
    [1, 2, 3, 4], // GND (all cap grounds)
    [0, 5],      // XTAL ↔ U
    [5, 6],      // XTAL load cap 1
    [5, 7],      // XTAL load cap 2
    [6, 7],      // GND (load caps)
    [0, 8],      // pull-up R ↔ U
    [0, 9],      // U ↔ prog header
  ]

  return { items, nets }
}

// ── 3. Op-Amp ─────────────────────────────────────────────────────────────────
//  SOIC-8(U) + 2 feedback resistors + 1 bypass cap — compact group
//
//  Footprints: soic=3×2, res=2×1 each, mlcc=1×1
export function opAmp(origin: Cell, alloc: RefAlloc): BlockResult {
  const [ox, oy] = origin
  const uRef = alloc.nextU()
  const r1   = alloc.nextR()
  const r2   = alloc.nextR()
  const cRef = alloc.nextC()

  const u   = item('soic', 8, [ox,     oy    ], 0, uRef)
  // feedback resistors stacked to the right
  const rf1 = item('res',  1, [ox + 4, oy    ], 0, r1)
  const rf2 = item('res',  1, [ox + 4, oy + 1], 0, r2)
  // bypass cap above IC
  const bp  = item('mlcc', 1, [ox + 1, oy - 2], 0, cRef)

  const items = [u, rf1, rf2, bp]
  //  indices:  0   1    2    3

  const nets: number[][] = [
    [0, 1],  // U out → R1 feedback
    [0, 2],  // U in- → R2 feedback
    [1, 2],  // feedback divider node
    [0, 3],  // U VCC ↔ bypass cap
    [3],     // bypass cap GND
  ]

  return { items, nets }
}

// ── 4. LED Indicator ──────────────────────────────────────────────────────────
//  LED(D) + series resistor(R) — placed side by side
export function ledIndicator(origin: Cell, alloc: RefAlloc): BlockResult {
  const [ox, oy] = origin
  const dRef = alloc.nextD()
  const rRef = alloc.nextR()

  const led = item('led', 0, [ox,     oy], 0, dRef)
  const res = item('res', 1, [ox + 2, oy], 0, rRef)

  const items = [led, res]
  const nets: number[][] = [
    [0, 1],  // LED anode ↔ resistor series
    [0],     // LED cathode (GND)
    [1],     // resistor other end (VCC/signal)
  ]

  return { items, nets }
}

// ── 4b. Rail spine ────────────────────────────────────────────────────────────
//  D(protect) → L(filter) → C(bulk) → R(limit) → LED(indicator)
//  A power rail laid the way a board designer lays one: every part shares the same
//  2×1 footprint row, so all pads sit on ONE line and every link renders as a
//  dead-straight etched run (kit2 section-3 look). 14×1 cells.
export function railSpine(origin: Cell, alloc: RefAlloc, variant = 0): BlockResult {
  const [ox, oy] = origin
  const parts: Array<{ kind: string; v: number; ref: string }> = [
    { kind: 'diode', v: 0, ref: alloc.nextD() },
    { kind: 'inductor', v: 0, ref: alloc.nextL() },
    { kind: 'tant', v: 0, ref: alloc.nextC() },
    { kind: 'res', v: variant % 9, ref: alloc.nextR() },
    { kind: 'led', v: variant % 2, ref: alloc.nextD() },
  ]
  const items: DecorItem[] = []
  let x = ox
  for (const p of parts) {
    items.push(item(p.kind, p.v, [x, oy], 0, p.ref))
    x += 3 // 2-wide part + 1-cell gap → a short straight run between neighbours
  }
  const nets: number[][] = []
  for (let i = 0; i < items.length - 1; i++) nets.push([i, i + 1])
  return { items, nets }
}

// ── 5. Transistor Switch ──────────────────────────────────────────────────────
//  SOT-23(Q) + base resistor(R) + pull-down resistor(R) + flyback diode(D)
//
//  Footprints: sot23=2×2, res=2×1, diode=2×1
export function transistorSwitch(origin: Cell, alloc: RefAlloc): BlockResult {
  const [ox, oy] = origin
  const qRef = alloc.nextQ()
  const rb   = alloc.nextR()
  const rPD  = alloc.nextR()
  const dRef = alloc.nextD()

  const q   = item('sot23', 1, [ox,     oy    ], 0, qRef)
  // base resistor to the left
  const rB  = item('res',   1, [ox - 3, oy    ], 0, rb)
  // pull-down below base
  const rP  = item('res',   1, [ox - 3, oy + 1], 0, rPD)
  // flyback diode above transistor
  const fly = item('diode', 1, [ox,     oy - 2], 0, dRef)

  const items = [q, rB, rP, fly]
  //  indices:  0   1   2   3

  const nets: number[][] = [
    [0, 1],  // base ↔ base-R
    [0, 2],  // emitter ↔ pull-down R
    [0, 3],  // collector ↔ flyback D
    [2],     // GND
    [3],     // flyback D other end (VCC)
  ]

  return { items, nets }
}

// ── 6. Passive Bank ───────────────────────────────────────────────────────────
//  Tidy row of 4–6 alternating res/mlcc (bus termination / filters)
//  All same horizontal orientation, uniform spacing.
// A small VARIED functional cluster (not a row of identical parts) — a real fragment that fills space.
// `count` selects the template so the caller's loop yields variety.
export function passiveBank(origin: Cell, count: number, alloc: RefAlloc): BlockResult {
  const [ox, oy] = origin
  const items: DecorItem[] = []
  const nets: number[][] = []
  const add = (kind: string, ref: string, dc: number, dr: number): number => {
    items.push(item(kind, 1, [ox + dc, oy + dr], 0, ref)); return items.length - 1
  }
  // `count` is a template selector (0..N-1). Electrolytic (big blue can) is intentionally RARE.
  switch (count % 9) {
    case 0: { const a = add('res', alloc.nextR(), 0, 0), b = add('mlcc', alloc.nextC(), 3, 0); nets.push([a, b]); break }      // RC filter
    case 1: { const a = add('res', alloc.nextR(), 0, 0), b = add('diode', alloc.nextD(), 3, 0); nets.push([a, b]); break }     // R + diode
    case 2: { const a = add('res', alloc.nextR(), 0, 0), b = add('led', alloc.nextD(), 3, 0); nets.push([a, b]); break }       // R → LED
    case 3: {                                                                                                                   // transistor stage
      const rb = add('res', alloc.nextR(), 0, 1), q = add('sot23', alloc.nextQ(), 3, 0), rc = add('res', alloc.nextR(), 6, 1)
      nets.push([rb, q], [q, rc]); break
    }
    case 4: { const a = add('mlcc', alloc.nextC(), 0, 0), b = add('mlcc', alloc.nextC(), 2, 0); nets.push([a, b]); break }     // decoupling pair
    case 5: { const a = add('res', alloc.nextR(), 0, 0), b = add('res', alloc.nextR(), 3, 0); nets.push([a, b]); break }       // R divider
    case 6: { const a = add('diode', alloc.nextD(), 0, 0), b = add('mlcc', alloc.nextC(), 3, 0); nets.push([a, b]); break }    // snubber
    case 7: {                                                                                                                   // crystal oscillator
      const x = add('xtal', alloc.nextY(), 0, 0), c1 = add('mlcc', alloc.nextC(), 0, 2), c2 = add('mlcc', alloc.nextC(), 2, 2)
      nets.push([x, c1], [x, c2]); break
    }
    default: { const a = add('inductor', alloc.nextL(), 0, 0), b = add('elec', alloc.nextC(), 3, 0); nets.push([a, b]) }       // LC filter (rare elec)
  }
  return { items, nets }
}

// ── Large functional blocks (occupy big areas — real multi-part circuits) ──────────────────────

/** Common-emitter amplifier stage (~8 parts): input cap, bias divider, transistor, Rc/Re/Ce, output cap. */
export function amplifierStage(origin: Cell, alloc: RefAlloc): BlockResult {
  const [ox, oy] = origin, items: DecorItem[] = [], nets: number[][] = []
  const add = (k: string, ref: string, dc: number, dr: number) => { items.push(item(k, 1, [ox + dc, oy + dr], 0, ref)); return items.length - 1 }
  const cin = add('mlcc', alloc.nextC(), 0, 2), r1 = add('res', alloc.nextR(), 2, 0), r2 = add('res', alloc.nextR(), 2, 4)
  const rc = add('res', alloc.nextR(), 5, 0), q = add('sot23', alloc.nextQ(), 5, 2), re = add('res', alloc.nextR(), 5, 5)
  const ce = add('mlcc', alloc.nextC(), 8, 5), cout = add('mlcc', alloc.nextC(), 8, 2)
  nets.push([cin, q], [r1, q], [r2, q], [rc, q], [q, re], [re, ce], [q, cout])
  return { items, nets }
}

/** 555-style timer block (~7 parts): DIP IC + 2 timing R + 2 C + output R + LED. */
export function timer555(origin: Cell, alloc: RefAlloc): BlockResult {
  const [ox, oy] = origin, items: DecorItem[] = [], nets: number[][] = []
  const add = (k: string, ref: string, dc: number, dr: number, v = 1) => { items.push(item(k, v, [ox + dc, oy + dr], 0, ref)); return items.length - 1 }
  const ic = add('dip', alloc.nextU(), 3, 2, 8), r1 = add('res', alloc.nextR(), 0, 0), r2 = add('res', alloc.nextR(), 0, 2)
  const c1 = add('mlcc', alloc.nextC(), 0, 4), c2 = add('mlcc', alloc.nextC(), 9, 2), ro = add('res', alloc.nextR(), 9, 0), led = add('led', alloc.nextD(), 9, 4)
  nets.push([r1, ic], [r2, ic], [c1, ic], [ic, c2], [ic, ro], [ro, led])
  return { items, nets }
}

/** LED bar driver (big, ~13 parts): DIP IC + a row of series resistors + a row of LEDs. */
export function ledBar(origin: Cell, alloc: RefAlloc, n = 6): BlockResult {
  const [ox, oy] = origin, items: DecorItem[] = [], nets: number[][] = []
  const add = (k: string, ref: string, dc: number, dr: number, v = 1) => { items.push(item(k, v, [ox + dc, oy + dr], 0, ref)); return items.length - 1 }
  const ic = add('dip', alloc.nextU(), 0, 3, 16)
  for (let i = 0; i < n; i++) {
    const r = add('res', alloc.nextR(), 7 + i * 3, 0)
    const d = add('led', alloc.nextD(), 7 + i * 3, 5)
    nets.push([ic, r], [r, d])
  }
  return { items, nets }
}
