import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5180 },
  preview: { port: 5181 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
} as any);
