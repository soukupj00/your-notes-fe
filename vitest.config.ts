import path from 'node:path';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Standalone Vitest config (does not load the PWA plugin from vite.config.ts).
// Keeps the `@/` alias so tests import the same modules the app does.
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
    // @excalidraw/excalidraw's dependency roughjs uses extensionless subpath
    // imports (`roughjs/bin/rough`) that fail under Vitest's default Node-native
    // module resolution for externalized deps. Inlining routes them through
    // Vite's own (esbuild-based) resolver instead, which resolves them fine -
    // the same resolution the app's real Vite build/dev server already uses.
    server: {
      deps: {
        inline: ['@excalidraw/excalidraw', 'roughjs'],
      },
    },
  },
});
