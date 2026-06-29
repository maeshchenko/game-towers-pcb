// /kit2 — vintage through-hole kit. Three sections:
//   1) component library  2) pairwise connections (what wires to what & why)  3) full schematic.
import './ui/styles.css'
import { Container, Graphics, Text } from 'pixi.js'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import type { ShapeSpec } from './render/decorBuilder'
import { buildVintageShapes, vintageLeadEnds, vintagePins, pin, VFOOT, type VintageKind, type VintageOpts } from './render/vintageDecor'

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
  type Spec = { kind: VintageKind; opts?: VintageOpts; pin: string }
  // every pair: A (left) → B (right) by FUNCTION pins. Trace leaves each pad perpendicular, runs in a
  // clear channel above the parts, enters the target pad HEAD-ON — never along a pin row, never crossing.
  const pairs: { why: string; a: Spec; b: Spec }[] = [
    { why: 'jack tip+ → diode anode : DC power in', a: { kind: 'powerJack', pin: 'tip+' }, b: { kind: 'diodeAxial', pin: 'anode' } },
    { why: 'diode cathode → cap + : rectify → smooth', a: { kind: 'diodeAxial', pin: 'cathode' }, b: { kind: 'electroRadial', pin: '+' } },
    { why: 'cap + → 7805 IN : smoothed DC in', a: { kind: 'electroRadial', pin: '+' }, b: { kind: 'to220', pin: 'IN' } },
    { why: '7805 OUT → tantalum + : output bulk cap', a: { kind: 'to220', pin: 'OUT' }, b: { kind: 'tantalum', pin: '+' } },
    { why: '7805 OUT → R A : supply to a load', a: { kind: 'to220', pin: 'OUT' }, b: { kind: 'resAxial', pin: 'A' } },
    { why: 'R B → LED anode : limits LED current', a: { kind: 'resAxial', pin: 'B' }, b: { kind: 'led5mm', opts: { on: true }, pin: 'anode' } },
    { why: 'IC VCC → ceramic : decoupling cap', a: { kind: 'dipIC', pin: 'VCC' }, b: { kind: 'ceramicDisc', pin: 't1' } },
    { why: 'crystal x1 → IC OSC : clock', a: { kind: 'crystalHC49', pin: 'x1' }, b: { kind: 'dipIC', pin: 'OSC' } },
    { why: 'R B → film cap : RC filter / timing', a: { kind: 'resAxial', pin: 'B' }, b: { kind: 'filmCap', pin: 't1' } },
    { why: 'R B → TO-92 base : biases transistor', a: { kind: 'resAxial', pin: 'B' }, b: { kind: 'to92', pin: 'B' } },
    { why: 'TO-92 collector → R A : collector load', a: { kind: 'to92', pin: 'C' }, b: { kind: 'resAxial', pin: 'A' } },
    { why: 'trimpot end → IC IO : adjustable input', a: { kind: 'trimpot', pin: 'end2' }, b: { kind: 'dipIC', pin: 'IO' } },
    { why: 'inductor → cap + : LC ripple filter', a: { kind: 'inductorAxial', pin: 'B' }, b: { kind: 'electroRadial', pin: '+' } },
    { why: 'R B → R A : resistors in series', a: { kind: 'resAxial', pin: 'B' }, b: { kind: 'resAxial', pin: 'A' } },
    { why: 'diode cathode → LED anode : steering', a: { kind: 'diodeAxial', pin: 'cathode' }, b: { kind: 'led5mm', opts: { on: false }, pin: 'anode' } },
    { why: 'tantalum + → IC VCC : local bulk cap', a: { kind: 'tantalum', pin: '+' }, b: { kind: 'dipIC', pin: 'VCC' } },
  ]
  // place a part so its named pad lands at (px,py); return world leads + footprint
  const placePad = (sp: Spec, px: number, py: number): { leads: Pt[]; gx: number; gy: number } => {
    const off = vintageLeadEnds(sp.kind, P)[Math.max(0, pin(sp.kind, sp.pin))]
    const gx = px - off.x, gy = py - off.y
    return { leads: leadsAt(sp.kind, gx, gy), gx, gy }
  }
  // escape a pad perpendicular to its nearest body edge
  const esc = (pad: Pt, gx: number, gy: number, kind: VintageKind, e = 14): Pt => {
    const w = VFOOT[kind].w * P, h = VFOOT[kind].h * P
    const dT = pad.y - gy, dB = gy + h - pad.y, dL = pad.x - gx, dR = gx + w - pad.x
    const m = Math.min(dT, dB, dL, dR)
    if (m === dT) return { x: pad.x, y: gy - e }
    if (m === dB) return { x: pad.x, y: gy + h + e }
    if (m === dL) return { x: gx - e, y: pad.y }
    return { x: gx + w + e, y: pad.y }
  }
  const simp = (pts: Pt[]): Pt[] => pts.filter((p, i) => i === 0 || i === pts.length - 1 || Math.sign(p.x - pts[i - 1].x) !== Math.sign(pts[i + 1].x - p.x) || Math.sign(p.y - pts[i - 1].y) !== Math.sign(pts[i + 1].y - p.y))
  pairs.forEach((pr, i) => {
    const col = i % PCOLS, x = 16 + col * (PW + 10)
    if (col === 0 && i > 0) y += PH + 10
    const g = new Graphics(); g.rect(x, y, PW, PH).fill({ color: 0x0a1712, alpha: 1 }).stroke({ color: 0x1c3a2b, width: 1 }); world.addChild(g)
    const cop = PALETTE.copperTrace, PADY = y + PH * 0.72, channelY = y + 34
    const A = placePad(pr.a, x + PW * 0.28, PADY), B = placePad(pr.b, x + PW * 0.72, PADY)
    const la = A.leads[Math.max(0, pin(pr.a.kind, pr.a.pin))], lb = B.leads[Math.max(0, pin(pr.b.kind, pr.b.pin))]
    const ea = esc(la, A.gx, A.gy, pr.a.kind), eb = esc(lb, B.gx, B.gy, pr.b.kind)
    // perpendicular stubs → up into the clear channel → across → down into the target (head-on)
    const route = simp([la, ea, { x: ea.x, y: channelY }, { x: eb.x, y: channelY }, eb, lb])
    const cg = new Graphics()
    cg.moveTo(route[0].x, route[0].y); for (let k = 1; k < route.length; k++) cg.lineTo(route[k].x, route[k].y)
    cg.stroke({ color: cop, width: 2.5, cap: 'round', join: 'round' })
    cg.circle(la.x, la.y, 3).fill({ color: cop }); cg.circle(lb.x, lb.y, 3).fill({ color: cop })
    world.addChild(cg)
    world.addChild(drawShapes(buildVintageShapes(pr.a.kind, P, pr.a.opts), A.gx, A.gy))
    world.addChild(drawShapes(buildVintageShapes(pr.b.kind, P, pr.b.opts), B.gx, B.gy))
    text(pr.a.pin, la.x - 6, la.y + 16, 0xd8c060, 9); text(pr.b.pin, lb.x - 6, lb.y + 16, 0xd8c060, 9)
    text(pr.why, x + 8, y + 8, 0x8fb8a0, 10)
  })
  y += PH + 24

  // ── SECTION 3 — compact hand-laid board (parts pad-to-pad, short straight traces, no crossings) ──
  section('3 · FULL SCHEMATIC — compact board: parts placed pad-to-pad, short straight copper, GND pour')
  const BX = 16, BY = y + 4, BW = 900, BH = 320
  const COP = PALETTE.copperTrace
  const sub = new Graphics(), copperG = new Graphics(), partsHolder = new Container(), topG = new Graphics()
  world.addChild(sub, copperG, partsHolder, topG)
  // ground pour + hatch (GND = the plane; GND pins thermal straight into it)
  sub.rect(BX, BY, BW, BH).fill({ color: 0x0c2418, alpha: 1 }).stroke({ color: 0x1c3a2b, width: 1 })
  for (let d = -BH; d < BW; d += 6) sub.moveTo(BX + d, BY).lineTo(BX + d + BH, BY + BH)
  sub.stroke({ color: PALETTE.hatch, width: 0.5, alpha: 0.22 })

  const partsList: { kind: VintageKind; x: number; y: number; opts?: VintageOpts }[] = []
  // place a part so its NAMED pad lands exactly at (px,py) → pads end up where I want them
  function placeByPad(kind: VintageKind, padName: string, px: number, py: number, opts?: VintageOpts): Pt[] {
    const off = vintageLeadEnds(kind, P)[Math.max(0, pin(kind, padName))]
    const gx = px - off.x, gy = py - off.y
    partsList.push({ kind, x: gx, y: gy, opts })
    return leadsAt(kind, gx, gy)
  }
  const placeAt = (kind: VintageKind, gx: number, gy: number, opts?: VintageOpts): Pt[] => { partsList.push({ kind, x: gx, y: gy, opts }); return leadsAt(kind, gx, gy) }
  const Lp = (kind: VintageKind, leads: Pt[], name: string): Pt => leads[Math.max(0, pin(kind, name))]
  const draw = (pts: Pt[], w = 2.5) => { copperG.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) copperG.lineTo(pts[i].x, pts[i].y); copperG.stroke({ color: COP, width: w, cap: 'round', join: 'round' }) }
  const seg = (a: Pt, b: Pt) => draw([a, b])                                   // straight (aligned pads)
  const linkVHV = (a: Pt, b: Pt, midY: number) => draw([a, { x: a.x, y: midY }, { x: b.x, y: midY }, b]) // vertical-horizontal-vertical
  const junction = (p: Pt) => topG.circle(p.x, p.y, 3.5).fill({ color: COP })
  const thermal = (p: Pt) => { topG.circle(p.x, p.y, 5.5).stroke({ color: COP, width: 1.5 }); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) topG.moveTo(p.x, p.y).lineTo(p.x + dx * 5.5, p.y + dy * 5.5).stroke({ color: COP, width: 2 }) }
  const cap = (t: string, x: number, yy: number) => text(t, x, yy, PALETTE.textDim, 11)

  // ── top spine: a single horizontal power line, parts wired pad-to-pad, shunts thermal to pour ──
  const SY = BY + 90
  let outp: Pt
  const jack = placeByPad('powerJack', 'tip+', BX + 70, SY); thermal(Lp('powerJack', jack, 'sleeve-')); outp = Lp('powerJack', jack, 'tip+')
  const d = placeByPad('diodeAxial', 'anode', outp.x + 38, SY); seg(outp, Lp('diodeAxial', d, 'anode')); outp = Lp('diodeAxial', d, 'cathode')
  const el = placeByPad('electroRadial', '+', outp.x + 40, SY); seg(outp, Lp('electroRadial', el, '+')); thermal(Lp('electroRadial', el, '-')); outp = Lp('electroRadial', el, '+')
  const reg = placeByPad('to220', 'IN', outp.x + 48, SY); seg(outp, Lp('to220', reg, 'IN')); thermal(Lp('to220', reg, 'GND'))
  const vccNode = Lp('to220', reg, 'OUT'); outp = vccNode
  const rled = placeByPad('resAxial', 'A', outp.x + 44, SY); seg(outp, Lp('resAxial', rled, 'A')); outp = Lp('resAxial', rled, 'B')
  const led = placeByPad('led5mm', 'anode', outp.x + 40, SY); seg(outp, Lp('led5mm', led, 'anode')); thermal(Lp('led5mm', led, 'cathode'))
  cap('VCC line: jack → diode → cap → 7805 → R → LED  (shunts ↓ to GND pour)', BX + 60, SY - 60)

  // ── lower cluster: decoupled IC fed from the VCC node (one clean V-H-V link), GND → pour ──
  const SY2 = BY + 220, midY = (SY + SY2) / 2
  const ic = placeAt('dipIC', BX + 150, SY2 - VFOOT.dipIC.h * P / 2)
  const icV = Lp('dipIC', ic, 'VCC'), icG = Lp('dipIC', ic, 'GND')
  thermal(icG)
  linkVHV(vccNode, icV, midY); junction(vccNode)                                   // VCC node → IC VCC
  const dec = placeByPad('ceramicDisc', 't1', icV.x + 40, icV.y); seg(icV, Lp('ceramicDisc', dec, 't1')); thermal(Lp('ceramicDisc', dec, 't2')) // decap across VCC/GND
  const osc = vintagePins('dipIC').map((p, i) => (p === 'OSC' ? i : -1)).filter((i) => i >= 0)
  const tc = placeByPad('ceramicDisc', 't1', ic[osc[0]].x, ic[osc[0]].y - 46); seg(ic[osc[0]], Lp('ceramicDisc', tc, 't1')); thermal(Lp('ceramicDisc', tc, 't2')) // timing cap on an OSC pin
  cap('IC: VCC from the regulator node, decoupling cap across VCC/GND, timing cap on a pin', BX + 60, SY2 + VFOOT.dipIC.h * P / 2 + 6)

  for (const pt of partsList) partsHolder.addChild(drawShapes(buildVintageShapes(pt.kind, P, pt.opts), pt.x, pt.y))
}
boot()
