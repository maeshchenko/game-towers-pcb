// src/ui/GameUI.ts
import type { Game } from '../game/Game'
import type { Tower } from '../game/Tower'
import { TOWER_DEFS, TOWER_BRANCHES, type TowerKind } from '../game/towerTypes'
import { audioEngine } from './AudioEngine'
import { i18n } from './i18n'
import { juice, setReducedFx } from '../render/juice/motion'
import { exportProgressCode, importProgressCode } from '../game/campaign'
import { waveComposition } from '../game/WaveManager'
import { loadPlayerDifficulty, savePlayerDifficulty } from '../game/playerPrefs'
import { mountUi } from './uiRoot'

export function formatHud(s: { wave: number; waveCount: number; lives: number; gold: number; phase: string }) {
  return { wave: `${i18n.t('hud.wave')} ${s.wave}/${s.waveCount}`, lives: `${i18n.t('hud.lives')} ${s.lives}`, gold: `${i18n.t('hud.gold')} ${s.gold}` }
}

const KINDS: TowerKind[] = ['cannon', 'slow', 'sniper', 'mortar', 'tesla']
const TOWER_THEMES: Record<TowerKind, { name: string; color: string; glow: string; dx: string; dy: string }> = {
  cannon: { name: 'PULSE', color: '#36e0e0', glow: 'rgba(54,224,224,0.4)', dx: '0px', dy: '-70px' },
  slow: { name: 'SLOW', color: '#4dff7a', glow: 'rgba(77,255,122,0.4)', dx: '67px', dy: '-22px' },
  sniper: { name: 'LASER', color: '#3a7bff', glow: 'rgba(58,123,255,0.4)', dx: '41px', dy: '57px' },
  mortar: { name: 'MISSILE', color: '#ff9b3a', glow: 'rgba(255,155,58,0.4)', dx: '-41px', dy: '57px' },
  tesla: { name: 'TESLA', color: '#c23bff', glow: 'rgba(194,59,255,0.4)', dx: '-67px', dy: '-22px' },
}

export class GameUI {
  private elWave!: HTMLElement; private elLives!: HTMLElement; private elGold!: HTMLElement
  private elDiff!: HTMLElement
  private panel!: HTMLElement
  private levelNumber = 1   // campaign level # (fixed across all waves of the level)
  private radial!: HTMLElement
  private radialBackdrop!: HTMLElement
  private overlay!: HTMLElement
  private wavePreview!: HTMLElement
  private radialTooltip!: HTMLElement
  private settingsModal!: HTMLElement
  private speedBtns: Record<number, HTMLButtonElement> = {}
  private btnPause!: HTMLButtonElement
  private btnAbility: HTMLButtonElement | null = null
  private autoWaveActive = true
  private waveBanner: HTMLElement | null = null
  private waveBannerTimer: number | null = null

  constructor(private opts: {
    onBuild(kind: TowerKind, spotIndex: number): void; onStartWave(): void; onTogglePlay(): void
    onSpeed(mult: number): void; onUpgrade(): void; onSell(): void; onTargetMode(): void
    onUpgradeBranch?(b: 0 | 1): void
    onAbility?(): void
    onMenu?(): void
    onLanguageChanged?(): void
    onAutoWaveChanged?(val: boolean): void
    onOpenBestiary?(): void
    onProgressImported?(): void
  }) {}

  selectedBuildKind(): TowerKind | null { return null } // Legacy placeholder

  setAutoWave(val: boolean): void {
    this.autoWaveActive = val
  }

  isAutoWave(): boolean {
    return this.autoWaveActive
  }

  mountHud(): HTMLElement {
    // Top HUD
    const hud = document.createElement('div')
    hud.className = 'pcb-tophud'

    const left = document.createElement('div')
    left.className = 'pcb-hud-left'

    const lbl = document.createElement('span')
    lbl.className = 'hud-level-label'
    lbl.textContent = i18n.t('hud.level') + ' '
    
    const val = document.createElement('span')
    val.className = 'pcb-hud-val level-num'
    val.textContent = '01'

    const space = document.createTextNode(' ')

    const badge = document.createElement('span')
    badge.className = 'pcb-hud-badge difficulty-badge'
    this.elDiff = badge

    const btnMap = document.createElement('button')
    btnMap.className = 'pcb-hud-btn map-btn'
    btnMap.textContent = i18n.t('hud.map')
    btnMap.style.marginLeft = '12px'
    btnMap.onclick = () => { audioEngine.playClick(); if (this.opts.onMenu) this.opts.onMenu() }

    left.append(lbl, val, space, badge, btnMap)

    const center = document.createElement('div')
    center.className = 'pcb-hud-center'
    this.elWave = document.createElement('span')
    this.elWave.className = 'pcb-hud-badge'
    this.elLives = document.createElement('span')
    this.elLives.className = 'pcb-hud-badge'
    this.elLives.style.color = '#ff4d4d'
    this.elGold = document.createElement('span')
    this.elGold.className = 'pcb-hud-badge'
    this.elGold.style.color = '#f0c43a'
    center.append(this.elWave, this.elLives, this.elGold)

    const right = document.createElement('div')
    right.className = 'pcb-hud-right'

    const btnStart = document.createElement('button')
    btnStart.className = 'pcb-hud-btn active next-wave-btn'
    btnStart.textContent = i18n.t('hud.start_wave')
    btnStart.onclick = () => { audioEngine.playClick(); this.opts.onStartWave() }

    const btnPause = document.createElement('button')
    btnPause.className = 'pcb-hud-btn'
    btnPause.textContent = '⏸'
    btnPause.onclick = () => { audioEngine.playClick(); this.opts.onTogglePlay() }
    this.btnPause = btnPause

    const btn1x = document.createElement('button')
    btn1x.className = 'pcb-hud-btn active'
    btn1x.textContent = '1×'
    btn1x.onclick = () => { audioEngine.playClick(); this.opts.onSpeed(1); this.selectSpeed(1) }
    this.speedBtns[1] = btn1x

    const btn2x = document.createElement('button')
    btn2x.className = 'pcb-hud-btn'
    btn2x.textContent = '2×'
    btn2x.onclick = () => { audioEngine.playClick(); this.opts.onSpeed(2); this.selectSpeed(2) }
    this.speedBtns[2] = btn2x

    const btn4x = document.createElement('button')
    btn4x.className = 'pcb-hud-btn'
    btn4x.textContent = '4×'
    btn4x.onclick = () => { audioEngine.playClick(); this.opts.onSpeed(4); this.selectSpeed(4) }
    this.speedBtns[4] = btn4x

    // Active ability: capacitor discharge (armed → next board click detonates).
    const btnAbility = document.createElement('button')
    btnAbility.className = 'pcb-hud-btn ability-btn'
    btnAbility.textContent = '⚡'
    btnAbility.title = i18n.t('ability.discharge.hint')
    btnAbility.onclick = () => { audioEngine.playClick(); this.opts.onAbility?.() }
    this.btnAbility = btnAbility

    const btnBestiary = document.createElement('button')
    btnBestiary.className = 'pcb-hud-btn'
    btnBestiary.textContent = '📖'
    btnBestiary.title = 'Бестиарий / Bestiary'
    btnBestiary.onclick = () => {
      audioEngine.playClick()
      if (this.opts.onOpenBestiary) this.opts.onOpenBestiary()
    }

    const btnSettings = document.createElement('button')
    btnSettings.className = 'pcb-hud-btn'
    btnSettings.textContent = '⚙️'
    btnSettings.onclick = () => {
      audioEngine.playClick()
      this.showSettings()
    }

    right.append(btnStart, btnPause, btn1x, btn2x, btn4x, btnAbility, btnBestiary, btnSettings)
    hud.append(left, center, right)
    mountUi(hud)

    // Wave Preview (initially hidden)
    this.wavePreview = document.createElement('div')
    this.wavePreview.className = 'pcb-wavepreview'
    this.wavePreview.style.display = 'none'
    mountUi(this.wavePreview)

    // Radial build menu (initially empty)
    this.radial = document.createElement('div')
    this.radial.className = 'pcb-radialmenu'
    mountUi(this.radial)

    // Dim backdrop behind the radial so the build menu reads as a modal, not merged into the board.
    this.radialBackdrop = document.createElement('div')
    this.radialBackdrop.className = 'pcb-radial-backdrop'
    this.radialBackdrop.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      this.closeRadialMenu()
    })
    mountUi(this.radialBackdrop)

    // Robust tutorial zoom/pan freeze: capturing blockers that detect the tutorial via the DOM (no
    // dependency on main.ts), so the camera can't move while the guided ring is anchored to a spot.
    // Lives in GameUI (a hot-reloadable module) so it applies even when main.ts isn't re-evaluated.
    const tutorialActive = (): boolean => {
      const b = document.querySelector('.pcb-tutorial-bubble') as HTMLElement | null
      return !!b && getComputedStyle(b).display !== 'none'
    }
    window.addEventListener('wheel', (e) => {
      if (tutorialActive()) { e.preventDefault(); e.stopImmediatePropagation() }
    }, { capture: true, passive: false })
    window.addEventListener('pointermove', (e) => {
      if (tutorialActive()) e.stopImmediatePropagation()
    }, { capture: true })

    // Radial Build Tooltip
    this.radialTooltip = document.createElement('div')
    this.radialTooltip.className = 'pcb-radial-tooltip'
    this.radialTooltip.style.display = 'none'
    mountUi(this.radialTooltip)

    // Settings Modal
    this.settingsModal = document.createElement('div')
    this.settingsModal.className = 'pcb-settings-modal'
    this.settingsModal.style.display = 'none'
    mountUi(this.settingsModal)

    // Tower detail panel (side panel)
    this.panel = document.createElement('div')
    this.panel.className = 'pcb-towerpanel'
    this.panel.style.display = 'none'
    mountUi(this.panel)

    // Game Overlay (Victory / Defeat)
    this.overlay = document.createElement('div')
    this.overlay.className = 'pcb-game-overlay'
    this.overlay.style.display = 'none'
    mountUi(this.overlay)

    return hud
  }

  retranslateHud(_game?: Game, difficulty = 1): void {
    const lbl = document.querySelector('.hud-level-label')
    if (lbl) lbl.textContent = i18n.t('hud.level') + ' '
    
    const startBtn = document.querySelector('.next-wave-btn') as HTMLElement
    if (startBtn) startBtn.textContent = i18n.t('hud.start_wave')
    
    const mapBtn = document.querySelector('.map-btn') as HTMLElement
    if (mapBtn) mapBtn.textContent = i18n.t('hud.map')

    const lvlNum = String(this.levelNumber).padStart(2, '0')
    const lvlEl = document.querySelector('.level-num')
    if (lvlEl) lvlEl.textContent = lvlNum

    this.updateDiffBadge(difficulty)
  }

  private updateDiffBadge(difficulty: number): void {
    if (difficulty >= 7) {
      this.elDiff.className = 'pcb-hud-badge difficulty-badge hard'
      this.elDiff.textContent = i18n.t('difficulty.hard')
    } else if (difficulty >= 3) {
      this.elDiff.className = 'pcb-hud-badge difficulty-badge medium'
      this.elDiff.textContent = i18n.t('difficulty.medium')
    } else {
      this.elDiff.className = 'pcb-hud-badge difficulty-badge easy'
      this.elDiff.textContent = i18n.t('difficulty.easy')
    }
  }

  showSettings(): void {
    this.settingsModal.style.display = 'flex'
    this.renderSettings()
  }

  renderSettings(): void {
    this.settingsModal.innerHTML = `
      <div class="pcb-settings-card">
        <h2>${i18n.t('settings.title')}</h2>
        
        <div class="settings-row">
          <label>${i18n.t('settings.music_vol')}</label>
          <input type="range" id="musicVolRange" min="0" max="100" value="${Math.round(audioEngine.getMusicVolume() * 100)}">
        </div>

        <div class="settings-row">
          <label>${i18n.t('settings.sfx_vol')}</label>
          <input type="range" id="sfxVolRange" min="0" max="100" value="${Math.round(audioEngine.getSfxVolume() * 100)}">
        </div>

        <div class="settings-row select-row">
          <label>${i18n.t('settings.auto_wave')}</label>
          <input type="checkbox" id="autoWaveCheck" ${this.autoWaveActive ? 'checked' : ''}>
        </div>

        <div class="settings-row select-row">
          <label>${i18n.t('settings.reduced_fx')}</label>
          <input type="checkbox" id="reducedFxCheck" ${juice.reducedFx ? 'checked' : ''}>
        </div>

        <div class="settings-row select-row">
          <label>${i18n.t('settings.lang')}</label>
          <div style="display: flex; gap: 8px;">
            <button class="pcb-hud-btn lang-ru ${i18n.lang === 'ru' ? 'active' : ''}">RU</button>
            <button class="pcb-hud-btn lang-en ${i18n.lang === 'en' ? 'active' : ''}">EN</button>
          </div>
        </div>

        <div class="settings-row select-row">
          <label>${i18n.t('settings.difficulty')}</label>
          <div style="display: flex; gap: 6px;">
            ${(['casual', 'normal', 'veteran'] as const).map((d) =>
              `<button class="pcb-hud-btn diff-${d} ${loadPlayerDifficulty() === d ? 'active' : ''}" title="${i18n.tk(`settings.difficulty.${d}.hint`)}">${i18n.tk(`settings.difficulty.${d}`)}</button>`
            ).join('')}
          </div>
        </div>

        <div class="settings-row select-row">
          <label>${i18n.t('settings.save_code')}</label>
          <div style="display: flex; gap: 8px;">
            <button class="pcb-hud-btn save-export-btn">${i18n.t('settings.save_export')}</button>
            <button class="pcb-hud-btn save-import-btn">${i18n.t('settings.save_import')}</button>
          </div>
        </div>
        <div class="settings-row save-import-row" style="display: none;">
          <input type="text" id="saveCodeInput" placeholder="${i18n.t('settings.save_paste')}" style="width: 100%;">
        </div>
        <div class="settings-save-status" style="min-height: 14px; font-size: 10px; color: #8fb3a0;"></div>

        <button class="pcb-hud-btn active close-settings-btn" style="margin-top: 20px; width: 100%;">${i18n.t('settings.close')}</button>
      </div>
    `
    const musicRange = this.settingsModal.querySelector('#musicVolRange') as HTMLInputElement
    musicRange.oninput = () => {
      audioEngine.setMusicVolume(parseFloat(musicRange.value) / 100)
      audioEngine.setMute(false) // unmute to hear change
    }

    const sfxRange = this.settingsModal.querySelector('#sfxVolRange') as HTMLInputElement
    sfxRange.oninput = () => {
      audioEngine.setSfxVolume(parseFloat(sfxRange.value) / 100)
      audioEngine.playClick()
    }

    const autoCheck = this.settingsModal.querySelector('#autoWaveCheck') as HTMLInputElement
    autoCheck.onchange = () => {
      this.autoWaveActive = autoCheck.checked
      if (this.opts.onAutoWaveChanged) {
        this.opts.onAutoWaveChanged(this.autoWaveActive)
      }
    }

    const reducedFxCheck = this.settingsModal.querySelector('#reducedFxCheck') as HTMLInputElement
    reducedFxCheck.onchange = () => {
      setReducedFx(reducedFxCheck.checked)
    }

    const btnRu = this.settingsModal.querySelector('.lang-ru') as HTMLButtonElement
    btnRu.onclick = () => {
      if (i18n.lang !== 'ru') {
        i18n.lang = 'ru'
        btnRu.classList.add('active')
        this.settingsModal.querySelector('.lang-en')?.classList.remove('active')
        this.renderSettings()
        if (this.opts.onLanguageChanged) this.opts.onLanguageChanged()
      }
    }

    const btnEn = this.settingsModal.querySelector('.lang-en') as HTMLButtonElement
    btnEn.onclick = () => {
      if (i18n.lang !== 'en') {
        i18n.lang = 'en'
        btnEn.classList.add('active')
        this.settingsModal.querySelector('.lang-ru')?.classList.remove('active')
        this.renderSettings()
        if (this.opts.onLanguageChanged) this.opts.onLanguageChanged()
      }
    }

    const btnClose = this.settingsModal.querySelector('.close-settings-btn') as HTMLButtonElement
    btnClose.onclick = () => {
      audioEngine.playClick()
      this.settingsModal.style.display = 'none'
    }

    // Global difficulty: persists immediately, applies from the next level start.
    for (const d of ['casual', 'normal', 'veteran'] as const) {
      const btn = this.settingsModal.querySelector(`.diff-${d}`) as HTMLButtonElement
      btn.onclick = () => {
        audioEngine.playClick()
        savePlayerDifficulty(d)
        this.renderSettings()
      }
    }

    // Save-as-code: insurance against localStorage loss (portal iframes, private modes).
    const saveStatus = this.settingsModal.querySelector('.settings-save-status') as HTMLElement
    const importRow = this.settingsModal.querySelector('.save-import-row') as HTMLElement
    const codeInput = this.settingsModal.querySelector('#saveCodeInput') as HTMLInputElement
    const btnExport = this.settingsModal.querySelector('.save-export-btn') as HTMLButtonElement
    btnExport.onclick = async () => {
      audioEngine.playClick()
      const code = exportProgressCode()
      try {
        await navigator.clipboard.writeText(code)
        saveStatus.textContent = i18n.t('settings.save_copied')
      } catch {
        // Clipboard API blocked (permissions/insecure context) — show the code for manual copy.
        importRow.style.display = 'block'
        codeInput.value = code
        codeInput.select()
        saveStatus.textContent = i18n.t('settings.save_copy_manual')
      }
    }
    const btnImport = this.settingsModal.querySelector('.save-import-btn') as HTMLButtonElement
    btnImport.onclick = () => {
      audioEngine.playClick()
      if (importRow.style.display === 'none') {
        importRow.style.display = 'block'
        codeInput.value = ''
        codeInput.focus()
        saveStatus.textContent = i18n.t('settings.save_paste')
        return
      }
      if (importProgressCode(codeInput.value)) {
        saveStatus.textContent = i18n.t('settings.save_imported')
        this.opts.onProgressImported?.()
      } else {
        saveStatus.textContent = i18n.t('settings.save_bad_code')
      }
    }
  }

  /** Ability button state: cooldown countdown, armed highlight, disabled while recharging. */
  setAbilityState(cooldownSec: number, armed: boolean): void {
    if (!this.btnAbility) return
    const label = cooldownSec > 0 ? `⚡${Math.ceil(cooldownSec)}` : '⚡'
    if (this.btnAbility.textContent !== label) this.btnAbility.textContent = label
    this.btnAbility.disabled = cooldownSec > 0
    this.btnAbility.classList.toggle('active', armed)
    this.btnAbility.style.opacity = cooldownSec > 0 ? '0.5' : ''
  }

  public selectSpeed(mult: number): void {
    if (this.btnPause) {
      if (mult === 0) {
        this.btnPause.classList.add('active')
      } else {
        this.btnPause.classList.remove('active')
      }
    }
    Object.values(this.speedBtns).forEach((b) => b.classList.remove('active'))
    if (mult > 0 && this.speedBtns[mult]) this.speedBtns[mult].classList.add('active')
  }

  /** set the campaign level number shown top-left (stays fixed for all waves of the level) */
  setLevelNumber(n: number): void {
    this.levelNumber = n
    const el = document.querySelector('.level-num')
    if (el) el.textContent = String(n).padStart(2, '0')
  }

  update(game: Game, difficulty = 1): void {
    const s = game.state
    const h = formatHud({ wave: s.waveNumber, waveCount: s.waveCount, lives: s.lives, gold: s.gold, phase: s.phase })
    
    this.elWave.textContent = h.wave
    this.elLives.textContent = `❤ ${s.lives}`
    this.elGold.textContent = `⚡ ${s.gold}`
    this.refreshRadialAffordability(s.gold)   // open build ring tracks gold live

    // Update level name/number in HUD
    const lvlEl = document.querySelector('.level-num')
    if (lvlEl) lvlEl.textContent = String(this.levelNumber).padStart(2, '0') // LEVEL #, not wave

    this.updateDiffBadge(difficulty)

    // Update Wave Preview
    if (s.phase === 'build') {
      const nextWave = game.peekWave(s.wave)
      if (nextWave.length > 0) {
        this.wavePreview.style.display = 'flex'
        this.wavePreview.innerHTML = `<span class="pcb-wavepreview-title">${i18n.t('enemy.next_wave')}</span>`
        // Aggregated totals (mixed groups split by weight) — the preview shows the real mix.
        for (const [kind, count] of waveComposition(nextWave)) {
          const t = { name: i18n.tk(`enemy.${kind}`), color: getEnemyColor(kind) }
          const item = document.createElement('div')
          item.className = 'pcb-wavepreview-item'
          item.innerHTML = `
            <span class="pcb-wavepreview-dot" style="background: ${t.color}; box-shadow: 0 0 6px ${t.color};"></span>
            <span class="pcb-wavepreview-name">${t.name}</span>
            <span class="pcb-wavepreview-count">×${count}</span>
          `
          this.wavePreview.appendChild(item)
        }
      } else {
        this.wavePreview.style.display = 'none'
      }
    } else {
      this.wavePreview.style.display = 'none'
    }
  }

  /** enable/grey a single radial item from its cost + current gold (kind-restriction is fixed) */
  private setRadialItemAffordable(btn: HTMLElement, gold: number): void {
    const blocked = btn.dataset.kindBlocked === '1' || gold < Number(btn.dataset.cost)
    btn.style.opacity = blocked ? '0.35' : '1'
    btn.style.pointerEvents = blocked ? 'none' : 'auto'
  }
  /** re-evaluate every open radial item against the CURRENT gold (called each frame from update) */
  private refreshRadialAffordability(gold: number): void {
    if (!this.radial.classList.contains('open')) return
    for (const btn of Array.from(this.radial.children)) this.setRadialItemAffordable(btn as HTMLElement, gold)
  }

  openRadialMenu(spotIndex: number, clientX: number, clientY: number, goldAvailable: number, allowedTowerKind?: TowerKind, showTooltips = true): void {
    this.radial.style.left = `${clientX}px`
    this.radial.style.top = `${clientY}px`
    this.radial.innerHTML = ''

    KINDS.forEach((k) => {
      const theme = TOWER_THEMES[k]
      const cost = TOWER_DEFS[k][0].cost
      const btn = document.createElement('button')
      btn.className = 'pcb-radialmenu-item'
      btn.style.setProperty('--dx', theme.dx)
      btn.style.setProperty('--dy', theme.dy)
      btn.style.setProperty('--neon-color', theme.color)
      btn.style.setProperty('--neon-glow', theme.glow)
      btn.innerHTML = `${theme.name}<span>$${cost}</span>`

      // remember cost + the fixed kind-restriction so affordability can be refreshed LIVE while the menu
      // stays open (gold earned mid-build must unlock items without closing/reopening the ring).
      btn.dataset.cost = String(cost)
      btn.dataset.kindBlocked = allowedTowerKind && k !== allowedTowerKind ? '1' : '0'
      this.setRadialItemAffordable(btn, goldAvailable)

      btn.onclick = (e) => {
        e.stopPropagation()
        audioEngine.playBuild()
        this.opts.onBuild(k, spotIndex)
        this.closeRadialMenu()
      }

      // Add tooltip hover events
      btn.onmouseenter = () => {
        if (!showTooltips) return
        const def = TOWER_DEFS[k][0]
        const descKey = `tower.${k}.desc` as any
        const desc = i18n.t(descKey)
        
        let extra = ''
        if (def.slow) extra = ` · SLOW ${(def.slow * 100).toFixed(0)}%`
        if (def.splashRadius) extra = ` · SPLASH ${def.splashRadius}`
        if (def.chainCount) extra = ` · CHAINS ${def.chainCount}`
        
        this.radialTooltip.style.display = 'block'
        this.radialTooltip.style.borderColor = theme.color
        this.radialTooltip.style.boxShadow = `0 0 15px ${theme.glow}`
        
        // Position tooltip centrally below or above the radial menu based on height
        const container = document.getElementById('game-container')
        const spaceH = container ? container.clientHeight : window.innerHeight
        this.radialTooltip.style.left = `${clientX}px`
        if (clientY > spaceH * 0.55) {
          this.radialTooltip.style.transform = 'translate(-50%, -100%)'
          this.radialTooltip.style.top = `${clientY - 110}px`
        } else {
          this.radialTooltip.style.transform = 'translate(-50%, 0)'
          this.radialTooltip.style.top = `${clientY + 110}px`
        }
        
        this.radialTooltip.innerHTML = `
          <div style="font-weight: bold; color: ${theme.color}; margin-bottom: 4px;">${theme.name}</div>
          <div style="font-size: 10px; color: #fff; margin-bottom: 6px;">
            DMG ${def.damage} · RATE ${def.fireRate} · RNG ${def.range}${extra}
          </div>
          <div style="font-size: 9px; line-height: 1.3; color: #6f8f7e;">${desc}</div>
        `
      }

      btn.onmouseleave = () => {
        this.radialTooltip.style.display = 'none'
      }

      this.radial.appendChild(btn)
    })

    // Trigger reflow to apply CSS transitions
    this.radial.getBoundingClientRect()
    this.radial.classList.add('open')
    this.radialBackdrop.classList.add('show')
  }

  closeRadialMenu(): void {
    if (!this.radial.classList.contains('open')) return
    this.radial.classList.remove('open')
    this.radialBackdrop.classList.remove('show')
    this.radialTooltip.style.display = 'none'
    setTimeout(() => {
      if (!this.radial.classList.contains('open')) {
        this.radial.innerHTML = ''
      }
    }, 250)
  }

  showTower(t: Tower | null, sellValue: number): void {
    if (!t) { this.panel.style.display = 'none'; return }
    const s = t.stats
    this.panel.style.display = 'block'
    const branchName = t.branch !== null ? ` · ${i18n.tk(`branch.${TOWER_BRANCHES[t.kind][t.branch].id}.name`)}` : ''
    this.panel.innerHTML = `<h3>${TOWER_THEMES[t.kind].name} L${t.level + 1}${branchName}</h3>
      <div style="margin-bottom: 8px;">DMG ${s.damage} · RATE ${s.fireRate} · RANGE ${s.range}</div>
      <div style="margin-bottom: 8px;">MODE ${t.targetMode}</div>`
    const mk = (label: string, fn: () => void, sfxType: 'click' | 'upgrade' | 'sell') => {
      const b = document.createElement('button')
      b.textContent = label
      b.onclick = () => {
        if (sfxType === 'upgrade') audioEngine.playUpgrade()
        else if (sfxType === 'sell') audioEngine.playSell()
        else audioEngine.playClick()
        fn()
      }
      this.panel.appendChild(b)
    }
    const upgradeStr = i18n.lang === 'ru' ? 'Улучшить' : 'Upgrade'
    const sellStr = i18n.lang === 'ru' ? 'Продать' : 'Sell'
    const targetStr = i18n.lang === 'ru' ? 'Приоритет' : 'Target'

    // Upgrade slot is ALWAYS present (disabled "MAX" when maxed) so the Sell button never jumps up
    // into the spot the cursor just clicked — prevents accidental sells right after a max upgrade.
    if (t.canBranch) {
      // Tier-4 specialization: two role-changing options instead of one linear upgrade.
      for (const b of [0, 1] as const) {
        const br = TOWER_BRANCHES[t.kind][b]
        const btn = document.createElement('button')
        btn.className = 'pcb-branch-btn'
        btn.title = i18n.tk(`branch.${br.id}.desc`)
        btn.innerHTML = `<span class="pcb-branch-name">▲ ${i18n.tk(`branch.${br.id}.name`)}</span>` +
          `<span class="pcb-branch-cost">$${br.cost}</span>`
        btn.onclick = () => { audioEngine.playUpgrade(); this.opts.onUpgradeBranch?.(b) }
        this.panel.appendChild(btn)
      }
    } else if (t.level < t.maxLevel) {
      mk(`${upgradeStr} $${TOWER_DEFS[t.kind][t.level + 1].cost}`, this.opts.onUpgrade, 'upgrade')
    } else {
      const maxBtn = document.createElement('button')
      maxBtn.textContent = i18n.lang === 'ru' ? 'МАКС. УРОВЕНЬ' : 'MAX LEVEL'
      maxBtn.disabled = true
      maxBtn.style.opacity = '0.5'
      this.panel.appendChild(maxBtn)
    }
    // Sell requires a two-click confirm (destructive + irreversible) so it is never a single misclick.
    const sellBtn = document.createElement('button')
    let armed = false
    const confirmStr = i18n.lang === 'ru' ? 'Точно продать?' : 'Confirm sell?'
    const paint = () => {
      sellBtn.textContent = armed ? `${confirmStr} $${sellValue}` : `${sellStr} $${sellValue}`
      sellBtn.style.background = armed ? '#7a2030' : ''
      sellBtn.style.borderColor = armed ? '#e8503a' : ''
    }
    paint()
    sellBtn.onclick = () => {
      if (!armed) { armed = true; paint(); audioEngine.playClick(); window.setTimeout(() => { armed = false; paint() }, 2500); return }
      audioEngine.playSell(); this.opts.onSell()
    }
    this.panel.appendChild(sellBtn)
    mk(`${targetStr}: ` + t.targetMode, this.opts.onTargetMode, 'click')
  }

  /** Transient top-center banner announcing a new wave: title + a chip row of its enemy composition. */
  showWaveBanner(waveNumber: number, composition: Array<{ name: string; color: number; count: number }>): void {
    // A fresh banner replaces any still-fading one so overlapping waveStart events don't stack DOM/timers.
    if (this.waveBanner) { this.waveBanner.remove(); this.waveBanner = null }
    if (this.waveBannerTimer !== null) { window.clearTimeout(this.waveBannerTimer); this.waveBannerTimer = null }

    const banner = document.createElement('div')
    banner.className = 'pcb-wave-banner'

    const title = document.createElement('div')
    title.className = 'pcb-wave-banner-title'
    title.textContent = i18n.t('hud.wave_banner').replace('{n}', String(waveNumber))
    banner.appendChild(title)

    const chips = document.createElement('div')
    chips.className = 'pcb-wave-banner-chips'
    composition.forEach((c) => {
      const hex = `#${c.color.toString(16).padStart(6, '0')}`
      const chip = document.createElement('span')
      chip.className = 'pcb-wave-banner-chip'
      chip.style.color = hex
      chip.textContent = `${c.name} ×${c.count}`
      chips.appendChild(chip)
    })
    banner.appendChild(chips)

    mountUi(banner)
    this.waveBanner = banner
    this.waveBannerTimer = window.setTimeout(() => {
      banner.remove()
      if (this.waveBanner === banner) this.waveBanner = null
      this.waveBannerTimer = null
    }, 1600)
  }

  showVictoryScreen(stars: number | null, score: number, onNext: (() => void) | null, onRetry: () => void, onMenu: () => void, debrief?: string): void {
    this.overlay.style.display = 'flex'
    this.overlay.className = 'pcb-game-overlay victory'

    let starsHtml = ''
    if (stars !== null) {
      const slots = Array.from({ length: 3 }, (_, i) => {
        const earned = i < stars
        const cls = earned ? 'pcb-star pcb-star-earned' : 'pcb-star'
        const style = earned ? ` style="animation-delay: ${(0.15 * i).toFixed(2)}s"` : ''
        return `<span class="${cls}"${style}>${earned ? '★' : '☆'}</span>`
      }).join('')
      starsHtml = `
        <div class="pcb-victory-stars">
          ${slots}
        </div>
      `
    }
    const debriefHtml = debrief ? `<div class="pcb-victory-debrief">${debrief}</div>` : ''

    this.overlay.innerHTML = `
      <div class="pcb-overlay-card">
        <h2>${i18n.t('result.victory_title')}</h2>
        <h3 class="status-glow">${i18n.t('result.victory_subtitle')}</h3>
        ${starsHtml}
        <div class="pcb-overlay-score">${i18n.t('result.saved_lives')}: ❤${score}</div>
        ${debriefHtml}
        <div class="pcb-overlay-actions">
          ${onNext ? `<button class="pcb-hud-btn active next-btn">${i18n.t('result.next_level')}</button>` : ''}
          <button class="pcb-hud-btn retry-btn">${i18n.t('result.retry')}</button>
          <button class="pcb-hud-btn menu-btn">${i18n.t('result.campaign_map')}</button>
        </div>
      </div>
    `

    if (onNext) {
      (this.overlay.querySelector('.next-btn') as HTMLElement).onclick = onNext
    }
    (this.overlay.querySelector('.retry-btn') as HTMLElement).onclick = onRetry;
    (this.overlay.querySelector('.menu-btn') as HTMLElement).onclick = onMenu
  }

  showDefeatScreen(onRetry: () => void, onMenu: () => void): void {
    this.overlay.style.display = 'flex'
    this.overlay.className = 'pcb-game-overlay defeat'
    this.overlay.innerHTML = `
      <div class="pcb-overlay-card">
        <h2>${i18n.t('result.defeat_title')}</h2>
        <h3 class="status-glow">${i18n.t('result.defeat_subtitle')}</h3>
        <div class="pcb-overlay-score">${i18n.t('result.lost_lives')}</div>
        <div class="pcb-overlay-actions">
          <button class="pcb-hud-btn active retry-btn">${i18n.t('result.retry')}</button>
          <button class="pcb-hud-btn menu-btn">${i18n.t('result.campaign_map')}</button>
        </div>
      </div>
    `;
    (this.overlay.querySelector('.retry-btn') as HTMLElement).onclick = onRetry;
    (this.overlay.querySelector('.menu-btn') as HTMLElement).onclick = onMenu
  }

  closeOverlay(): void {
    this.overlay.style.display = 'none'
    this.overlay.innerHTML = ''
  }
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
