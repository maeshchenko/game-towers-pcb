import type { DecorItem } from '../model/level'
import { PALETTE } from '../style/palette'

export interface ShapeSpec { type: 'rect' | 'circle'; x: number; y: number; w: number; h: number; color: number; alpha: number }

const FOOTPRINT: Record<string, { w: number; h: number }> = {
  qfp: { w: 4, h: 4 }, soic: { w: 3, h: 2 }, dip: { w: 5, h: 2 },
  electrolytic: { w: 2, h: 2 }, smdRes: { w: 2, h: 1 }, smdCap: { w: 1, h: 1 }, via: { w: 1, h: 1 },
}

export function buildDecorShapes(item: DecorItem, pitch: number): ShapeSpec[] {
  const fp = FOOTPRINT[item.kind] ?? { w: 2, h: 2 }
  const w = (item.rot === 90 || item.rot === 270 ? fp.h : fp.w) * pitch * item.scale
  const h = (item.rot === 90 || item.rot === 270 ? fp.w : fp.h) * pitch * item.scale
  const x = item.cell[0] * pitch
  const y = item.cell[1] * pitch
  const shapes: ShapeSpec[] = []

  if (item.kind === 'via') {
    shapes.push({ type: 'circle', x: x + w / 2, y: y + h / 2, w: w * 0.5, h: h * 0.5, color: PALETTE.pinSilver, alpha: 1 })
    shapes.push({ type: 'circle', x: x + w / 2, y: y + h / 2, w: w * 0.22, h: h * 0.22, color: PALETTE.substrate, alpha: 1 })
    return shapes
  }
  if (item.kind === 'electrolytic') {
    shapes.push({ type: 'circle', x: x + w / 2 + 2, y: y + h / 2 + 2, w: w * 0.5, h: h * 0.5, color: 0x000000, alpha: 0.45 }) // shadow
    shapes.push({ type: 'circle', x: x + w / 2, y: y + h / 2, w: w * 0.5, h: h * 0.5, color: PALETTE.icBody, alpha: 1 })
    shapes.push({ type: 'circle', x: x + w / 2, y: y + h / 2, w: w * 0.32, h: h * 0.32, color: PALETTE.pinSilver, alpha: 0.8 }) // top ring
    shapes.push({ type: 'circle', x: x + w * 0.4, y: y + h * 0.4, w: w * 0.12, h: h * 0.12, color: 0xffffff, alpha: 0.25 }) // specular
    return shapes
  }

  // generic chip / SMD: shadow -> body -> bevel -> pins -> specular
  shapes.push({ type: 'rect', x: x + 2, y: y + 3, w, h, color: 0x000000, alpha: 0.45 })        // drop shadow
  shapes.push({ type: 'rect', x, y, w, h, color: PALETTE.icBody, alpha: 1 })                    // body
  shapes.push({ type: 'rect', x, y, w, h: Math.max(1, h * 0.18), color: 0xffffff, alpha: 0.08 })// top bevel light
  shapes.push({ type: 'rect', x, y: y + h - Math.max(1, h * 0.18), w, h: Math.max(1, h * 0.18), color: 0x000000, alpha: 0.25 }) // bottom bevel dark
  const isChip = item.kind === 'qfp' || item.kind === 'soic' || item.kind === 'dip'
  if (isChip) {
    const pinCount = Math.max(2, Math.floor((item.variant || 8) / 2))
    for (let i = 0; i < pinCount; i++) {
      const px = x + ((i + 0.5) / pinCount) * w
      shapes.push({ type: 'rect', x: px - 1, y: y - 3, w: 2, h: 3, color: PALETTE.pinSilver, alpha: 0.9 })       // top pins
      shapes.push({ type: 'rect', x: px - 1, y: y + h, w: 2, h: 3, color: PALETTE.pinSilver, alpha: 0.9 })       // bottom pins
    }
  } else {
    // SMD end caps
    shapes.push({ type: 'rect', x: x - 2, y, w: 3, h, color: PALETTE.pinSilver, alpha: 0.9 })
    shapes.push({ type: 'rect', x: x + w - 1, y, w: 3, h, color: PALETTE.pinSilver, alpha: 0.9 })
  }
  shapes.push({ type: 'rect', x: x + w * 0.12, y: y + h * 0.12, w: w * 0.3, h: h * 0.12, color: 0xffffff, alpha: 0.12 }) // specular
  return shapes
}
