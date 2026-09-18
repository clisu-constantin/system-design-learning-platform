import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat['recommended-latest']],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // Labs and diagrams deliberately keep simulation state in a ref, mutate it
      // from the rAF ticker, read it (and the clock) during render, and repaint
      // through useRerender - see "Simulation state pattern" in CLAUDE.md. These
      // React Compiler rules forbid exactly that pattern. The app does not use
      // the compiler, so they would only push 280 suppressions into the labs.
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      // A compiler diagnostic ("compilation skipped"), meaningless without it.
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}', 'vite.config.ts', 'eslint.config.js'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
);
