import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint here is for useEffect: Biome (ADR 0005) still owns formatting,
 * import sorting and general style/correctness lint. ESLint only handles the rules
 * Biome cannot express - React Hooks / React Compiler analysis and TypeScript rules.
 */
const SOURCE_FILES = ['src/**/*.{ts,tsx}'];

export default defineConfig([
  globalIgnores([
    'dist/**',
    'coverage/**',
    'playwright-report/**',
    'src/routeTree.gen.ts',
    'src/contract/**',
    '**/*.d.ts',
  ]),

  // TypeScript layer. `projectService` resolves each file to the tsconfig
  // that includes it - src/** is covered by tsconfig.app.json - which is what makes
  // rules like no-floating-promises possible.
  {
    ...tseslint.configs.base,
    files: SOURCE_FILES,
    languageOptions: {
      ...tseslint.configs.base.languageOptions,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },

  // React Hooks + React Compiler rules (eslint-plugin-react-hooks v7).
  {
    ...reactHooks.configs.flat['recommended-latest'],
    files: SOURCE_FILES,
  },
  // Hooks that pass the caller's deps array on, by contract: the rule cannot read it. Biome checks
  // the callers of `useAsyncEffect` instead (biome.json).
  {
    files: ['src/hooks/useAsyncEffect.ts', 'src/data/useLive.ts'],
    rules: { 'react-hooks/exhaustive-deps': 'off' },
  },

  // https://react.dev/learn/you-might-not-need-an-effect
  {
    ...reactYouMightNotNeedAnEffect.configs.recommended,
    files: SOURCE_FILES,
  },
]);
