import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        id: 'crumb-hunt',
        name: 'Crumb Hunt',
        short_name: 'Crumb Hunt',
        description: 'A pixel-art ant puzzle. Send the right squads to eat every crumb.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        background_color: '#e7ecef',
        theme_color: '#2c56cc',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
}));
