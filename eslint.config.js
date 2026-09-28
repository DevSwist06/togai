import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
    rules: {
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: ['src/client/**/*.js', 'tests/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.browser, GPUBufferUsage: 'readonly' } },
  },
  {
    files: ['src/physics/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      globals: { ...globals.es2025, i32: 'readonly', f64: 'readonly', usize: 'readonly' },
    },
    rules: {
      ...js.configs.recommended.rules,
      'prefer-const': 'error',
      eqeqeq: 'error',
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },
];
