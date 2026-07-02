// src/render/juice/motion.ts
// Global reduced-effects flag. No pixi/gsap imports so this stays jsdom-testable in isolation.

const STORAGE_KEY = 'pcb_td_reduced_fx_v1'

export const juice = {
  reducedFx: false,
}

function readStoredPreference(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === '1') return true
  if (raw === '0') return false
  return null
}

function readSystemPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Reads persisted preference, falling back to the OS-level prefers-reduced-motion query.
export function initMotion(): void {
  const stored = readStoredPreference()
  juice.reducedFx = stored !== null ? stored : readSystemPreference()
}

export function setReducedFx(v: boolean): void {
  juice.reducedFx = v
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
  }
}
