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
        // Default globPatterns omit .json, which would leave the i18n locale files
        // (dist/locales/<lng>/translation.json) uncached and break translations offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
      },
      manifest: {
        name: 'YouNotes',
        short_name: 'YouNotes',
        start_url: '/',
        display: 'standalone',
        // The dark `--canvas` from `globals.css`, because `App.tsx` opens on
        // `defaultTheme="dark"`. A manifest is stamped at build time and cannot
        // read a token, so this is the one place the value is restated - and it
        // only has to hold until React mounts, after which `themeProvider`
        // writes the live one to `<meta name="theme-color">`. The purple it
        // replaced predated the nightshift palette and appeared nowhere in it.
        background_color: '#0d0f15',
        theme_color: '#0d0f15',
        icons: [
          { src: 'note-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'note-512.png', sizes: '512x512', type: 'image/png' },
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
