import { defineConfig } from 'vite';

// BUILD_ID is the commit SHA in CI; it versions the service worker cache.
const BUILD_ID = (process.env.BUILD_ID || 'dev').slice(0, 7);

export default defineConfig({
  base: './',   // served from /wallet-tracker/ on GitHub Pages
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' },
});
