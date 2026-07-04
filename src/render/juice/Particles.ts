// src/render/juice/Particles.ts
// Pixi wrapper around particleLogic's pure P/advance/spawnFrom math. Owns one ParticleContainer
// per baked shape texture (pixi v8 requires a single TextureSource per container), tints each
// Particle individually so bursts of any color still share those three containers.
import { Application, Container, Particle, ParticleContainer, type Texture } from 'pixi.js'
import { bakeParticleTexture, type ParticleShape } from '../views/textures'
import { spawnFrom, advance, cappedCount, type BurstSpec, type P } from './particleLogic'

const SHAPES: ParticleShape[] = ['dot', 'spark', 'shard']

// Natural pixel size (max dimension) of each baked shape, used to convert a burst's requested
// `size` (px) into a Particle scale factor relative to the baked texture.
const NATURAL_SIZE: Record<ParticleShape, number> = { dot: 8, spark: 6, shard: 8 }

interface LiveParticle {
  p: P
  particle: Particle
  container: ParticleContainer
  shape: ParticleShape
  gravity: number
  drag: number
}

export class ParticleSystem {
  private containers: Record<ParticleShape, ParticleContainer>
  // Flat pool of all live particles across every shape container — reused array, swap-removed
  // in place so update() never allocates beyond the particle objects spawnFrom hands out.
  private live: LiveParticle[] = []
  // Free-lists per shape: dead Particle objects (and their wrappers) are recycled instead of
  // re-allocated — peak combat at 4× used to churn hundreds of allocations per second.
  private freeByShape: Record<ParticleShape, LiveParticle[]> = { dot: [], spark: [], shard: [] }

  constructor(app: Application, layer: Container) {
    this.containers = {} as Record<ParticleShape, ParticleContainer>
    for (const shape of SHAPES) {
      const texture: Texture = bakeParticleTexture(app, shape)
      const container = new ParticleContainer({
        dynamicProperties: { position: true, scale: true, rotation: true, color: true },
        blendMode: 'add',
        texture,
      })
      this.containers[shape] = container
      layer.addChild(container)
    }
  }

  get liveCount(): number { return this.live.length }

  burst(spec: BurstSpec): void {
    const count = cappedCount(spec.count, this.live.length)
    if (count <= 0) return
    const shape = spec.shape ?? 'dot'
    const container = this.containers[shape]
    const scaleBase = NATURAL_SIZE[shape]
    const spawned = spawnFrom({ ...spec, count }, Math.random)
    for (const p of spawned) {
      const scale = p.size / scaleBase
      const recycled = this.freeByShape[shape].pop()
      if (recycled) {
        const particle = recycled.particle
        particle.x = p.x; particle.y = p.y
        particle.scaleX = scale; particle.scaleY = scale
        particle.rotation = p.rotation
        particle.tint = spec.color
        particle.alpha = 1
        container.addParticle(particle)
        recycled.p = p
        recycled.gravity = spec.gravity ?? 0
        recycled.drag = spec.drag ?? 0
        this.live.push(recycled)
      } else {
        const particle = new Particle({
          texture: container.texture,
          x: p.x, y: p.y,
          anchorX: 0.5, anchorY: 0.5,
          scaleX: scale, scaleY: scale,
          rotation: p.rotation,
          tint: spec.color,
        })
        container.addParticle(particle)
        this.live.push({ p, particle, container, shape, gravity: spec.gravity ?? 0, drag: spec.drag ?? 0 })
      }
    }
  }

  update(dt: number): void {
    let i = 0
    while (i < this.live.length) {
      const lp = this.live[i]
      const alive = advance(lp.p, dt, lp.gravity, lp.drag)
      if (!alive) {
        lp.container.removeParticle(lp.particle)
        this.freeByShape[lp.shape].push(lp) // recycle the pixi object + wrapper
        const last = this.live.length - 1
        this.live[i] = this.live[last]
        this.live.pop()
        continue // re-check the swapped-in element at index i
      }
      const particle = lp.particle
      particle.x = lp.p.x
      particle.y = lp.p.y
      particle.rotation = lp.p.rotation
      particle.alpha = lp.p.maxLife > 0 ? lp.p.life / lp.p.maxLife : 0 // fade out over lifetime
      // size/scale is set once at spawn — advance() never mutates p.size, so re-deriving the
      // scale here every frame would be wasted work.
      i++
    }
  }

  destroy(): void {
    for (const shape of SHAPES) this.containers[shape].destroy({ children: true })
    this.live.length = 0
  }
}

// Re-exported so callers only need to import from one place.
export type { BurstSpec }
