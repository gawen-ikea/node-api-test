import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['test/unittest/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
