// Meta-layer DOM screens: the star workshop, the achievements gallery, the operator
// dossier, and achievement toasts. All reuse the pcb-settings-modal shell.
import { i18n } from './i18n'
import { audioEngine } from './AudioEngine'
import { mountUi } from './uiRoot'
import { showConfirm } from './confirmModal'
import {
  META_UPGRADES, META_UPGRADE_IDS, nextTierCost, type MetaUpgradeId,
} from '../game/metaUpgrades'
import { loadProgress, starsAvailable, buyMetaUpgrade, respecMetaUpgrades } from '../game/campaign'
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../game/achievements'
import { achievementBadgeSvg, CATEGORY_COLORS } from './achievementArt'
import { loadStats, favoriteTower } from '../game/profileStats'

function modalShell(onClose?: () => void): { modal: HTMLElement; card: HTMLElement; close: () => void } {
  const modal = document.createElement('div')
  modal.className = 'pcb-settings-modal'
  modal.style.display = 'flex'
  const card = document.createElement('div')
  card.className = 'pcb-settings-card'
  card.style.cssText = 'width: 480px; max-width: 92%; max-height: 84vh; overflow-y: auto; text-align: left;'
  modal.appendChild(card)
  const close = (): void => {
    audioEngine.playClick()
    modal.remove()
    onClose?.()
  }
  modal.onclick = (e) => { if (e.target === modal) close() }
  mountUi(modal)
  return { modal, card, close }
}

/** Per-tier display value for a workshop track ("+45 ⚡", "75% refund", …). */
function tierValueLabel(id: MetaUpgradeId, tier: number): string {
  const v = META_UPGRADES[id].tiers[tier].value
  const n = id === 'recycler' ? Math.round(v * 100) : id === 'firmware' ? Math.round(v * 100) : v
  return i18n.tk(`meta.${id}.value`).replace('{n}', String(n))
}

/** Станция workshop: spend stars on permanent upgrade tracks. */
export function showWorkshop(onChange?: () => void): void {
  const { card, close } = modalShell(onChange)

  const render = (): void => {
    const progress = loadProgress()
    const levels = progress.metaUpgrades ?? {}
    const balance = starsAvailable(progress)
    const rows = META_UPGRADE_IDS.map((id) => {
      const def = META_UPGRADES[id]
      const lvl = levels[id] ?? 0
      const cost = nextTierCost(id, levels)
      const pips = def.tiers.map((_, i) =>
        `<span style="display:inline-block;width:10px;height:10px;margin-right:3px;border:1px solid #f0c43a;${i < lvl ? 'background:#f0c43a;box-shadow:0 0 5px rgba(240,196,58,.6);' : ''}"></span>`,
      ).join('')
      const valueNow = lvl > 0 ? tierValueLabel(id, lvl - 1) : ''
      const valueNext = cost !== null ? tierValueLabel(id, lvl) : ''
      const buyBtn = cost === null
        ? `<button class="pcb-hud-btn" disabled style="opacity:.5;">${i18n.t('meta.maxed')}</button>`
        : `<button class="pcb-hud-btn meta-buy" data-id="${id}" ${cost > balance ? 'disabled style="opacity:.5;"' : ''}>${i18n.t('meta.buy')} ★${cost}</button>`
      return `
        <div style="border:1px solid #1a4534;border-radius:4px;padding:10px 12px;display:flex;gap:12px;align-items:center;">
          <div style="flex:1;">
            <div style="color:#f0c43a;font-weight:bold;font-size:12px;letter-spacing:1px;">${i18n.tk(`meta.${id}.name`)}</div>
            <div style="color:#8fb3a0;font-size:10.5px;margin:3px 0;">${i18n.tk(`meta.${id}.desc`)}</div>
            <div style="font-size:10px;color:#fff;">${pips} ${valueNow ? `<span style="color:#6cf2a0;">${valueNow}</span>` : ''} ${valueNext ? `<span style="color:#5b7a68;">→ ${valueNext}</span>` : ''}</div>
          </div>
          ${buyBtn}
        </div>`
    }).join('')

    card.innerHTML = `
      <h2 style="font-size:16px;margin:0 0 4px;">${i18n.t('meta.title')}</h2>
      <div style="color:#8fb3a0;font-size:10.5px;margin-bottom:12px;">${i18n.t('meta.subtitle')}</div>
      <div style="color:#f0c43a;font-size:13px;font-weight:bold;margin-bottom:12px;">${i18n.t('meta.balance')}: ★${balance}</div>
      <div style="display:flex;flex-direction:column;gap:8px;">${rows}</div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="pcb-hud-btn meta-respec" style="flex:1;">${i18n.t('meta.respec')}</button>
        <button class="pcb-hud-btn active meta-close" style="flex:1;">${i18n.t('meta.close')}</button>
      </div>`

    for (const btn of Array.from(card.querySelectorAll<HTMLButtonElement>('.meta-buy'))) {
      btn.onclick = () => {
        if (buyMetaUpgrade(btn.dataset.id as MetaUpgradeId)) { audioEngine.playUpgrade(); render() }
        else audioEngine.playError()
      }
    }
    ;(card.querySelector('.meta-respec') as HTMLElement).onclick = async () => {
      if (await showConfirm(i18n.t('meta.respec_confirm'))) { respecMetaUpgrades(); render() }
    }
    ;(card.querySelector('.meta-close') as HTMLElement).onclick = close
  }
  render()
}

/** Achievements gallery: earned badges glow, locked ones show a silhouette + hint. */
export function showAchievements(): void {
  const { card, close } = modalShell()
  const earned = new Set(loadProgress().achievements ?? [])

  const sections = ACHIEVEMENT_CATEGORIES.map((cat) => {
    const defs = ACHIEVEMENTS.filter((a) => a.category === cat)
    if (defs.length === 0) return ''
    const items = defs.map((a) => {
      const has = earned.has(a.id)
      return `
        <div style="display:flex;gap:10px;align-items:center;border-bottom:1px solid #12281d;padding:7px 0;${has ? '' : 'opacity:.55;'}">
          <div style="flex-shrink:0;">${achievementBadgeSvg(a.id, has, 44)}</div>
          <div>
            <div style="font-size:11.5px;font-weight:bold;letter-spacing:1px;color:${has ? CATEGORY_COLORS[cat] : '#6f8f7e'};">${i18n.tk(`ach.${a.id}.name`)}</div>
            <div style="font-size:10px;color:#8fb3a0;margin-top:2px;">${i18n.tk(`ach.${a.id}.desc`)}</div>
          </div>
        </div>`
    }).join('')
    return `
      <div style="margin-bottom:14px;">
        <div style="font-size:10px;letter-spacing:2px;color:${CATEGORY_COLORS[cat]};border-bottom:1px solid ${CATEGORY_COLORS[cat]};padding-bottom:3px;margin-bottom:4px;">${i18n.tk(`ach.cat.${cat}`)}</div>
        ${items}
      </div>`
  }).join('')

  card.innerHTML = `
    <h2 style="font-size:16px;margin:0 0 4px;">${i18n.t('ach.title')}</h2>
    <div style="color:#8fb3a0;font-size:11px;margin-bottom:14px;">${i18n.t('ach.progress').replace('{n}', String(earned.size)).replace('{m}', String(ACHIEVEMENTS.length))}</div>
    ${sections}
    <button class="pcb-hud-btn active ach-close" style="width:100%;margin-top:8px;">${i18n.t('ach.close')}</button>`
  ;(card.querySelector('.ach-close') as HTMLElement).onclick = close
}

/** Operator dossier: lifetime stats. */
export function showDossier(): void {
  const { card, close } = modalShell()
  const s = loadStats()
  const fav = favoriteTower(s)
  const favLabel = fav ? i18n.tk(`tower.${fav}`) : i18n.t('profile.empty')
  const row = (label: string, value: string | number): string =>
    `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #12281d;padding:6px 0;font-size:11.5px;">
       <span style="color:#8fb3a0;">${label}</span><span style="color:#fff;font-weight:bold;">${value}</span>
     </div>`
  card.innerHTML = `
    <h2 style="font-size:16px;margin:0 0 12px;">${i18n.t('profile.title')}</h2>
    ${row(i18n.t('profile.kills'), s.totalKills)}
    ${row(i18n.t('profile.wins'), s.totalWins)}
    ${row(i18n.t('profile.losses'), s.totalLosses)}
    ${row(i18n.t('profile.leaks'), s.totalLeaks)}
    ${row(i18n.t('profile.gold'), s.totalGoldEarned)}
    ${row(i18n.t('profile.builds'), s.totalBuilds)}
    ${row(i18n.t('profile.favorite'), favLabel)}
    ${row(i18n.t('profile.discharges'), s.totalDischarges)}
    ${row(i18n.t('profile.endless_best'), s.bestEndlessWave || i18n.t('profile.empty'))}
    ${row(i18n.t('profile.dailies'), s.dailiesPlayed)}
    <button class="pcb-hud-btn active dossier-close" style="width:100%;margin-top:14px;">${i18n.t('profile.close')}</button>`
  ;(card.querySelector('.dossier-close') as HTMLElement).onclick = close
}

/** Stacked bottom-right toasts for freshly earned achievements. */
export function showAchievementToasts(ids: string[]): void {
  if (ids.length === 0) return
  let host = document.querySelector('.pcb-ach-toasts') as HTMLElement | null
  if (!host) {
    host = document.createElement('div')
    host.className = 'pcb-ach-toasts'
    mountUi(host)
  }
  ids.forEach((id, i) => {
    const el = document.createElement('div')
    el.className = 'pcb-ach-toast'
    el.innerHTML = `
      ${achievementBadgeSvg(id, true, 36)}
      <div>
        <div class="pcb-ach-toast-title">${i18n.t('ach.toast')}</div>
        <div class="pcb-ach-toast-name">${i18n.tk(`ach.${id}.name`)}</div>
      </div>`
    window.setTimeout(() => {
      host!.appendChild(el)
      audioEngine.playStar()
      window.setTimeout(() => { el.classList.add('out'); window.setTimeout(() => el.remove(), 400) }, 4200)
    }, i * 700)
  })
}
