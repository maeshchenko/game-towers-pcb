// Flat ESLint config. Deliberately lean: TypeScript-strict already covers types, so ESLint here
// is a bug net (not a style police) — it flags the mistakes tsc doesn't: unreachable branches,
// accidental fall-through, loose equality, floating promises-as-statements, dead conditions.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**', 'node_modules/**', 'coverage/**',
      'kit/**', 'kit2/**', 'editor/**', // internal galleries / dev tool — not shipped
      'src/kit.ts', 'src/kit2.ts', // gallery entry points for the above
      'scripts/**', // balance-tuning harnesses, run manually
      '**/*.config.*', '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: { window: 'readonly', document: 'readonly', navigator: 'readonly', performance: 'readonly', localStorage: 'readonly', requestAnimationFrame: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly' } },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      // ignoreReadBeforeAssign exempts the `let ui!: GameUI; …; ui = new GameUI()` forward-decl
      // pattern (the var is captured by closures defined before its single assignment).
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
      'no-fallthrough': 'error',
      // Intentional swallow: `catch (e) {}` around best-effort audio-node .stop() calls.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
      // TS's own noUnusedLocals handles real dead code; allow _-prefixed intentional unused.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // The codebase leans on `any` at a few framework boundaries (pixi internals, test fakes)
      // where a precise type buys nothing — keep it a warning, not a hard failure.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off', // used intentionally after guards
    },
  },
)
