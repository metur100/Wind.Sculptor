import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build also works from file:// inside a Capacitor WebView.
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined) },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
