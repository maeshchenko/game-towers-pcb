// src/ui/Panels.ts
import type { Level } from '../model/level'

export function mountPanels(level: Level | null): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'pcb-panels'
  wrap.innerHTML = `
    <div class="pcb-panel pcb-legend">
      <h3>LEGEND</h3>
      <ul>
        <li><span class="sw trace"></span> ENEMY PATH</li>
        <li><span class="sw build"></span> BUILD SPOT</li>
        <li><span class="sw special"></span> SPECIAL SPOT</li>
        <li><span class="sw start"></span> START</li>
        <li><span class="sw finish"></span> FINISH</li>
      </ul>
    </div>
    <div class="pcb-panel pcb-info">
      <h3>${level?.meta.name ?? 'LEVEL --'}</h3>
      <div>WAVE 0/30</div><div>LIVES 20</div><div>CURRENCY 650</div>
    </div>
    <div class="pcb-panel pcb-tips">
      <h3>TIPS</h3><p>BUILD TOWERS TO STOP ENEMIES FROM REACHING THE FINISH</p>
    </div>`
  document.body.appendChild(wrap)
  return wrap
}

export function updateLevelName(name: string): void {
  const h3 = document.querySelector('.pcb-info h3')
  if (h3) h3.textContent = name
}
