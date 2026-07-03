// src/ui/Panels.ts
import type { Level } from '../model/level'
import { i18n } from './i18n'
import { mountUi } from './uiRoot'

let currentTipIndex = 0
const TIP_KEYS = ['tips.desc1', 'tips.desc2', 'tips.desc3', 'tips.desc4', 'tips.desc5', 'tips.desc6', 'tips.desc7', 'tips.desc8', 'tips.desc9', 'tips.desc10', 'tips.desc11', 'tips.desc12'] as const
let tipInterval: any = null

function startTipRotation() {
  if (tipInterval) clearInterval(tipInterval)
  tipInterval = setInterval(() => {
    currentTipIndex = (currentTipIndex + 1) % TIP_KEYS.length
    updateTipContent()
  }, 8000) // cycle every 8 seconds
}

export function mountPanels(level: Level | null): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'pcb-panels'
  
  const lvlName = level ? (i18n.t(level.meta.name as any) || level.meta.name) : 'LEVEL --'

  wrap.innerHTML = `
    <div class="pcb-panel pcb-legend">
      <h3>${i18n.t('legend.title')}</h3>
      <ul>
        <li><span class="sw trace"></span> ${i18n.t('legend.path')}</li>
        <li><span class="sw build"></span> ${i18n.t('legend.build')}</li>
        <li><span class="sw special"></span> ${i18n.t('legend.special')}</li>
        <li><span class="sw start"></span> ${i18n.t('legend.start')}</li>
        <li><span class="sw finish"></span> ${i18n.t('legend.finish')}</li>
      </ul>
    </div>
    <div class="pcb-panel pcb-info">
      <h3>${lvlName}</h3>
      <div>${i18n.t('hud.wave')} 0/30</div>
      <div>${i18n.t('hud.lives')} 20</div>
      <div>${i18n.t('hud.gold')} 650</div>
    </div>
    <div class="pcb-panel pcb-tips">
      <span class="pcb-tips-close" style="position: absolute; top: 2px; right: 2px; cursor: pointer; color: #6cf2a0; font-size: 14px; padding: 6px 8px; line-height: 1; z-index: 5;" title="close">✕</span>
      <h3>${i18n.t('tips.title')}</h3>
      <p class="pcb-tip-content" style="min-height: 48px; margin: 0 0 10px 0; line-height: 1.4; font-size: 11px;"></p>
      <div class="pcb-tip-nav" style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 10px; color: #6cf2a0; user-select: none;">
        <span class="pcb-tip-prev" style="cursor: pointer; padding: 2px 6px; border: 1px solid #1f8f4d; border-radius: 3px; background: rgba(31,143,77,0.1);">◀</span>
        <span class="pcb-tip-counter">1 / 12</span>
        <span class="pcb-tip-next" style="cursor: pointer; padding: 2px 6px; border: 1px solid #1f8f4d; border-radius: 3px; background: rgba(31,143,77,0.1);">▶</span>
      </div>
    </div>`
  mountUi(wrap)

  // Tips close for the CURRENT level only — they come back on the next level / reload
  // (players asked for that: dismiss is a "not now", not a "never again").
  const tipsPanel = wrap.querySelector('.pcb-tips') as HTMLElement
  if (tipsPanel) {
    const close = tipsPanel.querySelector('.pcb-tips-close') as HTMLElement
    if (close) {
      // pointerdown (not click): the canvas drag handlers live on window and a slow press
      // can swallow the click; stopPropagation keeps the press from starting a camera drag.
      const dismiss = (e: Event) => {
        e.stopPropagation()
        tipsPanel.style.display = 'none'
      }
      close.addEventListener('pointerdown', dismiss)
      close.addEventListener('click', dismiss)
    }
  }

  const prev = wrap.querySelector('.pcb-tip-prev') as HTMLElement
  const next = wrap.querySelector('.pcb-tip-next') as HTMLElement
  if (prev && next) {
    prev.onclick = () => {
      currentTipIndex = (currentTipIndex - 1 + TIP_KEYS.length) % TIP_KEYS.length
      updateTipContent()
      startTipRotation() // reset interval on manual click
    }
    next.onclick = () => {
      currentTipIndex = (currentTipIndex + 1) % TIP_KEYS.length
      updateTipContent()
      startTipRotation() // reset interval on manual click
    }
  }

  updateTipContent()
  startTipRotation()
  return wrap
}

export function updateTipContent(): void {
  const content = document.querySelector('.pcb-tip-content')
  const counter = document.querySelector('.pcb-tip-counter')
  if (content && counter) {
    content.textContent = i18n.t(TIP_KEYS[currentTipIndex])
    counter.textContent = `${currentTipIndex + 1} / ${TIP_KEYS.length}`
  }
}

export function updateLevelName(name: string): void {
  const h3 = document.querySelector('.pcb-info h3')
  if (h3) h3.textContent = name
}

/** Re-show the tips panel (called on every level entry — dismissal is per-level only). */
export function showTipsPanel(): void {
  const el = document.querySelector('.pcb-tips') as HTMLElement | null
  if (el) el.style.display = ''
}

export function retranslatePanels(levelName = 'LEVEL --'): void {
  const legendTitle = document.querySelector('.pcb-legend h3')
  if (legendTitle) legendTitle.textContent = i18n.t('legend.title')

  const legendItems = document.querySelectorAll('.pcb-legend li')
  if (legendItems.length >= 5) {
    legendItems[0].innerHTML = `<span class="sw trace"></span> ${i18n.t('legend.path')}`
    legendItems[1].innerHTML = `<span class="sw build"></span> ${i18n.t('legend.build')}`
    legendItems[2].innerHTML = `<span class="sw special"></span> ${i18n.t('legend.special')}`
    legendItems[3].innerHTML = `<span class="sw start"></span> ${i18n.t('legend.start')}`
    legendItems[4].innerHTML = `<span class="sw finish"></span> ${i18n.t('legend.finish')}`
  }

  const infoTitle = document.querySelector('.pcb-info h3')
  if (infoTitle) infoTitle.textContent = levelName

  const infoDivs = document.querySelectorAll('.pcb-info div')
  if (infoDivs.length >= 3) {
    infoDivs[0].textContent = `${i18n.t('hud.wave')} 0/30`
    infoDivs[1].textContent = `${i18n.t('hud.lives')} 20`
    infoDivs[2].textContent = `${i18n.t('hud.gold')} 650`
  }

  const tipsTitle = document.querySelector('.pcb-tips h3')
  if (tipsTitle) tipsTitle.textContent = i18n.t('tips.title')

  updateTipContent()
}
