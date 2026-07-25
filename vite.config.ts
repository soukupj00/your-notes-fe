import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: false,
      // Colocated tests live in src/routes too; without this the generator
      // would register routes.test.tsx as a route.
      routeFileIgnorePattern: '\\.test\\.tsx?$',
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      workbox: {
        // Default globPatterns omit .json, which would leave the i18n locale files
        // (dist/locales/<lng>/translation.json) uncached and break translations offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        // @excalidraw/excalidraw (M3 Slice 5) pushed the main chunk past workbox's
        // default 2 MiB precache limit. Dynamic-importing the canvas is an accepted
        // follow-up (see the Excalidraw design spec), not required for this slice -
        // raise the cap instead so the app still precaches for offline use.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'My PWA App',
        short_name: 'PWAApp',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
