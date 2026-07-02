// Framework-free typed event bus. The sim publishes; render/audio/UI subscribe.
import type { Pt } from '../geom/types'
import type { TowerKind } from './towerTypes'
import type { EnemyKind } from './enemyTypes'

export type GameEvent =
  | { type: 'shotFired'; kind: TowerKind; from: Pt; to: Pt; towerLevel: number }
  | { type: 'enemyDamaged'; kind: EnemyKind; amount: number; pos: Pt }
  | { type: 'enemyDied'; kind: EnemyKind; pos: Pt; bounty: number }
  | { type: 'enemySpawned'; kind: EnemyKind; pos: Pt }
  | { type: 'leak'; kind: EnemyKind; livesLost: number }
  | { type: 'waveStart'; index: number }
  | { type: 'waveEnd'; index: number }
  | { type: 'towerBuilt'; kind: TowerKind; pos: Pt }
  | { type: 'towerUpgraded'; kind: TowerKind; pos: Pt; level: number }
  | { type: 'towerSold'; kind: TowerKind; pos: Pt }
  | { type: 'baseHit'; livesLost: number }
  | { type: 'projectileImpact'; kind: TowerKind; pos: Pt; splashRadius?: number }

export class EventBus {
  private handlers = new Set<(e: GameEvent) => void>()
  on(h: (e: GameEvent) => void): () => void {
    this.handlers.add(h)
    return () => this.handlers.delete(h)
  }
  emit(e: GameEvent): void {
    for (const h of this.handlers) {
      try { h(e) } catch (err) { console.error('event handler failed', err) }
    }
  }
}
