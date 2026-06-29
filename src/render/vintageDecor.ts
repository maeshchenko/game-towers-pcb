// Vintage through-hole component renderer — single TOP-DOWN camera + pseudo-3D volume (top face +
// side wall + highlight + cast shadow). Leads go straight into annular pads AT the component
// footprint (no long legs). Returns ShapeSpec[] (decorBuilder union) at origin (0,0).
// See docs/design/through-hole-components.md + docs/design/refs/.
import type { ShapeSpec } from './decorBuilder'

export type VintageKind =
  | 'resAxial' | 'diodeAxial' | 'inductorAxial'
  | 'ceramicDisc' | 'filmCap' | 'electroRadial' | 'tantalum' | 'led5mm' | 'trimpot'
  | 'to92' | 'to220' | 'crystalHC49' | 'dipIC'
  | 'battery9v' | 'batteryClip' | 'powerJack'

export interface VintageOpts { color?: number; on?: boolean }

// footprint in grid cells (fractional ok). Compact — pads sit at the body, not on long legs.
export const VFOOT: Record<VintageKind, { w: number; h: number }> = {
  resAxial: { w: 5, h: 1.8 }, diodeAxial: { w: 4, h: 1.8 }, inductorAxial: { w: 5, h: 2 },
  ceramicDisc: { w: 2.2, h: 2.2 }, filmCap: { w: 2.4, h: 2.2 }, electroRadial: { w: 3, h: 3 },
  tantalum: { w: 2.2, h: 2.2 }, led5mm: { w: 2.2, h: 2.2 }, trimpot: { w: 2.6, h: 2.4 },
  to92: { w: 2.6, h: 2.4 }, to220: { w: 3, h: 3.2 }, crystalHC49: { w: 3.6, h: 1.8 }, dipIC: { w: 6, h: 3 },
  battery9v: { w: 4, h: 5.4 }, batteryClip: { w: 3.2, h: 2 }, powerJack: { w: 3.2, h: 2.6 },
}

const C = {
  wire: 0xb8c0c0, solder: 0xe4eaea, solderMid: 0x7e8884, shadow: 0x000000, white: 0xffffff,
  resTan: 0xc8a86a, disc: 0xcf8a3c, filmRed: 0xb83a2e,
  elecBlue: 0x2747a0, elecTop: 0x14306a, stripe: 0xd8dee0,
  tantal: 0xd8b13a, to92: 0x1b1b1f, to220: 0x171717, tab: 0xb0b8b4,
  diodeBody: 0x1b1b1f, diodeBand: 0xcdd2cf, ledRed: 0xe23a3a, ledGreen: 0x3ad26a, trim: 0x2f5fa8, brass: 0xc8a84c,
  can: 0xaab2ad, dip: 0x18181c, silk: 0xc9d2cc,
  battBody: 0x1b1b1f, battLabel: 0x2a4a8a, jackBody: 0x26262b, jackRing: 0x8a9290,
  pad: 0xb9c2bd, hole: 0x0a1712, term: 0x2f6fd0,
}
const BANDS = [0x6b3a12, 0x101010, 0xc23b22, 0xc8a84c] // brown,black,red,gold

function r(s: ShapeSpec[], x: number, y: number, w: number, h: number, color: number, alpha = 1): void { s.push({ type: 'rect', x, y, w, h, color, alpha }) }
function rr(s: ShapeSpec[], x: number, y: number, w: number, h: number, rad: number, color: number, alpha = 1): void { s.push({ type: 'roundRect', x, y, w, h, r: rad, color, alpha }) }
function ci(s: ShapeSpec[], x: number, y: number, rad: number, color: number, alpha = 1): void { s.push({ type: 'circle', x, y, r: rad, color, alpha }) }
function ln(s: ShapeSpec[], x1: number, y1: number, x2: number, y2: number, width: number, color: number, alpha = 1): void { s.push({ type: 'line', x1, y1, x2, y2, width, color, alpha }) }

/** Through-hole annular pad (donut): tin ring + drilled hole. */
function padHole(s: ShapeSpec[], x: number, y: number, p: number): void {
  ci(s, x, y, p * 0.26, C.pad, 1)
  ci(s, x, y, p * 0.12, C.hole, 1)
}
/** Pseudo-3D disc from top: cast shadow → side wall → top face → highlight. */
function topDisc(s: ShapeSpec[], cx: number, cy: number, rad: number, color: number, wall = 3): void {
  ci(s, cx + 2, cy + 4, rad, C.shadow, 0.4)
  ci(s, cx, cy + wall, rad, color, 1); ci(s, cx, cy + wall, rad, C.shadow, 0.4)
  ci(s, cx, cy, rad, color, 1)
  ci(s, cx - rad * 0.32, cy - rad * 0.3, rad * 0.42, C.white, 0.18)
}
/** Pseudo-3D box from top. */
function topBox(s: ShapeSpec[], x: number, y: number, w: number, h: number, color: number, rad = 2, wall = 3): void {
  rr(s, x + 2, y + 4, w, h, rad, C.shadow, 0.4)
  rr(s, x, y + wall, w, h, rad, color, 1); rr(s, x, y + wall, w, h, rad, C.shadow, 0.4)
  rr(s, x, y, w, h, rad, color, 1)
  rr(s, x + w * 0.1, y + h * 0.1, w * 0.6, Math.max(1.5, h * 0.16), rad, C.white, 0.16)
}

// --- pad geometry shared by leadEnds + draw (top-down: pads at the footprint, near the body) ---
const PDX = (p: number) => p * 0.6   // half lead-spacing for 2-lead radial parts
const PY = (H: number, p: number) => H - p * 0.5 // pad row y (just below the body)

/** Solder-joint (pad) positions, origin-relative px — MUST match buildVintageShapes. */
export function vintageLeadEnds(kind: VintageKind, pitch: number): { x: number; y: number }[] {
  const fp = VFOOT[kind], W = fp.w * pitch, H = fp.h * pitch, cx = W / 2, cy = H / 2
  const py = PY(H, pitch), dx = PDX(pitch)
  switch (kind) {
    case 'resAxial': case 'inductorAxial': case 'diodeAxial': return [{ x: 2, y: cy }, { x: W - 2, y: cy }]
    case 'ceramicDisc': case 'filmCap': case 'electroRadial': case 'tantalum': case 'led5mm':
      return [{ x: cx - dx, y: py }, { x: cx + dx, y: py }]
    case 'crystalHC49': return [{ x: cx - W * 0.3, y: py }, { x: cx + W * 0.3, y: py }]
    case 'trimpot': return [{ x: cx - dx * 1.4, y: py }, { x: cx + dx * 1.4, y: py }]
    case 'to92': case 'to220': return [{ x: cx - pitch * 0.8, y: py }, { x: cx, y: py }, { x: cx + pitch * 0.8, y: py }]
    case 'battery9v': { const bw = W * 0.8, bx = cx - bw / 2, by = pitch * 0.6; return [{ x: bx + bw * 0.34, y: by }, { x: bx + bw * 0.67, y: by }] }
    case 'batteryClip': return [{ x: cx - dx * 1.4, y: py }, { x: cx + dx * 1.4, y: py }]
    case 'powerJack': return [{ x: cx, y: py }, { x: 2, y: cy }, { x: W - 2, y: cy }]
    case 'dipIC': {
      const bw = W * 0.84, bh = H * 0.62, bx = cx - bw / 2, by = cy - bh / 2, pins = 7, out: { x: number; y: number }[] = []
      for (let i = 0; i < pins; i++) { const px = bx + bw * (0.1 + (i / (pins - 1)) * 0.8); out.push({ x: px, y: by - pitch * 0.35 }, { x: px, y: by + bh + pitch * 0.35 }) }
      return out
    }
  }
  return []
}

// Pin/lead FUNCTION per index — SAME order as vintageLeadEnds.
export function vintagePins(kind: VintageKind): string[] {
  switch (kind) {
    case 'resAxial': case 'inductorAxial': return ['A', 'B']
    case 'diodeAxial': return ['anode', 'cathode']
    case 'ceramicDisc': case 'filmCap': return ['t1', 't2']
    case 'electroRadial': case 'tantalum': return ['+', '-']
    case 'led5mm': return ['anode', 'cathode']
    case 'trimpot': return ['end1', 'end2']
    case 'to92': return ['E', 'B', 'C']
    case 'to220': return ['IN', 'GND', 'OUT']
    case 'crystalHC49': return ['x1', 'x2']
    case 'battery9v': case 'batteryClip': return ['+', '-']
    case 'powerJack': return ['tip+', 'sleeve-', 'sw']
    case 'dipIC': {
      const pins = 7, out: string[] = []
      for (let i = 0; i < pins; i++) { out.push(i === pins - 1 ? 'VCC' : i === 3 || i === 4 ? 'OSC' : 'IO'); out.push(i === 0 ? 'GND' : 'IO') }
      return out
    }
  }
  return []
}
export function pin(kind: VintageKind, name: string): number { return vintagePins(kind).indexOf(name) }

// short lead stub from body edge into a pad (top-down: leads barely show)
function stub(s: ShapeSpec[], fromX: number, fromY: number, toX: number, toY: number, p: number): void {
  ln(s, fromX, fromY, toX, toY, Math.max(1.6, p * 0.12), C.wire, 1)
  padHole(s, toX, toY, p)
}

export function buildVintageShapes(kind: VintageKind, pitch: number, opts: VintageOpts = {}): ShapeSpec[] {
  const s: ShapeSpec[] = []
  const fp = VFOOT[kind], W = fp.w * pitch, H = fp.h * pitch, cx = W / 2, cy = H / 2
  const py = PY(H, pitch), dx = PDX(pitch)

  switch (kind) {
    // axial: horizontal body, leads bend into pads at both ends
    case 'resAxial': case 'inductorAxial': case 'diodeAxial': {
      const bodyW = kind === 'diodeAxial' ? W * 0.5 : W * 0.6, bh = H * 0.5, bx = cx - bodyW / 2, by = cy - bh / 2
      stub(s, bx, cy, 2, cy, pitch); stub(s, bx + bodyW, cy, W - 2, cy, pitch)
      const body = kind === 'resAxial' ? C.resTan : kind === 'inductorAxial' ? 0x2f7d6a : C.diodeBody
      topBox(s, bx, by, bodyW, bh, body, bh / 2)
      if (kind === 'diodeAxial') r(s, bx + bodyW * 0.76, by + bh * 0.08, bodyW * 0.1, bh * 0.84, C.diodeBand, 0.95)
      else (kind === 'resAxial' ? BANDS : [0x2f7d6a, 0xc8a84c, 0x6b3a12]).forEach((col, i) =>
        r(s, bx + bodyW * (0.22 + i * 0.16), by + bh * 0.08, bodyW * 0.08, bh * 0.84, col, 0.95))
      return s
    }

    // radial 2-lead: two close pads at the footprint, body sits on top of them
    case 'ceramicDisc': case 'tantalum': {
      padHole(s, cx - dx, py, pitch); padHole(s, cx + dx, py, pitch)
      const rad = W * 0.42, dcy = py - rad - pitch * 0.1
      stub(s, cx - dx, dcy, cx - dx, py, pitch); stub(s, cx + dx, dcy, cx + dx, py, pitch)
      topDisc(s, cx, dcy, rad, kind === 'tantalum' ? C.tantal : C.disc)
      if (kind === 'tantalum') r(s, cx - rad * 0.7, dcy - rad * 0.12, rad * 0.3, rad * 0.24, C.shadow, 0.4)
      return s
    }

    case 'filmCap': {
      padHole(s, cx - dx, py, pitch); padHole(s, cx + dx, py, pitch)
      const bw = W * 0.74, bh = H * 0.55, bx = cx - bw / 2, by = py - bh - pitch * 0.1
      stub(s, cx - dx, by + bh, cx - dx, py, pitch); stub(s, cx + dx, by + bh, cx + dx, py, pitch)
      topBox(s, bx, by, bw, bh, C.filmRed, bw * 0.16)
      return s
    }

    case 'electroRadial': {
      padHole(s, cx - dx, py, pitch); padHole(s, cx + dx, py, pitch)
      const rad = W * 0.44, dcy = py - rad - pitch * 0.1
      stub(s, cx - dx, dcy, cx - dx, py, pitch); stub(s, cx + dx, dcy, cx + dx, py, pitch)
      topDisc(s, cx, dcy, rad, C.elecBlue, 4)
      ln(s, cx - rad * 0.5, dcy, cx + rad * 0.5, dcy, 1.6, C.elecTop, 0.85)         // vent cross
      ln(s, cx, dcy - rad * 0.5, cx, dcy + rad * 0.5, 1.6, C.elecTop, 0.85)
      r(s, cx + rad * 0.5, dcy - rad * 0.1, rad * 0.34, rad * 0.2, C.stripe, 0.9)   // − mark on rim
      return s
    }

    case 'led5mm': {
      const col = opts.color ?? C.ledRed, on = opts.on ?? true
      padHole(s, cx - dx, py, pitch); padHole(s, cx + dx, py, pitch)
      const rad = W * 0.42, dcy = py - rad - pitch * 0.1
      stub(s, cx - dx, dcy, cx - dx, py, pitch); stub(s, cx + dx, dcy, cx + dx, py, pitch)
      if (on) ci(s, cx, dcy, rad * 1.7, col, 0.18)
      ci(s, cx + 2, dcy + 4, rad, C.shadow, 0.4)
      ci(s, cx, dcy, rad, col, on ? 0.92 : 0.5)
      if (on) ci(s, cx, dcy, rad * 0.45, 0xffffff, 0.92); else ci(s, cx, dcy, rad * 0.5, C.shadow, 0.3)
      ci(s, cx - rad * 0.32, dcy - rad * 0.32, rad * 0.3, C.white, on ? 0.6 : 0.3)
      return s
    }

    case 'trimpot': {
      const px = [cx - dx * 1.4, cx + dx * 1.4]; px.forEach((x) => padHole(s, x, py, pitch))
      const bw = W * 0.78, bh = H * 0.6, bx = cx - bw / 2, by = py - bh - pitch * 0.1
      px.forEach((x) => stub(s, x, by + bh, x, py, pitch))
      topBox(s, bx, by, bw, bh, C.trim, 2)
      ci(s, cx, by + bh * 0.5, bw * 0.28, C.brass, 1)
      ln(s, cx - bw * 0.2, by + bh * 0.5, cx + bw * 0.2, by + bh * 0.5, 2, C.shadow, 0.7)
      return s
    }

    case 'crystalHC49': {
      const px = [cx - W * 0.3, cx + W * 0.3]; px.forEach((x) => padHole(s, x, py, pitch))
      const bw = W * 0.74, bh = H * 0.52, bx = cx - bw / 2, by = py - bh - pitch * 0.1
      px.forEach((x) => stub(s, x, by + bh, x, py, pitch))
      topBox(s, bx, by, bw, bh, C.can, bh * 0.5)
      return s
    }

    // TO-92: D top + 3 close pads under the flat side
    case 'to92': {
      const px = [cx - pitch * 0.8, cx, cx + pitch * 0.8]; px.forEach((x) => padHole(s, x, py, pitch))
      const bw = W * 0.7, bh = H * 0.52, bx = cx - bw / 2, by = py - bh - pitch * 0.15
      px.forEach((x) => stub(s, x, by + bh, x, py, pitch))
      rr(s, bx + 2, by + 4, bw, bh, bw * 0.45, C.shadow, 0.4)
      rr(s, bx, by + 3, bw, bh, bw * 0.45, C.to92, 1); r(s, bx, by + bh * 0.5, bw, bh * 0.5 + 3, C.to92, 1)
      rr(s, bx, by, bw, bh, bw * 0.45, C.to92, 1); r(s, bx, by + bh * 0.5, bw, bh * 0.5, C.to92, 1)
      rr(s, bx + bw * 0.2, by + bh * 0.1, bw * 0.5, bh * 0.16, 2, C.white, 0.14)
      return s
    }

    case 'to220': {
      const px = [cx - pitch * 0.8, cx, cx + pitch * 0.8]; px.forEach((x) => padHole(s, x, py, pitch))
      const bw = W * 0.8, bx = cx - bw / 2, tabH = H * 0.24, bodyH = H * 0.4, by = pitch * 0.4 + tabH
      px.forEach((x) => stub(s, x, by + bodyH, x, py, pitch))
      topBox(s, bx, pitch * 0.4, bw, tabH, C.tab, 2)
      ci(s, cx, pitch * 0.4 + tabH * 0.5, tabH * 0.3, C.shadow, 0.9)
      topBox(s, bx, by, bw, bodyH, C.to220, 2)
      return s
    }

    case 'dipIC': {
      const bw = W * 0.84, bh = H * 0.62, bx = cx - bw / 2, by = cy - bh / 2, pins = 7
      for (let i = 0; i < pins; i++) {
        const px = bx + bw * (0.1 + (i / (pins - 1)) * 0.8)
        stub(s, px, by, px, by - pitch * 0.35, pitch); stub(s, px, by + bh, px, by + bh + pitch * 0.35, pitch)
      }
      topBox(s, bx, by, bw, bh, C.dip, 3)
      ci(s, bx + bw * 0.12, by + bh * 0.5, bw * 0.05, C.silk, 0.85)
      s.push({ type: 'circle', x: bx + bw * 0.5, y: by, r: bw * 0.06, color: C.shadow, alpha: 0.85 })
      return s
    }

    case 'battery9v': {
      const bw = W * 0.8, bh = H * 0.84, bx = cx - bw / 2, by = pitch * 0.6
      topBox(s, bx, by, bw, bh, C.battBody, 4)
      rr(s, bx + bw * 0.12, by + bh * 0.3, bw * 0.76, bh * 0.4, 2, C.battLabel, 1)
      padHole(s, bx + bw * 0.34, by, pitch); padHole(s, bx + bw * 0.67, by, pitch)
      return s
    }

    case 'batteryClip': {
      // board-mount 2-pad screw terminal (blue) — pads, not flying wires
      const px = [cx - dx * 1.4, cx + dx * 1.4]; px.forEach((x) => padHole(s, x, py, pitch))
      const bw = W * 0.86, bh = H * 0.6, bx = cx - bw / 2, by = py - bh - pitch * 0.1
      px.forEach((x) => stub(s, x, by + bh, x, py, pitch))
      topBox(s, bx, by, bw, bh, C.term, 3)
      ;[0.3, 0.7].forEach((f) => { ci(s, bx + bw * f, by + bh * 0.45, bw * 0.12, C.jackRing, 1); ln(s, bx + bw * f - 4, by + bh * 0.45, bx + bw * f + 4, by + bh * 0.45, 1.5, C.shadow, 0.8) })
      return s
    }

    case 'powerJack': {
      const bw = W * 0.62, bh = H * 0.56, bx = cx - bw / 2
      stub(s, cx, cy + bh / 2, cx, py, pitch); stub(s, bx, cy, 2, cy, pitch); stub(s, bx + bw, cy, W - 2, cy, pitch)
      topBox(s, bx, cy - bh / 2, bw, bh, C.jackBody, 3)
      ci(s, cx, cy, bh * 0.38, C.jackRing, 1); ci(s, cx, cy, bh * 0.2, C.shadow, 1); ci(s, cx, cy, bh * 0.07, C.jackRing, 1)
      return s
    }
  }
  return s
}
