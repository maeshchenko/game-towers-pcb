// src/ui/GameUI.ts
import type { Game } from '../game/Game'
import type { Tower } from '../game/Tower'
import { TOWER_DEFS, type TowerKind } from '../game/towerTypes'

export function formatHud(s: { wave: number; waveCount: number; lives: number; gold: number; phase: string }) {
  return { wave: `WAVE ${s.wave}/${s.waveCount}`, lives: `LIVES ${s.lives}`, gold: `CURRENCY ${s.gold}` }
}

const KINDS: TowerKind[] = ['cannon', 'slow', 'sniper', 'mortar', 'tesla']
const TOWER_THEMES: Record<TowerKind, { name: string; color: string; glow: string; dx: string; dy: string }> = {
  cannon: { name: 'PULSE', color: '#36e0e0', glow: 'rgba(54,224,224,0.4)', dx: '0px', dy: '-70px' },
  slow: { name: 'SLOW', color: '#4dff7a', glow: 'rgba(77,255,122,0.4)', dx: '67px', dy: '-22px' },
  sniper: { name: 'LASER', color: '#3a7bff', glow: 'rgba(58,123,255,0.4)', dx: '41px', dy: '57px' },
  mortar: { name: 'MISSILE', color: '#ff9b3a', glow: 'rgba(255,155,58,0.4)', dx: '-41px', dy: '57px' },
  tesla: { name: 'TESLA', color: '#c23bff', glow: 'rgba(194,59,255,0.4)', dx: '-67px', dy: '-22px' },
}

const TOWER_DESCS: Record<TowerKind, string> = {
  cannon: 'Базовый чип средней дальности. Стабильный импульсный урон.',
  slow: 'Замедляет сигналы в радиусе действия. Не наносит урона.',
  sniper: 'Мощный лазер. Огромный урон и радиус с пробитием брони.',
  mortar: 'Выпускает ракеты, наносящие взрывной урон по области (сплэш).',
  tesla: 'Генерирует электро-цепи, перескакивающие между целями.',
}

const ENEMY_THEMES: Record<string, { name: string; color: string }> = {
  normal: { name: 'PACKET', color: '#ff4d4d' },
  fast: { name: 'SIGNAL', color: '#36e0e0' },
  healer: { name: 'BURST', color: '#f0c43a' },
  brute: { name: 'VIRUS', color: '#c23bff' },
  tank: { name: 'CORRUPTED', color: '#ff9b3a' },
  rogue: { name: 'GLITCH', color: '#4dff7a' },
  boss: { name: 'BOSS', color: '#c23bff' },
}

export class GameUI {
  private elWave!: HTMLElement; private elLives!: HTMLElement; private elGold!: HTMLElement
  private elDiff!: HTMLElement
  private panel!: HTMLElement
  private radial!: HTMLElement
  private overlay!: HTMLElement
  private wavePreview!: HTMLElement
  private radialTooltip!: HTMLElement
  private speedBtns: Record<number, HTMLButtonElement> = {}

  constructor(private opts: {
    onBuild(kind: TowerKind, spotIndex: number): void; onStartWave(): void; onTogglePlay(): void
    onSpeed(mult: number): void; onUpgrade(): void; onSell(): void; onTargetMode(): void
    onMenu?(): void
  }) {}

  selectedBuildKind(): TowerKind | null { return null } // Legacy method placeholder for compatibility

  mountHud(): HTMLElement {
    // Top HUD
    const hud = document.createElement('div')
    hud.className = 'pcb-tophud'

    const left = document.createElement('div')
    left.className = 'pcb-hud-left'
    left.innerHTML = `LEVEL <span class="pcb-hud-val level-num">01</span> <span class="pcb-hud-badge difficulty-badge">EASY</span>`
    this.elDiff = left.querySelector('.difficulty-badge')!

    const btnMap = document.createElement('button')
    btnMap.className = 'pcb-hud-btn'
    btnMap.textContent = 'MAP'
    btnMap.style.marginLeft = '12px'
    btnMap.onclick = () => { if (this.opts.onMenu) this.opts.onMenu() }
    left.appendChild(btnMap)

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
    btnStart.className = 'pcb-hud-btn active'
    btnStart.textContent = 'START WAVE'
    btnStart.onclick = () => this.opts.onStartWave()

    const btnPause = document.createElement('button')
    btnPause.className = 'pcb-hud-btn'
    btnPause.textContent = '⏸'
    btnPause.onclick = () => this.opts.onTogglePlay()

    const btn1x = document.createElement('button')
    btn1x.className = 'pcb-hud-btn active'
    btn1x.textContent = '1×'
    btn1x.onclick = () => { this.opts.onSpeed(1); this.selectSpeed(1) }
    this.speedBtns[1] = btn1x

    const btn2x = document.createElement('button')
    btn2x.className = 'pcb-hud-btn'
    btn2x.textContent = '2×'
    btn2x.onclick = () => { this.opts.onSpeed(2); this.selectSpeed(2) }
    this.speedBtns[2] = btn2x

    const btn4x = document.createElement('button')
    btn4x.className = 'pcb-hud-btn'
    btn4x.textContent = '4×'
    btn4x.onclick = () => { this.opts.onSpeed(4); this.selectSpeed(4) }
    this.speedBtns[4] = btn4x

    right.append(btnStart, btnPause, btn1x, btn2x, btn4x)
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

    // Update difficulty tag
    if (difficulty >= 7) {
      this.elDiff.className = 'pcb-hud-badge difficulty-badge hard'
      this.elDiff.textContent = 'HARD'
    } else if (difficulty >= 3) {
      this.elDiff.className = 'pcb-hud-badge difficulty-badge medium'
      this.elDiff.textContent = 'MEDIUM'
    } else {
      this.elDiff.className = 'pcb-hud-badge difficulty-badge easy'
      this.elDiff.textContent = 'EASY'
    }

    // Update Wave Preview
    if (s.phase === 'build') {
      const nextWave = game.peekWave(s.wave)
      if (nextWave.length > 0) {
        this.wavePreview.style.display = 'flex'
        this.wavePreview.innerHTML = `<span class="pcb-wavepreview-title">СЛЕДУЮЩАЯ ВОЛНА:</span>`
        nextWave.forEach((entry) => {
          const t = ENEMY_THEMES[entry.kind] || { name: entry.kind.toUpperCase(), color: '#fff' }
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
        this.opts.onBuild(k, spotIndex)
        this.closeRadialMenu()
      }

      // Add tooltip hover events
      btn.onmouseenter = () => {
        const def = TOWER_DEFS[k][0]
        const desc = TOWER_DESCS[k]
        
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
    // Clear items after animation
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
    const mk = (label: string, fn: () => void) => {
      const b = document.createElement('button')
      b.textContent = label
      b.onclick = fn
      this.panel.appendChild(b)
    }
    if (t.level < t.maxLevel) mk(`Upgrade $${TOWER_DEFS[t.kind][t.level + 1].cost}`, this.opts.onUpgrade)
    mk(`Sell $${sellValue}`, this.opts.onSell)
    mk('Target: ' + t.targetMode, this.opts.onTargetMode)
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
        <h2>ИСПЫТАНИЕ ЗАВЕРШЕНО</h2>
        <h3 class="status-glow">ЦЕПЬ СТАБИЛИЗИРОВАНА</h3>
        ${starsHtml}
        <div class="pcb-overlay-score">Сохранено жизней: ❤${score}</div>
        <div class="pcb-overlay-actions">
          ${onNext ? '<button class="pcb-hud-btn active next-btn">СЛЕД. УРОВЕНЬ</button>' : ''}
          <button class="pcb-hud-btn retry-btn">ПОВТОРИТЬ</button>
          <button class="pcb-hud-btn menu-btn">КАРТА КАМПАНИИ</button>
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
        <h2>ЦЕПЬ РАЗОМКНУТА</h2>
        <h3 class="status-glow">КРИТИЧЕСКИЕ ПОВРЕЖДЕНИЯ</h3>
        <div class="pcb-overlay-score">Все жизни базы были утеряны.</div>
        <div class="pcb-overlay-actions">
          <button class="pcb-hud-btn active retry-btn">ПОВТОРИТЬ</button>
          <button class="pcb-hud-btn menu-btn">КАРТА КАМПАНИИ</button>
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
