import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

interface BundleEntry {
  fileName: string
}

const STATIC_APP_SHELL = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/og.png',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-icon.svg',
  '/icons/maskable-icon-512.png',
  '/icons/apple-touch-icon.png',
]

function buildServiceWorker(): Plugin {
  return {
    name: 'hafa-code-service-worker',
    apply: 'build',
    generateBundle(_options, bundle: Record<string, BundleEntry>) {
      const appShell = new Set(STATIC_APP_SHELL)

      Object.values(bundle).forEach((item) => {
        if (!/\.(css|js|json|png|svg|ttf|wasm)$/i.test(item.fileName)) return
        appShell.add(`/${item.fileName}`)
      })

      const appShellPaths = Array.from(appShell).sort()
      const version = createHash('sha256').update(appShellPaths.join('\n')).digest('hex').slice(0, 12)
      const source = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8')
        .replace('__HAFA_CODE_SW_VERSION__', version)
        .replace('__HAFA_CODE_APP_SHELL__', JSON.stringify(appShellPaths, null, 2))

      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), buildServiceWorker()],
  optimizeDeps: {
    exclude: [
      '@jitl/quickjs-wasmfile-release-sync',
      '@ruby/3.3-wasm-wasi',
      '@ruby/wasm-wasi',
      'quickjs-emscripten',
    ],
  },
})
