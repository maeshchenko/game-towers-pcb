import type { DecorItem } from '../model/level'
import { PALETTE } from '../style/palette'

// ---------- ShapeSpec discriminated union ----------
export type ShapeSpec =
  | { type: 'rect';   x: number; y: number; w: number; h: number; color: number; alpha: number }
  | { type: 'circle'; x: number; y: number; r: number; color: number; alpha: number }
  | { type: 'line';   x1: number; y1: number; x2: number; y2: number; width: number; color: number; alpha: number }
  | { type: 'text';   x: number; y: number; text: string; size: number; color: number; align?: 'left' | 'center' }

// ---------- Footprint table (grid cells W × H) ----------
const FOOTPRINT: Record<string, { w: number; h: number }> = {
  soic:         { w: 3, h: 2 },
  qfp:          { w: 4, h: 4 },
  qfn:          { w: 3, h: 3 },
  dip:          { w: 5, h: 2 },
  electrolytic: { w: 2, h: 2 },
  elec:         { w: 2, h: 2 },
  smdRes:       { w: 2, h: 1 },
  res:          { w: 2, h: 1 },
  smdCap:       { w: 1, h: 1 },
  mlcc:         { w: 1, h: 1 },
  via:          { w: 1, h: 1 },
  tant:         { w: 2, h: 1 },
  tantalum:     { w: 2, h: 1 },
  diode:        { w: 2, h: 1 },
  led:          { w: 1, h: 1 },
  sot23:        { w: 2, h: 2 },
  crystal:      { w: 2, h: 2 },
  xtal:         { w: 2, h: 2 },
  inductor:     { w: 2, h: 1 },
  pwrind:       { w: 3, h: 3 },
  testpoint:    { w: 1, h: 1 },
  mount:        { w: 2, h: 2 },
  header:       { w: 2, h: 1 },  // variant overrides column count
}

// ---------- Drawing helpers ----------
const SILK  = PALETTE.silkWhite
const GOLD  = PALETTE.padGold
const SPAD  = PALETTE.padSilver
const SHD   = 0x000000

function rect(shapes: ShapeSpec[], x: number, y: number, w: number, h: number, color: number, alpha: number): void {
  shapes.push({ type: 'rect', x, y, w, h, color, alpha })
}

function circle(shapes: ShapeSpec[], x: number, y: number, r: number, color: number, alpha: number): void {
  shapes.push({ type: 'circle', x, y, r, color, alpha })
}

/** Thin white silkscreen outline (4 lines, inset from body edges). */
function silkRect(shapes: ShapeSpec[], x: number, y: number, w: number, h: number, inset = 2): void {
  const xi = x + inset, yi = y + inset, xe = x + w - inset, ye = y + h - inset
  const lw = 0.8, a = 0.85
  shapes.push({ type: 'line', x1: xi, y1: yi, x2: xe, y2: yi, width: lw, color: SILK, alpha: a })
  shapes.push({ type: 'line', x1: xe, y1: yi, x2: xe, y2: ye, width: lw, color: SILK, alpha: a })
  shapes.push({ type: 'line', x1: xe, y1: ye, x2: xi, y2: ye, width: lw, color: SILK, alpha: a })
  shapes.push({ type: 'line', x1: xi, y1: ye, x2: xi, y2: yi, width: lw, color: SILK, alpha: a })
}

/** Fake-3D body: drop-shadow → body fill → top bevel → bottom bevel. */
function chipBody(shapes: ShapeSpec[], x: number, y: number, w: number, h: number, color: number): void {
  rect(shapes, x + 2, y + 3, w, h, SHD, 0.45)                                      // drop-shadow
  rect(shapes, x, y, w, h, color, 1)                                                 // body
  rect(shapes, x, y, w, Math.max(1, h * 0.15), 0xffffff, 0.08)                      // top bevel light
  rect(shapes, x, y + h - Math.max(1, h * 0.15), w, Math.max(1, h * 0.15), SHD, 0.25) // bottom bevel dark
}

function specular(shapes: ShapeSpec[], x: number, y: number, w: number, h: number): void {
  rect(shapes, x + w * 0.1, y + h * 0.1, w * 0.3, h * 0.1, 0xffffff, 0.12)
}

/** Small white dot marking pin 1. */
function pin1Dot(shapes: ShapeSpec[], x: number, y: number, r = 2): void {
  circle(shapes, x, y, r, SILK, 0.9)
}

/** Designator text placed just above the body top-left (only if item.ref is set).
 *  Small silkscreen size — stays in the margin above the part, left-aligned. */
function designator(shapes: ShapeSpec[], item: DecorItem, bx: number, by: number, pitch: number): void {
  if (!item.ref) return
  const size = Math.max(6, pitch * 0.32)
  shapes.push({ type: 'text', x: bx, y: by - size - 1, text: item.ref, size, color: SILK, align: 'left' })
}

/** Two SMD end pads (silver) on left/right sides of body. */
function endPads(shapes: ShapeSpec[], x: number, y: number, w: number, h: number): void {
  const pw = w * 0.2
  rect(shapes, x - pw * 0.5,     y + h * 0.15, pw, h * 0.7, SPAD, 0.9)
  rect(shapes, x + w - pw * 0.5, y + h * 0.15, pw, h * 0.7, SPAD, 0.9)
}

/** Standard passive 2-terminal SMD component (body + end pads + silk + specular + ref). */
function passive2T(shapes: ShapeSpec[], item: DecorItem, x: number, y: number, w: number, h: number, bodyColor: number, pitch: number): void {
  chipBody(shapes, x, y, w, h, bodyColor)
  endPads(shapes, x, y, w, h)
  silkRect(shapes, x, y, w, h)
  specular(shapes, x, y, w, h)
  designator(shapes, item, x, y, pitch)
}

// ---------- Footprint helper (exported for placement) ----------
/**
 * Returns the grid footprint in CELLS for the given kind/variant/rotation.
 * Accounts for rotation swapping w↔h and header pin-count scaling via variant.
 */
export function footprintCells(kind: string, variant: number, rot: 0 | 90 | 180 | 270): { w: number; h: number } {
  let base = FOOTPRINT[kind] ?? { w: 2, h: 2 }
  // header width scales with variant (pin count)
  if (kind === 'header') {
    const pins = Math.max(2, variant || 4)
    base = { w: pins, h: 1 }
  }
  const rotated = rot === 90 || rot === 270
  return rotated ? { w: base.h, h: base.w } : { w: base.w, h: base.h }
}

// ---------- Main builder ----------
export function buildDecorShapes(item: DecorItem, pitch: number): ShapeSpec[] {
  const fp   = FOOTPRINT[item.kind] ?? { w: 2, h: 2 }
  const rotated = item.rot === 90 || item.rot === 270
  const fw   = (rotated ? fp.h : fp.w) * item.scale
  const fh   = (rotated ? fp.w : fp.h) * item.scale
  const w    = fw * pitch
  const h    = fh * pitch
  const x    = item.cell[0] * pitch
  const y    = item.cell[1] * pitch
  const shapes: ShapeSpec[] = []

  switch (item.kind) {

    // ── via ──────────────────────────────────────────────────────────────────
    case 'via': {
      const cx = x + w / 2, cy = y + h / 2
      circle(shapes, cx, cy, w * 0.42, GOLD, 1)
      circle(shapes, cx, cy, w * 0.20, PALETTE.substrate, 1)
      return shapes
    }

    // ── mount ─────────────────────────────────────────────────────────────────
    case 'mount': {
      const cx = x + w / 2, cy = y + h / 2
      // Modest ring: ~1.5-cell visual diameter (r ≈ 0.375 × footprint side)
      const r = Math.min(w, h) * 0.375
      circle(shapes, cx + 2, cy + 2, r, SHD, 0.4)
      circle(shapes, cx, cy, r, SPAD, 0.9)
      circle(shapes, cx, cy, r * 0.55, PALETTE.substrate, 1)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── testpoint ─────────────────────────────────────────────────────────────
    case 'testpoint': {
      const cx = x + w / 2, cy = y + h / 2
      circle(shapes, cx, cy, w * 0.40, GOLD, 1)
      circle(shapes, cx, cy, w * 0.17, PALETTE.substrate, 0.7)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── electrolytic / elec ───────────────────────────────────────────────────
    case 'electrolytic':
    case 'elec': {
      const cx = x + w / 2, cy = y + h / 2
      const r = Math.min(w, h) * 0.46
      circle(shapes, cx + 2, cy + 2, r, SHD, 0.45)
      circle(shapes, cx, cy, r, PALETTE.elecCan, 1)            // silver aluminium can
      circle(shapes, cx, cy, r * 0.80, 0x222222, 1)            // dark phenolic sleeve
      // polarity marker: white bar at top
      rect(shapes, cx - r * 0.5, cy - r, r, r * 0.22, SILK, 0.85)
      circle(shapes, cx, cy, r * 0.28, PALETTE.elecCan, 0.7)  // top cap
      circle(shapes, cx - r * 0.22, cy - r * 0.22, r * 0.11, 0xffffff, 0.25) // specular
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── tant / tantalum ───────────────────────────────────────────────────────
    case 'tant':
    case 'tantalum': {
      chipBody(shapes, x, y, w, h, PALETTE.tantalum)
      endPads(shapes, x, y, w, h)
      // polarity bar: white rect at left end
      rect(shapes, x + 2, y + h * 0.2, w * 0.12, h * 0.6, SILK, 0.85)
      silkRect(shapes, x, y, w, h)
      specular(shapes, x, y, w, h)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── diode ─────────────────────────────────────────────────────────────────
    case 'diode': {
      chipBody(shapes, x, y, w, h, 0x1c1c1c)
      endPads(shapes, x, y, w, h)
      // cathode stripe: white bar right end
      rect(shapes, x + w - w * 0.18, y, w * 0.18, h, SILK, 0.70)
      silkRect(shapes, x, y, w, h)
      specular(shapes, x, y, w, h)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── led ───────────────────────────────────────────────────────────────────
    case 'led': {
      const ledColor = item.variant === 1 ? PALETTE.ledGreen : PALETTE.ledRed
      chipBody(shapes, x, y, w, h, ledColor)
      endPads(shapes, x, y, w, h)
      // cathode bar right end
      rect(shapes, x + w - w * 0.16, y, w * 0.16, h, SILK, 0.60)
      silkRect(shapes, x, y, w, h)
      specular(shapes, x, y, w, h)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── smdRes / res (chip resistor) ──────────────────────────────────────────
    case 'smdRes':
    case 'res': {
      passive2T(shapes, item, x, y, w, h, PALETTE.resBlack, pitch)
      // Value code centered on body; width-constrained so it never overflows.
      // Body inner width excludes end pads (~20 % each side) → use 56 % of w.
      const code = '100'
      const innerW = w * 0.56
      const codeSize = Math.min(pitch * 0.4, innerW / (code.length * 0.62))
      // Drop the label when the result would be unreadably tiny (< 5 px)
      if (codeSize >= 5) {
        shapes.push({
          type: 'text',
          x: x + w / 2,
          y: y + (h - codeSize) / 2,
          text: code,
          size: codeSize,
          color: 0x888888,
          align: 'center',
        })
      }
      return shapes
    }

    // ── smdCap / mlcc (ceramic cap) ───────────────────────────────────────────
    case 'smdCap':
    case 'mlcc': {
      passive2T(shapes, item, x, y, w, h, PALETTE.capTan, pitch)
      return shapes
    }

    // ── inductor ─────────────────────────────────────────────────────────────
    case 'inductor': {
      passive2T(shapes, item, x, y, w, h, PALETTE.inductor, pitch)
      return shapes
    }

    // ── pwrind (power inductor) ───────────────────────────────────────────────
    case 'pwrind': {
      chipBody(shapes, x, y, w, h, PALETTE.inductor)
      // silver side pads
      const ps = pitch * 0.30
      rect(shapes, x - ps * 0.5,     y + h * 0.3, ps, h * 0.4, SPAD, 0.9)
      rect(shapes, x + w - ps * 0.5, y + h * 0.3, ps, h * 0.4, SPAD, 0.9)
      // silver identification stripe on top
      rect(shapes, x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.15, SPAD, 0.5)
      silkRect(shapes, x, y, w, h)
      specular(shapes, x, y, w, h)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── sot23 ─────────────────────────────────────────────────────────────────
    case 'sot23': {
      chipBody(shapes, x, y, w, h, 0x1c1c1c)
      const pw = w * 0.25, ph = h * 0.18
      // 2 pads on bottom edge
      rect(shapes, x + w * 0.13, y + h - ph * 0.5, pw, ph, SPAD, 0.9)
      rect(shapes, x + w * 0.60, y + h - ph * 0.5, pw, ph, SPAD, 0.9)
      // 1 pad on top edge (pin 2)
      rect(shapes, x + w * 0.35, y - ph * 0.5, pw, ph, SPAD, 0.9)
      // pin-1 dot (bottom-left pad)
      pin1Dot(shapes, x + w * 0.25, y + h * 0.82, 2)
      silkRect(shapes, x, y, w, h)
      specular(shapes, x, y, w, h)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── crystal / xtal ────────────────────────────────────────────────────────
    case 'crystal':
    case 'xtal': {
      chipBody(shapes, x, y, w, h, PALETTE.crystal)
      // 4 corner pads
      const cs = pitch * 0.28
      rect(shapes, x - cs * 0.5,     y - cs * 0.5,     cs, cs, GOLD, 0.9)
      rect(shapes, x + w - cs * 0.5, y - cs * 0.5,     cs, cs, GOLD, 0.9)
      rect(shapes, x - cs * 0.5,     y + h - cs * 0.5, cs, cs, GOLD, 0.9)
      rect(shapes, x + w - cs * 0.5, y + h - cs * 0.5, cs, cs, GOLD, 0.9)
      silkRect(shapes, x, y, w, h)
      specular(shapes, x, y, w, h)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── header (connector) ────────────────────────────────────────────────────
    case 'header': {
      const pinCount = Math.max(2, item.variant || 4)
      const hw = pinCount * pitch * item.scale
      chipBody(shapes, x, y, hw, h, 0x1a1a1a)
      const padS = pitch * 0.50
      for (let i = 0; i < pinCount; i++) {
        const cx = x + (i + 0.5) * pitch * item.scale
        const cy = y + h / 2
        rect(shapes, cx - padS / 2, cy - padS / 2, padS, padS, GOLD, 0.9)
      }
      silkRect(shapes, x, y, hw, h)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── soic ──────────────────────────────────────────────────────────────────
    case 'soic': {
      chipBody(shapes, x, y, w, h, PALETTE.icBody)
      const pinCount = Math.max(2, Math.floor((item.variant || 8) / 2))
      const padW = pitch * 0.30, padH = pitch * 0.15
      for (let i = 0; i < pinCount; i++) {
        const px = x + ((i + 0.5) / pinCount) * w
        rect(shapes, px - padW / 2, y - padH,     padW, padH, GOLD, 0.9)  // top gull-wing
        rect(shapes, px - padW / 2, y + h,         padW, padH, GOLD, 0.9)  // bottom gull-wing
      }
      pin1Dot(shapes, x + pitch * 0.28, y + pitch * 0.28)
      silkRect(shapes, x, y, w, h)
      specular(shapes, x, y, w, h)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── qfp ───────────────────────────────────────────────────────────────────
    case 'qfp': {
      chipBody(shapes, x, y, w, h, PALETTE.icBody)
      const pinsPerSide = Math.max(4, Math.floor((item.variant || 32) / 4))
      const padW = pitch * 0.11, padH = pitch * 0.28
      for (let i = 0; i < pinsPerSide; i++) {
        const px = x + ((i + 0.5) / pinsPerSide) * w
        const py = y + ((i + 0.5) / pinsPerSide) * h
        rect(shapes, px - padW / 2, y - padH,      padW, padH, GOLD, 0.9)  // top
        rect(shapes, px - padW / 2, y + h,          padW, padH, GOLD, 0.9)  // bottom
        rect(shapes, x - padH,      py - padW / 2, padH, padW, GOLD, 0.9)  // left
        rect(shapes, x + w,         py - padW / 2, padH, padW, GOLD, 0.9)  // right
      }
      pin1Dot(shapes, x + pitch * 0.32, y + pitch * 0.32)
      silkRect(shapes, x, y, w, h)
      specular(shapes, x, y, w, h)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── qfn ───────────────────────────────────────────────────────────────────
    case 'qfn': {
      chipBody(shapes, x, y, w, h, PALETTE.icBody)
      const pinsPerSide = Math.max(3, Math.floor((item.variant || 16) / 4))
      // flush edge tabs (inside body boundary)
      const tabL = pitch * 0.30, tabT = pitch * 0.10
      for (let i = 0; i < pinsPerSide; i++) {
        const px = x + ((i + 0.5) / pinsPerSide) * w
        const py = y + ((i + 0.5) / pinsPerSide) * h
        rect(shapes, px - tabT / 2, y,           tabT, tabL, GOLD, 0.9)  // top flush
        rect(shapes, px - tabT / 2, y + h - tabL, tabT, tabL, GOLD, 0.9)  // bottom flush
        rect(shapes, x,           py - tabT / 2, tabL, tabT, GOLD, 0.9)  // left flush
        rect(shapes, x + w - tabL, py - tabT / 2, tabL, tabT, GOLD, 0.9)  // right flush
      }
      pin1Dot(shapes, x + pitch * 0.25, y + pitch * 0.25)
      silkRect(shapes, x, y, w, h)
      specular(shapes, x, y, w, h)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── dip ───────────────────────────────────────────────────────────────────
    case 'dip': {
      const pinCount = Math.max(2, Math.floor((item.variant || 8) / 2))
      const padR  = pitch * 0.15
      const holeR = pitch * 0.07
      // Draw through-hole rings before the body (they poke out from under)
      for (let i = 0; i < pinCount; i++) {
        const px = x + ((i + 0.5) / pinCount) * w
        circle(shapes, px, y,     padR * 1.4, GOLD, 0.9)
        circle(shapes, px, y,     holeR,      PALETTE.substrate, 1)
        circle(shapes, px, y + h, padR * 1.4, GOLD, 0.9)
        circle(shapes, px, y + h, holeR,      PALETTE.substrate, 1)
      }
      chipBody(shapes, x + pitch * 0.08, y + pitch * 0.18, w - pitch * 0.16, h - pitch * 0.36, PALETTE.icBody)
      // notch at pin-1 end: dark semi-indent
      const nx = x + pitch * 0.08
      rect(shapes, nx + (w - pitch * 0.16) * 0.35, y + pitch * 0.18 - 2, (w - pitch * 0.16) * 0.30, 4, 0x444444, 0.8)
      pin1Dot(shapes, x + ((0.5) / pinCount) * w, y + pitch * 0.38)
      silkRect(shapes, x, y, w, h)
      specular(shapes, x + pitch * 0.08, y + pitch * 0.18, w - pitch * 0.16, h - pitch * 0.36)
      designator(shapes, item, x, y, pitch)
      return shapes
    }

    // ── fallback ──────────────────────────────────────────────────────────────
    default: {
      chipBody(shapes, x, y, w, h, PALETTE.icBody)
      silkRect(shapes, x, y, w, h)
      specular(shapes, x, y, w, h)
      designator(shapes, item, x, y, pitch)
      return shapes
    }
  }
}
