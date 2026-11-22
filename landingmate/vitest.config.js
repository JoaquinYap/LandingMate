import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
          environment: 'node'
        }
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.js'],
          environment: 'jsdom',
          setupFiles: ['tests/helpers/setup-dom.js']
        }
      }
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: [
        // Bootstrap de 2 líneas: lo ejercitan los tests e2e
        'src/pages/*.entry.js',
        // Animaciones decorativas (parallax, contadores, marquee): se validan en e2e
        'src/ui/effects.js'
      ],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 90,
        branches: 85
      }
    }
  }
});
