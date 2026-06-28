// src/app/viewport.ts
export const MAP_PRESETS: { label: string; cols: number; rows: number }[] = [
  { label: 'S', cols: 32, rows: 24 },
  { label: 'M', cols: 48, rows: 36 },
  { label: 'L', cols: 64, rows: 48 },
  { label: 'XL', cols: 96, rows: 72 },
]

export function fitPitch(
  cols: number, rows: number, viewW: number, viewH: number,
  opts: { minPitch?: number; maxPitch?: number } = {},
): number {
  const min = opts.minPitch ?? 8
  const max = opts.maxPitch ?? 48
  const raw = Math.floor(Math.min(viewW / cols, viewH / rows))
  return Math.max(min, Math.min(max, raw))
}
