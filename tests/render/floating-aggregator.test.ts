// tests/render/floating-aggregator.test.ts
import { describe, it, expect } from 'vitest'
import { DamageAggregator } from '../../src/render/juice/floatingLogic'

describe('floatingLogic / DamageAggregator', () => {
  it('does not flush a batch before 0.25s has passed since the first add', () => {
    const agg = new DamageAggregator()
    const enemy = {}
    agg.add(enemy, 10, 5, 5, 0)
    expect(agg.flush(0.1)).toEqual([])
    expect(agg.flush(0.24)).toEqual([])
  })

  it('flushes a batch once 0.25s has passed since the first add', () => {
    const agg = new DamageAggregator()
    const enemy = {}
    agg.add(enemy, 10, 5, 5, 0)
    const out = agg.flush(0.25)
    expect(out).toEqual([{ amount: 10, x: 5, y: 5 }])
  })

  it('sums amounts from multiple adds within the same window', () => {
    const agg = new DamageAggregator()
    const enemy = {}
    agg.add(enemy, 10, 0, 0, 0)
    agg.add(enemy, 15, 1, 1, 0.1)
    agg.add(enemy, 5, 2, 2, 0.2)
    const out = agg.flush(0.25)
    expect(out).toEqual([{ amount: 30, x: 2, y: 2 }])
  })

  it('keeps the latest x,y even though the window is measured from the first add', () => {
    const agg = new DamageAggregator()
    const enemy = {}
    agg.add(enemy, 10, 0, 0, 0)
    agg.add(enemy, 10, 99, 99, 0.2)
    const out = agg.flush(0.25)
    expect(out[0]).toEqual({ amount: 20, x: 99, y: 99 })
  })

  it('removes a flushed batch so it does not flush again', () => {
    const agg = new DamageAggregator()
    const enemy = {}
    agg.add(enemy, 10, 0, 0, 0)
    expect(agg.flush(0.25).length).toBe(1)
    expect(agg.flush(1)).toEqual([])
  })

  it('starts a fresh window when a new add arrives after a flush', () => {
    const agg = new DamageAggregator()
    const enemy = {}
    agg.add(enemy, 10, 0, 0, 0)
    agg.flush(0.25)
    agg.add(enemy, 7, 3, 3, 0.3)
    expect(agg.flush(0.5)).toEqual([])
    expect(agg.flush(0.55)).toEqual([{ amount: 7, x: 3, y: 3 }])
  })

  it('tracks multiple keys independently', () => {
    const agg = new DamageAggregator()
    const a = {}
    const b = {}
    agg.add(a, 10, 0, 0, 0)
    agg.add(b, 20, 10, 10, 0.1)
    const out1 = agg.flush(0.25) // only `a`'s window has elapsed
    expect(out1).toEqual([{ amount: 10, x: 0, y: 0 }])
    const out2 = agg.flush(0.4) // now `b`'s window has elapsed too
    expect(out2).toEqual([{ amount: 20, x: 10, y: 10 }])
  })

  it('does not mix amounts between different keys', () => {
    const agg = new DamageAggregator()
    const a = {}
    const b = {}
    agg.add(a, 10, 0, 0, 0)
    agg.add(b, 5, 0, 0, 0)
    const out = agg.flush(0.25)
    const sum = out.reduce((s, b) => s + b.amount, 0)
    expect(sum).toBe(15)
    expect(out.length).toBe(2)
  })
})
