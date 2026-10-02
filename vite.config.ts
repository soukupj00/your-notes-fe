import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      // Colocated tests live in src/routes too; without this the generator
      // would register routes.test.tsx as a route.
      routeFileIgnorePattern: '\\.test\\.tsx?$',
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['note-128.png'],
      workbox: {
        // A first visit installs the worker but stays uncontrolled until a reload,
        // so a Device paired and then taken offline could not open a Note. Claiming
        // on activate is safe under `prompt`: an update still waits for a yes.
        clientsClaim: true,
        // The default patterns omit .json, which would leave the locale files uncached offline.
        // Only the two app font families are precached; KaTeX's and Excalidraw's many, rarely
        // needed fonts are cached the first time they load.
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,json}',
          '**/{bricolage-grotesque,work-sans}-*.woff2',
        ],
        runtimeCaching: [
          {
            // Hashed file names never change content, so cache-first is exact.
            urlPattern: ({ request, sameOrigin, url }) =>
              sameOrigin && url.pathname.startsWith('/assets/') && request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 60 } },
          },
        ],
      },
      manifest: {
        name: 'YouNotes',
        short_name: 'YouNotes',
        start_url: '/',
        display: 'standalone',
        // The dark `--canvas` from `globals.css`, since the app opens dark. A manifest cannot read
        // a token, so it is restated here; it only has to hold until `themeProvider` mounts and
        // writes the live `theme-color`.
        background_color: '#0d0f15',
        theme_color: '#0d0f15',
        icons: [
          { src: 'note-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'note-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  // The backend's `pnpm dev` (ni-dip-be), so the Account screens work under `pnpm dev`.
  // In production the server serves the PWA itself, same origin (ADR 0018).
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
