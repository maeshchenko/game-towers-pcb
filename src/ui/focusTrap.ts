// Keyboard focus containment for modal dialogs. Marks the element as a dialog and cycles Tab
// within its focusable children so keyboard/screen-reader users can't tab out into the game
// behind the overlay. Returns a teardown that also restores focus to whatever was focused before.

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function installFocusTrap(el: HTMLElement): () => void {
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  const prevFocus = document.activeElement as HTMLElement | null

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return
    const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null)
    if (items.length === 0) return
    const first = items[0], last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
  }
  el.addEventListener('keydown', onKey)
  // Focus the first sensible control (the primary action if flagged, else the first focusable).
  const initial = el.querySelector<HTMLElement>('button.active') ?? el.querySelector<HTMLElement>(FOCUSABLE)
  initial?.focus()

  return () => {
    el.removeEventListener('keydown', onKey)
    prevFocus?.focus?.()
  }
}
