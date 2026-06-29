// Vintage through-hole component renderer (hand-soldered look): axial/radial parts with visible
// wire leads + solder joints, cylindrical shading, vintage colors. Returns ShapeSpec[] (same union
// as decorBuilder) drawn at origin (0,0). See docs/design/through-hole-components.md.
import type { ShapeSpec } from './decorBuilder'

export type VintageKind =
  | 'resAxial' | 'diodeAxial' | 'inductorAxial'
  | 'ceramicDisc' | 'filmCap' | 'electroRadial' | 'tantalum' | 'led5mm' | 'trimpot'
  | 'to92' | 'to220' | 'crystalHC49' | 'dipIC'
  | 'battery9v' | 'batteryClip' | 'powerJack'

export interface VintageOpts { color?: number; on?: boolean }

// footprint in grid cells (fractional ok)
export const VFOOT: Record<VintageKind, { w: number; h: number }> = {
  resAxial: { w: 5, h: 1.6 }, diodeAxial: { w: 4, h: 1.6 }, inductorAxial: { w: 5, h: 1.8 },
  ceramicDisc: { w: 2, h: 2.6 }, filmCap: { w: 2.6, h: 2.6 }, electroRadial: { w: 3, h: 4.2 },
  tantalum: { w: 2, h: 2.6 }, led5mm: { w: 2, h: 2.6 }, trimpot: { w: 2.6, h: 2.6 },
  to92: { w: 2.6, h: 3 }, to220: { w: 3, h: 4.2 }, crystalHC49: { w: 4, h: 2.2 }, dipIC: { w: 6, h: 3 },
  battery9v: { w: 4, h: 6 }, batteryClip: { w: 3, h: 3 }, powerJack: { w: 3.4, h: 3 },
}

const C = {
  wire: 0xb8c0c0, solder: 0xe4eaea, solderMid: 0x7e8884, shadow: 0x000000, white: 0xffffff,
  resTan: 0xc8a86a, resBlue: 0x7fb8c8,
  disc: 0xcf8a3c, filmRed: 0xb83a2e, boxBlue: 0x2f5fa8,
  elecBlue: 0x223f86, elecTop: 0x0e1116, stripe: 0xd8dee0,
  tantal: 0xd8b13a, to92: 0x171717, to220: 0x161616, tab: 0x9aa3a0,
  diodeBody: 0x171717, diodeBand: 0xcdd2cf, ledRed: 0xe23a3a, ledGreen: 0x3ad26a, trim: 0x2f5fa8, brass: 0xc8a84c,
  can: 0x9aa3a0, dip: 0x141414, silk: 0xc9d2cc,
  battBody: 0x1b1b1f, battLabel: 0x2a4a8a, wireRed: 0xcf3a32, wireBlack: 0x202428, jackBody: 0x26262b, jackRing: 0x8a9290,
  pad: 0xb9c2bd, hole: 0x0a1712, term: 0x2f6fd0,
}
// resistor 4-band example colors (brown,black,red,gold)
const BANDS = [0x6b3a12, 0x101010, 0xc23b22, 0xc8a84c]

function r(s: ShapeSpec[], x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  s.push({ type: 'rect', x, y, w, h, color, alpha })
}
function rr(s: ShapeSpec[], x: number, y: number, w: number, h: number, rad: number, color: number, alpha = 1): void {
  s.push({ type: 'roundRect', x, y, w, h, r: rad, color, alpha })
}
function ci(s: ShapeSpec[], x: number, y: number, rad: number, color: number, alpha = 1): void {
  s.push({ type: 'circle', x, y, r: rad, color, alpha })
}
function ln(s: ShapeSpec[], x1: number, y1: number, x2: number, y2: number, width: number, color: number, alpha = 1): void {
  s.push({ type: 'line', x1, y1, x2, y2, width, color, alpha })
}
// TOP-DOWN render helpers (single top-down camera + pseudo-3D: top face + side wall + highlight).
/** Through-hole annular pad (donut): tin ring + drilled hole. */
function padHole(s: ShapeSpec[], x: number, y: number, p: number): void {
  ci(s, x, y, p * 0.24, C.pad, 1)
  ci(s, x, y, p * 0.11, C.hole, 1)
}
/** Silver lead wire from a body edge to a pad, then the annular pad. */
function lead(s: ShapeSpec[], x1: number, y1: number, x2: number, y2: number, p: number): void {
  ln(s, x1, y1, x2, y2, Math.max(1.6, p * 0.11), C.wire, 1)
  padHole(s, x2, y2, p)
}
/** Pseudo-3D disc seen from top: cast shadow → side wall → top face → highlight. */
function topDisc(s: ShapeSpec[], cx: number, cy: number, rad: number, color: number, wall = 3): void {
  ci(s, cx + 2, cy + 4, rad, C.shadow, 0.4)
  ci(s, cx, cy + wall, rad, color, 1); ci(s, cx, cy + wall, rad, C.shadow, 0.4) // darkened side wall
  ci(s, cx, cy, rad, color, 1)                                                  // top face
  ci(s, cx - rad * 0.32, cy - rad * 0.3, rad * 0.42, C.white, 0.18)             // highlight
}
/** Pseudo-3D box seen from top. */
function topBox(s: ShapeSpec[], x: number, y: number, w: number, h: number, color: number, rad = 2, wall = 3): void {
  rr(s, x + 2, y + 4, w, h, rad, C.shadow, 0.4)
  rr(s, x, y + wall, w, h, rad, color, 1); rr(s, x, y + wall, w, h, rad, C.shadow, 0.4) // side wall
  rr(s, x, y, w, h, rad, color, 1)                                                       // top face
  rr(s, x + w * 0.1, y + h * 0.1, w * 0.6, Math.max(1.5, h * 0.16), rad, C.white, 0.16)  // highlight
}

/** Solder-joint (lead end) positions, origin-relative px — matches buildVintageShapes lead() calls. */
export function vintageLeadEnds(kind: VintageKind, pitch: number): { x: number; y: number }[] {
  const fp = VFOOT[kind]
  const W = fp.w * pitch, H = fp.h * pitch, cx = W / 2, cy = H / 2
  switch (kind) {
    case 'resAxial': case 'inductorAxial': case 'diodeAxial':
      return [{ x: 2, y: cy }, { x: W - 2, y: cy }]
    case 'ceramicDisc': return [{ x: cx - W * 0.16, y: H - 2 }, { x: cx + W * 0.16, y: H - 2 }]
    case 'filmCap': case 'electroRadial': return [{ x: cx - W * 0.18, y: H - 2 }, { x: cx + W * 0.18, y: H - 2 }]
    case 'tantalum': return [{ x: cx - W * 0.16, y: H - 2 }, { x: cx + W * 0.16, y: H - 2 }]
    case 'led5mm': return [{ x: cx - W * 0.14, y: H - 2 }, { x: cx + W * 0.14, y: H - 2 }]
    case 'trimpot': { const bw = W * 0.8, bx = cx - bw / 2; return [{ x: bx + bw * 0.2, y: H - 2 }, { x: bx + bw * 0.8, y: H - 2 }] }
    case 'to92': { const bw = W * 0.72, bx = cx - bw / 2; return [{ x: bx + bw * 0.18, y: H - 2 }, { x: cx, y: H - 2 }, { x: bx + bw * 0.82, y: H - 2 }] }
    case 'to220': { const bw = W * 0.8, bx = cx - bw / 2; return [{ x: bx + bw * 0.18, y: H - 2 }, { x: cx, y: H - 2 }, { x: bx + bw * 0.82, y: H - 2 }] }
    case 'crystalHC49': return [{ x: cx - W * 0.22, y: H - 2 }, { x: cx + W * 0.22, y: H - 2 }]
    case 'battery9v': { const bw = W * 0.78, bx = cx - bw / 2, by = H * 0.1; return [{ x: bx + bw * 0.34, y: by }, { x: bx + bw * 0.67, y: by }] }
    case 'batteryClip': return [{ x: cx - W * 0.18, y: H - 2 }, { x: cx + W * 0.18, y: H - 2 }]
    case 'powerJack': { const bw = W * 0.6, bx = cx - bw / 2; return [{ x: bx + bw * 0.5, y: H - 2 }, { x: 2, y: cy }, { x: W - 2, y: cy }] }
    case 'dipIC': {
      const bw = W * 0.84, bh = H * 0.6, bx = cx - bw / 2, by = cy - bh / 2, pins = 7, out: { x: number; y: number }[] = []
      for (let i = 0; i < pins; i++) { const px = bx + bw * (0.1 + (i / (pins - 1)) * 0.8); out.push({ x: px, y: by - H * 0.18 }, { x: px, y: by + bh + H * 0.18 }) }
      return out
    }
  }
  return []
}

// Pin/lead FUNCTION per index — SAME order as vintageLeadEnds. Connections must respect these
// (anode↔cathode, +↔−, base/emitter/collector, IN/GND/OUT, VCC/GND). See doc for the table.
export function vintagePins(kind: VintageKind): string[] {
  switch (kind) {
    case 'resAxial': case 'inductorAxial': return ['A', 'B']           // non-polar
    case 'diodeAxial': return ['anode', 'cathode']                     // band end = cathode
    case 'ceramicDisc': case 'filmCap': return ['t1', 't2']            // non-polar
    case 'electroRadial': return ['+', '-']                            // stripe side = −
    case 'tantalum': return ['+', '-']
    case 'led5mm': return ['anode', 'cathode']                         // long lead = anode
    case 'trimpot': return ['end1', 'end2']
    case 'to92': return ['E', 'B', 'C']                                // emitter, base, collector
    case 'to220': return ['IN', 'GND', 'OUT']                          // 7805 regulator
    case 'crystalHC49': return ['x1', 'x2']
    case 'battery9v': return ['+', '-']
    case 'batteryClip': return ['+', '-']                              // red = +, black = −
    case 'powerJack': return ['tip+', 'sleeve-', 'sw']
    case 'dipIC': {                                                    // top row then bottom per i
      const pins = 7, out: string[] = []
      for (let i = 0; i < pins; i++) {
        out.push(i === pins - 1 ? 'VCC' : i === 3 || i === 4 ? 'OSC' : 'IO') // top-right = VCC; mid = OSC
        out.push(i === 0 ? 'GND' : 'IO')                                      // bottom-left = GND
      }
      return out
    }
  }
  return []
}
/** Index of a named pin (first match), or -1. */
export function pin(kind: VintageKind, name: string): number { return vintagePins(kind).indexOf(name) }

export function buildVintageShapes(kind: VintageKind, pitch: number, opts: VintageOpts = {}): ShapeSpec[] {
  const s: ShapeSpec[] = []
  const fp = VFOOT[kind]
  const W = fp.w * pitch, H = fp.h * pitch
  const cx = W / 2, cy = H / 2

  switch (kind) {
    // axial parts: horizontal body, leads bent to annular pads at both ends (top-down)
    case 'resAxial':
    case 'inductorAxial':
    case 'diodeAxial': {
      const bodyW = kind === 'diodeAxial' ? W * 0.5 : W * 0.62, bh = H * 0.46
      const bx = cx - bodyW / 2, by = cy - bh / 2
      lead(s, bx, cy, 2, cy, pitch); lead(s, bx + bodyW, cy, W - 2, cy, pitch)
      const body = kind === 'resAxial' ? C.resTan : kind === 'inductorAxial' ? 0x2f7d6a : C.diodeBody
      topBox(s, bx, by, bodyW, bh, body, bh / 2)
      if (kind === 'diodeAxial') r(s, bx + bodyW * 0.76, by + bh * 0.1, bodyW * 0.1, bh * 0.8, C.diodeBand, 0.95)
      else (kind === 'resAxial' ? BANDS : [0x2f7d6a, 0xc8a84c, 0x6b3a12]).forEach((col, i) =>
        r(s, bx + bodyW * (0.22 + i * 0.16), by + bh * 0.1, bodyW * 0.08, bh * 0.8, col, 0.95))
      return s
    }

    // radial parts: body on top, two leads down to annular pads at the bottom edge
    case 'ceramicDisc': {
      const px = [cx - W * 0.16, cx + W * 0.16]
      const rad = W * 0.4, dcy = H * 0.36
      px.forEach((x) => ln(s, x, dcy + rad * 0.6, x, H - 2, Math.max(1.6, pitch * 0.11), C.wire, 1))
      px.forEach((x) => padHole(s, x, H - 2, pitch))
      topDisc(s, cx, dcy, rad, C.disc)
      return s
    }

    case 'filmCap': {
      const px = [cx - W * 0.18, cx + W * 0.18], bw = W * 0.7, bh = H * 0.52, bx = cx - bw / 2, by = H * 0.1
      px.forEach((x) => ln(s, x, by + bh, x, H - 2, Math.max(1.6, pitch * 0.11), C.wire, 1))
      px.forEach((x) => padHole(s, x, H - 2, pitch))
      topBox(s, bx, by, bw, bh, C.filmRed, bw * 0.16)
      return s
    }

    case 'electroRadial': {
      // top-down can: a CIRCLE with vent cross + negative-side mark on the rim
      const px = [cx - W * 0.18, cx + W * 0.18], rad = W * 0.42, dcy = H * 0.4
      px.forEach((x) => ln(s, x, dcy + rad * 0.6, x, H - 2, Math.max(1.6, pitch * 0.11), C.wire, 1))
      px.forEach((x) => padHole(s, x, H - 2, pitch))
      topDisc(s, cx, dcy, rad, C.elecBlue, 4)
      ln(s, cx - rad * 0.5, dcy, cx + rad * 0.5, dcy, 1.6, C.elecTop, 0.8)  // vent cross
      ln(s, cx, dcy - rad * 0.5, cx, dcy + rad * 0.5, 1.6, C.elecTop, 0.8)
      r(s, cx + rad * 0.55, dcy - rad * 0.12, rad * 0.32, rad * 0.24, C.stripe, 0.9) // − mark on rim
      return s
    }

    case 'tantalum': {
      const px = [cx - W * 0.16, cx + W * 0.16], rad = W * 0.36, dcy = H * 0.36
      px.forEach((x) => ln(s, x, dcy + rad * 0.6, x, H - 2, Math.max(1.6, pitch * 0.11), C.wire, 1))
      px.forEach((x) => padHole(s, x, H - 2, pitch))
      topDisc(s, cx, dcy, rad, C.tantal)
      r(s, cx - rad * 0.7, dcy - rad * 0.12, rad * 0.3, rad * 0.24, C.shadow, 0.4) // + mark
      return s
    }

    case 'led5mm': {
      const col = opts.color ?? C.ledRed, on = opts.on ?? true
      const px = [cx - W * 0.14, cx + W * 0.14], rad = W * 0.4, dcy = H * 0.36
      px.forEach((x) => ln(s, x, dcy + rad * 0.6, x, H - 2, Math.max(1.6, pitch * 0.11), C.wire, 1))
      px.forEach((x) => padHole(s, x, H - 2, pitch))
      if (on) ci(s, cx, dcy, rad * 1.7, col, 0.18)                       // glow
      ci(s, cx + 2, dcy + 4, rad, C.shadow, 0.4)                         // shadow
      ci(s, cx, dcy, rad, col, on ? 0.92 : 0.5)                          // dome
      if (on) ci(s, cx, dcy, rad * 0.45, 0xffffff, 0.92)                 // emissive core
      else ci(s, cx, dcy, rad * 0.5, C.shadow, 0.3)
      ci(s, cx - rad * 0.32, dcy - rad * 0.32, rad * 0.3, C.white, on ? 0.6 : 0.3)
      return s
    }

    case 'battery9v': {
      // top-down block + two terminal pads on the top edge
      const bw = W * 0.8, bh = H * 0.84, bx = cx - bw / 2, by = H * 0.1
      topBox(s, bx, by, bw, bh, C.battBody, 4)
      rr(s, bx + bw * 0.12, by + bh * 0.3, bw * 0.76, bh * 0.4, 2, C.battLabel, 1)
      padHole(s, bx + bw * 0.34, by, pitch); padHole(s, bx + bw * 0.67, by, pitch)
      r(s, bx + bw * 0.3, by - pitch * 0.4, 4, 5, C.silk, 0.8); r(s, bx + bw * 0.62, by - pitch * 0.35, 6, 2, C.silk, 0.8) // +/−
      return s
    }

    case 'batteryClip': {
      // board-mount 2-pad screw terminal (blue) — pads, not flying wires
      const bw = W * 0.86, bh = H * 0.6, bx = cx - bw / 2, by = H * 0.12
      const px = [cx - W * 0.18, cx + W * 0.18]
      px.forEach((x) => ln(s, x, by + bh, x, H - 2, Math.max(1.6, pitch * 0.11), C.wire, 1))
      px.forEach((x) => padHole(s, x, H - 2, pitch))
      topBox(s, bx, by, bw, bh, C.term, 3)
      ;[0.3, 0.7].forEach((f) => { ci(s, bx + bw * f, by + bh * 0.42, bw * 0.13, C.jackRing, 1); ln(s, bx + bw * f - 4, by + bh * 0.42, bx + bw * f + 4, by + bh * 0.42, 1.5, C.shadow, 0.8) }) // screws
      return s
    }

    case 'powerJack': {
      const bw = W * 0.62, bh = H * 0.56, bx = cx - bw / 2, dcy = cy - H * 0.06
      lead(s, bx + bw * 0.5, dcy + bh / 2, bx + bw * 0.5, H - 2, pitch); lead(s, bx, dcy, 2, dcy, pitch); lead(s, bx + bw, dcy, W - 2, dcy, pitch)
      topBox(s, bx, dcy - bh / 2, bw, bh, C.jackBody, 3)
      ci(s, cx, dcy, bh * 0.38, C.jackRing, 1); ci(s, cx, dcy, bh * 0.2, C.shadow, 1); ci(s, cx, dcy, bh * 0.07, C.jackRing, 1)
      return s
    }

    case 'trimpot': {
      const bw = W * 0.78, bh = H * 0.6, bx = cx - bw / 2, by = H * 0.1
      ;[bx + bw * 0.2, bx + bw * 0.8].forEach((x) => ln(s, x, by + bh, x, H - 2, Math.max(1.6, pitch * 0.11), C.wire, 1))
      ;[bx + bw * 0.2, bx + bw * 0.8].forEach((x) => padHole(s, x, H - 2, pitch))
      topBox(s, bx, by, bw, bh, C.trim, 2)
      ci(s, cx, by + bh * 0.5, bw * 0.28, C.brass, 1)
      ln(s, cx - bw * 0.2, by + bh * 0.5, cx + bw * 0.2, by + bh * 0.5, 2, C.shadow, 0.7)
      return s
    }

    case 'to92': {
      // top-down D: rounded top + flat lead side (bottom), 3 leads to annular pads
      const bw = W * 0.7, bh = H * 0.5, bx = cx - bw / 2, by = H * 0.08
      const px = [bx + bw * 0.18, cx, bx + bw * 0.82]
      px.forEach((x) => ln(s, x, by + bh, x, H - 2, Math.max(1.6, pitch * 0.11), C.wire, 1))
      px.forEach((x) => padHole(s, x, H - 2, pitch))
      rr(s, bx + 2, by + 4, bw, bh, bw * 0.45, C.shadow, 0.4)
      rr(s, bx, by + 3, bw, bh, bw * 0.45, C.to92, 1); r(s, bx, by + bh * 0.5, bw, bh * 0.5 + 3, C.to92, 1) // wall
      rr(s, bx, by, bw, bh, bw * 0.45, C.to92, 1); r(s, bx, by + bh * 0.5, bw, bh * 0.5, C.to92, 1)         // top, flat front
      rr(s, bx + bw * 0.2, by + bh * 0.1, bw * 0.5, bh * 0.16, 2, C.white, 0.14)
      return s
    }

    case 'to220': {
      const bw = W * 0.8, bx = cx - bw / 2, tabH = H * 0.26, bodyH = H * 0.4, by = H * 0.06 + tabH
      const px = [bx + bw * 0.18, cx, bx + bw * 0.82]
      px.forEach((x) => ln(s, x, by + bodyH, x, H - 2, Math.max(1.6, pitch * 0.11), C.wire, 1))
      px.forEach((x) => padHole(s, x, H - 2, pitch))
      topBox(s, bx, H * 0.06, bw, tabH, C.tab, 2)                       // heatsink tab
      ci(s, cx, H * 0.06 + tabH * 0.5, tabH * 0.28, C.shadow, 0.9)      // mount hole
      topBox(s, bx, by, bw, bodyH, C.to220, 2)                         // black body
      return s
    }

    case 'crystalHC49': {
      const bw = W * 0.7, bh = H * 0.5, bx = cx - bw / 2, by = H * 0.12
      ;[cx - W * 0.22, cx + W * 0.22].forEach((x) => ln(s, x, by + bh, x, H - 2, Math.max(1.6, pitch * 0.11), C.wire, 1))
      ;[cx - W * 0.22, cx + W * 0.22].forEach((x) => padHole(s, x, H - 2, pitch))
      topBox(s, bx, by, bw, bh, C.can, bh * 0.5)
      return s
    }

    case 'dipIC': {
      const bw = W * 0.84, bh = H * 0.56, bx = cx - bw / 2, by = cy - bh / 2, pins = 7
      for (let i = 0; i < pins; i++) {
        const px = bx + bw * (0.1 + (i / (pins - 1)) * 0.8)
        ln(s, px, by, px, by - H * 0.16, Math.max(1.6, pitch * 0.1), C.wire, 1); padHole(s, px, by - H * 0.16, pitch)
        ln(s, px, by + bh, px, by + bh + H * 0.16, Math.max(1.6, pitch * 0.1), C.wire, 1); padHole(s, px, by + bh + H * 0.16, pitch)
      }
      topBox(s, bx, by, bw, bh, C.dip, 3)
      ci(s, bx + bw * 0.12, by + bh * 0.5, bw * 0.05, C.silk, 0.85)                                   // pin-1 dot
      s.push({ type: 'circle', x: bx + bw * 0.5, y: by, r: bw * 0.06, color: C.shadow, alpha: 0.85 }) // notch
      return s
    }
  }
  return s
}
