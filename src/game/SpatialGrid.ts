// Uniform hash grid for circle queries over moving entities. Rebuilt each tick (cheap),
// queried by towers/splash/chain/healer instead of scanning the full enemy list.
import type { Pt } from '../geom/types'

export class SpatialGrid<T extends { pos: Pt }> {
  private buckets = new Map<number, T[]>()
  constructor(private cellSize: number) {}

  private key(cx: number, cy: number): number { return cy * 65536 + cx + 1073741824 }

  rebuild(items: T[]): void {
    this.buckets.clear()
    for (const it of items) {
      const cx = Math.floor(it.pos.x / this.cellSize), cy = Math.floor(it.pos.y / this.cellSize)
      const k = this.key(cx, cy)
      const b = this.buckets.get(k)
      if (b) b.push(it); else this.buckets.set(k, [it])
    }
  }

  queryCircle(center: Pt, r: number): T[] {
    const out: T[] = []
    const x0 = Math.floor((center.x - r) / this.cellSize), x1 = Math.floor((center.x + r) / this.cellSize)
    const y0 = Math.floor((center.y - r) / this.cellSize), y1 = Math.floor((center.y + r) / this.cellSize)
    const r2 = r * r
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const b = this.buckets.get(this.key(cx, cy))
      if (!b) continue
      for (const it of b) {
        const dx = it.pos.x - center.x, dy = it.pos.y - center.y
        if (dx * dx + dy * dy <= r2) out.push(it)
      }
    }
    return out
  }
}
