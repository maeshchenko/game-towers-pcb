// src/ui/Toolbar.ts
import type { Level } from '../model/level'
import { serializeLevel, parseLevel } from '../model/level'
import { MAP_PRESETS } from '../app/viewport'

export function levelToBlobUrl(level: Level): string {
  return URL.createObjectURL(new Blob([serializeLevel(level)], { type: 'application/json' }))
}

export function readLevelFile(file: File): Promise<Level> {
  return file.text().then((t) => parseLevel(t))
}

export function mountToolbar(opts: {
  onNew(): void; onGenerate(): void; onSave(): void; onLoad(file: File): void; onReseed(): void
  onResize(cols: number, rows: number): void
}): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'pcb-toolbar'
  const btn = (label: string, fn: () => void) => {
    const b = document.createElement('button'); b.textContent = label; b.onclick = fn; bar.appendChild(b); return b
  }
  btn('New', opts.onNew)
  btn('Auto-Generate', opts.onGenerate)
  btn('Reseed', opts.onReseed)
  btn('Save', opts.onSave)
  const file = document.createElement('input'); file.type = 'file'; file.accept = 'application/json'
  file.style.display = 'none'
  file.onchange = () => { if (file.files?.[0]) opts.onLoad(file.files[0]) }
  const load = btn('Load', () => file.click()); load.appendChild(file)

  // map-size controls: presets + manual cols×rows
  const colsIn = document.createElement('input'); colsIn.type = 'number'; colsIn.value = '64'; colsIn.className = 'pcb-size'; colsIn.title = 'cols'
  const rowsIn = document.createElement('input'); rowsIn.type = 'number'; rowsIn.value = '48'; rowsIn.className = 'pcb-size'; rowsIn.title = 'rows'
  for (const p of MAP_PRESETS)
    btn(p.label, () => { colsIn.value = String(p.cols); rowsIn.value = String(p.rows); opts.onResize(p.cols, p.rows) })
  bar.appendChild(colsIn); bar.appendChild(document.createTextNode('×')); bar.appendChild(rowsIn)
  const apply = () => {
    const c = Math.max(8, Math.min(256, Math.floor(Number(colsIn.value) || 0)))
    const r = Math.max(8, Math.min(256, Math.floor(Number(rowsIn.value) || 0)))
    colsIn.value = String(c); rowsIn.value = String(r); opts.onResize(c, r)
  }
  colsIn.onchange = apply; rowsIn.onchange = apply

  document.body.appendChild(bar)
  return bar
}
