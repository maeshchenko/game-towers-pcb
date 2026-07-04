// Player-chosen global difficulty preference (see PlayerDifficulty in difficulty.ts).
// Applied on the NEXT level start — mid-level the enemy HP is already rolled.
import { storageGet, storageSet } from '../util/safeStorage'
import type { PlayerDifficulty } from './difficulty'

const KEY = 'pcb_td_player_difficulty_v1'

export function loadPlayerDifficulty(): PlayerDifficulty {
  const v = storageGet(KEY)
  return v === 'casual' || v === 'veteran' ? v : 'normal'
}

export function savePlayerDifficulty(d: PlayerDifficulty): void {
  storageSet(KEY, d)
}
