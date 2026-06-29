// /kit2 — vintage through-hole kit. Three sections:
//   1) component library  2) pairwise connections (what wires to what & why)  3) full schematic.
import './ui/styles.css'
import { Container, Graphics, Text } from 'pixi.js'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import type { ShapeSpec } from './render/decorBuilder'
import { buildVintageShapes, vintageLeadEnds, vintagePins, pin, VFOOT, type VintageKind, type VintageOpts } from './render/vintageDecor'
import { makeRng } from './pipeline/rng'

const P = 18
const TILE = 172
const COLS = 7
type Pt = { x: number; y: number }

function drawShapes(shapes: ShapeSpec[], ox = 0, oy = 0): Container {
  const c = new Container(), g = new Graphics(), texts: ShapeSpec[] = []
  for (const s of shapes) {
    if (s.type === 'rect') g.rect(s.x + ox, s.y + oy, s.w, s.h).fill({ color: s.color, alpha: s.alpha })
    else if (s.type === 'roundRect') g.roundRect(s.x + ox, s.y + oy, s.w, s.h, s.r).fill({ color: s.color, alpha: s.alpha })
    else if (s.type === 'circle') g.circle(s.x + ox, s.y + oy, s.r).fill({ color: s.color, alpha: s.alpha })
    else if (s.type === 'line') g.moveTo(s.x1 + ox, s.y1 + oy).lineTo(s.x2 + ox, s.y2 + oy).stroke({ color: s.color, width: s.width, alpha: s.alpha })
    else texts.push(s)
  }
  c.addChild(g)
  for (const s of texts) if (s.type === 'text') { const t = new Text({ text: s.text, style: { fontFamily: 'monospace', fontSize: s.size, fill: s.color } }); t.position.set(s.x + ox, s.y + oy); c.addChild(t) }
  return c
}
const leadsAt = (kind: VintageKind, gx: number, gy: number): Pt[] =>
  vintageLeadEnds(kind, P).map((l) => ({ x: gx + l.x, y: gy + l.y }))

async function boot() {
  const app = await createPixiApp({ width: window.innerWidth, height: window.innerHeight, background: PALETTE.substrate })
  document.getElementById('app')!.appendChild(app.canvas)
  const world = new Container()
  app.stage.addChild(world)
  let scrollY = 0
  window.addEventListener('wheel', (e) => { scrollY = Math.min(0, scrollY - e.deltaY); world.y = scrollY })

  const text = (t: string, x: number, y: number, fill: number = PALETTE.textDim, size = 11, bold = false) =>
    world.addChild(new Text({ text: t, x, y, style: { fontFamily: 'monospace', fontSize: size, fill, ...(bold ? { fontWeight: 'bold' } : {}) } }))
  let y = 16
  const section = (t: string) => { text(t, 16, y, 0x9bffc8, 17, true); y += 30 }

  // centered component inside a TILE-sized cell
  function centerPart(kind: VintageKind, cellX: number, cellY: number, w: number, h: number, opts?: VintageOpts): void {
    const fp = VFOOT[kind]
    const ox = cellX + w / 2 - (fp.w * P) / 2, oy = cellY + h / 2 - (fp.h * P) / 2
    world.addChild(drawShapes(buildVintageShapes(kind, P, opts), ox, oy))
  }
  function cell(x: number, w: number, h: number, label: string): void {
    const g = new Graphics(); g.rect(x, y, w, h).fill({ color: 0x0d1f17, alpha: 0.7 }).stroke({ color: 0x1c3a2b, width: 1 }); world.addChild(g)
    text(label, x + 6, y + h - 18, PALETTE.textDim, 10)
  }

  // ── SECTION 1 — library ───────────────────────────────────────────────────
  section('1 · COMPONENT LIBRARY')
  const lib: { kind: VintageKind; label: string; opts?: VintageOpts }[] = [
    { kind: 'resAxial', label: 'resistor' }, { kind: 'diodeAxial', label: 'diode' }, { kind: 'inductorAxial', label: 'inductor' },
    { kind: 'ceramicDisc', label: 'ceramic disc' }, { kind: 'filmCap', label: 'film cap' }, { kind: 'electroRadial', label: 'electrolytic' },
    { kind: 'tantalum', label: 'tantalum' }, { kind: 'trimpot', label: 'trimpot' }, { kind: 'crystalHC49', label: 'crystal' },
    { kind: 'to92', label: 'TO-92' }, { kind: 'to220', label: 'TO-220' }, { kind: 'dipIC', label: 'DIP IC' },
    { kind: 'led5mm', label: 'LED red ON', opts: { color: 0xe23a3a, on: true } },
    { kind: 'led5mm', label: 'LED red OFF', opts: { color: 0xe23a3a, on: false } },
    { kind: 'led5mm', label: 'LED green ON', opts: { color: 0x3ad26a, on: true } },
    { kind: 'led5mm', label: 'LED green OFF', opts: { color: 0x3ad26a, on: false } },
    { kind: 'battery9v', label: '9V battery' }, { kind: 'batteryClip', label: 'battery clip (Krona)' }, { kind: 'powerJack', label: 'DC power jack' },
  ]
  lib.forEach((e, i) => {
    const col = i % COLS, x = 16 + col * TILE
    if (col === 0 && i > 0) y += TILE
    cell(x, TILE - 8, TILE - 8, e.label)
    centerPart(e.kind, x, y, TILE - 8, TILE - 8, e.opts)
  })
  y += TILE + 16

  // ── SECTION 2 — pairwise connections ──────────────────────────────────────
  section('2 · CONNECTIONS — which part wires to which, and why')
  const PW = 290, PH = 150, PCOLS = 4
  function copperSeg(g: Graphics, a: Pt, b: Pt): void {
    const my = (a.y + b.y) / 2
    g.moveTo(a.x, a.y).lineTo(a.x, my).lineTo(b.x, my).lineTo(b.x, b.y).stroke({ color: PALETTE.copperTrace, width: 3, cap: 'round', join: 'round' })
    g.circle(a.x, a.y, 3).fill({ color: PALETTE.copperTrace }); g.circle(b.x, b.y, 3).fill({ color: PALETTE.copperTrace })
  }
  // pair: two parts placed left/right, connected by FUNCTION pins (anode↔cathode, +↔−, …)
  type Spec = { kind: VintageKind; opts?: VintageOpts; dx: number; dy: number; pin: string }
  const pairs: { why: string; a: Spec; b: Spec }[] = [
    { why: 'battery + → clip + : snaps on (power)', a: { kind: 'battery9v', dx: 0.22, dy: 0.1, pin: '+' }, b: { kind: 'batteryClip', dx: 0.7, dy: 0.0, pin: '+' } },
    { why: 'clip + → jack tip+ : board power in', a: { kind: 'batteryClip', dx: 0.22, dy: 0.0, pin: '+' }, b: { kind: 'powerJack', dx: 0.68, dy: 0.3, pin: 'tip+' } },
    { why: 'R → LED anode : limits current', a: { kind: 'resAxial', dx: 0.05, dy: 0.4, pin: 'B' }, b: { kind: 'led5mm', opts: { on: true }, dx: 0.7, dy: 0.3, pin: 'anode' } },
    { why: 'diode cathode → cap + : rectify→smooth', a: { kind: 'diodeAxial', dx: 0.04, dy: 0.4, pin: 'cathode' }, b: { kind: 'electroRadial', dx: 0.62, dy: 0.0, pin: '+' } },
    { why: 'cap + → 7805 IN : smoothed DC in', a: { kind: 'electroRadial', dx: 0.1, dy: 0.0, pin: '+' }, b: { kind: 'to220', dx: 0.62, dy: 0.0, pin: 'IN' } },
    { why: '7805 OUT → ceramic : decoupling', a: { kind: 'to220', dx: 0.05, dy: 0.0, pin: 'OUT' }, b: { kind: 'ceramicDisc', dx: 0.7, dy: 0.3, pin: 't1' } },
    { why: 'crystal → IC OSC : clock', a: { kind: 'crystalHC49', dx: 0.08, dy: 0.1, pin: 'x1' }, b: { kind: 'dipIC', dx: 0.5, dy: 0.4, pin: 'OSC' } },
    { why: 'IC VCC → ceramic : decap on power', a: { kind: 'dipIC', dx: 0.04, dy: 0.4, pin: 'VCC' }, b: { kind: 'ceramicDisc', dx: 0.78, dy: 0.2, pin: 't1' } },
    { why: 'R + film cap : RC filter / timing', a: { kind: 'resAxial', dx: 0.05, dy: 0.4, pin: 'B' }, b: { kind: 'filmCap', dx: 0.66, dy: 0.3, pin: 't1' } },
    { why: 'R → TO-92 base : biases transistor', a: { kind: 'resAxial', dx: 0.04, dy: 0.4, pin: 'B' }, b: { kind: 'to92', dx: 0.66, dy: 0.2, pin: 'B' } },
    { why: 'trimpot → IC IO : adjustable input', a: { kind: 'trimpot', dx: 0.1, dy: 0.2, pin: 'end2' }, b: { kind: 'dipIC', dx: 0.55, dy: 0.4, pin: 'IO' } },
    { why: 'inductor → cap + : LC ripple filter', a: { kind: 'inductorAxial', dx: 0.02, dy: 0.4, pin: 'B' }, b: { kind: 'electroRadial', dx: 0.6, dy: 0.0, pin: '+' } },
  ]
  pairs.forEach((pr, i) => {
    const col = i % PCOLS, x = 16 + col * (PW + 10)
    if (col === 0 && i > 0) y += PH + 10
    const g = new Graphics(); g.rect(x, y, PW, PH).fill({ color: 0x0a1712, alpha: 1 }).stroke({ color: 0x1c3a2b, width: 1 }); world.addChild(g)
    const ax = x + pr.a.dx * PW, ay = y + 24 + pr.a.dy * (PH - 40)
    const bx = x + pr.b.dx * PW, by = y + 24 + pr.b.dy * (PH - 40)
    const ia = Math.max(0, pin(pr.a.kind, pr.a.pin)), ib = Math.max(0, pin(pr.b.kind, pr.b.pin))
    const la = leadsAt(pr.a.kind, ax, ay)[ia], lb = leadsAt(pr.b.kind, bx, by)[ib]
    const cg = new Graphics(); copperSeg(cg, la, lb); world.addChild(cg)            // copper under
    world.addChild(drawShapes(buildVintageShapes(pr.a.kind, P, pr.a.opts), ax, ay)) // parts on top
    world.addChild(drawShapes(buildVintageShapes(pr.b.kind, P, pr.b.opts), bx, by))
    text(pr.a.pin, la.x - 6, la.y + 6, 0xd8c060, 9); text(pr.b.pin, lb.x - 6, lb.y + 6, 0xd8c060, 9) // pin labels
    text(pr.why, x + 8, y + 8, 0x8fb8a0, 10)
  })
  y += PH + 24

  // ── SECTION 3 — full schematic ────────────────────────────────────────────
  section('3 · FULL SCHEMATIC — every block on one board, copper routed under the parts')
  const BX = 16, BY = y + 4, BW = 1180, BH = 560
  const VCC = BY + 40, GND = BY + BH - 40
  const COP = PALETTE.copperTrace
  const sub = new Graphics(), copperG = new Graphics(), partsHolder = new Container()
  world.addChild(sub, copperG, partsHolder)
  sub.rect(BX, BY, BW, BH).fill({ color: 0x0a1712, alpha: 1 }).stroke({ color: 0x1c3a2b, width: 1 })
  for (let d = -BH; d < BW; d += 7) sub.moveTo(BX + d, BY).lineTo(BX + d + BH, BY + BH)
  sub.stroke({ color: PALETTE.hatch, width: 0.5, alpha: 0.18 })
  const rng = makeRng(42), dirs = [[1, 0], [0, 1], [1, 1], [1, -1]] as const
  for (let i = 0; i < 90; i++) { const x0 = BX + rng() * BW, y0 = BY + rng() * BH, [dx, dy] = dirs[Math.floor(rng() * 4)], len = (2 + rng() * 6) * P; sub.moveTo(x0, y0).lineTo(x0 + dx * len, y0 + dy * len) }
  sub.stroke({ color: PALETTE.routing, width: 1.4, alpha: 0.5 })
  for (let i = 0; i < 60; i++) sub.circle(BX + rng() * BW, BY + rng() * BH, 1.6).fill({ color: PALETTE.routing, alpha: 0.6 })

  const partsList: { kind: VintageKind; x: number; y: number; opts?: VintageOpts }[] = []
  const part = (kind: VintageKind, gx: number, gy: number, opts?: VintageOpts): Pt[] => { partsList.push({ kind, x: gx, y: gy, opts }); return leadsAt(kind, gx, gy) }
  const via = (p: Pt) => { copperG.circle(p.x, p.y, 4).fill({ color: COP }); copperG.circle(p.x, p.y, 1.8).fill({ color: 0x0a1712 }) }
  function route(pts: Pt[], w = 3): void {
    copperG.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) copperG.lineTo(pts[i].x, pts[i].y)
    copperG.stroke({ color: COP, width: w, cap: 'round', join: 'round' }); for (let i = 1; i < pts.length - 1; i++) via(pts[i])
  }
  const elbow = (a: Pt, b: Pt, atY: number): Pt[] => [a, { x: a.x, y: atY }, { x: b.x, y: atY }, b]
  const cap = (t: string, x: number, yy: number) => text(t, x, yy, PALETTE.textDim, 11)
  route([{ x: BX + 20, y: VCC }, { x: BX + BW - 20, y: VCC }], 5)
  route([{ x: BX + 20, y: GND }, { x: BX + BW - 20, y: GND }], 5)
  cap('VCC rail', BX + 24, VCC - 16); cap('GND rail', BX + 24, GND + 8)
  const tapVcc = (p: Pt) => { route([{ x: p.x, y: VCC }, p]); via({ x: p.x, y: VCC }) }
  const tapGnd = (p: Pt) => { route([p, { x: p.x, y: GND }]); via({ x: p.x, y: GND }) }

  // pin-aware lead lookup
  const L = (kind: VintageKind, leads: Pt[], name: string): Pt => leads[Math.max(0, pin(kind, name))]
  // power input chain: jack tip+ → diode (anode→cathode) → electrolytic + → 7805 IN; OUT→VCC, GND→GND
  { const jack = part('powerJack', BX + 40, VCC + 50); const d = part('diodeAxial', BX + 150, VCC + 70); const el = part('electroRadial', BX + 320, VCC + 40); const reg = part('to220', BX + 460, VCC + 40)
    route([L('powerJack', jack, 'tip+'), { x: jack[0].x, y: VCC + 64 }, { x: L('diodeAxial', d, 'anode').x, y: VCC + 64 }, L('diodeAxial', d, 'anode')])
    route([L('diodeAxial', d, 'cathode'), L('electroRadial', el, '+')]); route([L('electroRadial', el, '+'), L('to220', reg, 'IN')])
    tapVcc(L('to220', reg, 'OUT')); tapGnd(L('to220', reg, 'GND')); tapGnd(L('electroRadial', el, '-'))
    cap('A · jack tip+ → diode → cap+ → 7805 IN; OUT→VCC, GND→GND', BX + 30, VCC + 30) }
  // decoupled IC + crystal clock: VCC/GND taps, decap across VCC, crystal+load caps on OSC
  { const ic = part('dipIC', BX + 620, BY + BH / 2 - 10); const dec = part('ceramicDisc', BX + 720, BY + BH / 2 - 60); const xtal = part('crystalHC49', BX + 780, BY + BH / 2 - 80); const lc1 = part('ceramicDisc', BX + 760, BY + BH / 2 + 70); const lc2 = part('ceramicDisc', BX + 840, BY + BH / 2 + 70)
    const oscPins = vintagePins('dipIC').map((p, idx) => (p === 'OSC' ? idx : -1)).filter((i) => i >= 0)
    tapVcc(L('dipIC', ic, 'VCC')); tapGnd(L('dipIC', ic, 'GND'))
    route([dec[0], L('dipIC', ic, 'VCC')]); tapGnd(dec[1])
    route([xtal[0], ic[oscPins[0]]]); route([xtal[1], ic[oscPins[1]]]); route([lc1[0], ic[oscPins[0]]]); tapGnd(lc1[1]); route([lc2[0], ic[oscPins[1]]]); tapGnd(lc2[1])
    cap('B · IC VCC/GND + decap + crystal on OSC pins (load caps→GND)', BX + 600, BY + BH / 2 - 96) }
  // LED indicator: VCC → R → LED anode; cathode → GND
  { const r = part('resAxial', BX + 960, VCC + 50); const led = part('led5mm', BX + 1100, VCC + 44, { on: true })
    tapVcc(L('resAxial', r, 'A')); route(elbow(L('resAxial', r, 'B'), L('led5mm', led, 'anode'), VCC + 64)); tapGnd(L('led5mm', led, 'cathode')); cap('C · LED: VCC→R→anode, cathode→GND', BX + 950, VCC + 30) }
  // transistor stage: R→base, collector→VCC, emitter→GND, coupling cap off collector
  { const rb = part('resAxial', BX + 940, GND - 120); const q = part('to92', BX + 1080, GND - 150); const cc = part('filmCap', BX + 1130, GND - 60)
    route([L('resAxial', rb, 'B'), L('to92', q, 'B')]); tapVcc(L('to92', q, 'C')); tapGnd(L('to92', q, 'E')); route([L('to92', q, 'C'), cc[0]]); tapGnd(cc[1]); cap('D · R→base, C→VCC, E→GND, coupling cap off C', BX + 900, GND - 150) }
  // RC filter: VCC → R → cap → GND
  { const rf = part('resAxial', BX + 120, GND - 90); const cf = part('filmCap', BX + 300, GND - 110)
    tapVcc(L('resAxial', rf, 'A')); route([L('resAxial', rf, 'B'), cf[0]]); tapGnd(cf[1]); cap('E · RC filter: VCC→R→C→GND', BX + 110, GND - 120) }

  for (const pt of partsList) partsHolder.addChild(drawShapes(buildVintageShapes(pt.kind, P, pt.opts), pt.x, pt.y))
}
boot()
