import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Split the eagerly-loaded vendor code into stable, separately-cacheable chunks.
 *
 * Only packages that are ALREADY part of the eager graph are listed here — adding a
 * lazily-imported package (recharts, html2canvas, ...) would drag its whole chunk into
 * the initial load. Anything not matched keeps Rollup's default chunking.
 */
const VENDOR_CHUNKS = [
  ['vendor-react', ['/react/', '/react-dom/', '/scheduler/']],
  ['vendor-router', ['/react-router/', '/react-router-dom/', '/@remix-run/']],
  ['vendor-motion', ['/framer-motion/']],
  ['vendor-radix', ['/@radix-ui/']],
  ['vendor-query', ['/@tanstack/']],
  ['vendor-i18n', ['/i18next/', '/react-i18next/', '/i18next-browser-languagedetector/']],
  ['vendor-capacitor', ['/@capacitor/', '/@capgo/']],
]

function manualChunks(id) {
  // chokidar/rollup hand us native separators on Windows — normalise before matching
  const file = id.split(path.win32.sep).join('/')
  if (!file.includes('/node_modules/')) return
  const pkgPath = file.slice(file.lastIndexOf('/node_modules/') + '/node_modules'.length)
  for (const [chunk, prefixes] of VENDOR_CHUNKS) {
    if (prefixes.some((p) => pkgPath.startsWith(p))) return chunk
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectRegister: null,
      manifest: false,
      injectManifest: {
        // Precache the app shell only. Images/fonts/audio are picked up lazily by the
        // stale-while-revalidate handler in public/sw.js, so precaching the entire
        // public/ tree (~28 MB) only burned mobile data on first install.
        globPatterns: [
          'assets/**/*.{js,css}',
          'manifest.json',
          'android/launchericon-{48x48,72x72,96x96,144x144,192x192,512x512}.png',
        ],
        globIgnores: ['index.html'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MB
      }
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks },
    },
  },
  // Exclude Cargo build artifacts from file watching (Windows locks compiled DLLs)
  server: {
    proxy: {},
    watch: {
      // Predicate instead of a glob: chokidar hands us native separators on Windows,
      // where glob patterns silently fail to match.
      ignored: (p) => p.includes('src-tauri') && p.includes('target'),
    },
  },
});
