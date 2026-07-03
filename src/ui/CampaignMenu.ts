// src/ui/CampaignMenu.ts
import { CAMPAIGN_LEVELS, loadProgress, resetProgress } from '../game/campaign'
import { cleanupPercent } from '../story/campaignStory'
import { i18n } from './i18n'
import { audioEngine } from './AudioEngine'
import { mountUi } from './uiRoot'
import { storageGet } from '../util/safeStorage'

/** Local-date stamp YYYYMMDD — one shared daily board per calendar day. */
export function dailyStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function getEnemyColor(kind: string): string {
  const map: Record<string, string> = {
    normal: '#ff4d4d',
    fast: '#36e0e0',
    healer: '#f0c43a',
    brute: '#c23bff',
    tank: '#ff9b3a',
    rogue: '#4dff7a',
    boss: '#c23bff',
    shielded: '#3a7bff',
    carrier: '#d08aff',
    fragment: '#ff8a8a',
  }
  return map[kind] || '#fff'
}

function isEnemyUnlocked(kind: string, unlockedLevelIndex: number): boolean {
  const map: Record<string, number> = {
    normal: 0, // Level 1
    fast: 1,   // Level 2
    healer: 2, // Level 3
    brute: 3,  // Level 4
    tank: 4,   // Level 5
    rogue: 6,  // Level 7
    shielded: 5, // Level 6
    carrier: 7,  // Level 8
    fragment: 7, // Level 8 (born from carriers)
    boss: 11,  // Level 12
  }
  return unlockedLevelIndex >= (map[kind] ?? 0)
}

export class CampaignMenu {
  private element: HTMLElement | null = null

  constructor(private opts: {
    onSelectLevel(index: number): void
    onShowLog(index: number): void
    onEndless?(): void
    onDaily?(): void
  }) {}

  mount(): HTMLElement {
    if (this.element) return this.element

    const wrap = document.createElement('div')
    wrap.className = 'pcb-campaign-screen'
    this.element = wrap

    this.render()
    mountUi(wrap)
    return wrap
  }

  render(): void {
    if (!this.element) return

    const progress = loadProgress()
    const unlocked = progress.unlockedLevelIndex
    // A level counts as completed when it has recorded stars — unlockedLevelIndex alone caps at
    // the last level, so the finale could never reach ISOLATED / 100% cleanup.
    const isDone = (i: number): boolean => i < unlocked || (progress.stars[i] || 0) > 0
    const completedCount = CAMPAIGN_LEVELS.reduce((n, _, i) => n + (isDone(i) ? 1 : 0), 0)
    const cleanup = cleanupPercent(completedCount)

    const dailyDone = storageGet(`pcb_td_daily_${dailyStamp()}`)
    const dailyLabel = dailyDone !== null
      ? `${i18n.t('mode.daily')} · ❤${dailyDone}`
      : i18n.t('mode.daily')
    const endlessBest = storageGet('pcb_td_endless_best_v1')
    const endlessLabel = endlessBest !== null
      ? `${i18n.t('mode.endless')} · ${i18n.t('mode.endless_best')} ${endlessBest}`
      : i18n.t('mode.endless')
    this.element.innerHTML = `
      <div class="pcb-campaign-header">
        <h1>PCB TD</h1>
        <h2>${i18n.t('campaign.subtitle')}</h2>
        <div class="pcb-campaign-station">${i18n.t('story.station.title')} ${cleanup}%</div>
      </div>
      <div class="pcb-campaign-levels"></div>
      <div class="pcb-campaign-footer" style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
        <button class="pcb-campaign-daily pcb-campaign-reset" style="background: rgba(240,196,58,0.1); border-color: #f0c43a; color: #f0c43a; box-shadow: 0 0 10px rgba(240,196,58,0.15);">${dailyLabel}</button>
        ${(progress.stars[11] || 0) > 0 ? `<button class="pcb-campaign-endless pcb-campaign-reset" style="background: rgba(194,59,255,0.1); border-color: #c23bff; color: #c23bff; box-shadow: 0 0 10px rgba(194,59,255,0.15);">${endlessLabel}</button>` : ''}
        <button class="pcb-campaign-bestiary pcb-campaign-reset" style="background: rgba(54,224,224,0.1); border-color: #36e0e0; color: #36e0e0; box-shadow: 0 0 10px rgba(54,224,224,0.15);">${i18n.t('bestiary.btn')}</button>
        <button class="pcb-campaign-reset">${i18n.t('campaign.reset')}</button>
      </div>
    `

    const container = this.element.querySelector('.pcb-campaign-levels')!
    CAMPAIGN_LEVELS.forEach((lvl, i) => {
      const isLocked = i > unlocked
      const starsCount = progress.stars[i] || 0
      const starsHtml = '★'.repeat(starsCount) + '☆'.repeat(3 - starsCount)
      
      const recordStr = i18n.lang === 'ru' ? 'РЕКОРД' : 'RECORD'
      const noneStr = i18n.lang === 'ru' ? 'НЕТ РЕКОРДА' : 'NO RECORD'
      const highscore = progress.highscores[i] !== undefined ? `${recordStr}: ❤${progress.highscores[i]}` : noneStr
      
      const diffClass = lvl.difficulty >= 7 ? 'hard' : lvl.difficulty >= 3 ? 'medium' : 'easy'
      const diffNameKey = lvl.difficulty >= 7 ? 'difficulty.hard' : lvl.difficulty >= 3 ? 'difficulty.medium' : 'difficulty.easy'
      const diffName = i18n.t(diffNameKey as any)

      // Status badge: completed levels are "isolated" (past threat, dim green), the current
      // frontier level is "infected" (active threat, red), locked ones show "no link" below.
      const isCompleted = isDone(i)
      const statusHtml = isLocked ? '' : isCompleted
        ? `<div class="pcb-level-status isolated">${i18n.t('story.status.isolated')}</div>`
        : `<div class="pcb-level-status infected">${i18n.t('story.status.infected')}</div>`
      // Every reachable level exposes its full shift-log (players re-read story at will).
      const logBtnHtml = !isLocked ? `<button class="pcb-level-log-btn">[${i18n.t('story.log.button')}]</button>` : ''

      const card = document.createElement('div')
      card.className = `pcb-level-card ${isLocked ? 'locked' : ''}`
      card.innerHTML = `
        <div class="pcb-level-num">${i18n.t('hud.level')} ${String(i + 1).padStart(2, '0')}</div>
        <div class="pcb-level-title">${i18n.t(lvl.nameKey as any) || lvl.name}</div>
        <div class="pcb-level-meta">
          <span class="pcb-hud-badge ${diffClass}">${diffName}</span>
          <span>${lvl.cols}×${lvl.rows}</span>
        </div>
        ${statusHtml}
        <div class="pcb-level-stars">${isLocked ? `🔒 ${i18n.t('story.status.nolink')}` : starsHtml}</div>
        <div class="pcb-level-score">${isLocked ? '' : highscore}</div>
        ${logBtnHtml}
      `

      if (!isLocked) {
        card.onclick = () => {
          this.opts.onSelectLevel(i)
        }
      }

      // Handler must match the render condition (!isLocked) — a rendered button without a
      // handler lets the click bubble into the card and START THE LEVEL instead of the log.
      if (!isLocked) {
        const logBtn = card.querySelector('.pcb-level-log-btn') as HTMLButtonElement | null
        if (logBtn) {
          logBtn.onclick = (e) => {
            e.stopPropagation()
            this.opts.onShowLog(i)
          }
        }
      }

      container.appendChild(card)
    })

    const btnReset = this.element.querySelector('.pcb-campaign-reset') as HTMLButtonElement
    btnReset.onclick = () => {
      if (confirm(i18n.t('campaign.reset_confirm'))) {
        resetProgress()
        this.render()
      }
    }

    const btnDaily = this.element.querySelector('.pcb-campaign-daily') as HTMLButtonElement | null
    if (btnDaily) btnDaily.onclick = () => { audioEngine.playClick(); this.opts.onDaily?.() }
    const btnEndless = this.element.querySelector('.pcb-campaign-endless') as HTMLButtonElement | null
    if (btnEndless) btnEndless.onclick = () => { audioEngine.playClick(); this.opts.onEndless?.() }
    const btnBestiary = this.element.querySelector('.pcb-campaign-bestiary') as HTMLButtonElement
    btnBestiary.onclick = () => {
      audioEngine.playClick()
      this.showBestiary(unlocked)
    }
  }

  showBestiary(unlockedLevelIndex: number, onClose?: () => void): void {
    const modal = document.createElement('div')
    modal.className = 'pcb-settings-modal'
    modal.style.zIndex = '300'
    modal.style.display = 'flex'
    
    let itemsHtml = ''
    // Display order follows the FORM-NN nomenclature (story spec, Task 5).
    const kinds = ['normal', 'fast', 'rogue', 'tank', 'healer', 'brute', 'boss', 'shielded', 'carrier', 'fragment']
    kinds.forEach((k) => {
      const unlocked = isEnemyUnlocked(k, unlockedLevelIndex)
      const color = getEnemyColor(k)
      
      if (unlocked) {
        const name = i18n.t(`enemy.${k}` as any)
        const desc = i18n.t(`enemy.${k}.desc` as any)
        const strat = i18n.t(`enemy.${k}.strat` as any)
        itemsHtml += `
          <div class="bestiary-item" style="border-bottom: 1px solid #1a4534; padding-bottom: 10px; text-align: left;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
              <span class="pcb-wavepreview-dot" style="background: ${color}; box-shadow: 0 0 6px ${color}; width: 8px; height: 8px; display: inline-block; border-radius: 50%;"></span>
              <span style="font-weight: bold; color: ${color}; font-size: 13px;">${name}</span>
            </div>
            <div style="color: #fff; margin-bottom: 6px; font-size: 11px; line-height: 1.4;">${desc}</div>
            <div style="color: #6f8f7e; font-size: 10px; line-height: 1.3;"><span style="color: #f0c43a; font-weight: bold;">${i18n.t('bestiary.strategy')}:</span> ${strat}</div>
          </div>
        `
      } else {
        itemsHtml += `
          <div class="bestiary-item locked" style="opacity: 0.35; border-bottom: 1px solid #1a4534; padding-bottom: 10px; text-align: left;">
            <div style="font-weight: bold; color: #888; font-size: 11px; display: flex; align-items: center; gap: 8px;">
              <span>🔒</span> <span>${i18n.t('bestiary.locked')}</span>
            </div>
          </div>
        `
      }
    })

    modal.innerHTML = `
      <div class="pcb-settings-card" style="width: 440px; max-width: 90%; max-height: 80vh; overflow-y: auto;">
        <h2 style="font-size: 16px; margin-bottom: 16px;">${i18n.t('bestiary.title')}</h2>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
          ${itemsHtml}
        </div>
        <button class="pcb-hud-btn active close-bestiary-btn" style="width: 100%;">${i18n.t('bestiary.close')}</button>
      </div>
    `
    mountUi(modal);

    const closeBestiary = () => {
      audioEngine.playClick()
      modal.parentNode?.removeChild(modal)
      onClose?.()
    }
    ;(modal.querySelector('.close-bestiary-btn') as HTMLElement).onclick = closeBestiary
    modal.onclick = (e) => { if (e.target === modal) closeBestiary() }
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
