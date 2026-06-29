// Vintage through-hole component renderer (hand-soldered look): axial/radial parts with visible
// wire leads + solder joints, cylindrical shading, vintage colors. Returns ShapeSpec[] (same union
// as decorBuilder) drawn at origin (0,0). See docs/design/through-hole-components.md.
import type { ShapeSpec } from './decorBuilder'

export type VintageKind =
  | 'resAxial' | 'diodeAxial' | 'inductorAxial'
  | 'ceramicDisc' | 'filmCap' | 'electroRadial' | 'tantalum' | 'led5mm' | 'trimpot'
  | 'to92' | 'to220' | 'crystalHC49' | 'dipIC'

// footprint in grid cells (fractional ok)
export const VFOOT: Record<VintageKind, { w: number; h: number }> = {
  resAxial: { w: 5, h: 1.6 }, diodeAxial: { w: 4, h: 1.6 }, inductorAxial: { w: 5, h: 1.8 },
  ceramicDisc: { w: 2, h: 2.6 }, filmCap: { w: 2.6, h: 2.6 }, electroRadial: { w: 3, h: 4.2 },
  tantalum: { w: 2, h: 2.6 }, led5mm: { w: 2, h: 2.6 }, trimpot: { w: 2.6, h: 2.6 },
  to92: { w: 2.6, h: 3 }, to220: { w: 3, h: 4.2 }, crystalHC49: { w: 4, h: 2.2 }, dipIC: { w: 6, h: 3 },
}

const C = {
  wire: 0xb8c0c0, solder: 0xe4eaea, solderMid: 0x7e8884, shadow: 0x000000, white: 0xffffff,
  resTan: 0xc8a86a, resBlue: 0x7fb8c8,
  disc: 0xcf8a3c, filmRed: 0xb83a2e, boxBlue: 0x2f5fa8,
  elecBlue: 0x223f86, elecTop: 0x0e1116, stripe: 0xd8dee0,
  tantal: 0xd8b13a, to92: 0x171717, to220: 0x161616, tab: 0x9aa3a0,
  diodeBody: 0x171717, diodeBand: 0xcdd2cf, ledRed: 0xe23a3a, trim: 0x2f5fa8, brass: 0xc8a84c,
  can: 0x9aa3a0, dip: 0x141414, silk: 0xc9d2cc,
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
/** Silver wire lead + solder joint at the pad end (px). */
function lead(s: ShapeSpec[], x1: number, y1: number, x2: number, y2: number, p: number): void {
  ln(s, x1, y1, x2, y2, Math.max(1.5, p * 0.1), C.wire, 1)
  ci(s, x2, y2, p * 0.16, C.solder, 1)
  ci(s, x2, y2, p * 0.07, C.solderMid, 1)
}
/** Horizontal cylinder body: rounded-end fill + top highlight + bottom shadow. */
function cylH(s: ShapeSpec[], x: number, y: number, w: number, h: number, color: number): void {
  rr(s, x + 1, y + 2, w, h, h / 2, C.shadow, 0.4)        // drop shadow
  rr(s, x, y, w, h, h / 2, color, 1)
  rr(s, x + h * 0.4, y + h * 0.12, w - h * 0.8, h * 0.22, h * 0.1, C.white, 0.22) // top highlight
  rr(s, x + h * 0.4, y + h * 0.66, w - h * 0.8, h * 0.22, h * 0.1, C.shadow, 0.28) // bottom shadow
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
    case 'dipIC': {
      const bw = W * 0.84, bh = H * 0.6, bx = cx - bw / 2, by = cy - bh / 2, pins = 7, out: { x: number; y: number }[] = []
      for (let i = 0; i < pins; i++) { const px = bx + bw * (0.1 + (i / (pins - 1)) * 0.8); out.push({ x: px, y: by - H * 0.18 }, { x: px, y: by + bh + H * 0.18 }) }
      return out
    }
  }
  return []
}

export function buildVintageShapes(kind: VintageKind, pitch: number): ShapeSpec[] {
  const s: ShapeSpec[] = []
  const fp = VFOOT[kind]
  const W = fp.w * pitch, H = fp.h * pitch
  const cx = W / 2, cy = H / 2

  switch (kind) {
    case 'resAxial':
    case 'inductorAxial':
    case 'diodeAxial': {
      const bodyW = kind === 'diodeAxial' ? W * 0.5 : W * 0.62
      const bh = H * 0.5
      const bx = cx - bodyW / 2, by = cy - bh / 2
      lead(s, bx, cy, 2, cy, pitch)                 // left lead
      lead(s, bx + bodyW, cy, W - 2, cy, pitch)     // right lead
      const body = kind === 'resAxial' ? C.resTan : kind === 'inductorAxial' ? 0x2f7d6a : C.diodeBody
      cylH(s, bx, by, bodyW, bh, body)
      if (kind === 'diodeAxial') {
        r(s, bx + bodyW * 0.78, by, bodyW * 0.1, bh, C.diodeBand, 0.95) // cathode band
      } else {
        const cols = kind === 'resAxial' ? BANDS : [0x2f7d6a, 0xc8a84c, 0x6b3a12]
        cols.forEach((col, i) => r(s, bx + bodyW * (0.22 + i * 0.16), by + bh * 0.06, bodyW * 0.08, bh * 0.88, col, 0.95))
      }
      return s
    }

    case 'ceramicDisc': {
      lead(s, cx - W * 0.16, cy, cx - W * 0.16, H - 2, pitch)
      lead(s, cx + W * 0.16, cy, cx + W * 0.16, H - 2, pitch)
      const rad = W * 0.42
      ci(s, cx, cy - H * 0.12, rad, C.shadow, 0.35)
      ci(s, cx, cy - H * 0.16, rad, C.disc, 1)
      ci(s, cx - rad * 0.3, cy - H * 0.16 - rad * 0.3, rad * 0.35, C.white, 0.22) // highlight
      return s
    }

    case 'filmCap': {
      lead(s, cx - W * 0.18, cy + H * 0.1, cx - W * 0.18, H - 2, pitch)
      lead(s, cx + W * 0.18, cy + H * 0.1, cx + W * 0.18, H - 2, pitch)
      const bw = W * 0.74, bh = H * 0.6, bx = cx - bw / 2, by = cy - bh * 0.7
      rr(s, bx + 1, by + 2, bw, bh, bw * 0.18, C.shadow, 0.4)
      rr(s, bx, by, bw, bh, bw * 0.18, C.filmRed, 1)
      rr(s, bx + bw * 0.12, by + bh * 0.12, bw * 0.5, bh * 0.18, 2, C.white, 0.18)
      return s
    }

    case 'electroRadial': {
      lead(s, cx - W * 0.18, H * 0.8, cx - W * 0.18, H - 2, pitch)
      lead(s, cx + W * 0.18, H * 0.8, cx + W * 0.18, H - 2, pitch)
      const bw = W * 0.8, bh = H * 0.82, bx = cx - bw / 2, by = 2
      rr(s, bx + 2, by + 2, bw, bh, bw * 0.18, C.shadow, 0.45)
      rr(s, bx, by, bw, bh, bw * 0.18, C.elecBlue, 1)
      r(s, bx + bw * 0.78, by + bh * 0.08, bw * 0.16, bh * 0.84, C.stripe, 0.9) // negative stripe
      rr(s, bx, by, bw, bh * 0.18, bw * 0.18, C.elecTop, 1)                     // dark top
      ln(s, cx - bw * 0.18, by + bh * 0.09, cx + bw * 0.18, by + bh * 0.09, 1.5, C.stripe, 0.7) // vent
      ln(s, cx, by + bh * 0.02, cx, by + bh * 0.16, 1.5, C.stripe, 0.7)
      rr(s, bx + bw * 0.12, by + bh * 0.22, bw * 0.16, bh * 0.6, 2, C.white, 0.16) // highlight
      return s
    }

    case 'tantalum': {
      lead(s, cx - W * 0.16, cy + H * 0.2, cx - W * 0.16, H - 2, pitch)
      lead(s, cx + W * 0.16, cy + H * 0.2, cx + W * 0.16, H - 2, pitch)
      const bw = W * 0.7, bh = H * 0.6
      rr(s, cx - bw / 2, cy - bh * 0.6, bw, bh, bw * 0.4, C.tantal, 1)
      r(s, cx - bw / 2, cy - bh * 0.55, bw * 0.12, bh * 0.9, C.shadow, 0.3)
      r(s, cx + bw * 0.32, cy - bh * 0.55, bw * 0.1, bh * 0.5, C.shadow, 0.4) // + mark
      return s
    }

    case 'led5mm': {
      lead(s, cx - W * 0.14, cy + H * 0.15, cx - W * 0.14, H - 2, pitch)
      lead(s, cx + W * 0.14, cy + H * 0.15, cx + W * 0.14, H - 2, pitch)
      const rad = W * 0.4
      r(s, cx - rad, cy + rad * 0.5, rad * 2, rad * 0.5, C.ledRed, 0.5) // flange
      ci(s, cx, cy, rad, C.ledRed, 0.85)
      ci(s, cx, cy, rad * 0.45, 0xffd0d0, 0.95)                          // emissive core
      ci(s, cx - rad * 0.3, cy - rad * 0.35, rad * 0.25, C.white, 0.5)   // dome highlight
      return s
    }

    case 'trimpot': {
      const bw = W * 0.8, bh = H * 0.8, bx = cx - bw / 2, by = cy - bh / 2
      lead(s, bx + bw * 0.2, by + bh, bx + bw * 0.2, H - 2, pitch)
      lead(s, bx + bw * 0.8, by + bh, bx + bw * 0.8, H - 2, pitch)
      rr(s, bx + 2, by + 2, bw, bh, 2, C.shadow, 0.4)
      rr(s, bx, by, bw, bh, 2, C.trim, 1)
      ci(s, cx, cy, bw * 0.3, C.brass, 1)                  // screw
      ln(s, cx - bw * 0.22, cy, cx + bw * 0.22, cy, 2, C.shadow, 0.7) // slot
      return s
    }

    case 'to92': {
      const bw = W * 0.72, bh = H * 0.62, bx = cx - bw / 2, by = 2
      lead(s, bx + bw * 0.18, by + bh, bx + bw * 0.18, H - 2, pitch)
      lead(s, cx, by + bh, cx, H - 2, pitch)
      lead(s, bx + bw * 0.82, by + bh, bx + bw * 0.82, H - 2, pitch)
      // D-shape: rounded back + flat front (bottom)
      rr(s, bx + 2, by + 2, bw, bh, bw * 0.42, C.shadow, 0.4)
      rr(s, bx, by, bw, bh, bw * 0.42, C.to92, 1)
      r(s, bx, by + bh * 0.5, bw, bh * 0.5, C.to92, 1)     // flatten the front
      rr(s, bx + bw * 0.2, by + bh * 0.12, bw * 0.5, bh * 0.16, 2, C.white, 0.14)
      return s
    }

    case 'to220': {
      const bw = W * 0.8, bx = cx - bw / 2
      const tabH = H * 0.3, bodyH = H * 0.42, by = 2 + tabH
      lead(s, bx + bw * 0.18, by + bodyH, bx + bw * 0.18, H - 2, pitch)
      lead(s, cx, by + bodyH, cx, H - 2, pitch)
      lead(s, bx + bw * 0.82, by + bodyH, bx + bw * 0.82, H - 2, pitch)
      rr(s, bx, 2, bw, tabH, 2, C.tab, 1)                  // metal heatsink tab
      ci(s, cx, 2 + tabH * 0.5, tabH * 0.28, C.shadow, 0.8) // mounting hole
      r(s, bx + 2, 2, bw - 4, tabH * 0.3, C.white, 0.18)
      rr(s, bx, by, bw, bodyH, 2, C.to220, 1)              // black body
      r(s, bx + bw * 0.12, by + bodyH * 0.18, bw * 0.5, bodyH * 0.2, C.white, 0.1)
      return s
    }

    case 'crystalHC49': {
      lead(s, cx - W * 0.22, cy + H * 0.2, cx - W * 0.22, H - 2, pitch)
      lead(s, cx + W * 0.22, cy + H * 0.2, cx + W * 0.22, H - 2, pitch)
      const bw = W * 0.7, bh = H * 0.62
      rr(s, cx - bw / 2 + 2, cy - bh / 2 + 2, bw, bh, bh * 0.5, C.shadow, 0.4)
      rr(s, cx - bw / 2, cy - bh / 2, bw, bh, bh * 0.5, C.can, 1)
      rr(s, cx - bw * 0.3, cy - bh * 0.3, bw * 0.5, bh * 0.22, 2, C.white, 0.22)
      return s
    }

    case 'dipIC': {
      const bw = W * 0.84, bh = H * 0.6, bx = cx - bw / 2, by = cy - bh / 2
      const pins = 7
      for (let i = 0; i < pins; i++) {
        const px = bx + bw * (0.1 + (i / (pins - 1)) * 0.8)
        lead(s, px, by, px, by - H * 0.18, pitch)
        lead(s, px, by + bh, px, by + bh + H * 0.18, pitch)
      }
      rr(s, bx + 2, by + 2, bw, bh, 3, C.shadow, 0.45)
      rr(s, bx, by, bw, bh, 3, C.dip, 1)
      ci(s, bx + bw * 0.14, by + bh * 0.5, bw * 0.06, C.silk, 0.8) // pin-1 dot
      // notch
      s.push({ type: 'circle', x: bx + bw * 0.5, y: by, r: bw * 0.06, color: C.shadow, alpha: 0.8 })
      r(s, bx + bw * 0.1, by + bh * 0.16, bw * 0.5, bh * 0.12, C.white, 0.08)
      return s
    }
  }
  return s
}
