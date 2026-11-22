import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'coverage/', 'playwright-report/', 'test-results/', 'node_modules/']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-implicit-globals': 'error',
      'no-console': 'error'
    }
  },
  {
    files: ['tests/**/*.js', 'e2e/**/*.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
  }
];
