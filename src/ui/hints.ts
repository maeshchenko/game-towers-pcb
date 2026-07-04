// Contextual one-shot hints. Each fires the first time the player reaches a teachable moment
// (a tower can branch, an early wave call is available, a tower can be upgraded) and never again
// — the seen-set persists. Deliberately separate from the campaign tutorial: those are scripted
// steps for level 1, these surface systemic depth that the tutorial doesn't cover.

import { i18n } from './i18n'
import { mountUi } from './uiRoot'
import { storageGet, storageSet } from '../util/safeStorage'

export type HintId = 'branch' | 'earlycall' | 'upgrade' | 'sell' | 'ability' | 'backup'

const KEY = 'pcb_td_hints_seen_v1'

function seen(): Set<string> {
  try {
    const v: unknown = JSON.parse(storageGet(KEY) ?? '[]')
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/** True once — the caller shows its hint only when this returns true. */
export function hintFired(id: HintId): boolean {
  const s = seen()
  if (s.has(id)) return false
  s.add(id)
  storageSet(KEY, JSON.stringify([...s]))
  return true
}

/** Fire a hint the first time `id` is reached. No-op on repeats. */
export function showHint(id: HintId): void {
  if (!hintFired(id)) return
  let host = document.querySelector('.pcb-hint-toasts') as HTMLElement | null
  if (!host) {
    host = document.createElement('div')
    host.className = 'pcb-hint-toasts'
    mountUi(host)
  }
  const el = document.createElement('div')
  el.className = 'pcb-hint-toast'
  el.innerHTML = `
    <div class="pcb-hint-toast-icon">💡</div>
    <div>
      <div class="pcb-hint-toast-title">${i18n.t('hint.title')}</div>
      <div class="pcb-hint-toast-body">${i18n.tk(`hint.${id}`)}</div>
    </div>`
  host.appendChild(el)
  window.setTimeout(() => { el.classList.add('out'); window.setTimeout(() => el.remove(), 400) }, 6500)
}

/** Test/debug: wipe the seen-set so hints replay. */
export function resetHints(): void { storageSet(KEY, '[]') }

/** One-off non-persisted info toast (perf auto-degrade notice, etc). Reuses the hint styling. */
export function showInfoToast(title: string, body: string, icon = '⚙'): void {
  let host = document.querySelector('.pcb-hint-toasts') as HTMLElement | null
  if (!host) {
    host = document.createElement('div')
    host.className = 'pcb-hint-toasts'
    mountUi(host)
  }
  const el = document.createElement('div')
  el.className = 'pcb-hint-toast'
  el.innerHTML = `
    <div class="pcb-hint-toast-icon">${icon}</div>
    <div>
      <div class="pcb-hint-toast-title">${title}</div>
      <div class="pcb-hint-toast-body">${body}</div>
    </div>`
  host.appendChild(el)
  window.setTimeout(() => { el.classList.add('out'); window.setTimeout(() => el.remove(), 400) }, 7000)
}
