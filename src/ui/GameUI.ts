import type { Game } from '../game/Game'
import type { Tower } from '../game/Tower'
import { TOWER_DEFS, type TowerKind } from '../game/towerTypes'

export function formatHud(s: { wave: number; waveCount: number; lives: number; gold: number; phase: string }) {
  return { wave: `WAVE ${s.wave}/${s.waveCount}`, lives: `LIVES ${s.lives}`, gold: `CURRENCY ${s.gold}` }
}

const KINDS: TowerKind[] = ['cannon', 'slow', 'sniper', 'mortar', 'tesla']

export class GameUI {
  private armed: TowerKind | null = null
  private elWave!: HTMLElement; private elLives!: HTMLElement; private elGold!: HTMLElement
  private panel!: HTMLElement
  constructor(private opts: {
    onBuild(kind: TowerKind): void; onStartWave(): void; onTogglePlay(): void
    onSpeed(mult: number): void; onUpgrade(): void; onSell(): void; onTargetMode(): void
  }) {}

  selectedBuildKind(): TowerKind | null { return this.armed }

  mountHud(): HTMLElement {
    const bar = document.createElement('div'); bar.className = 'pcb-gamebar'
    this.elWave = document.createElement('span'); this.elLives = document.createElement('span'); this.elGold = document.createElement('span')
    bar.append(this.elWave, this.elLives, this.elGold)
    const mkBtn = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; bar.appendChild(b); return b }
    mkBtn('Start Wave', this.opts.onStartWave)
    mkBtn('Play/Pause', this.opts.onTogglePlay)
    mkBtn('1×', () => this.opts.onSpeed(1)); mkBtn('2×', () => this.opts.onSpeed(2)); mkBtn('4×', () => this.opts.onSpeed(4))
    for (const k of KINDS) {
      const cost = TOWER_DEFS[k][0].cost
      mkBtn(`${k} $${cost}`, () => { this.armed = k; this.opts.onBuild(k) })
    }
    document.body.appendChild(bar)
    this.panel = document.createElement('div'); this.panel.className = 'pcb-towerpanel'; this.panel.style.display = 'none'
    document.body.appendChild(this.panel)
    return bar
  }

  update(game: Game): void {
    const s = game.state
    const h = formatHud({ wave: s.waveNumber, waveCount: s.waveCount, lives: s.lives, gold: s.gold, phase: s.phase })
    this.elWave.textContent = h.wave; this.elLives.textContent = h.lives; this.elGold.textContent = h.gold
  }

  showTower(t: Tower | null, sellValue: number): void {
    if (!t) { this.panel.style.display = 'none'; this.armed = null; return }
    const s = t.stats
    this.panel.style.display = 'block'
    this.panel.innerHTML = `<h3>${t.kind.toUpperCase()} L${t.level + 1}</h3>
      <div>DMG ${s.damage} · RATE ${s.fireRate} · RANGE ${s.range}</div>
      <div>MODE ${t.targetMode}</div>`
    const mk = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; this.panel.appendChild(b) }
    if (t.level < t.maxLevel) mk(`Upgrade $${TOWER_DEFS[t.kind][t.level + 1].cost}`, this.opts.onUpgrade)
    mk(`Sell $${sellValue}`, this.opts.onSell)
    mk('Target: ' + t.targetMode, this.opts.onTargetMode)
  }
}
