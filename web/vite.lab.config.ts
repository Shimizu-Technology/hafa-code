import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { immutableAssetHeaders, rustLabToolchain } from './vite.config'

/**
 * The experimental Rust Lab (/labs/rust/, docs/RUST_LAB.md) builds separately into the same
 * dist/ after the main app, so the workspace's chunks, entry budget, and offline app shell are
 * exactly what they would be without the lab. It shares only the long-term caching rules.
 */
export default defineConfig({
  plugins: [react(), rustLabToolchain({ emit: true }), immutableAssetHeaders()],
  // public/ (including _headers) was already copied by the main build.
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: { rustLab: resolve(import.meta.dirname, 'labs/rust/index.html') },
    },
  },
})
