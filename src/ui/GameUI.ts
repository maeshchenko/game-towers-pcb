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
import { installFocusTrap } from './focusTrap'
import { icon } from './icons'
import { enemyColorHex } from '../render/theme'

export function formatHud(s: { wave: number; waveCount: number; lives: number; gold: number; phase: string }) {
  const total = Number.isFinite(s.waveCount) ? String(s.waveCount) : '∞'
  return { wave: `${i18n.t('hud.wave')} ${s.wave}/${total}`, lives: `${i18n.t('hud.lives')} ${s.lives}`, gold: `${i18n.t('hud.gold')} ${s.gold}` }
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
  private reducedFxCheck: HTMLInputElement | null = null
  private pauseTrapOff: (() => void) | null = null
  private settingsTrapOff: (() => void) | null = null
  /** Reflect an external reduced-fx change (perf auto-degrade) in the settings checkbox. */
  syncReducedFx(on: boolean): void { if (this.reducedFxCheck) this.reducedFxCheck.checked = on }
  private speedBtns: Record<number, HTMLButtonElement> = {}
  private btnPause!: HTMLButtonElement
  private btnAbility: HTMLButtonElement | null = null
  private btnAbility2: HTMLButtonElement | null = null
  private autoWaveActive = true
  private waveBanner: HTMLElement | null = null
  private waveBannerTimer: number | null = null

  constructor(private opts: {
    onBuild(kind: TowerKind, spotIndex: number): void; onStartWave(): void; onTogglePlay(): void
    onSpeed(mult: number): void; onUpgrade(): void; onSell(): void; onTargetMode(): void
    onUpgradeBranch?(b: 0 | 1): void
    onAbility?(): void
    onAbility2?(): void
    onMenu?(): void
    onLanguageChanged?(): void
    onAutoWaveChanged?(val: boolean): void
    onOpenBestiary?(): void
    onProgressImported?(): void
    onModalOpen?(): void
    onModalClose?(): void
    /** Range-circle preview while choosing in the radial (kind=null clears). */
    onPreviewRange?(kind: TowerKind | null, spotIndex: number): void
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
    btnMap.textContent = i18n.t('hud.menu')
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
    btnPause.innerHTML = icon('pause')
    btnPause.setAttribute('aria-label', i18n.t('pause.title'))
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
    btnAbility.innerHTML = icon('bolt')
    btnAbility.title = i18n.t('ability.discharge.hint')
    btnAbility.setAttribute('aria-label', 'discharge')
    btnAbility.onclick = () => { audioEngine.playClick(); this.opts.onAbility?.() }
    this.btnAbility = btnAbility

    const btnAbility2 = document.createElement('button')
    btnAbility2.className = 'pcb-hud-btn ability-btn ability2-btn'
    btnAbility2.innerHTML = icon('overload')
    btnAbility2.title = i18n.t('ability.overload.hint')
    btnAbility2.setAttribute('aria-label', 'overload')
    btnAbility2.onclick = () => { audioEngine.playClick(); this.opts.onAbility2?.() }
    this.btnAbility2 = btnAbility2

    const btnBestiary = document.createElement('button')
    btnBestiary.className = 'pcb-hud-btn'
    btnBestiary.innerHTML = icon('book')
    btnBestiary.title = i18n.t('hud.bestiary')
    btnBestiary.setAttribute('aria-label', i18n.t('hud.bestiary'))
    btnBestiary.onclick = () => {
      audioEngine.playClick()
      if (this.opts.onOpenBestiary) this.opts.onOpenBestiary()
    }

    const btnSettings = document.createElement('button')
    btnSettings.className = 'pcb-hud-btn'
    btnSettings.innerHTML = icon('gear')
    btnSettings.setAttribute('aria-label', i18n.t('settings.title'))
    btnSettings.onclick = () => {
      audioEngine.playClick()
      this.showSettings()
    }

    right.append(btnStart, btnPause, btn1x, btn2x, btn4x, btnAbility, btnAbility2, btnBestiary, btnSettings)
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
    // Cached lookup: the raw version ran querySelector + getComputedStyle on EVERY
    // pointermove. The bubble is re-queried at most every 150 ms; style is only read
    // while a bubble actually exists (i.e. during the tutorial).
    let tutorialBubble: HTMLElement | null = null
    let tutorialCheckAt = 0
    const tutorialActive = (): boolean => {
      const now = performance.now()
      if (now - tutorialCheckAt > 150 || (tutorialBubble && !tutorialBubble.isConnected)) {
        tutorialCheckAt = now
        tutorialBubble = document.querySelector('.pcb-tutorial-bubble')
      }
      return !!tutorialBubble && getComputedStyle(tutorialBubble).display !== 'none'
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
    if (mapBtn) mapBtn.textContent = i18n.t('hud.menu')

    const lvlNum = String(this.levelNumber).padStart(2, '0')
    const lvlEl = document.querySelector('.level-num')
    if (lvlEl) lvlEl.textContent = lvlNum

    this.updateDiffBadge(difficulty)
    this.invalidateHudCache() // localized HUD text just changed — force update() to rewrite
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

  /** returnToPause: opened from the pause menu — closing must go BACK there, not resume
   * the game (the player paused deliberately; settings must not silently unpause). */
  private settingsReturnToPause = false

  showSettings(returnToPause = false): void {
    this.settingsReturnToPause = returnToPause
    this.settingsModal.style.display = 'flex'
    this.renderSettings()
    // Click on the dark backdrop (not the card) dismisses — standard modal behaviour.
    this.settingsModal.onclick = (e) => {
      if (e.target === this.settingsModal) { audioEngine.playClick(); this.closeSettings() }
    }
    this.settingsTrapOff?.()
    this.settingsTrapOff = installFocusTrap(this.settingsModal)
    this.opts.onModalOpen?.()
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
    this.reducedFxCheck = reducedFxCheck

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
      this.closeSettings()
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

  /** Ability button state: hidden until unlocked, cooldown countdown, armed highlight.
   * Called every frame — every DOM write is guarded by a change check. */
  private abilityKey = ''
  setAbilityState(cooldownSec: number, armed: boolean, unlocked = true): void {
    if (!this.btnAbility) return
    const key = `${unlocked}|${armed}|${cooldownSec > 0 ? Math.ceil(cooldownSec) : 0}`
    if (this.abilityKey === key) return
    this.abilityKey = key
    this.btnAbility.style.display = unlocked ? '' : 'none'
    if (!unlocked) return
    const label = cooldownSec > 0 ? `${icon('bolt')}${Math.ceil(cooldownSec)}` : icon('bolt')
    if (this.btnAbility.dataset.label !== label) { this.btnAbility.dataset.label = label; this.btnAbility.innerHTML = label }
    this.btnAbility.disabled = cooldownSec > 0
    this.btnAbility.classList.toggle('active', armed)
    this.btnAbility.style.opacity = cooldownSec > 0 ? '0.5' : ''
  }

  /** Second ability (overload) — same guarded per-frame update as setAbilityState. */
  private ability2Key = ''
  setAbility2State(cooldownSec: number, armed: boolean, unlocked = true): void {
    if (!this.btnAbility2) return
    const key = `${unlocked}|${armed}|${cooldownSec > 0 ? Math.ceil(cooldownSec) : 0}`
    if (this.ability2Key === key) return
    this.ability2Key = key
    this.btnAbility2.style.display = unlocked ? '' : 'none'
    if (!unlocked) return
    const label = cooldownSec > 0 ? `${icon('overload')}${Math.ceil(cooldownSec)}` : icon('overload')
    if (this.btnAbility2.dataset.label !== label) { this.btnAbility2.dataset.label = label; this.btnAbility2.innerHTML = label }
    this.btnAbility2.disabled = cooldownSec > 0
    this.btnAbility2.classList.toggle('active', armed)
    this.btnAbility2.style.opacity = cooldownSec > 0 ? '0.5' : ''
  }

  /** One-shot attention pulse on an ability button (first unlock). */
  pulseAbilityButton(which: 1 | 2 = 1): void {
    const btn = which === 1 ? this.btnAbility : this.btnAbility2
    btn?.classList.add('fresh')
    window.setTimeout(() => btn?.classList.remove('fresh'), 6000)
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
    this.previewKey = '' // new level → same wave index means DIFFERENT content; drop the cache
    const el = document.querySelector('.level-num')
    if (el) el.textContent = String(n).padStart(2, '0')
  }

  update(game: Game, difficulty = 1): void {
    const s = game.state
    // update() runs 60×/s — every DOM write here is dirty-checked so a steady frame touches
    // nothing (no textContent churn, no formatHud alloc, no querySelector). Lossless: identical
    // output, just skipped when unchanged.
    if (s.lives !== this.lastLives) { this.elLives.textContent = `❤ ${s.lives}`; this.lastLives = s.lives }
    if (s.gold !== this.lastGold) { this.elGold.textContent = `⚡ ${s.gold}`; this.lastGold = s.gold }
    if (s.waveNumber !== this.lastWave || s.phase !== this.lastPhase || s.waveCount !== this.lastWaveCount) {
      const h = formatHud({ wave: s.waveNumber, waveCount: s.endless ? Infinity : s.waveCount, lives: s.lives, gold: s.gold, phase: s.phase })
      this.elWave.textContent = h.wave
      this.lastWave = s.waveNumber; this.lastPhase = s.phase; this.lastWaveCount = s.waveCount
    }
    this.refreshRadialAffordability(s.gold)   // open build ring tracks gold live

    // Level number in HUD — cache the element (query once) and write only when it changes.
    if (this.levelNumber !== this.lastLevelNumShown) {
      this.levelNumEl ??= document.querySelector('.level-num')
      if (this.levelNumEl) this.levelNumEl.textContent = String(this.levelNumber).padStart(2, '0') // LEVEL #, not wave
      this.lastLevelNumShown = this.levelNumber
    }

    if (difficulty !== this.lastDiff) { this.updateDiffBadge(difficulty); this.lastDiff = difficulty }

    // Update Wave Preview. update() runs every frame — rebuild the DOM only when the wave
    // (or language) actually changes; the old unconditional innerHTML churned 60×/s.
    if (s.phase === 'build') {
      const nextWave = game.peekWave(s.wave)
      if (nextWave.length > 0) {
        const key = `${s.wave}|${i18n.lang}`
        this.wavePreview.style.display = 'flex'
        if (this.previewKey !== key) {
          this.previewKey = key
          this.wavePreview.innerHTML = `<span class="pcb-wavepreview-title">${i18n.t('enemy.next_wave')}</span>`
          // Aggregated totals (mixed groups split by weight) — the preview shows the real mix.
          for (const [kind, count] of waveComposition(nextWave)) {
            const t = { name: i18n.tk(`enemy.${kind}`), color: enemyColorHex(kind) }
            const item = document.createElement('div')
            item.className = 'pcb-wavepreview-item'
            item.innerHTML = `
              <span class="pcb-wavepreview-dot" style="background: ${t.color}; box-shadow: 0 0 6px ${t.color};"></span>
              <span class="pcb-wavepreview-name">${t.name}</span>
              <span class="pcb-wavepreview-count">×${count}</span>
            `
            this.wavePreview.appendChild(item)
          }
        }
      } else {
        this.wavePreview.style.display = 'none'
      }
    } else {
      this.wavePreview.style.display = 'none'
    }
  }
  private previewKey = ''
  // Dirty-check caches for update() — sentinel NaN forces the first write.
  private lastLives = NaN
  private lastGold = NaN
  private lastWave = NaN
  private lastWaveCount = NaN
  private lastPhase = ''
  private lastDiff = NaN
  private lastLevelNumShown = NaN
  private levelNumEl: Element | null = null
  /** Invalidate the HUD dirty-check caches so the next update() rewrites everything (call after
   * a language switch or level change — localized/renumbered text must refresh). */
  private invalidateHudCache(): void {
    this.lastLives = this.lastGold = this.lastWave = this.lastWaveCount = this.lastDiff = this.lastLevelNumShown = NaN
    this.lastPhase = ''
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

  openRadialMenu(spotIndex: number, clientX: number, clientY: number, goldAvailable: number, allowedTowerKind?: TowerKind, showTooltips = true, bannedKind?: TowerKind | null): void {
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
      const banned = k === bannedKind
      btn.innerHTML = banned ? `${theme.name}<span>${i18n.t('daily.embargoed')}</span>` : `${theme.name}<span>$${cost}</span>`

      // remember cost + the fixed kind-restriction so affordability can be refreshed LIVE while the menu
      // stays open (gold earned mid-build must unlock items without closing/reopening the ring).
      btn.dataset.cost = String(cost)
      btn.dataset.kindBlocked = (allowedTowerKind && k !== allowedTowerKind) || banned ? '1' : '0'
      this.setRadialItemAffordable(btn, goldAvailable)

      btn.onclick = (e) => {
        e.stopPropagation()
        // Touch two-step: first tap arms the item (tooltip + range preview — phones have no
        // hover, players were buying blind), second tap builds. Mouse keeps one-click flow.
        const isTouch = (e as PointerEvent).pointerType === 'touch'
        if (isTouch && btn.dataset.armed !== '1') {
          for (const other of Array.from(this.radial.children)) (other as HTMLElement).dataset.armed = '0'
          btn.dataset.armed = '1'
          btn.style.boxShadow = `0 0 20px ${theme.color}`
          showInfo()
          return
        }
        audioEngine.playBuild()
        this.opts.onPreviewRange?.(null, spotIndex)
        this.radialTooltip.style.display = 'none'
        this.opts.onBuild(k, spotIndex)
        this.closeRadialMenu()
      }

      const showInfo = () => {
        this.opts.onPreviewRange?.(k, spotIndex)
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

      btn.onmouseenter = () => showInfo()
      btn.onmouseleave = () => {
        this.radialTooltip.style.display = 'none'
        this.opts.onPreviewRange?.(null, spotIndex)
      }

      this.radial.appendChild(btn)
    })

    // Trigger reflow to apply CSS transitions
    this.radial.getBoundingClientRect()
    this.radial.classList.add('open')
    this.radialBackdrop.classList.add('show')
  }

  closeRadialMenu(): void {
    this.opts.onPreviewRange?.(null, 0)
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
    // Upgrade preview: show the stat DELTA so the player never pays blind.
    const next = !t.canBranch && t.level < t.maxLevel ? TOWER_DEFS[t.kind][t.level + 1] : null
    const delta = (cur: number, nxt: number | undefined) =>
      nxt !== undefined && nxt !== cur ? ` <span style="color:#f0c43a">→${nxt}</span>` : ''
    // Lifetime line: what this specific chip has actually contributed (skip for auras — they deal no damage).
    const statsLine = s.aura ? '' :
      `<div style="margin-bottom: 8px; color: #8fb3a0;">${i18n.t('panel.dmg_dealt')} ${Math.round(t.damageDealt)} · ${i18n.t('panel.kills')} ${t.kills}</div>`
    this.panel.innerHTML = `<h3>${TOWER_THEMES[t.kind].name} L${t.level + 1}${branchName}</h3>
      <div style="margin-bottom: 8px;">DMG ${s.damage}${delta(s.damage, next?.damage)} · RATE ${s.fireRate}${delta(s.fireRate, next?.fireRate)} · RNG ${s.range}${delta(s.range, next?.range)}</div>
      ${statsLine}
      <div style="margin-bottom: 8px;">MODE ${i18n.tk(`target.${t.targetMode}`)}</div>`
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
    const upgradeStr = i18n.t('tower.upgrade')
    const sellStr = i18n.t('tower.sell')
    const targetStr = i18n.t('tower.target')

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
      maxBtn.textContent = i18n.t('tower.max')
      maxBtn.disabled = true
      maxBtn.style.opacity = '0.5'
      this.panel.appendChild(maxBtn)
    }
    // Sell requires a two-click confirm (destructive + irreversible) so it is never a single misclick.
    const sellBtn = document.createElement('button')
    let armed = false
    const confirmStr = i18n.t('tower.sell_confirm')
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
    mk(`${targetStr}: ` + i18n.tk(`target.${t.targetMode}`), this.opts.onTargetMode, 'click')
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
        ${this.statsHtml()}
        ${debriefHtml}
        <div class="pcb-overlay-actions">
          ${onNext ? `<button class="pcb-hud-btn active next-btn">${i18n.t('result.next_level')}</button>` : ''}
          <button class="pcb-hud-btn retry-btn">${i18n.t('result.retry')}</button>
          ${this.shareBtnHtml()}
          <button class="pcb-hud-btn menu-btn">${i18n.t('result.campaign_map')}</button>
        </div>
      </div>
    `

    const withClick = (cb: () => void) => () => { audioEngine.playClick(); cb() }
    if (onNext) {
      (this.overlay.querySelector('.next-btn') as HTMLElement).onclick = withClick(onNext)
    }
    (this.overlay.querySelector('.retry-btn') as HTMLElement).onclick = withClick(onRetry);
    (this.overlay.querySelector('.menu-btn') as HTMLElement).onclick = withClick(onMenu)
    this.wireShareBtn()
  }

  showDefeatScreen(onRetry: () => void, onMenu: () => void): void {
    this.overlay.style.display = 'flex'
    this.overlay.className = 'pcb-game-overlay defeat'
    // "Reached wave N of M" is the single most useful defeat fact — it shows progress, not just failure.
    const waveLine = this.lastStats
      ? `<div class="pcb-overlay-score">${i18n.t('result.reached_wave').replace('{n}', String(this.lastStats.wave)).replace('{m}', Number.isFinite(this.lastStats.waveCount) ? String(this.lastStats.waveCount) : '∞')}</div>`
      : `<div class="pcb-overlay-score">${i18n.t('result.lost_lives')}</div>`
    this.overlay.innerHTML = `
      <div class="pcb-overlay-card">
        <h2>${i18n.t('result.defeat_title')}</h2>
        <h3 class="status-glow">${i18n.t('result.defeat_subtitle')}</h3>
        ${waveLine}
        ${this.statsHtml()}
        <div class="pcb-overlay-actions">
          <button class="pcb-hud-btn active retry-btn">${i18n.t('result.retry')}</button>
          ${this.shareBtnHtml()}
          <button class="pcb-hud-btn menu-btn">${i18n.t('result.campaign_map')}</button>
        </div>
      </div>
    `;
    (this.overlay.querySelector('.retry-btn') as HTMLElement).onclick = () => { audioEngine.playClick(); onRetry() };
    (this.overlay.querySelector('.menu-btn') as HTMLElement).onclick = () => { audioEngine.playClick(); onMenu() }
    this.wireShareBtn()
  }

  /** Share line for daily/endless result screens (null = no share button). */
  private shareText: string | null = null
  setShareText(t: string | null): void { this.shareText = t }
  private shareBtnHtml(): string {
    return this.shareText ? `<button class="pcb-hud-btn share-btn">${i18n.t('share.btn')}</button>` : ''
  }
  private wireShareBtn(): void {
    const b = this.overlay.querySelector('.share-btn') as HTMLElement | null
    if (!b || !this.shareText) return
    const text = this.shareText
    b.onclick = () => {
      audioEngine.playClick()
      navigator.clipboard?.writeText(text).then(
        () => { b.textContent = i18n.t('share.copied') },
        () => {}, // clipboard denied (some iframes) — button just stays as-is
      )
    }
  }

  /** Run stats supplied by main.ts right before showing a result screen. */
  private lastStats: { kills: number; leaks: number; goldEarned: number; wave: number; waveCount: number; bestTower?: { kind: TowerKind; damage: number } | null } | null = null
  setRunStats(s: { kills: number; leaks: number; goldEarned: number; wave: number; waveCount: number; bestTower?: { kind: TowerKind; damage: number } | null }): void {
    this.lastStats = s
  }

  private statsHtml(): string {
    const s = this.lastStats
    if (!s) return ''
    const cell = (label: string, value: string | number) =>
      `<div class="pcb-stat"><div class="pcb-stat-val">${value}</div><div class="pcb-stat-label">${label}</div></div>`
    const best = s.bestTower
      ? `<div style="margin-top: 6px; font-size: 11px; color: #8fb3a0;">${i18n.t('result.best_tower')}: <span style="color: ${TOWER_THEMES[s.bestTower.kind].color}; font-weight: bold;">${TOWER_THEMES[s.bestTower.kind].name}</span> · ${Math.round(s.bestTower.damage)} DMG</div>`
      : ''
    return `<div class="pcb-overlay-stats">
      ${cell(i18n.t('result.stat_kills'), s.kills)}
      ${cell(i18n.t('result.stat_leaks'), s.leaks)}
      ${cell(i18n.t('result.stat_gold'), '⚡' + s.goldEarned)}
    </div>${best}`
  }

  closeOverlay(): void {
    this.overlay.style.display = 'none'
    this.overlay.innerHTML = ''
  }

  // ---------------------------------------------------------- pause menu
  private pauseMenuEl: HTMLElement | null = null
  private lastPauseOpts: { onResume(): void; onRestart(): void; onMenu(): void } | null = null
  get isPauseMenuOpen(): boolean { return !!this.pauseMenuEl }

  /** Genre-standard pause overlay. Also the confirmation layer for leaving a run:
   * the MAP button routes here instead of instantly killing 20 minutes of progress. */
  showPauseMenu(opts: { onResume(): void; onRestart(): void; onMenu(): void }): void {
    if (this.pauseMenuEl) return
    this.lastPauseOpts = opts
    const el = document.createElement('div')
    el.className = 'pcb-settings-modal'
    el.style.display = 'flex'
    el.innerHTML = `
      <div class="pcb-settings-card" style="min-width: 240px;">
        <h2>${i18n.t('pause.title')}</h2>
        <button class="pcb-hud-btn active pm-resume" style="width:100%; margin-top:14px;">${i18n.t('pause.resume')}</button>
        <button class="pcb-hud-btn pm-settings" style="width:100%; margin-top:8px;">${i18n.t('settings.title')}</button>
        <button class="pcb-hud-btn pm-restart" style="width:100%; margin-top:8px;">${i18n.t('result.retry')}</button>
        <button class="pcb-hud-btn pm-menu" style="width:100%; margin-top:8px;">${i18n.t('result.campaign_map')}</button>
      </div>`
    const done = (cb: () => void) => () => { audioEngine.playClick(); this.hidePauseMenu(); cb() }
    el.onclick = (e) => { if (e.target === el) done(opts.onResume)() }
    ;(el.querySelector('.pm-resume') as HTMLElement).onclick = done(opts.onResume)
    ;(el.querySelector('.pm-settings') as HTMLElement).onclick = () => { audioEngine.playClick(); this.hidePauseMenu(); this.showSettings(true) }
    ;(el.querySelector('.pm-restart') as HTMLElement).onclick = done(opts.onRestart)
    ;(el.querySelector('.pm-menu') as HTMLElement).onclick = done(opts.onMenu)
    mountUi(el)
    this.pauseMenuEl = el
    this.pauseTrapOff = installFocusTrap(el)
  }

  hidePauseMenu(): void {
    this.pauseTrapOff?.(); this.pauseTrapOff = null
    this.pauseMenuEl?.remove()
    this.pauseMenuEl = null
  }

  get isSettingsOpen(): boolean { return this.settingsModal.style.display !== 'none' && this.settingsModal.style.display !== '' }
  closeSettings(): void {
    this.settingsTrapOff?.(); this.settingsTrapOff = null
    this.settingsModal.style.display = 'none'
    if (this.settingsReturnToPause && this.lastPauseOpts) {
      // Back to the pause menu the settings were opened from — the game stays paused.
      this.settingsReturnToPause = false
      this.showPauseMenu(this.lastPauseOpts)
      return
    }
    this.settingsReturnToPause = false
    this.opts.onModalClose?.()
  }
  get isRadialOpen(): boolean { return this.radial.classList.contains('open') }
}

