import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/web/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
    globals: false,
  },
});
