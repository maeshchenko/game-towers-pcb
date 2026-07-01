import { defineConfig } from 'vitest/config'
// Runner for one-off optimizer/report scripts in scripts/ (not part of the test suite).
//   npx vitest run --config vitest.scripts.config.ts
export default defineConfig({ test: { environment: 'node', include: ['scripts/**/*.ts'] } })
