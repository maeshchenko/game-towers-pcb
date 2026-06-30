// src/ui/GameUI.ts
import type { Game } from '../game/Game'
import type { Tower } from '../game/Tower'
import { TOWER_DEFS, type TowerKind } from '../game/towerTypes'
import { audioEngine } from './AudioEngine'
import { i18n } from './i18n'

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
  private radial!: HTMLElement
  private overlay!: HTMLElement
  private wavePreview!: HTMLElement
  private radialTooltip!: HTMLElement
  private settingsModal!: HTMLElement
  private speedBtns: Record<number, HTMLButtonElement> = {}
  private autoWaveActive = true

  constructor(private opts: {
    onBuild(kind: TowerKind, spotIndex: number): void; onStartWave(): void; onTogglePlay(): void
    onSpeed(mult: number): void; onUpgrade(): void; onSell(): void; onTargetMode(): void
    onMenu?(): void
    onLanguageChanged?(): void
    onAutoWaveChanged?(val: boolean): void
    onOpenBestiary?(): void
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

    right.append(btnStart, btnPause, btn1x, btn2x, btn4x, btnBestiary, btnSettings)
    hud.append(left, center, right)
    document.body.appendChild(hud)

    // Wave Preview (initially hidden)
    this.wavePreview = document.createElement('div')
    this.wavePreview.className = 'pcb-wavepreview'
    this.wavePreview.style.display = 'none'
    document.body.appendChild(this.wavePreview)

    // Radial build menu (initially empty)
    this.radial = document.createElement('div')
    this.radial.className = 'pcb-radialmenu'
    document.body.appendChild(this.radial)

    // Radial Build Tooltip
    this.radialTooltip = document.createElement('div')
    this.radialTooltip.className = 'pcb-radial-tooltip'
    this.radialTooltip.style.display = 'none'
    document.body.appendChild(this.radialTooltip)

    // Settings Modal
    this.settingsModal = document.createElement('div')
    this.settingsModal.className = 'pcb-settings-modal'
    this.settingsModal.style.display = 'none'
    document.body.appendChild(this.settingsModal)

    // Tower detail panel (side panel)
    this.panel = document.createElement('div')
    this.panel.className = 'pcb-towerpanel'
    this.panel.style.display = 'none'
    document.body.appendChild(this.panel)

    // Game Overlay (Victory / Defeat)
    this.overlay = document.createElement('div')
    this.overlay.className = 'pcb-game-overlay'
    this.overlay.style.display = 'none'
    document.body.appendChild(this.overlay)

    return hud
  }

  retranslateHud(game?: Game, difficulty = 1): void {
    const lbl = document.querySelector('.hud-level-label')
    if (lbl) lbl.textContent = i18n.t('hud.level') + ' '
    
    const startBtn = document.querySelector('.next-wave-btn') as HTMLElement
    if (startBtn) startBtn.textContent = i18n.t('hud.start_wave')
    
    const mapBtn = document.querySelector('.map-btn') as HTMLElement
    if (mapBtn) mapBtn.textContent = i18n.t('hud.map')

    const lvlNum = game ? String(game.state.waveNumber).padStart(2, '0') : '01'
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
          <label>${i18n.t('settings.lang')}</label>
          <div style="display: flex; gap: 8px;">
            <button class="pcb-hud-btn lang-ru ${i18n.lang === 'ru' ? 'active' : ''}">RU</button>
            <button class="pcb-hud-btn lang-en ${i18n.lang === 'en' ? 'active' : ''}">EN</button>
          </div>
        </div>

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
  }

  private selectSpeed(mult: number): void {
    Object.values(this.speedBtns).forEach((b) => b.classList.remove('active'))
    if (this.speedBtns[mult]) this.speedBtns[mult].classList.add('active')
  }

  update(game: Game, difficulty = 1): void {
    const s = game.state
    const h = formatHud({ wave: s.waveNumber, waveCount: s.waveCount, lives: s.lives, gold: s.gold, phase: s.phase })
    
    this.elWave.textContent = h.wave
    this.elLives.textContent = `❤ ${s.lives}`
    this.elGold.textContent = `⚡ ${s.gold}`

    // Update level name/number in HUD
    const lvlEl = document.querySelector('.level-num')
    if (lvlEl) lvlEl.textContent = String(game.state.waveNumber).padStart(2, '0')

    this.updateDiffBadge(difficulty)

    // Update Wave Preview
    if (s.phase === 'build') {
      const nextWave = game.peekWave(s.wave)
      if (nextWave.length > 0) {
        this.wavePreview.style.display = 'flex'
        this.wavePreview.innerHTML = `<span class="pcb-wavepreview-title">${i18n.t('enemy.next_wave')}</span>`
        nextWave.forEach((entry) => {
          const kindName = `enemy.${entry.kind}` as any
          const t = { name: i18n.t(kindName), color: getEnemyColor(entry.kind) }
          const item = document.createElement('div')
          item.className = 'pcb-wavepreview-item'
          item.innerHTML = `
            <span class="pcb-wavepreview-dot" style="background: ${t.color}; box-shadow: 0 0 6px ${t.color};"></span>
            <span class="pcb-wavepreview-name">${t.name}</span>
            <span class="pcb-wavepreview-count">×${entry.count}</span>
          `
          this.wavePreview.appendChild(item)
        })
      } else {
        this.wavePreview.style.display = 'none'
      }
    } else {
      this.wavePreview.style.display = 'none'
    }
  }

  openRadialMenu(spotIndex: number, clientX: number, clientY: number, goldAvailable: number, allowedTowerKind?: TowerKind): void {
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

      if (goldAvailable < cost || (allowedTowerKind && k !== allowedTowerKind)) {
        btn.style.opacity = '0.35'
        btn.style.pointerEvents = 'none'
      }

      btn.onclick = (e) => {
        e.stopPropagation()
        audioEngine.playBuild()
        this.opts.onBuild(k, spotIndex)
        this.closeRadialMenu()
      }

      // Add tooltip hover events
      btn.onmouseenter = () => {
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
        
        // Position tooltip centrally below the radial menu
        this.radialTooltip.style.left = `${clientX}px`
        this.radialTooltip.style.top = `${clientY + 120}px`
        
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
  }

  closeRadialMenu(): void {
    if (!this.radial.classList.contains('open')) return
    this.radial.classList.remove('open')
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
    this.panel.innerHTML = `<h3>${t.kind.toUpperCase()} L${t.level + 1}</h3>
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

    if (t.level < t.maxLevel) mk(`${upgradeStr} $${TOWER_DEFS[t.kind][t.level + 1].cost}`, this.opts.onUpgrade, 'upgrade')
    mk(`${sellStr} $${sellValue}`, this.opts.onSell, 'sell')
    mk(`${targetStr}: ` + t.targetMode, this.opts.onTargetMode, 'click')
  }

  showVictoryScreen(stars: number | null, score: number, onNext: (() => void) | null, onRetry: () => void, onMenu: () => void): void {
    this.overlay.style.display = 'flex'
    this.overlay.className = 'pcb-game-overlay victory'
    
    let starsHtml = ''
    if (stars !== null) {
      starsHtml = `
        <div class="pcb-victory-stars">
          ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}
        </div>
      `
    }

    this.overlay.innerHTML = `
      <div class="pcb-overlay-card">
        <h2>${i18n.t('result.victory_title')}</h2>
        <h3 class="status-glow">${i18n.t('result.victory_subtitle')}</h3>
        ${starsHtml}
        <div class="pcb-overlay-score">${i18n.t('result.saved_lives')}: ❤${score}</div>
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
  }
  return map[kind] || '#fff'
}
