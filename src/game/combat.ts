import { dist } from '../geom/grid'
import type { Enemy } from './Enemy'
import type { ShotResult } from './Tower'
import type { GameEvent } from './events'
import type { SpatialGrid } from './SpatialGrid'

/** Status payloads ride every damaging hit (direct, splash, chain, projectile arrival). */
export function applyStatuses(shot: ShotResult, e: Enemy): void {
  if (shot.burnDps && shot.burnDur) e.applyBurn(shot.burnDps, shot.burnDur)
  if (shot.shredArmor && shot.shredDur) e.applyShred(shot.shredArmor, shot.shredDur)
}

export function applyShot(
  shot: ShotResult,
  enemies: Enemy[],
  pitch: number,
  emit?: (e: GameEvent) => void,
  grid?: SpatialGrid<Enemy>,
): void {
  const { target } = shot
  if (!target) return
  const dmg = shot.damage ?? 0
  // Every connected hit both credits the source tower's damage stat and marks the enemy so
  // the eventual kill is attributed to the LAST tower that touched it.
  const credit = (e: Enemy, dealt: number): void => {
    if (!shot.tower) return
    shot.tower.damageDealt += dealt
    e.lastHitBy = shot.tower
  }
  if (dmg > 0) {
    credit(target, target.takeDamage(dmg, shot.pierce ?? 0))
    applyStatuses(shot, target)
    emit?.({ type: 'enemyDamaged', kind: target.kind, amount: dmg, pos: { x: target.pos.x, y: target.pos.y }, enemy: target, from: shot.from })
  }
  if (shot.slow && shot.slow < 1) target.applySlow(shot.slow, 1.5)

  if (shot.splashRadius && dmg > 0) {
    const r = shot.splashRadius * pitch
    const splashCandidates = grid ? grid.queryCircle(target.pos, r) : enemies
    for (const e of splashCandidates) {
      if (e === target || !e.alive) continue
      if (dist(e.pos, target.pos) <= r) {
        credit(e, e.takeDamage(dmg, shot.pierce ?? 0))
        applyStatuses(shot, e)
        emit?.({ type: 'enemyDamaged', kind: e.kind, amount: dmg, pos: { x: e.pos.x, y: e.pos.y }, enemy: e, from: shot.from })
      }
    }
  }
  if (shot.chainCount && shot.chainRange && dmg > 0) {
    const r = shot.chainRange * pitch
    const chainDmg = dmg * 0.6
    const chainCandidates = grid ? grid.queryCircle(target.pos, r) : enemies
    const candidates = chainCandidates
      .filter((e) => e !== target && e.alive && dist(e.pos, target.pos) <= r)
      .sort((a, b) => dist(a.pos, target.pos) - dist(b.pos, target.pos))
      .slice(0, shot.chainCount)
    for (const e of candidates) {
      credit(e, e.takeDamage(chainDmg, shot.pierce ?? 0))
      applyStatuses(shot, e)
      emit?.({ type: 'enemyDamaged', kind: e.kind, amount: chainDmg, pos: { x: e.pos.x, y: e.pos.y }, enemy: e, from: shot.from })
    }
  }
}
