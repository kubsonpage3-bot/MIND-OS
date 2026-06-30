import react from '@vitejs/plugin-react'
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