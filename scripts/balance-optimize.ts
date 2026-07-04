// ============================================================================
// PER-MAP BALANCE OPTIMIZER (pcb-specific). Mine, not the tower-defence-game one.
//
// For each authored campaign level it binary-searches the per-map enemy-HP knob
// (meta.tune.hpMul) so the level lands on a target "pressure" (fraction of lives
// lost by the reference defence) that RAMPS with difficulty: gentle tutorial,
// tense finale. Prints the recommended hpMul per level; bake them into the level
// meta. Re-run after changing levels / tower / enemy numbers.
//
//   npx vitest run scripts/balance-optimize.ts
// ============================================================================
import { it } from 'vitest'
import { AUTHORED_LEVELS } from '../src/levels'
import { simulate } from '../src/game/sim'
import type { Board, Level } from '../src/model/level'

const BOARDS: Board[] = [
  { cols: 24, rows: 18, pitch: 30 }, { cols: 24, rows: 18, pitch: 30 },
  { cols: 32, rows: 24, pitch: 30 }, { cols: 32, rows: 24, pitch: 30 }, { cols: 32, rows: 24, pitch: 30 },
  { cols: 44, rows: 33, pitch: 30 }, { cols: 44, rows: 33, pitch: 30 }, { cols: 44, rows: 33, pitch: 30 },
  { cols: 60, rows: 45, pitch: 30 }, { cols: 60, rows: 45, pitch: 30 }, { cols: 60, rows: 45, pitch: 30 }, { cols: 60, rows: 45, pitch: 30 },
]

// difficulty-ramped target pressure: easy intro -> tense finale (fraction of 20 lives lost)
const targetPressure = (difficulty: number): number =>
  Math.max(0.12, Math.min(0.5, 0.10 + difficulty * 0.045))

// pressure of a level at a given hpMul (deterministic by seed)
function pressureAt(build: (b: Board) => Level, board: Board, hpMul: number): { won: boolean; pressure: number } {
  const lvl = build(board)
  lvl.meta.tune = { ...(lvl.meta.tune ?? {}), hpMul }
  const v = simulate(lvl, lvl.seed)
  return { won: v.won, pressure: v.pressure }
}

/** sweep hpMul and pick the value whose pressure is closest to target while staying WON. Robust to the
 *  coarse pressure quantisation (1 life = 0.05) and any non-monotonicity. Prefers not overshooting. */
function solveHpMul(build: (b: Board) => Level, board: Board, target: number): { hpMul: number; pressure: number; won: boolean } {
  // collect every WON sample; pick the one closest to target, ties -> HIGHER hpMul (more tension).
  // many of our levels are "cliffs" (defence holds perfectly until it suddenly collapses), so when no
  // sample reaches target this naturally selects the hardest still-winnable HP = max achievable tension.
  const won: { hpMul: number; pressure: number; won: boolean }[] = []
  // Floor 0.2: multi-spawn maps can be unwinnable for the reference defence at 0.4 already —
  // a floor that high silently recommends a LOSING hpMul (bit us on level 11).
  for (let hp = 0.2; hp <= 4.0001; hp += 0.05) {
    const r = pressureAt(build, board, hp)
    if (!r.won) break
    won.push({ hpMul: Math.round(hp * 100) / 100, ...r })
  }
  if (!won.length) return { hpMul: 0.2, ...pressureAt(build, board, 0.2) }
  const score = (p: number) => Math.abs(p - target) + Math.max(0, p - target) * 0.6 // small overshoot penalty
  let best = won[0]
  for (const w of won) {
    const d = score(w.pressure), bd = score(best.pressure)
    if (d < bd - 1e-9 || (Math.abs(d - bd) < 1e-9 && w.hpMul > best.hpMul)) best = w
  }
  return best
}

it('per-map balance optimize: recommend hpMul', { timeout: 120000 }, () => {
  let out = '\n=== PER-MAP BALANCE OPTIMIZE (reference cannon defence) ===\n'
  out += 'lvl  diff  target  hpMul   pressure  result\n'
  const recos: number[] = []
  AUTHORED_LEVELS.forEach((build, i) => {
    const board = BOARDS[i]
    const diff = build(board).meta.difficulty
    const t = targetPressure(diff)
    const r = solveHpMul(build, board, t)
    const hp = Math.round(r.hpMul * 100) / 100
    recos.push(hp)
    out += `${String(i + 1).padStart(2, ' ')}   ${String(diff).padStart(2)}    ${t.toFixed(2)}    ${hp.toFixed(2).padStart(5)}   ${r.pressure.toFixed(2).padStart(5)}     ${r.won ? 'WON' : 'LOST'}\n`
  })
  out += '\nRECO hpMul array: [' + recos.map((x) => x.toFixed(2)).join(', ') + ']\n'
  console.log(out)
})
