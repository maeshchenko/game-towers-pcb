// tests/render/camera.test.ts
import { describe, it, expect } from 'vitest'
import { Camera } from '../../src/render/Camera'

describe('Camera', () => {
  it('pans by delta', () => {
    const c = new Camera()
    c.panBy(10, -5)
    expect(c.x).toBe(10)
    expect(c.y).toBe(-5)
  })
  it('zooms toward a point, keeping that point stationary in world space', () => {
    const c = new Camera()
    const beforeWorldX = (100 - c.x) / c.zoom
    c.zoomAt(100, 100, 2)
    const afterWorldX = (100 - c.x) / c.zoom
    expect(afterWorldX).toBeCloseTo(beforeWorldX, 5)
    expect(c.zoom).toBeCloseTo(2, 5)
  })
})
