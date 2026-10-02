import path from 'node:path';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Standalone, so the PWA plugin in vite.config.ts stays out of tests.
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
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Excalidraw's roughjs uses extensionless subpath imports (`roughjs/bin/rough`) that Node's
    // resolver rejects; inlining sends them through Vite's resolver, as the app's build does.
    server: {
      deps: {
        inline: ['@excalidraw/excalidraw', 'roughjs'],
      },
    },
  },
});
