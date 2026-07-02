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

export interface VintageOpts { color?: number; on?: boolean; ref?: string }

// footprint in grid cells (fractional ok). Compact — pads sit at the body, not on long legs.
export const VFOOT: Record<VintageKind, { w: number; h: number }> = {
  resAxial: { w: 5, h: 1.8 }, diodeAxial: { w: 4, h: 1.8 }, inductorAxial: { w: 5, h: 2 },
  ceramicDisc: { w: 2.2, h: 2.2 }, filmCap: { w: 2.4, h: 2.2 }, electroRadial: { w: 3, h: 3 },
  tantalum: { w: 2.2, h: 2.2 }, led5mm: { w: 2.2, h: 2.2 }, trimpot: { w: 2.6, h: 2.4 },
  to92: { w: 2.6, h: 2.4 }, to220: { w: 3, h: 3.2 }, crystalHC49: { w: 3.6, h: 1.8 }, dipIC: { w: 6, h: 3 },
  battery9v: { w: 4, h: 5.4 }, batteryClip: { w: 3.2, h: 2 }, powerJack: { w: 3.2, h: 2.6 },
}

const C = {
  wire: 0x5f6a66, solder: 0x8b958f, solderMid: 0x4d5652, shadow: 0x000000, white: 0xffffff,
  resTan: 0x8f7d54, disc: 0x8f6a3c, filmRed: 0xb83a2e,
  elecBlue: 0x2a3a5c, elecTop: 0x14306a, stripe: 0x8c9092, // was 0xd8dee0 — darkened ~35% (bright metallic fill)
  tantal: 0xd8b13a, to92: 0x1b1b1f, to220: 0x171717, tab: 0x727875, // was 0xb0b8b4 — darkened ~35%
  diodeBody: 0x1b1b1f, diodeBand: 0x858987, ledRed: 0x6a3838, ledGreen: 0x2f7a4a, trim: 0x2f5fa8, brass: 0xc8a84c, // diodeBand was 0xcdd2cf
  can: 0x6f7470, dip: 0x18181c, silk: 0xc9d2cc, // can was 0xaab2ad — darkened ~35% (silver capsule)
  battBody: 0x1b1b1f, battLabel: 0x2a4a8a, jackBody: 0x26262b, jackRing: 0x5a5f5e, // jackRing was 0x8a9290
  pad: 0x7d8a82, hole: 0x0a1712, term: 0x2f6fd0,
}
// Dim a color's RGB channels toward black (muted band colors — quiet background decor).
function dim(c: number, f = 0.7): number {
  const r = Math.round(((c >> 16) & 0xff) * f), g = Math.round(((c >> 8) & 0xff) * f), b = Math.round((c & 0xff) * f)
  return (r << 16) | (g << 8) | b
}
// brown,black,red,gold — dim(0.7) toward black, then hand-blended a further ~40% toward the body tone
// (C.resTan 0x8f7d54) so bands stay quiet against the resistor body: 0x6b3a12->0x664b29,
// 0x101010->0x403928, 0xc23b22->0x8b4b30, 0xc8a84c->0x8d7941.
const BANDS = [0x664b29, 0x403928, 0x8b4b30, 0x8d7941]

function r(s: ShapeSpec[], x: number, y: number, w: number, h: number, color: number, alpha = 1): void { s.push({ type: 'rect', x, y, w, h, color, alpha }) }
function rr(s: ShapeSpec[], x: number, y: number, w: number, h: number, rad: number, color: number, alpha = 1): void { s.push({ type: 'roundRect', x, y, w, h, r: rad, color, alpha }) }
function ci(s: ShapeSpec[], x: number, y: number, rad: number, color: number, alpha = 1): void { s.push({ type: 'circle', x, y, r: rad, color, alpha }) }
function ln(s: ShapeSpec[], x1: number, y1: number, x2: number, y2: number, width: number, color: number, alpha = 1): void { s.push({ type: 'line', x1, y1, x2, y2, width, color, alpha }) }

/** Through-hole joint: annular pad + concave shiny solder fillet (IPC-A-610) + cut lead. */
function padHole(s: ShapeSpec[], x: number, y: number, p: number): void {
  const R = p * 0.34
  ci(s, x + 0.6, y + 1.1, R, C.shadow, 0.4)               // soft seat shadow
  ci(s, x, y, R, C.solderMid, 1)                          // outer solder fillet (darker tin)
  ci(s, x, y, R * 0.82, C.pad, 1)                         // bright tin annular ring
  ci(s, x, y, R * 0.44, C.solderMid, 1)                   // concave dip toward the lead
  ci(s, x, y, R * 0.27, C.wire, 1)                        // cut silver lead in the joint
  ci(s, x - R * 0.3, y - R * 0.32, R * 0.34, C.white, 0.275) // concave specular catch-light (top-left)
}
/** Pseudo-3D disc from top: cast shadow → side wall → top face → rim shade → highlight. */
function topDisc(s: ShapeSpec[], cx: number, cy: number, rad: number, color: number, wall = 3): void {
  ci(s, cx + 2.5, cy + 4.5, rad, C.shadow, 0.45)
  ci(s, cx, cy + wall, rad, color, 1); ci(s, cx, cy + wall, rad, C.shadow, 0.5)  // darker side wall
  ci(s, cx, cy, rad, color, 1)
  ci(s, cx + rad * 0.28, cy + rad * 0.3, rad * 0.6, C.shadow, 0.22)              // bottom-right cylinder shade
  ci(s, cx - rad * 0.3, cy - rad * 0.32, rad * 0.46, C.white, 0.11)             // top-left highlight
}
/** Pseudo-3D box from top: cast shadow → side wall → top face → edge shade → highlight band. */
function topBox(s: ShapeSpec[], x: number, y: number, w: number, h: number, color: number, rad = 2, wall = 3): void {
  rr(s, x + 2, y + 4.5, w, h, rad, C.shadow, 0.45)
  rr(s, x, y + wall, w, h, rad, color, 1); rr(s, x, y + wall, w, h, rad, C.shadow, 0.5)  // darker side wall
  rr(s, x, y, w, h, rad, color, 1)
  rr(s, x, y + h * 0.62, w, h * 0.38, rad, C.shadow, 0.18)                        // bottom edge shade (volume)
  rr(s, x + w * 0.08, y + h * 0.1, w * 0.62, Math.max(1.5, h * 0.18), rad, C.white, 0.1) // top highlight band
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
      return [{ x: cx - dx, y: cy }, { x: cx + dx, y: cy }]
    case 'crystalHC49': return [{ x: cx - W * 0.3, y: cy }, { x: cx + W * 0.3, y: cy }]
    case 'trimpot': return [{ x: cx - dx * 1.4, y: cy }, { x: cx + dx * 1.4, y: cy }]
    case 'to92': case 'to220': return [{ x: cx - pitch * 0.8, y: py }, { x: cx, y: py }, { x: cx + pitch * 0.8, y: py }]
    case 'battery9v': { const bw = W * 0.8, bx = cx - bw / 2, by = pitch * 0.6; return [{ x: bx + bw * 0.34, y: by }, { x: bx + bw * 0.67, y: by }] }
    case 'batteryClip': return [{ x: cx - dx * 1.4, y: cy }, { x: cx + dx * 1.4, y: cy }]
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

// helper: short lead wire entering a pad from the body — two-tone for a rounded metallic look
function leadWire(s: ShapeSpec[], fromX: number, fromY: number, toX: number, toY: number, p: number): void {
  ln(s, fromX, fromY, toX, toY, Math.max(2.2, p * 0.18), C.solderMid, 0.95) // wire body (darker tin)
  ln(s, fromX, fromY, toX, toY, Math.max(1, p * 0.08), C.solder, 0.475)      // bright centre highlight
}

function silkLabel(s: ShapeSpec[], ref: string | undefined, cx: number, y: number, p: number): void {
  if (!ref) return
  const size = Math.max(5.5, p * 0.28)
  s.push({ type: 'text', x: cx, y: y - size - 0.5, text: ref, size, color: C.silk, align: 'center' })
}

export function buildVintageShapes(kind: VintageKind, pitch: number, opts: VintageOpts = {}): ShapeSpec[] {
  const s: ShapeSpec[] = []
  const fp = VFOOT[kind], W = fp.w * pitch, H = fp.h * pitch, cx = W / 2, cy = H / 2
  const py = PY(H, pitch), dx = PDX(pitch)

  switch (kind) {
    case 'resAxial': case 'inductorAxial': case 'diodeAxial': {
      const bodyW = kind === 'diodeAxial' ? W * 0.5 : W * 0.6, bh = H * 0.5, bx = cx - bodyW / 2, by = cy - bh / 2
      rr(s, bx - 1.5, by - 1.5, bodyW + 3, bh + 3, 2, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, by, pitch)
      leadWire(s, bx, cy, 2, cy, pitch); padHole(s, 2, cy, pitch)
      leadWire(s, bx + bodyW, cy, W - 2, cy, pitch); padHole(s, W - 2, cy, pitch)
      const body = kind === 'resAxial' ? C.resTan : kind === 'inductorAxial' ? 0x2f7d6a : C.diodeBody
      topBox(s, bx, by, bodyW, bh, body, bh / 2)
      r(s, bx, by + bh * 0.12, bodyW, bh * 0.18, C.white, 0.075)
      if (kind === 'diodeAxial') r(s, bx + bodyW * 0.76, by + bh * 0.08, bodyW * 0.1, bh * 0.84, C.diodeBand, 0.95)
      else (kind === 'resAxial' ? BANDS : [0x2f7d6a, 0xc8a84c, 0x6b3a12].map((c) => dim(c))).forEach((col, i) =>
        r(s, bx + bodyW * (0.22 + i * 0.16), by + bh * 0.08, bodyW * 0.08, bh * 0.84, col, 0.95))
      return s
    }

    case 'ceramicDisc': case 'tantalum': {
      const bw = W * 0.6, bh = H * 0.28, bx = cx - bw / 2, by = cy - bh / 2
      rr(s, bx - 1.5, by - 1.5, bw + 3, bh + 3, 2, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, by, pitch)
      leadWire(s, bx, cy, cx - dx, cy, pitch); padHole(s, cx - dx, cy, pitch)
      leadWire(s, bx + bw, cy, cx + dx, cy, pitch); padHole(s, cx + dx, cy, pitch)
      topBox(s, bx, by, bw, bh, kind === 'tantalum' ? C.tantal : C.disc, bh / 2, 2)
      if (kind === 'tantalum') r(s, bx + bw * 0.7, by + bh * 0.2, bw * 0.1, bh * 0.6, C.shadow, 0.4)
      s.push({ type: 'text', x: cx, y: by + bh * 0.15, text: kind === 'tantalum' ? '+' : '104', size: Math.max(4, bh * 0.45), color: 0x4a3212, align: 'center' })
      return s
    }

    case 'filmCap': {
      const bw = W * 0.74, bh = H * 0.45, bx = cx - bw / 2, by = cy - bh / 2
      rr(s, bx - 1.5, by - 1.5, bw + 3, bh + 3, 2, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, by, pitch)
      leadWire(s, bx, cy, cx - dx, cy, pitch); padHole(s, cx - dx, cy, pitch)
      leadWire(s, bx + bw, cy, cx + dx, cy, pitch); padHole(s, cx + dx, cy, pitch)
      topBox(s, bx, by, bw, bh, C.filmRed, 2, 2)
      s.push({ type: 'text', x: cx, y: by + bh * 0.25, text: '224K', size: Math.max(5, bh * 0.35), color: 0xd8dee0, align: 'center' })
      return s
    }

    case 'electroRadial': {
      const rad = W * 0.44
      ci(s, cx, cy, rad + 1.5, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, cy - rad, pitch)
      padHole(s, cx - dx, cy, pitch); padHole(s, cx + dx, cy, pitch)
      topDisc(s, cx, cy, rad, C.elecBlue, 4)
      ln(s, cx - rad * 0.5, cy, cx + rad * 0.5, cy, 1.6, C.elecTop, 0.85)         // vent cross
      ln(s, cx, cy - rad * 0.5, cx, cy + rad * 0.5, 1.6, C.elecTop, 0.85)
      r(s, cx + rad * 0.5, cy - rad * 0.15, rad * 0.34, rad * 0.3, C.stripe, 0.9)   // − mark on rim
      s.push({ type: 'text', x: cx + rad * 0.67, y: cy - 3, text: '-', size: Math.max(5, rad * 0.5), color: 0x222222, align: 'center' })
      return s
    }

    case 'led5mm': {
      const col = opts.color ?? C.ledRed, on = opts.on ?? true
      const rad = W * 0.42
      ci(s, cx, cy, rad + 1.5, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, cy - rad, pitch)
      padHole(s, cx - dx, cy, pitch); padHole(s, cx + dx, cy, pitch)
      const lfy = cy + rad * 0.15
      r(s, cx - rad * 0.35, lfy - rad * 0.3, rad * 0.3, rad * 0.4, 0x8a9290, 0.8) // cathode
      ln(s, cx + rad * 0.15, lfy + rad * 0.1, cx + rad * 0.15, lfy - rad * 0.2, 1.2, 0x8a9290, 0.8) // anode
      // no outer glow halo — LED reads as a small dome + darker rim only (no additive ring)
      ci(s, cx + 2, cy + 4, rad, C.shadow, 0.4)
      ci(s, cx, cy, rad, col, on ? 0.92 : 0.5)
      r(s, cx + rad * 0.7, cy - rad * 0.7, rad * 0.4, rad * 1.4, C.shadow, 0.5) // clip shadow
      if (on) ci(s, cx, cy, rad * 0.45, 0xffffff, 0.46); else ci(s, cx, cy, rad * 0.5, C.shadow, 0.3)
      ci(s, cx - rad * 0.32, cy - rad * 0.32, rad * 0.3, C.white, on ? 0.3 : 0.15)
      return s
    }

    case 'trimpot': {
      const px = [cx - dx * 1.4, cx + dx * 1.4]; 
      const bw = W * 0.78, bh = H * 0.6, bx = cx - bw / 2, by = cy - bh / 2
      rr(s, bx - 1.5, by - 1.5, bw + 3, bh + 3, 2, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, by, pitch)
      px.forEach((x) => padHole(s, x, cy, pitch))
      topBox(s, bx, by, bw, bh, C.trim, 2)
      ci(s, cx, cy, bw * 0.28, C.brass, 1)
      ln(s, cx - bw * 0.2, cy, cx + bw * 0.2, cy, 2, C.shadow, 0.7)
      return s
    }

    case 'crystalHC49': {
      const bw = W * 0.74, bh = H * 0.45, bx = cx - bw / 2, by = cy - bh / 2
      rr(s, bx - 1.5, by - 1.5, bw + 3, bh + 3, 2, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, by, pitch)
      leadWire(s, bx, cy, cx - W * 0.3, cy, pitch); padHole(s, cx - W * 0.3, cy, pitch)
      leadWire(s, bx + bw, cy, cx + W * 0.3, cy, pitch); padHole(s, cx + W * 0.3, cy, pitch)
      topBox(s, bx, by, bw, bh, C.can, bh * 0.5)
      s.push({ type: 'text', x: cx, y: by + bh * 0.22, text: '16.000', size: Math.max(5, bh * 0.35), color: 0x5e6f63, align: 'center' })
      return s
    }

    case 'to92': {
      const px = [cx - pitch * 0.8, cx, cx + pitch * 0.8]; 
      const bw = W * 0.7, bh = H * 0.52, bx = cx - bw / 2, by = py - bh - pitch * 0.15
      rr(s, bx - 1.5, by - 1.5, bw + 3, bh + 3, bw * 0.45, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, by, pitch)
      px.forEach((x) => leadWire(s, x, by + bh, x, py, pitch)); px.forEach((x) => padHole(s, x, py, pitch))
      rr(s, bx + 2, by + 4, bw, bh, bw * 0.45, C.shadow, 0.4)
      rr(s, bx, by + 3, bw, bh, bw * 0.45, C.to92, 1); r(s, bx, by + bh * 0.5, bw, bh * 0.5 + 3, C.to92, 1)
      rr(s, bx, by, bw, bh, bw * 0.45, C.to92, 1); r(s, bx, by + bh * 0.5, bw, bh * 0.5, C.to92, 1)
      rr(s, bx + bw * 0.2, by + bh * 0.1, bw * 0.5, bh * 0.16, 2, C.white, 0.07)
      s.push({ type: 'text', x: cx, y: by + bh * 0.25, text: 'BC547', size: Math.max(5, bh * 0.4), color: 0x8a948c, align: 'center' })
      return s
    }

    case 'to220': {
      const px = [cx - pitch * 0.8, cx, cx + pitch * 0.8]; 
      const bw = W * 0.8, bx = cx - bw / 2, tabH = H * 0.24, bodyH = H * 0.4, by = pitch * 0.4 + tabH
      rr(s, bx - 1.5, pitch * 0.4 - 1.5, bw + 3, tabH + bodyH + 3, 2, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, pitch * 0.4, pitch)
      px.forEach((x) => leadWire(s, x, by + bodyH, x, py, pitch)); px.forEach((x) => padHole(s, x, py, pitch))
      topBox(s, bx, pitch * 0.4, bw, tabH, C.tab, 2)
      ci(s, cx, pitch * 0.4 + tabH * 0.5, tabH * 0.3, C.shadow, 0.9)
      topBox(s, bx, by, bw, bodyH, C.to220, 2)
      s.push({ type: 'text', x: cx, y: by + bodyH * 0.22, text: 'LM7805', size: Math.max(5, bodyH * 0.4), color: 0x8a948c, align: 'center' })
      return s
    }

    case 'dipIC': {
      const bw = W * 0.84, bh = H * 0.62, bx = cx - bw / 2, by = cy - bh / 2, pins = 7
      rr(s, bx - 1.5, by - 1.5, bw + 3, bh + 3, 3, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, by, pitch)
      for (let i = 0; i < pins; i++) {
        const px = bx + bw * (0.1 + (i / (pins - 1)) * 0.8)
        leadWire(s, px, by, px, by - pitch * 0.35, pitch); padHole(s, px, by - pitch * 0.35, pitch)
        leadWire(s, px, by + bh, px, by + bh + pitch * 0.35, pitch); padHole(s, px, by + bh + pitch * 0.35, pitch)
      }
      topBox(s, bx, by, bw, bh, C.dip, 3)
      ci(s, bx + bw * 0.12, cy, bw * 0.05, C.silk, 0.85)
      s.push({ type: 'circle', x: bx + bw * 0.5, y: by, r: bw * 0.06, color: C.shadow, alpha: 0.85 })
      s.push({ type: 'text', x: cx, y: cy - 3, text: 'LM324N', size: Math.max(6, bh * 0.3), color: 0x7e8884, align: 'center' })
      return s
    }

    case 'battery9v': {
      const bw = W * 0.8, bh = H * 0.84, bx = cx - bw / 2, by = pitch * 0.6
      rr(s, bx - 1.5, by - 1.5, bw + 3, bh + 3, 4, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, by, pitch)
      topBox(s, bx, by, bw, bh, C.battBody, 4)
      rr(s, bx + bw * 0.12, by + bh * 0.3, bw * 0.76, bh * 0.4, 2, C.battLabel, 1)
      s.push({ type: 'text', x: cx, y: by + bh * 0.38, text: '6F22 9V', size: Math.max(6, bh * 0.15), color: 0xffffff, align: 'center' })
      padHole(s, bx + bw * 0.34, by, pitch); padHole(s, bx + bw * 0.67, by, pitch)
      return s
    }

    case 'batteryClip': {
      const px = [cx - dx * 1.4, cx + dx * 1.4]; 
      const bw = W * 0.86, bh = H * 0.6, bx = cx - bw / 2, by = cy - bh / 2
      rr(s, bx - 1.5, by - 1.5, bw + 3, bh + 3, 3, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, by, pitch)
      px.forEach((x) => padHole(s, x, cy, pitch))
      topBox(s, bx, by, bw, bh, C.term, 3)
      const lx = bx + bw * 0.3, rx = bx + bw * 0.7
      ci(s, lx, cy, bw * 0.12, C.jackRing, 1); ci(s, rx, cy, bw * 0.12, C.jackRing, 1)
      ln(s, lx - 4, cy, lx + 4, cy, 1.5, C.shadow, 0.85); ln(s, lx, cy - 4, lx, cy + 4, 1.5, C.shadow, 0.85) // + screw
      ln(s, rx - 4, cy, rx + 4, cy, 1.5, C.shadow, 0.85)                                                     // − screw
      ln(s, lx - 3, by - 4, lx + 3, by - 4, 1.6, C.silk, 0.9); ln(s, lx, by - 7, lx, by - 1, 1.6, C.silk, 0.9) // silk +
      ln(s, rx - 3, by - 4, rx + 3, by - 4, 1.6, C.silk, 0.9)                                                  // silk −
      return s
    }

    case 'powerJack': {
      const bw = W * 0.62, bh = H * 0.56, bx = cx - bw / 2
      rr(s, bx - 1.5, cy - bh / 2 - 1.5, bw + 3, bh + 3, 3, C.silk, 0.35)
      silkLabel(s, opts.ref, cx, cy - bh / 2, pitch)
      leadWire(s, cx, cy + bh / 2, cx, py, pitch); padHole(s, cx, py, pitch)
      leadWire(s, bx, cy, 2, cy, pitch); padHole(s, 2, cy, pitch)
      leadWire(s, bx + bw, cy, W - 2, cy, pitch); padHole(s, W - 2, cy, pitch)
      topBox(s, bx, cy - bh / 2, bw, bh, C.jackBody, 3)
      ci(s, cx, cy, bh * 0.38, C.jackRing, 1); ci(s, cx, cy, bh * 0.2, C.shadow, 1); ci(s, cx, cy, bh * 0.07, C.jackRing, 1)
      return s
    }
  }
  return s
}
