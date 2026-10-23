import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { DESCRIPTION, OG_ALT, SITE_URL, TAGLINE, THEME, escapeXml } from './scripts/site';

const SITE_META: Record<string, string> = { SITE_URL, DESCRIPTION, THEME, OG_ALT };

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
    {
      name: 'site-meta',
      transformIndexHtml: (html) => html.replace(/%(SITE_URL|DESCRIPTION|THEME|OG_ALT)%/g, (_, k: string) => escapeXml(SITE_META[k])),
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        id: 'pixel-hunt',
        name: 'Pixel Hunt',
        short_name: 'Pixel Hunt',
        description: TAGLINE,
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        background_color: '#e7ecef',
        theme_color: THEME,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['og-image.png'], // link-preview card, never shown in the app
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
