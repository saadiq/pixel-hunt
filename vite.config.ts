import { defineConfig } from 'vite';

// preview.html (the scene preview) is a dev-only page: listed as an input while
// serving, left out of the production build.
export default defineConfig(({ command }) => ({
  base: './',
  build: {
    outDir: 'dist',
    rolldownOptions: {
      input: (command === 'serve' ? { main: 'index.html', preview: 'preview.html' } : { main: 'index.html' }) as Record<string, string>,
    },
  },
}));
