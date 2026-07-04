import { describe, it, expect } from 'vitest'
import { EventBus, type GameEvent } from '../../src/game/events'

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new EventBus()
    const got: GameEvent[] = []
    bus.on((e) => got.push(e))
    bus.emit({ type: 'leak', kind: 'normal', livesLost: 1 })
    expect(got).toEqual([{ type: 'leak', kind: 'normal', livesLost: 1 }])
  })

  it('unsubscribe stops delivery', () => {
    const bus = new EventBus()
    let n = 0
    const off = bus.on(() => n++)
    bus.emit({ type: 'waveStart', index: 0 })
    off()
    bus.emit({ type: 'waveStart', index: 1 })
    expect(n).toBe(1)
  })

  it('one throwing handler does not break others', () => {
    const bus = new EventBus()
    let n = 0
    bus.on(() => { throw new Error('boom') })
    bus.on(() => n++)
    bus.emit({ type: 'waveEnd', index: 0 })
    expect(n).toBe(1)
  })
})
