import { describe, it, expect, vi } from 'vitest'
import { PerfMonitor } from '../../src/render/PerfMonitor'

function feed(m: PerfMonitor, fps: number, seconds: number): void {
  const dt = 1 / fps
  for (let t = 0; t < seconds; t += dt) m.sample(dt)
}

describe('PerfMonitor', () => {
  it('does not degrade at healthy frame rates', () => {
    const onDegrade = vi.fn()
    const m = new PerfMonitor({ onDegrade })
    feed(m, 60, 20)
    expect(onDegrade).not.toHaveBeenCalled()
    expect(m.degraded).toBe(false)
  })

  it('degrades once after sustained low FPS', () => {
    const onDegrade = vi.fn()
    const m = new PerfMonitor({ onDegrade, floorFps: 45, sustainSec: 4 })
    feed(m, 25, 10) // well below floor, long enough
    expect(onDegrade).toHaveBeenCalledTimes(1)
    expect(m.degraded).toBe(true)
    // further bad frames must not re-fire
    feed(m, 20, 10)
    expect(onDegrade).toHaveBeenCalledTimes(1)
  })

  it('a brief dip that recovers does not degrade', () => {
    const onDegrade = vi.fn()
    const m = new PerfMonitor({ onDegrade, floorFps: 45, sustainSec: 4 })
    feed(m, 30, 2) // 2 s of lag — under the 4 s window
    feed(m, 60, 5) // recovers
    expect(onDegrade).not.toHaveBeenCalled()
  })

  it('ignores single huge frames (tab-switch / GC stall) and resets the streak', () => {
    const onDegrade = vi.fn()
    const m = new PerfMonitor({ onDegrade, floorFps: 45, sustainSec: 4, spikeCutoff: 0.5 })
    feed(m, 30, 3.5) // almost at the threshold
    m.sample(2.0) // a 2 s stall — must reset, not push over
    feed(m, 60, 5)
    expect(onDegrade).not.toHaveBeenCalled()
  })

  it('exposes a smoothed fps estimate', () => {
    const m = new PerfMonitor({ onDegrade: () => {} })
    feed(m, 30, 5)
    expect(m.fps).toBeGreaterThan(25)
    expect(m.fps).toBeLessThan(35)
  })
})
