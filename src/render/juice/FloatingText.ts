// src/render/juice/FloatingText.ts
// Pixi wrapper: pooled BitmapText for damage numbers and bounty (+gold) call-outs. Installs a
// small monospace bitmap font once (module-level guard) since BitmapFont.install() requires a
// globally-unique font name and would otherwise throw if a second GameView/FloatingText is built.
import { BitmapFont, BitmapText, type Container } from 'pixi.js'

const FONT_NAME = 'dmg'
const FONT_SIZE = 24
const POOL_SIZE = 32
const LIFE = 0.8        // seconds
const RISE_PX = 40      // total upward travel over the full life
const FADE_START = 0.5  // fraction of life at which fade-out begins (1 -> 0 over the remaining half)
const POP_IN_TIME = 0.12 // seconds
const POP_IN_SCALE = 1.4 // starting scale multiplier during pop-in, settles to 1.0

let fontInstalled = false
function ensureFont(): void {
  if (fontInstalled) return
  BitmapFont.install({
    name: FONT_NAME,
    style: { fontFamily: 'monospace', fontSize: FONT_SIZE, fill: 0xffffff },
    chars: [['0', '9'], '+-'],
  })
  fontInstalled = true
}

interface Slot {
  text: BitmapText
  active: boolean
  age: number
  life: number
  startY: number
  scale: number
}

export class FloatingText {
  private pool: Slot[] = []

  constructor(layer: Container) {
    ensureFont()
    for (let i = 0; i < POOL_SIZE; i++) {
      const text = new BitmapText({ text: '', style: { fontFamily: FONT_NAME, fontSize: FONT_SIZE } })
      text.anchor.set(0.5)
      text.visible = false
      layer.addChild(text)
      this.pool.push({ text, active: false, age: 0, life: LIFE, startY: 0, scale: 1 })
    }
  }

  /** Spawns (or reuses a pooled) floating text at (x, y). Pop-in animates from `scale * 1.4` down
   * to `scale`; the whole glyph then rises and fades per update(). */
  spawn(text: string, x: number, y: number, color: number, scale = 1): void {
    const slot = this.acquireSlot()
    slot.active = true
    slot.age = 0
    slot.life = LIFE
    slot.startY = y
    slot.scale = scale
    const bt = slot.text
    bt.text = text
    bt.tint = color
    bt.position.set(x, y)
    bt.alpha = 1
    bt.scale.set(scale * POP_IN_SCALE)
    bt.visible = true
  }

  // Free slot if one exists, else the active slot that has lived the longest (closest to death).
  private acquireSlot(): Slot {
    let oldest = this.pool[0]
    for (const slot of this.pool) {
      if (!slot.active) return slot
      if (slot.age > oldest.age) oldest = slot
    }
    return oldest
  }

  update(dt: number): void {
    for (const slot of this.pool) {
      if (!slot.active) continue
      slot.age += dt
      if (slot.age >= slot.life) {
        slot.active = false
        slot.text.visible = false
        continue
      }
      const t = slot.age / slot.life
      slot.text.y = slot.startY - RISE_PX * t
      slot.text.alpha = t < FADE_START ? 1 : 1 - (t - FADE_START) / (1 - FADE_START)
      if (slot.age < POP_IN_TIME) {
        const p = slot.age / POP_IN_TIME
        slot.text.scale.set(slot.scale * (POP_IN_SCALE + (1 - POP_IN_SCALE) * p))
      } else {
        slot.text.scale.set(slot.scale)
      }
    }
  }

  destroy(): void {
    for (const slot of this.pool) slot.text.destroy()
    this.pool.length = 0
  }
}
