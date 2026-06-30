// src/ui/TutorialOverlay.ts
import { i18n } from './i18n'

export class TutorialOverlay {
  private bubble: HTMLElement | null = null
  private spotlight: HTMLElement | null = null

  constructor() {}

  mount(): void {
    if (this.bubble) return
    
    this.bubble = document.createElement('div')
    this.bubble.className = 'pcb-tutorial-bubble'
    this.bubble.style.display = 'none'
    document.body.appendChild(this.bubble)

    this.spotlight = document.createElement('div')
    this.spotlight.className = 'pcb-tutorial-spotlight'
    this.spotlight.style.display = 'none'
    document.body.appendChild(this.spotlight)
  }

  showStep(text: string, x: number, y: number, onNext: (() => void) | null = null): void {
    this.mount()

    // Position bubble - auto flip if too low or high
    this.bubble!.style.display = 'block'
    const bubbleHeight = 110
    const screenH = window.innerHeight
    // clear the radial build ring (~120px radius) so the text never sits on top of the chip menu
    const gap = 150
    const posY = y + bubbleHeight + gap > screenH ? y - bubbleHeight - gap : y + gap
    
    this.bubble!.style.left = `${Math.max(20, Math.min(window.innerWidth - 270, x - 125))}px`
    this.bubble!.style.top = `${posY}px`

    this.bubble!.innerHTML = `
      <p style="margin: 0 0 10px 0; line-height: 1.4;">${text}</p>
      ${onNext ? `<div style="display: flex; justify-content: flex-end;"><button class="pcb-hud-btn active">${i18n.t('tutorial.next')}</button></div>` : ''}
    `
    if (onNext) {
      (this.bubble!.querySelector('button') as HTMLButtonElement).onclick = onNext
    }

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
