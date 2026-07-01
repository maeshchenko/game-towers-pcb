// src/ui/Toolbar.ts
import type { Level } from '../model/level'
import { serializeLevel, parseLevel } from '../model/level'
import { MAP_PRESETS } from '../app/viewport'
import { i18n } from './i18n'

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
  const btn = (label: string, className: string, fn: () => void) => {
    const b = document.createElement('button')
    b.className = className
    b.textContent = label
    b.onclick = fn
    bar.appendChild(b)
    return b
  }
  btn(i18n.t('editor.new'), 'pcb-btn-new', opts.onNew)
  btn(i18n.t('editor.generate'), 'pcb-btn-generate', opts.onGenerate)
  btn(i18n.t('editor.reseed'), 'pcb-btn-reseed', opts.onReseed)
  btn(i18n.t('editor.save'), 'pcb-btn-save', opts.onSave)
  const file = document.createElement('input'); file.type = 'file'; file.accept = 'application/json'
  file.style.display = 'none'
  file.onchange = () => { if (file.files?.[0]) opts.onLoad(file.files[0]) }
  const load = btn(i18n.t('editor.load'), 'pcb-btn-load', () => file.click()); load.appendChild(file)

  // map-size controls: presets + manual cols×rows
  const colsIn = document.createElement('input'); colsIn.type = 'number'; colsIn.value = '32'; colsIn.className = 'pcb-size'; colsIn.title = 'cols'
  const rowsIn = document.createElement('input'); rowsIn.type = 'number'; rowsIn.value = '24'; rowsIn.className = 'pcb-size'; rowsIn.title = 'rows'
  for (const p of MAP_PRESETS)
    btn(p.label, 'pcb-btn-preset', () => { colsIn.value = String(p.cols); rowsIn.value = String(p.rows); opts.onResize(p.cols, p.rows) })
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

export function retranslateToolbar(): void {
  const btnNew = document.querySelector('.pcb-btn-new')
  if (btnNew) btnNew.firstChild!.textContent = i18n.t('editor.new')
  const btnGen = document.querySelector('.pcb-btn-generate')
  if (btnGen) btnGen.firstChild!.textContent = i18n.t('editor.generate')
  const btnRes = document.querySelector('.pcb-btn-reseed')
  if (btnRes) btnRes.firstChild!.textContent = i18n.t('editor.reseed')
  const btnSave = document.querySelector('.pcb-btn-save')
  if (btnSave) btnSave.firstChild!.textContent = i18n.t('editor.save')
  const btnLoad = document.querySelector('.pcb-btn-load')
  if (btnLoad) btnLoad.firstChild!.textContent = i18n.t('editor.load')
}
