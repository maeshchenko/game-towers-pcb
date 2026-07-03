import { describe, it, expect } from 'vitest'
import { Game } from '../../src/game/Game'
import type { Level } from '../../src/model/level'

function miniLevel(): Level {
  return {
    version: 1, board: { cols: 16, rows: 12, pitch: 24 }, seed: 1,
    trace: { waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 },
    paths: [{ waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 }],
    spots: [{ cell: [3, 4], score: 5, kind: 'build' }], specialSpots: [], decor: [],
    meta: { name: 'mini', difficulty: 0 },
  }
}

/** Run one wave for `seconds` of sim time in chunks of `dt`, return shotFired count. */
function shotsAt(dt: number, seconds: number, speed = 1): number {
  const g = new Game(miniLevel(), 1)
  g.speed = speed
  g.build('cannon', 0)
  let shots = 0
  g.events.on((e) => { if (e.type === 'shotFired') shots++ })
  g.startWave()
  const calls = Math.round(seconds / dt)
  for (let i = 0; i < calls && g.state.phase === 'wave'; i++) g.tick(dt)
  return shots
}

describe('fixed-step simulation (fast-forward fairness)', () => {
  it('coarse ticks produce the same fire rate as fine ticks', () => {
    // 0.5 s frames (e.g. 30 FPS at 4× speed reaching the sim as one big dt) must not
    // starve tower DPS versus 60 FPS frames over the same total sim time.
    const fine = shotsAt(1 / 60, 8)
    const coarse = shotsAt(0.5, 8)
    expect(coarse).toBeGreaterThan(0)
    expect(Math.abs(coarse - fine)).toBeLessThanOrEqual(1)
  })
  it('4x speed with laggy frames matches 1x speed in sim-time shot count', () => {
    // 30 FPS at 4× → tick(0.033) with speed 4 ≙ 0.133 s sim per call.
    const fast = shotsAt(1 / 30, 3, 4)   // 12 s of sim time
    const slow = shotsAt(1 / 60, 12, 1)  // 12 s of sim time
    expect(Math.abs(fast - slow)).toBeLessThanOrEqual(1)
  })
})
