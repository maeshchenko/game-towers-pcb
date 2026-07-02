// src/render/juice/particleLogic.ts
// Pure particle-pool math: no pixi imports so this is jsdom/node-testable in isolation and
// deterministic given an injected rand(). Particles.ts wraps this with the pixi rendering.

export interface BurstSpec {
  x: number; y: number; count: number
  speed: [number, number]           // px/s min..max
  angle?: [number, number]          // radians, default [0, 2π]
  life: [number, number]            // seconds
  color: number; size: [number, number]
  gravity?: number                  // px/s² down
  drag?: number                     // 0..1 fraction of velocity lost per second
  shape?: 'dot' | 'spark' | 'shard' // default 'dot'
}

// One live particle's simulation state. Deliberately excludes color/shape/texture — those are
// constant per-burst and owned by the pixi wrapper, which zips them onto the Particle it creates
// for each P.
export interface P {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  size: number
  rotation: number; spin: number    // radians, radians/s
}

const TWO_PI = Math.PI * 2
const MAX_SPIN = 10 // rad/s, arbitrary tumble range for spark/shard shapes

function lerp(min: number, max: number, t: number): number { return min + (max - min) * t }

// Spawns spec.count particles at the burst origin with randomized velocity/life/size/rotation,
// all driven by the injected rand() so callers (and tests) can get reproducible results.
export function spawnFrom(spec: BurstSpec, rand: () => number): P[] {
  const [aMin, aMax] = spec.angle ?? [0, TWO_PI]
  const out: P[] = []
  for (let i = 0; i < spec.count; i++) {
    const angle = lerp(aMin, aMax, rand())
    const speed = lerp(spec.speed[0], spec.speed[1], rand())
    const life = lerp(spec.life[0], spec.life[1], rand())
    const size = lerp(spec.size[0], spec.size[1], rand())
    const rotation = rand() * TWO_PI
    const spin = lerp(-MAX_SPIN, MAX_SPIN, rand())
    out.push({
      x: spec.x, y: spec.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life, maxLife: life,
      size, rotation, spin,
    })
  }
  return out
}

// Advances one particle in place by dt seconds. Returns false once its life has expired (caller
// should drop it). Drag is applied as a per-second fractional velocity loss, clamped so it can
// never invert velocity at large dt.
export function advance(p: P, dt: number, gravity: number, drag: number): boolean {
  p.vy += gravity * dt
  const dragFactor = Math.max(0, 1 - drag * dt)
  p.vx *= dragFactor
  p.vy *= dragFactor
  p.x += p.vx * dt
  p.y += p.vy * dt
  p.rotation += p.spin * dt
  p.life -= dt
  return p.life > 0
}

// Cap-degradation math: shrinks a requested burst count as the live pool fills toward the 500
// global cap, fully refusing new particles once at/over the cap. Exported standalone so tests can
// exercise the math without spinning up ParticleSystem/pixi.
export function cappedCount(requested: number, live: number): number {
  if (live >= 500) return 0
  return Math.floor(requested * Math.max(0.2, 1 - live / 500))
}
