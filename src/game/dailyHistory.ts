// Daily-challenge win history + streak. Stamps are local-date YYYYMMDD strings (same format
// as the board seed stamp). Persistence mirrors profileStats: best-effort localStorage.

import { storageGet, storageSet } from '../util/safeStorage'

const KEY = 'pcb_td_daily_history_v1'

export function loadDailyHistory(): string[] {
  try {
    const v: unknown = JSON.parse(storageGet(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function recordDailyWin(stamp: string): void {
  const h = loadDailyHistory()
  if (h.includes(stamp)) return
  h.push(stamp)
  h.sort()
  storageSet(KEY, JSON.stringify(h.slice(-365)))
}

function toDate(stamp: string): Date {
  return new Date(Number(stamp.slice(0, 4)), Number(stamp.slice(4, 6)) - 1, Number(stamp.slice(6, 8)))
}
function toStamp(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/** Consecutive won days ending today — or yesterday, so an unplayed today doesn't kill the
 * streak before the player gets a chance to extend it. */
export function dailyStreak(todayStamp: string, history: string[] = loadDailyHistory()): number {
  const set = new Set(history)
  const d = toDate(todayStamp)
  if (!set.has(todayStamp)) d.setDate(d.getDate() - 1)
  let n = 0
  while (set.has(toStamp(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}
