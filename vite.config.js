import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'web',
  plugins: [vue()],
  base: './',
  build: {
    outDir: fileURLToPath(new URL('./webroot', import.meta.url)),
    emptyOutDir: true,
    target: 'es2020',
  },
});
