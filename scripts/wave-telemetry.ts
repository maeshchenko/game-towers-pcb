// Per-wave balance report for all 12 campaign levels: where lives are lost, how gold flows,
// how long each wave drags, whether the difficulty is a curve or a cliff.
//   npm run balance:waves
// Keep this tool — it generalizes to future TD projects (anything with Game + waveTelemetry).
import { it } from 'vitest'
import { CAMPAIGN_LEVELS } from '../src/game/campaign'
import { waveTelemetry } from '../src/game/telemetry'
import { startLives } from '../src/game/difficulty'

it('per-wave balance report', () => {
  const summary: string[] = []
  for (let li = 0; li < CAMPAIGN_LEVELS.length; li++) {
    const def = CAMPAIGN_LEVELS[li]
    if (!def.build) continue
    const level = def.build({ cols: def.cols, rows: def.rows, pitch: 30 })
    const t = waveTelemetry(level, level.seed)
    const rows = t.waves.map((w) =>
      `  w${String(w.wave).padStart(2)} leaks=${String(w.leaks).padStart(2)} gold@start=${String(w.goldStart).padStart(4)} ` +
      `towers=${String(w.towers).padStart(2)} dur=${w.durationSec.toFixed(0).padStart(4)}s kills=${w.kills}`)
    console.log(`\n=== L${li + 1} diff=${level.meta.difficulty} ${t.won ? 'WIN' : 'LOSE'} lost=${t.livesLost}/${startLives}${t.cliff ? '  ⚠ CLIFF' : ''} ===\n` + rows.join('\n'))
    summary.push(`L${String(li + 1).padStart(2)} diff=${level.meta.difficulty} lost=${String(t.livesLost).padStart(2)}/${startLives} ${t.won ? 'WIN ' : 'LOSE'}${t.cliff ? ' ⚠CLIFF' : ''}`)
  }
  console.log('\n──── CAMPAIGN CURVE ────\n' + summary.join('\n'))
}, 600_000)
