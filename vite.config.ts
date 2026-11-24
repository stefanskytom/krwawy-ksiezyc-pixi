import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['input-switch-polyfill'],
  },
});
