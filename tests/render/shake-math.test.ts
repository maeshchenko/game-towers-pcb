// tests/render/shake-math.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { ScreenShake } from '../../src/render/juice/ScreenShake'
import { juice } from '../../src/render/juice/motion'

afterEach(() => {
  juice.reducedFx = false
})

describe('ScreenShake', () => {
  it('decays trauma linearly over time down to zero, never negative', () => {
    const s = new ScreenShake()
    s.add(1)
    s.update(0.5) // trauma -> 0.5, still shaking
    expect(s.offset).not.toEqual({ x: 0, y: 0, angle: 0 })
    s.update(0.5) // trauma -> 0 exactly
    expect(s.offset).toEqual({ x: 0, y: 0, angle: 0 })
  })

  it('clamps trauma at zero instead of going negative', () => {
    const s = new ScreenShake()
    s.add(0.3)
    s.update(5) // far more than trauma remaining; must clamp, not go negative and re-square positive
    expect(s.offset).toEqual({ x: 0, y: 0, angle: 0 })
  })

  it('shake magnitude scales with trauma^2', () => {
    const full = new ScreenShake()
    full.add(1)
    const half = new ScreenShake()
    half.add(0.5)
    // No update() called yet on either instance, so both share t=0 — only trauma differs.
    // shake = trauma^2, so full/half amplitude ratio should be 1^2 / 0.5^2 = 4.
    expect(full.offset.y).toBeCloseTo(half.offset.y * 4, 6)
    expect(full.offset.angle).toBeCloseTo(half.offset.angle * 4, 6)
  })

  it('offset is zero at trauma 0', () => {
    const s = new ScreenShake()
    expect(s.offset).toEqual({ x: 0, y: 0, angle: 0 })
    s.update(1) // no-op, trauma already 0
    expect(s.offset).toEqual({ x: 0, y: 0, angle: 0 })
  })

  it('offset stays bounded by maxOffset/maxAngle at full trauma', () => {
    const s = new ScreenShake()
    s.add(1)
    for (let i = 0; i < 500; i++) {
      s.update(0.01) // trauma decays a bit each step but re-add to keep it pinned at 1
      s.add(1)
      const { x, y, angle } = s.offset
      expect(Math.abs(x)).toBeLessThanOrEqual(10 + 1e-9)
      expect(Math.abs(y)).toBeLessThanOrEqual(10 + 1e-9)
      expect(Math.abs(angle)).toBeLessThanOrEqual(0.02 + 1e-9)
    }
  })

  it('never uses per-frame randomness — same trauma/time reproduces the same offset', () => {
    const a = new ScreenShake()
    a.add(1)
    a.update(0.37)
    const b = new ScreenShake()
    b.add(1)
    b.update(0.37)
    expect(a.offset).toEqual(b.offset)
  })

  it('applyTo ADDS the offset to an existing position/rotation (pivot at the target position)', () => {
    const s = new ScreenShake()
    s.add(1)
    const o = s.offset
    const target = { position: { x: 5, y: 7 }, rotation: 0.2 }
    // With pivot == target position the rotation term contributes nothing to position,
    // so applyTo degenerates to plain adds.
    s.applyTo(target, { x: 5, y: 7 })
    expect(target.position.x).toBeCloseTo(5 + o.x, 9)
    expect(target.position.y).toBeCloseTo(7 + o.y, 9)
    expect(target.rotation).toBeCloseTo(0.2 + o.angle, 9)
  })

  it('applyTo rotates the position around the pivot, not the local origin', () => {
    const s = new ScreenShake()
    s.add(1)
    s.update(0.3) // advance the clock so the sine mix yields a non-zero angle
    const o = s.offset
    expect(o.angle).not.toBe(0)
    const target = { position: { x: 100, y: 50 }, rotation: 0 }
    const pivot = { x: 640, y: 360 }
    // Expected: position rotated about the pivot by o.angle, then shifted by the linear offset.
    const dx = 100 - pivot.x
    const dy = 50 - pivot.y
    const cos = Math.cos(o.angle)
    const sin = Math.sin(o.angle)
    const ex = pivot.x + dx * cos - dy * sin + o.x
    const ey = pivot.y + dx * sin + dy * cos + o.y
    s.applyTo(target, pivot)
    expect(target.position.x).toBeCloseTo(ex, 9)
    expect(target.position.y).toBeCloseTo(ey, 9)
    expect(target.rotation).toBeCloseTo(o.angle, 9)
    // Pure rotation preserves the distance to the pivot, so the total position change is bounded
    // by |chord| + linear offset — no far-corner blow-up like rotating around a distant origin.
    const dist = Math.hypot(dx, dy)
    const chord = 2 * dist * Math.abs(Math.sin(o.angle / 2))
    const moved = Math.hypot(target.position.x - 100, target.position.y - 50)
    expect(moved).toBeLessThanOrEqual(chord + Math.hypot(o.x, o.y) + 1e-9)
  })

  it('reset drops all pending trauma immediately', () => {
    const s = new ScreenShake()
    s.add(1)
    s.reset()
    expect(s.offset).toEqual({ x: 0, y: 0, angle: 0 })
    const target = { position: { x: 3, y: 4 }, rotation: 0 }
    s.applyTo(target, { x: 0, y: 0 })
    expect(target).toEqual({ position: { x: 3, y: 4 }, rotation: 0 })
  })

  it('add() is a no-op when juice.reducedFx is set', () => {
    juice.reducedFx = true
    const s = new ScreenShake()
    s.add(1)
    expect(s.offset).toEqual({ x: 0, y: 0, angle: 0 })
  })
})
