// src/ui/CampaignMenu.ts
import { CAMPAIGN_LEVELS, loadProgress, resetProgress } from '../game/campaign'

export class CampaignMenu {
  private element: HTMLElement | null = null

  constructor(private opts: {
    onSelectLevel(index: number): void
  }) {}

  mount(): HTMLElement {
    if (this.element) return this.element

    const wrap = document.createElement('div')
    wrap.className = 'pcb-campaign-screen'
    this.element = wrap

    this.render()
    document.body.appendChild(wrap)
    return wrap
  }

  render(): void {
    if (!this.element) return

    const progress = loadProgress()
    const unlocked = progress.unlockedLevelIndex

    this.element.innerHTML = `
      <div class="pcb-campaign-header">
        <h1>PCB TD</h1>
        <h2>ВЫБОР ИСПЫТАНИЯ (КАМПАНИЯ)</h2>
      </div>
      <div class="pcb-campaign-levels"></div>
      <div class="pcb-campaign-footer">
        <button class="pcb-campaign-reset">СБРОСИТЬ ПРОГРЕСС</button>
      </div>
    `

    const container = this.element.querySelector('.pcb-campaign-levels')!
    CAMPAIGN_LEVELS.forEach((lvl, i) => {
      const isLocked = i > unlocked
      const starsCount = progress.stars[i] || 0
      const starsHtml = '★'.repeat(starsCount) + '☆'.repeat(3 - starsCount)
      const highscore = progress.highscores[i] !== undefined ? `РЕКОРД: ❤${progress.highscores[i]}` : 'НЕТ РЕКОРДА'
      
      const diffClass = lvl.difficulty >= 7 ? 'hard' : lvl.difficulty >= 3 ? 'medium' : 'easy'
      const diffName = lvl.difficulty >= 7 ? 'HARD' : lvl.difficulty >= 3 ? 'MEDIUM' : 'EASY'

      const card = document.createElement('div')
      card.className = `pcb-level-card ${isLocked ? 'locked' : ''}`
      card.innerHTML = `
        <div class="pcb-level-num">LEVEL ${String(i + 1).padStart(2, '0')}</div>
        <div class="pcb-level-title">${lvl.name}</div>
        <div class="pcb-level-meta">
          <span class="pcb-hud-badge ${diffClass}">${diffName}</span>
          <span>${lvl.cols}×${lvl.rows}</span>
        </div>
        <div class="pcb-level-stars">${isLocked ? '🔒 ЗАБЛОКИРОВАНО' : starsHtml}</div>
        <div class="pcb-level-score">${isLocked ? '' : highscore}</div>
      `

      if (!isLocked) {
        card.onclick = () => {
          this.opts.onSelectLevel(i)
        }
      }

      container.appendChild(card)
    })

    const btnReset = this.element.querySelector('.pcb-campaign-reset') as HTMLButtonElement
    btnReset.onclick = () => {
      if (confirm('Вы уверены, что хотите полностью сбросить прогресс кампании?')) {
        resetProgress()
        this.render()
      }
    }
  }

  show(): void {
    if (!this.element) this.mount()
    this.render()
    this.element!.style.display = 'flex'
  }

  hide(): void {
    if (this.element) {
      this.element.style.display = 'none'
    }
  }
}
