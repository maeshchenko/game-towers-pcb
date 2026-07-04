// Safe localStorage access. With "block all cookies" (and some portal iframes) the mere
// property access `window.localStorage` throws SecurityError — a plain `if (window.localStorage)`
// guard still crashes. Every read/write in the game goes through these helpers; storage being
// unavailable degrades to in-memory defaults instead of a black screen on boot.

export function storageGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function storageSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // Storage blocked or full — settings simply won't persist this session.
  }
}

export function storageRemove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key)
  } catch {
    // ignore
  }
}
