// src/app/viewport.ts
export const MAP_PRESETS: { label: string; cols: number; rows: number }[] = [
  { label: 'S', cols: 24, rows: 18 },
  { label: 'M', cols: 32, rows: 24 },
  { label: 'L', cols: 44, rows: 33 },
  { label: 'XL', cols: 60, rows: 45 },
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
