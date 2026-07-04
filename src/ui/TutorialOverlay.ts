// src/ui/TutorialOverlay.ts
import { i18n } from './i18n'
import { mountUi } from './uiRoot'

export class TutorialOverlay {
  private bubble: HTMLElement | null = null
  private spotlight: HTMLElement | null = null
  /** Wired by main.ts: a veteran must be able to bail out of the guided intro at any step. */
  onSkip: (() => void) | null = null

  constructor() {}

  mount(): void {
    if (this.bubble) return
    
    this.bubble = document.createElement('div')
    this.bubble.className = 'pcb-tutorial-bubble'
    this.bubble.style.display = 'none'
    mountUi(this.bubble)

    this.spotlight = document.createElement('div')
    this.spotlight.className = 'pcb-tutorial-spotlight'
    this.spotlight.style.display = 'none'
    mountUi(this.spotlight)
  }

  showStep(text: string, x: number, y: number, onNext: (() => void) | null = null, gap = 60): void {
    this.mount()

    // Position bubble - auto flip if too low or high
    this.bubble!.style.display = 'block'
    const bubbleHeight = 110
    const container = document.getElementById('game-container')
    const screenW = container ? container.clientWidth : window.innerWidth
    const screenH = container ? container.clientHeight : window.innerHeight
    // gap: 60 keeps the bubble hugging its target; the radial-menu step passes ~150 so the
    // text clears the chip ring that opens on click
    const posY = y + bubbleHeight + gap > screenH ? y - bubbleHeight - gap : y + gap
    
    this.bubble!.style.left = `${Math.max(20, Math.min(screenW - 270, x - 125))}px`
    this.bubble!.style.top = `${posY}px`

    this.bubble!.innerHTML = `
      <p style="margin: 0 0 10px 0; line-height: 1.4;">${text}</p>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button class="pcb-tutorial-skip">${i18n.t('tutorial.skip')}</button>
        ${onNext ? `<button class="pcb-hud-btn active tutorial-next">${i18n.t('tutorial.next')}</button>` : '<span></span>'}
      </div>
    `
    if (onNext) {
      (this.bubble!.querySelector('.tutorial-next') as HTMLButtonElement).onclick = onNext
    }
    const skip = this.bubble!.querySelector('.pcb-tutorial-skip') as HTMLButtonElement
    skip.onclick = () => this.onSkip?.()

    // Position spotlight
    this.spotlight!.style.display = 'block'
    this.spotlight!.style.left = `${x}px`
    this.spotlight!.style.top = `${y}px`
  }

  hide(): void {
    if (this.bubble) this.bubble.style.display = 'none'
    if (this.spotlight) this.spotlight.style.display = 'none'
  }

  destroy(): void {
    if (this.bubble) { this.bubble.remove(); this.bubble = null }
    if (this.spotlight) { this.spotlight.remove(); this.spotlight = null }
  }
}
