import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const bg = { background: '#2c56cc' };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: bg },
    apple: { ...minimal2023Preset.apple, resizeOptions: bg },
  },
  images: ['public/icon.svg'],
});
