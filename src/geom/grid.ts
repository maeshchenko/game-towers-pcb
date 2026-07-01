import type { Cell, Pt } from './types'

export function cellToPx(c: Cell, pitch: number): Pt {
  return { x: c[0] * pitch + pitch / 2, y: c[1] * pitch + pitch / 2 }
}
export function snapToCell(p: Pt, pitch: number): Cell {
  return [Math.floor(p.x / pitch), Math.floor(p.y / pitch)]
}
export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
export function cellKey(c: Cell): string {
  return `${c[0]},${c[1]}`
}
