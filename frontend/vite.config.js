import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json}']
      }
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Exclude Cargo build artifacts from file watching (Windows locks compiled DLLs)
  // Use regex instead of glob — chokidar on Windows uses backslashes, globs fail to match
  server: {
    proxy: {},
    watch: {
      ignored: [/src-tauri[/\\]target/],
    },
  },
});