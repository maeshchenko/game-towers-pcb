// src/render/juice/motion.ts
// Global reduced-effects flag. No pixi/gsap imports so this stays jsdom-testable in isolation.
import { storageGet, storageSet } from '../../util/safeStorage'

const STORAGE_KEY = 'pcb_td_reduced_fx_v1'

export const juice = {
  reducedFx: false,
}

function readStoredPreference(): boolean | null {
  const raw = storageGet(STORAGE_KEY)
  if (raw === '1') return true
  if (raw === '0') return false
  return null
}

function readSystemPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Reads persisted preference, falling back to the OS-level prefers-reduced-motion query. Also
// live-subscribes to that query: if the user has no explicit override, flipping the OS setting
// (or a device power-saver toggling it) applies immediately without a reload.
export function initMotion(): void {
  const stored = readStoredPreference()
  juice.reducedFx = stored !== null ? stored : readSystemPreference()
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => { if (readStoredPreference() === null) juice.reducedFx = mq.matches }
    // addEventListener is the modern API; older Safari only has addListener.
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange)
    else if (typeof mq.addListener === 'function') mq.addListener(onChange)
  }
}

export function setReducedFx(v: boolean): void {
  juice.reducedFx = v
  storageSet(STORAGE_KEY, v ? '1' : '0')
}
