// In-DOM replacements for window.alert/confirm: native dialogs are SILENTLY blocked in
// sandboxed iframes (itch.io embeds the game in one) — confirm() returns false and the
// action becomes unreachable with no error. Same pcb-settings-modal styling as the rest.
import { i18n } from './i18n'
import { audioEngine } from './AudioEngine'
import { mountUi } from './uiRoot'

function makeModal(message: string, buttons: { label: string; primary: boolean; value: boolean }[]): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = document.createElement('div')
    modal.className = 'pcb-settings-modal'
    modal.style.display = 'flex'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    const prevFocus = document.activeElement as HTMLElement | null
    const btnsHtml = buttons.map((b, i) =>
      `<button class="pcb-hud-btn ${b.primary ? 'active' : ''} pcb-confirm-btn-${i}" style="flex: 1;">${b.label}</button>`,
    ).join('')
    modal.innerHTML = `
      <div class="pcb-settings-card" style="max-width: 320px; text-align: center;">
        <p style="margin: 0 0 16px; line-height: 1.5; font-size: 12px; color: #d9e6dc;">${message}</p>
        <div style="display: flex; gap: 8px;">${btnsHtml}</div>
      </div>`
    const close = (value: boolean): void => {
      audioEngine.playClick()
      window.removeEventListener('keydown', onKey, true)
      modal.remove()
      prevFocus?.focus?.() // restore focus to whatever opened the dialog
      resolve(value)
    }
    buttons.forEach((b, i) => {
      ;(modal.querySelector(`.pcb-confirm-btn-${i}`) as HTMLElement).onclick = () => close(b.value)
    })
    // Backdrop click / Escape = the safe answer (false), same as dismissing a confirm.
    modal.onclick = (e) => { if (e.target === modal) close(false) }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.stopPropagation(); close(false); return }
      // Focus trap: Tab cycles only within the dialog's buttons (never leaks to the game behind).
      if (e.key === 'Tab') {
        const focusable = Array.from(modal.querySelectorAll('button')) as HTMLElement[]
        if (focusable.length === 0) return
        const first = focusable[0], last = focusable[focusable.length - 1]
        const active = document.activeElement
        if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    mountUi(modal)
    ;(modal.querySelector('button.active') as HTMLElement | null)?.focus()
  })
}

/** Async confirm(): resolves true on the affirmative button. */
export function showConfirm(message: string): Promise<boolean> {
  return makeModal(message, [
    { label: i18n.t('confirm.yes'), primary: true, value: true },
    { label: i18n.t('confirm.no'), primary: false, value: false },
  ])
}

/** Async alert(): resolves when dismissed. */
export async function showAlert(message: string): Promise<void> {
  await makeModal(message, [{ label: i18n.t('confirm.ok'), primary: true, value: true }])
}
