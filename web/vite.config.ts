import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

interface BundleEntry {
  fileName: string
  type: 'asset' | 'chunk'
  isEntry?: boolean
  imports?: string[]
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

const PYODIDE_RUNTIME_FILES = [
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'pyodide-lock.json',
  'python_stdlib.zip',
]

function copyPyodideRuntime() {
  const pyodideDirectory = dirname(createRequire(import.meta.url).resolve('pyodide'))
  return viteStaticCopy({
    targets: PYODIDE_RUNTIME_FILES.map((fileName) => ({
      src: join(pyodideDirectory, fileName).replace(/\\/g, '/'),
      dest: 'assets/pyodide',
      rename: { stripBase: true },
    })),
  })
}

function buildServiceWorker(): Plugin {
  return {
    name: 'hafa-code-service-worker',
    apply: 'build',
    generateBundle(_options, bundle: Record<string, BundleEntry>) {
      const appShell = new Set(STATIC_APP_SHELL)
      const entryImports = new Set<string>()
      const visitEntryImports = (fileName: string) => {
        if (entryImports.has(fileName)) return
        entryImports.add(fileName)
        const item = bundle[fileName]
        item?.imports?.forEach(visitEntryImports)
      }

      Object.values(bundle).forEach((item) => {
        if (item.type === 'chunk' && item.isEntry) visitEntryImports(item.fileName)
      })

      Object.values(bundle).forEach((item) => {
        const isLightweightAsset = /\.(css|json|png|svg|ttf)$/i.test(item.fileName)
        if (!isLightweightAsset && !entryImports.has(item.fileName)) return
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
  plugins: [react(), copyPyodideRuntime(), buildServiceWorker()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  optimizeDeps: {
    exclude: [
      '@jitl/quickjs-wasmfile-release-sync',
      '@ruby/3.3-wasm-wasi',
      '@ruby/wasm-wasi',
      'pyodide',
      'quickjs-emscripten',
    ],
  },
})
