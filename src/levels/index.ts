import type { Board, Level } from '../model/level'
import { buildLevel01 } from './campaign/level01'
import { buildLevel02 } from './campaign/level02'
import { buildLevel03 } from './campaign/level03'
import { buildLevel04 } from './campaign/level04'
import { buildLevel05 } from './campaign/level05'
import { buildLevel06 } from './campaign/level06'
import { buildLevel07 } from './campaign/level07'
import { buildLevel08 } from './campaign/level08'
import { buildLevel09 } from './campaign/level09'
import { buildLevel10 } from './campaign/level10'
import { buildLevel11 } from './campaign/level11'
import { buildLevel12 } from './campaign/level12'

// Authored campaign builders, index-aligned with CAMPAIGN_LEVELS.
export const AUTHORED_LEVELS: Array<(board: Board) => Level> = [
  buildLevel01, buildLevel02, buildLevel03, buildLevel04, buildLevel05, buildLevel06,
  buildLevel07, buildLevel08, buildLevel09, buildLevel10, buildLevel11, buildLevel12,
]
