import type { Plugin } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { createReadStream, readFileSync } from 'node:fs'
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

// Only these pinned core files are served; arbitrary package paths stay private.
function copyPyodideRuntime(): Plugin {
  const pyodideDirectory = dirname(createRequire(import.meta.url).resolve('pyodide'))
  const contentTypes: Record<string, string> = {
    'pyodide.asm.mjs': 'application/javascript',
    'pyodide.asm.wasm': 'application/wasm',
    'pyodide-lock.json': 'application/json',
    'python_stdlib.zip': 'application/zip',
  }
  return {
    name: 'hafa-code-pyodide-runtime',
    configureServer(server) {
      const routes = new Map(PYODIDE_RUNTIME_FILES.map((fileName) => [
        `${server.config.base}assets/pyodide/${fileName}`, fileName,
      ]))
      server.middlewares.use((request, response, next) => {
        const fileName = routes.get(request.url?.split('?')[0] ?? '')
        if (!fileName || !['GET', 'HEAD'].includes(request.method ?? '')) return next()
        const stream = createReadStream(join(pyodideDirectory, fileName))
        stream.on('error', next)
        stream.on('open', () => {
          response.setHeader('Content-Type', contentTypes[fileName])
          if (request.method === 'HEAD') {
            stream.destroy()
            response.end()
          } else {
            stream.pipe(response)
          }
        })
        response.on('close', () => stream.destroy())
      })
    },
    generateBundle() {
      for (const fileName of PYODIDE_RUNTIME_FILES) {
        this.emitFile({
          type: 'asset', fileName: `assets/pyodide/${fileName}`,
          source: readFileSync(join(pyodideDirectory, fileName)),
        })
      }
    },
  }
}

const VIRTUAL_TYPESCRIPT_LIBRARIES = 'virtual:hafa-typescript-libraries'
const RESOLVED_VIRTUAL_TYPESCRIPT_LIBRARIES = `\0${VIRTUAL_TYPESCRIPT_LIBRARIES}`

function bundleTypeScriptLibraries(): Plugin {
  return {
    name: 'hafa-code-typescript-libraries',
    resolveId(id) {
      return id === VIRTUAL_TYPESCRIPT_LIBRARIES ? RESOLVED_VIRTUAL_TYPESCRIPT_LIBRARIES : null
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_TYPESCRIPT_LIBRARIES) return null

      const libraryDirectory = dirname(createRequire(import.meta.url).resolve('typescript'))
      const libraries: Record<string, string> = {}
      const visit = (fileName: string) => {
        if (libraries[fileName]) return
        const source = readFileSync(join(libraryDirectory, fileName), 'utf8')
        libraries[fileName] = source
        for (const match of source.matchAll(/<reference\s+lib=["']([^"']+)["']/g)) {
          visit(`lib.${match[1].toLowerCase()}.d.ts`)
        }
      }

      visit('lib.es2020.d.ts')
      return `export default ${JSON.stringify(libraries)}`
    },
  }
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
        if (item.fileName.startsWith('assets/pyodide/')) return
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
  plugins: [react(), copyPyodideRuntime(), bundleTypeScriptLibraries(), buildServiceWorker()],
  worker: {
    plugins: () => [bundleTypeScriptLibraries()],
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: ['./src/test/setup.ts'],
  },
  optimizeDeps: {
    include: ['typescript'],
    exclude: [
      '@jitl/quickjs-wasmfile-release-sync',
      '@ruby/3.3-wasm-wasi',
      '@ruby/wasm-wasi',
      'pyodide',
      'quickjs-emscripten',
    ],
  },
})
