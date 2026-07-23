import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import legacy from '@vitejs/plugin-legacy';

// The kiosk runs on a repurposed used tablet or phone (spec §4), so the build
// targets an old Android WebView rather than a modern browser.
export default defineConfig({
  plugins: [
    preact(),
    legacy({
      targets: ['chrome >= 61', 'android >= 6'],
      renderLegacyChunks: true,
    }),
  ],
  build: {
    target: 'es2017',
    cssTarget: 'chrome61',
    minify: 'terser',
  },
  server: {
    port: 5173,
    proxy: {
      // the kiosk never talks to the database, only to the backend
      '/kiosk': 'http://localhost:3010',
      '/pair': 'http://localhost:3010',
    },
  },
});
