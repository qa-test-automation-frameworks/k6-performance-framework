const { defineConfig } = require('vitest/config');
const path = require('node:path');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
  },
  resolve: {
    alias: {
      'k6/http': path.resolve(__dirname, 'tests/unit/mocks/k6-http.ts'),
      'k6/metrics': path.resolve(__dirname, 'tests/unit/mocks/k6-metrics.ts'),
      'k6/data': path.resolve(__dirname, 'tests/unit/mocks/k6-data.ts'),
      k6: path.resolve(__dirname, 'tests/unit/mocks/k6.ts'),
    },
  },
});
