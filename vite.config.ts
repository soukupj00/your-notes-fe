import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type Rollup } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const EXCALIDRAW_FONTS_URL = '/assets/excalidraw/fonts/';
const EXCALIDRAW_FONTS_PACKAGE = 'node_modules/@excalidraw/excalidraw/dist/prod/fonts/';
const EXCALIDRAW_FONTS_DIR = path.resolve(__dirname, EXCALIDRAW_FONTS_PACKAGE);

/**
 * Excalidraw's fonts, served from this origin: without them it falls back to esm.sh (NFR2).
 * The app points `EXCALIDRAW_ASSET_PATH` at the folder above `EXCALIDRAW_FONTS_URL`.
 */
function excalidrawFonts(): Plugin {
  return {
    name: 'excalidraw-fonts',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url?.startsWith(EXCALIDRAW_FONTS_URL)) {
          request.url = `/${EXCALIDRAW_FONTS_PACKAGE}${request.url.slice(EXCALIDRAW_FONTS_URL.length)}`;
        }
        next();
      });
    },
    generateBundle() {
      const fonts = readdirSync(EXCALIDRAW_FONTS_DIR, { recursive: true, withFileTypes: true });
      for (const font of fonts.filter((entry) => entry.isFile())) {
        const file = path.join(font.parentPath, font.name);
        this.emitFile({
          type: 'asset',
          fileName: path.join(
            EXCALIDRAW_FONTS_URL.slice(1),
            path.relative(EXCALIDRAW_FONTS_DIR, file)
          ),
          source: readFileSync(file),
        });
      }
    },
  };
}

const EXCALIDRAW_MODAL_PARENT =
  /(parentSelector\s*\?\s*([\w$]+)\?\.querySelector\([\w$.]+\)\s*:\s*)document\.body/;

/**
 * Excalidraw mounts its dialogs (Help, Mermaid, Reset the canvas) on `<body>`, where the Drawing's
 * modal dialog takes away their pointer and focus, so they mount in its canvas area instead.
 * Dev and build alike, since dev serves a pre-bundled copy that Excalidraw's file name does not name.
 */
function excalidrawModalsInDialog(): Plugin {
  return {
    name: 'excalidraw-modals-in-dialog',
    transform(code, id) {
      if (!id.includes('/node_modules/') || !code.includes('"excalidraw-modal-container"')) return;
      const moved = code.replace(
        EXCALIDRAW_MODAL_PARENT,
        '$1$2?.closest("[data-excalidraw-modal-host]") ?? document.body'
      );
      if (moved === code) {
        this.error("Excalidraw's modal container moved; update EXCALIDRAW_MODAL_PARENT.");
      }
      return { code: moved, map: null };
    },
  };
}

const EXCALIDRAW_LOCALE = /\/@excalidraw\/excalidraw\/dist\/prod\/locales\/(.+)-[A-Z0-9]{8}\.js$/;
// English is bundled into Excalidraw's main code, which also reads `percentages`; Czech is the
// app's other language.
const REACHABLE_EXCALIDRAW_LOCALES = new Set(['en', 'percentages', 'cs-CZ']);

/**
 * Excalidraw fetches a language chunk only for its `langCode`, so the others stay out of the
 * precache. A chunk is judged by the modules it holds, never by its name, which the bundler picks.
 */
function excalidrawLocales() {
  const unreachable = new Set<string>();
  const isUnreachable = (moduleId: string) => {
    const locale = EXCALIDRAW_LOCALE.exec(moduleId)?.[1];
    return locale !== undefined && !REACHABLE_EXCALIDRAW_LOCALES.has(locale);
  };
  const plugin: Plugin = {
    name: 'excalidraw-locales',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (
          file.type === 'chunk' &&
          file.moduleIds.length > 0 &&
          file.moduleIds.every(isUnreachable)
        ) {
          unreachable.add(file.fileName);
        }
      }
      if (unreachable.size === 0) {
        this.error("Excalidraw's language chunks moved; update EXCALIDRAW_LOCALE.");
      }
    },
  };
  return {
    plugin,
    dropFromPrecache: <Entry extends { url: string }>(entries: Entry[]) => ({
      manifest: entries.filter((entry) => !unreachable.has(entry.url)),
    }),
  };
}

const EXCALIDRAW_LOCALES = excalidrawLocales();

const MERMAID_TO_EXCALIDRAW = '/node_modules/@excalidraw/mermaid-to-excalidraw/';

/** The chunks reachable from `from`, never following a dynamic import made by `lazy`. */
function reachableChunks(
  bundle: Rollup.OutputBundle,
  from: Rollup.OutputChunk[],
  lazy = new Set<Rollup.OutputChunk>()
) {
  const seen = new Set<Rollup.OutputChunk>();
  const visit = (name: string) => {
    const chunk = bundle[name];
    if (chunk?.type !== 'chunk' || seen.has(chunk)) return;
    seen.add(chunk);
    chunk.imports.forEach(visit);
    if (!lazy.has(chunk)) chunk.dynamicImports.forEach(visit);
  };
  for (const chunk of from) visit(chunk.fileName);
  return seen;
}

/**
 * Mermaid's diagram types, about 2.4 MiB that few users open, stay out of the precache and are
 * cached on first use (`runtimeCaching`). Its entry stays: Excalidraw imports it on a paste
 * outside its try, so offline without it the pasted text was lost.
 */
function mermaidChunks() {
  const diagrams = new Set<string>();
  const plugin: Plugin = {
    name: 'mermaid-chunks',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((file) => file.type === 'chunk');
      const mermaid = chunks.filter(
        (chunk) =>
          chunk.isDynamicEntry && chunk.moduleIds.some((id) => id.includes(MERMAID_TO_EXCALIDRAW))
      );
      if (mermaid.length === 0) {
        this.error("Excalidraw's Mermaid tool moved; update MERMAID_TO_EXCALIDRAW.");
      }
      const app = reachableChunks(
        bundle,
        chunks.filter((chunk) => chunk.isEntry),
        new Set(mermaid)
      );
      const behindMermaid = reachableChunks(bundle, mermaid);
      for (const chunk of behindMermaid) {
        if (!app.has(chunk)) diagrams.add(chunk.fileName);
      }
      if (diagrams.size === 0) {
        this.error('Nothing behind Mermaid is left to cache on first use; check `mermaidChunks`.');
      }
    },
  };
  return {
    plugin,
    dropFromPrecache: <Entry extends { url: string }>(entries: Entry[]) => ({
      manifest: entries.filter((entry) => !diagrams.has(entry.url)),
    }),
  };
}

const MERMAID_CHUNKS = mermaidChunks();

/** Why each source is allowed: docs/architecture/05-server.md, "Security posture". */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const EXCALIDRAW_CDN_FALLBACK = /\w+\.push\(new URL\(\w+,\s*\w+\.ASSETS_FALLBACK_URL\)\)[,;]/g;

/**
 * Build only: the dev server injects inline scripts, which the policy refuses. Also drops
 * Excalidraw's esm.sh font fallback, which the policy would report on every Drawing open.
 */
function contentSecurityPolicy(): Plugin {
  let fallbacksDropped = false;
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
    transform(code, id) {
      if (!id.includes('/@excalidraw/excalidraw/')) return;
      const dropped = code.replace(EXCALIDRAW_CDN_FALLBACK, '');
      if (dropped === code) return;
      fallbacksDropped = true;
      return { code: dropped, map: null };
    },
    generateBundle(_options, bundle) {
      const left = Object.values(bundle).some(
        (file) => file.type === 'chunk' && file.code.includes('.ASSETS_FALLBACK_URL)')
      );
      if (!fallbacksDropped || left) {
        this.error("Excalidraw's esm.sh font fallback moved; update the pattern.");
      }
    },
  };
}

export default defineConfig({
  plugins: [
    contentSecurityPolicy(),
    excalidrawFonts(),
    excalidrawModalsInDialog(),
    EXCALIDRAW_LOCALES.plugin,
    MERMAID_CHUNKS.plugin,
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
        manifestTransforms: [EXCALIDRAW_LOCALES.dropFromPrecache, MERMAID_CHUNKS.dropFromPrecache],
        runtimeCaching: [
          {
            // Any destination: Excalidraw also fetches its fonts to subset them into a preview.
            // A few are unhashed; one stale after an upgrade is harmless. Room for every file.
            urlPattern: ({ sameOrigin, url }) =>
              sameOrigin && url.pathname.startsWith('/assets/excalidraw/fonts/'),
            handler: 'CacheFirst',
            options: { cacheName: 'excalidraw-fonts', expiration: { maxEntries: 250 } },
          },
          {
            // Hashed file names never change content, so cache-first is exact.
            urlPattern: ({ request, sameOrigin, url }) =>
              sameOrigin && url.pathname.startsWith('/assets/') && request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 60 } },
          },
          {
            // The scripts kept out of the precache, Mermaid's about 60. Room for two versions,
            // so an upgrade never evicts a chunk the open version still needs.
            urlPattern: ({ request, sameOrigin, url }) =>
              sameOrigin && url.pathname.startsWith('/assets/') && request.destination === 'script',
            handler: 'CacheFirst',
            options: { cacheName: 'scripts', expiration: { maxEntries: 150 } },
          },
        ],
      },
      manifest: {
        name: 'YourNotes',
        short_name: 'YourNotes',
        // The app's identity, apart from its launch URL. It equals the id installs computed before
        // it was set; any other value would orphan them.
        id: '/',
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
  // In production the server serves the PWA itself, same origin (ADR 0018). Playwright sets
  // NO_API_PROXY: its specs mock the server or expect none, and `preview` inherits this proxy.
  server: {
    proxy: process.env.NO_API_PROXY
      ? undefined
      : {
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
