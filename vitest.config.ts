import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/render/report-client.ts'],
      thresholds: {
        statements: 93,
        branches: 86,
        functions: 95,
        lines: 95,
      },
    },
  },
});
