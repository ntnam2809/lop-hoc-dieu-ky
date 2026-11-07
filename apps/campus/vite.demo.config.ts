import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Bản chơi thử offline (đi dạo sân trường + lớp học), build tĩnh để đăng artifact/Pages.
// Tách khỏi vite.config.ts để không đổi bản build campus chính.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist-demo',
    emptyOutDir: true,
    rollupOptions: { input: { demo: resolve(import.meta.dirname, 'demo.html') } },
  },
});
