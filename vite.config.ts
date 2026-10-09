import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  // Relative asset paths so the build also works from file:// inside a Capacitor WebView.
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      // The mobile build (scripts/build-mobile.mjs) inlines everything into one HTML file, so no chunks.
      output:
        mode === 'mobile'
          ? { codeSplitting: false }
          : { manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined) },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
