import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2022' },
  server: { port: 5198 },
  // Unit test ở test/; tests/e2e/ là Playwright, vitest không quét.
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
} as any);
