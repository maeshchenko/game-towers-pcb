import type { Board, Level } from '../model/level'
import { generateLevel } from '../pipeline/generator'
import { simulate } from './sim'

// Fair band for the basic-defense pressure (fraction of lives lost): winnable but with real
// pressure — not trivial (< LO) and not a loss. Measured: difficulty 5 sits ~0.49.
export const FAIR_LO = 0.15
export const FAIR_HI = 0.65
const TARGET = 0.4

export interface BalanceVerdict { won: boolean; pressure: number }

/** Headless verdict: does a basic defense win this level, and under how much pressure? */
export function evaluate(level: Level, seed: number): BalanceVerdict {
  const r = simulate(level, seed)
  return { won: r.won, pressure: r.pressure }
}

/**
 * Generate a level guaranteed to be fair under a basic defense: try several seeds, accept the
 * first that is won with pressure in [FAIR_LO, FAIR_HI]; otherwise return the closest-to-target
 * attempt. Deterministic for a given (board, difficulty, seed). Tags `meta.balance`.
 */
export function generateBalancedLevel(params: {
  board: Board; difficulty: number; seed: number; archetype?: string; attempts?: number
}): Level {
  const attempts = params.attempts ?? 6
  let best: { level: Level; verdict: BalanceVerdict; dist: number } | null = null
  for (let i = 0; i < attempts; i++) {
    const seed = params.seed + i * 1009
    const level = generateLevel({ board: params.board, difficulty: params.difficulty, seed, archetype: params.archetype })
    const verdict = evaluate(level, seed)
    const fair = verdict.won && verdict.pressure >= FAIR_LO && verdict.pressure <= FAIR_HI
    if (fair) return tag(level, verdict)
    const dist = verdict.won ? Math.abs(verdict.pressure - TARGET) : 1 + verdict.pressure // prefer wins
    if (!best || dist < best.dist) best = { level, verdict, dist }
  }
  return tag(best!.level, best!.verdict)
}

function tag(level: Level, balance: BalanceVerdict): Level {
  return { ...level, meta: { ...level.meta, balance } }
}
