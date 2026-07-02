import { dist } from '../geom/grid'
import type { Enemy } from './Enemy'
import type { ShotResult } from './Tower'
import type { GameEvent } from './events'

export function applyShot(shot: ShotResult, enemies: Enemy[], pitch: number, emit?: (e: GameEvent) => void): void {
  const { target } = shot
  if (!target) return
  const dmg = shot.damage ?? 0
  if (dmg > 0) {
    target.takeDamage(dmg, shot.pierce ?? 0)
    emit?.({ type: 'enemyDamaged', kind: target.kind, amount: dmg, pos: { x: target.pos.x, y: target.pos.y } })
  }
  if (shot.slow && shot.slow < 1) target.applySlow(shot.slow, 1.5)

  if (shot.splashRadius && dmg > 0) {
    const r = shot.splashRadius * pitch
    for (const e of enemies) {
      if (e === target || !e.alive) continue
      if (dist(e.pos, target.pos) <= r) {
        e.takeDamage(dmg, shot.pierce ?? 0)
        emit?.({ type: 'enemyDamaged', kind: e.kind, amount: dmg, pos: { x: e.pos.x, y: e.pos.y } })
      }
    }
  }
  if (shot.chainCount && shot.chainRange && dmg > 0) {
    const r = shot.chainRange * pitch
    const chainDmg = dmg * 0.6
    const candidates = enemies
      .filter((e) => e !== target && e.alive && dist(e.pos, target.pos) <= r)
      .sort((a, b) => dist(a.pos, target.pos) - dist(b.pos, target.pos))
      .slice(0, shot.chainCount)
    for (const e of candidates) {
      e.takeDamage(chainDmg, shot.pierce ?? 0)
      emit?.({ type: 'enemyDamaged', kind: e.kind, amount: chainDmg, pos: { x: e.pos.x, y: e.pos.y } })
    }
  }
}
