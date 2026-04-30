import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: [
      '@jitl/quickjs-wasmfile-release-sync',
      '@ruby/3.3-wasm-wasi',
      '@ruby/wasm-wasi',
      'quickjs-emscripten',
    ],
  },
})
