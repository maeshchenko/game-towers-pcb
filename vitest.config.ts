import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Gate only the framework-free simulation core — that's the deterministic, TDD-covered
      // logic where a regression is a real bug. Render/UI/audio are exercised by browser smoke,
      // not unit coverage, so measuring them here would just produce a meaningless low number.
      include: ['src/game/**/*.ts'],
      exclude: ['src/game/**/*.d.ts'],
      reporter: ['text-summary', 'html'],
      // Set just under the current 94.7% / 91.7% so an accidental drop (untested new branch,
      // deleted test) fails CI, without being so tight that a trivial refactor trips it.
      thresholds: { statements: 88, branches: 85, functions: 90, lines: 88 },
    },
  },
})
