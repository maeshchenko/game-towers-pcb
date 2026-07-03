// src/render/juice/Vfx.ts
// Post-processing juice: a permanent bloom on the projectiles/particles layers, a very subtle CRT
// overlay on the whole stage (gated by reducedFx — cheap flag flip in update()), and two transient
// hit-feedback effects: a red edge-vignette flash (drawn into the screen-space vfxOverlay so camera
// shake/zoom never distorts it) and a brief RGB-split pulse on the world container. Transients are
// no-ops when reducedFx is on; bloom is gated too (it's the single most expensive filter on
// mobile GPUs — two render-to-texture passes per frame).
import { Application, Container, Sprite, Texture } from 'pixi.js'
import { AdvancedBloomFilter, CRTFilter, RGBSplitFilter } from 'pixi-filters'
import { juice } from './motion'

const VIGNETTE_DURATION = 0.25 // s, alpha 0.6 -> 0
const VIGNETTE_ALPHA = 0.6

const RGB_SPLIT_DURATION = 0.12 // s, offset 3px -> 0
const RGB_SPLIT_OFFSET = 3

/** Radial hurt-gradient baked once into a canvas texture: soft red bleeding in from the
 * edges instead of four flat debug-looking bars. Falls back to a 1px texture when no 2D
 * context exists (headless tests). */
function makeVignetteTexture(): Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  if (!ctx) return Texture.WHITE
  const g = ctx.createRadialGradient(128, 128, 64, 128, 128, 132)
  g.addColorStop(0, 'rgba(255,32,32,0)')
  g.addColorStop(0.65, 'rgba(255,32,32,0.25)')
  g.addColorStop(1, 'rgba(255,32,32,0.9)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return Texture.from(c)
}

export class Vfx {
  // resolution 0.5 (set post-construction — not in the options type): bloom is a blur,
  // half-res is visually identical and ~4× cheaper.
  private readonly bloom = (() => {
    const f = new AdvancedBloomFilter({ threshold: 0.5, bloomScale: 0.8, quality: 3 })
    f.resolution = 0.5
    return f
  })()
  private readonly crt = new CRTFilter({ lineWidth: 1, lineContrast: 0.08, vignetting: 0.25 })
  private readonly rgbSplit = new RGBSplitFilter()
  private readonly vignette: Sprite

  private crtActive = false
  private bloomActive = false
  private crtTime = 0
  // Both timers start "finished" so the effects are inert until a transient method fires them.
  private vignetteT = VIGNETTE_DURATION
  private rgbSplitT = RGB_SPLIT_DURATION

  private readonly onResize = () => this.layoutVignette()

  constructor(
    private readonly app: Application,
    private readonly world: Container,
    private readonly overlay: Container,
    private readonly bloomLayers: Container[],
  ) {
    this.vignette = new Sprite(makeVignetteTexture())
    this.vignette.visible = false
    this.overlay.addChild(this.vignette)
    this.layoutVignette()
    this.app.renderer.on('resize', this.onResize)
  }

  update(dt: number): void {
    this.updateFilterGates(dt)
    this.updateVignette(dt)
    this.updateRgbSplit(dt)
  }

  /** Red edge-vignette flash: alpha 0.6 -> 0 over VIGNETTE_DURATION. No-op when reducedFx. */
  flashVignette(): void {
    if (juice.reducedFx) return
    this.vignetteT = 0
    this.vignette.visible = true
    this.vignette.alpha = VIGNETTE_ALPHA
  }

  /** Brief RGB-split pulse on the world container: offset 3px -> 0 over RGB_SPLIT_DURATION. */
  rgbSplitPulse(): void {
    if (juice.reducedFx) return
    this.rgbSplitT = 0
    this.world.filters = [this.rgbSplit]
  }

  destroy(): void {
    this.app.renderer.off('resize', this.onResize)
    for (const layer of this.bloomLayers) layer.filters = null
    this.app.stage.filters = null
    this.world.filters = null
    this.vignette.destroy()
  }

  private updateFilterGates(dt: number): void {
    // CRT + bloom follow the reducedFx flag live (settings toggle mid-game must apply).
    if (juice.reducedFx && this.crtActive) {
      this.app.stage.filters = null
      this.crtActive = false
    } else if (!juice.reducedFx && !this.crtActive) {
      this.app.stage.filters = [this.crt]
      this.crtActive = true
    }
    if (juice.reducedFx && this.bloomActive) {
      for (const layer of this.bloomLayers) layer.filters = null
      this.bloomActive = false
    } else if (!juice.reducedFx && !this.bloomActive) {
      for (const layer of this.bloomLayers) layer.filters = [this.bloom]
      this.bloomActive = true
    }
    if (this.crtActive) {
      this.crtTime += dt
      this.crt.time = this.crtTime
    }
  }

  private updateVignette(dt: number): void {
    if (this.vignetteT >= VIGNETTE_DURATION) return
    this.vignetteT = Math.min(VIGNETTE_DURATION, this.vignetteT + dt)
    const k = 1 - this.vignetteT / VIGNETTE_DURATION
    this.vignette.alpha = VIGNETTE_ALPHA * k * k // ease-out: linger then fade
    if (this.vignetteT >= VIGNETTE_DURATION) this.vignette.visible = false
  }

  private updateRgbSplit(dt: number): void {
    if (this.rgbSplitT >= RGB_SPLIT_DURATION) return
    this.rgbSplitT = Math.min(RGB_SPLIT_DURATION, this.rgbSplitT + dt)
    const k = 1 - this.rgbSplitT / RGB_SPLIT_DURATION
    this.rgbSplit.red = { x: -RGB_SPLIT_OFFSET * k, y: 0 }
    this.rgbSplit.blue = { x: RGB_SPLIT_OFFSET * k, y: 0 }
    if (this.rgbSplitT >= RGB_SPLIT_DURATION) this.world.filters = null
  }

  private layoutVignette(): void {
    this.vignette.width = this.app.screen.width
    this.vignette.height = this.app.screen.height
  }
}
