// src/render/juice/Vfx.ts
// Post-processing juice: a permanent bloom on the projectiles/particles layers, a very subtle CRT
// overlay on the whole stage (gated by reducedFx — cheap flag flip in update()), and two transient
// hit-feedback effects: a red edge-vignette flash (drawn into the screen-space vfxOverlay so camera
// shake/zoom never distorts it) and a brief RGB-split pulse on the world container. Transients are
// no-ops when reducedFx is on; the bloom stays (it's static, not motion-sensitive).
import { Application, Container, Graphics } from 'pixi.js'
import { AdvancedBloomFilter, CRTFilter, RGBSplitFilter } from 'pixi-filters'
import { juice } from './motion'

const VIGNETTE_DURATION = 0.15 // s, alpha 0.5 -> 0
const VIGNETTE_THICKNESS = 60 // px, edge-band width
const VIGNETTE_COLOR = 0xff2020
const VIGNETTE_ALPHA = 0.5

const RGB_SPLIT_DURATION = 0.12 // s, offset 3px -> 0
const RGB_SPLIT_OFFSET = 3

export class Vfx {
  private readonly bloom = new AdvancedBloomFilter({ threshold: 0.5, bloomScale: 0.8, quality: 4 })
  private readonly crt = new CRTFilter({ lineWidth: 1, lineContrast: 0.08, vignetting: 0.25 })
  private readonly rgbSplit = new RGBSplitFilter()
  private readonly vignette = new Graphics()

  private crtActive = false
  private crtTime = 0
  // Both timers start "finished" so the effects are inert until a transient method fires them.
  private vignetteT = VIGNETTE_DURATION
  private rgbSplitT = RGB_SPLIT_DURATION

  private readonly onResize = () => this.drawVignette()

  constructor(
    private readonly app: Application,
    private readonly world: Container,
    private readonly overlay: Container,
    private readonly bloomLayers: Container[],
  ) {
    for (const layer of bloomLayers) layer.filters = [this.bloom]

    this.vignette.visible = false
    this.overlay.addChild(this.vignette)
    this.drawVignette()
    this.app.renderer.on('resize', this.onResize)
  }

  update(dt: number): void {
    this.updateCrtGate(dt)
    this.updateVignette(dt)
    this.updateRgbSplit(dt)
  }

  /** Red edge-vignette flash: alpha 0.5 -> 0 over VIGNETTE_DURATION. No-op when reducedFx. */
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

  private updateCrtGate(dt: number): void {
    if (juice.reducedFx && this.crtActive) {
      this.app.stage.filters = null
      this.crtActive = false
    } else if (!juice.reducedFx && !this.crtActive) {
      this.app.stage.filters = [this.crt]
      this.crtActive = true
    }
    if (this.crtActive) {
      this.crtTime += dt
      this.crt.time = this.crtTime
    }
  }

  private updateVignette(dt: number): void {
    if (this.vignetteT >= VIGNETTE_DURATION) return
    this.vignetteT = Math.min(VIGNETTE_DURATION, this.vignetteT + dt)
    const alpha = VIGNETTE_ALPHA * (1 - this.vignetteT / VIGNETTE_DURATION)
    this.vignette.alpha = alpha
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

  // Redrawn on resize (app.renderer 'resize' event) so the edge band always matches the screen.
  private drawVignette(): void {
    const w = this.app.screen.width
    const h = this.app.screen.height
    const t = VIGNETTE_THICKNESS
    this.vignette.clear()
    this.vignette.rect(0, 0, w, t).fill(VIGNETTE_COLOR)
    this.vignette.rect(0, h - t, w, t).fill(VIGNETTE_COLOR)
    this.vignette.rect(0, t, t, h - t * 2).fill(VIGNETTE_COLOR)
    this.vignette.rect(w - t, t, t, h - t * 2).fill(VIGNETTE_COLOR)
  }
}
