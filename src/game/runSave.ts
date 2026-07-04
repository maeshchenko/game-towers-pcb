// Mid-level run persistence: a reload (or a mobile tab eviction) on a 15-minute XL level must
// not cost the whole run. Snapshots are taken at build-phase boundaries (Game.snapshot) and
// keyed to the campaign level index; win/lose/exit clears the slot.
import { storageGet, storageSet, storageRemove } from '../util/safeStorage'
import type { RunSnapshot } from './Game'

const KEY = 'pcb_td_run_v1'

interface StoredRun { v: 1; levelIndex: number; snap: RunSnapshot }

export function saveRun(levelIndex: number, snap: RunSnapshot): void {
  const data: StoredRun = { v: 1, levelIndex, snap }
  storageSet(KEY, JSON.stringify(data))
}

export function loadRun(levelIndex: number): RunSnapshot | null {
  try {
    const raw = storageGet(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredRun
    if (parsed?.v !== 1 || parsed.levelIndex !== levelIndex) return null
    if (typeof parsed.snap?.wave !== 'number' || !Array.isArray(parsed.snap.towers)) return null
    return parsed.snap
  } catch {
    return null
  }
}

export function clearRun(): void {
  storageRemove(KEY)
}
