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
export function passiveBank(origin: Cell, count: number, alloc: RefAlloc): BlockResult {
  const [ox, oy] = origin
  const items: DecorItem[] = []
  const nets: number[][] = []

  for (let i = 0; i < count; i++) {
    const isRes = i % 2 === 0
    const ref   = isRes ? alloc.nextR() : alloc.nextC()
    const kind  = isRes ? 'res' : 'mlcc'
    const xOff  = isRes ? i * 3 : i * 3  // res=2w+1gap, mlcc=1w+2gap → uniform 3-col pitch
    items.push(item(kind, 1, [ox + xOff, oy], 0, ref))
    // pair consecutive items as a net (simple bus filter pair)
    if (i > 0) nets.push([i - 1, i])
  }

  return { items, nets }
}
