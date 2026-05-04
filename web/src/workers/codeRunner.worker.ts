import { newQuickJSWASMModule, newVariant, RELEASE_SYNC, shouldInterruptAfterDeadline } from 'quickjs-emscripten'
import type { QuickJSHandle } from 'quickjs-emscripten'
import { DefaultRubyVM } from '@ruby/wasm-wasi/dist/browser'
import quickJsWasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url'
import rubyWasmUrl from '@ruby/3.3-wasm-wasi/dist/ruby+stdlib.wasm?url'
import type { ProjectFile, RunnerLanguage } from '../lib/codeRunner'

interface RunRequest {
  id: string
  code: string
  entryPath?: string
  files?: ProjectFile[]
  language: RunnerLanguage
  timeoutMs: number
}

interface RunResponse {
  id: string
  type: 'started' | 'result'
  stdout?: string
  stderr?: string
  durationMs?: number
}

const quickJsModulePromise = newQuickJSWASMModule(
  newVariant(RELEASE_SYNC, { wasmLocation: quickJsWasmUrl }),
)
let rubyModulePromise: Promise<WebAssembly.Module> | null = null

function getRubyModule() {
  rubyModulePromise ??= fetch(rubyWasmUrl)
    .then((response) => response.arrayBuffer())
    .then((buffer) => WebAssembly.compile(buffer))
  return rubyModulePromise
}

function stringifyQuickJsValue(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'undefined') return 'undefined'

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function dirname(path: string) {
  return path.includes('/') ? path.split('/').slice(0, -1).join('/') : ''
}

function normalizeModulePath(fromPath: string, specifier: string) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return specifier
  const basePath = specifier.startsWith('/') ? '' : dirname(fromPath)
  const segments = `${basePath ? `${basePath}/` : ''}${specifier.replace(/^\/+/, '')}`.split('/')
  const normalized: string[] = []
  segments.forEach((segment) => {
    if (!segment || segment === '.') return
    if (segment === '..') normalized.pop()
    else normalized.push(segment)
  })
  return normalized.join('/')
}

function resolveModulePath(fromPath: string, specifier: string, modulePaths: Set<string>) {
  const normalized = normalizeModulePath(fromPath, specifier)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return normalized
  if (modulePaths.has(normalized)) return normalized

  const candidates = [
    `${normalized}.js`,
    `${normalized}.mjs`,
    `${normalized}.cjs`,
    `${normalized}/index.js`,
  ]
  return candidates.find((candidate) => modulePaths.has(candidate)) ?? normalized
}

function transformJavaScriptModule(path: string, code: string, modulePaths: Set<string>) {
  const exportedNames = new Set<string>()
  const exportAliases: Array<{ localName: string; exportedName: string }> = []
  let hasDefaultExport = false
  let reExportIndex = 0
  let transformed = code

  transformed = transformed.replace(/import\s+([\s\S]+?)\s+from\s+['"]([^'"]+)['"];?/g, (_match, bindings: string, specifier: string) => {
    const resolved = resolveModulePath(path, specifier, modulePaths)
    const trimmed = bindings.trim()
    if (trimmed.startsWith('{')) return `const ${namedImportPattern(trimmed)} = __hafa_require__(${JSON.stringify(resolved)});`
    if (trimmed.startsWith('* as ')) return `const ${trimmed.replace('* as ', '').trim()} = __hafa_require__(${JSON.stringify(resolved)});`
    return `const ${trimmed} = __hafa_require__(${JSON.stringify(resolved)}).default;`
  })

  transformed = transformed.replace(/import\s+['"]([^'"]+)['"];?/g, (_match, specifier: string) => {
    const resolved = resolveModulePath(path, specifier, modulePaths)
    return `__hafa_require__(${JSON.stringify(resolved)});`
  })

  transformed = transformed.replace(/export\s+\*\s+from\s+['"]([^'"]+)['"];?/g, (_match, specifier: string) => {
    const resolved = resolveModulePath(path, specifier, modulePaths)
    return `Object.assign(__hafa_exports__, __hafa_require__(${JSON.stringify(resolved)}));`
  })

  transformed = transformed.replace(/export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g, (_match, names: string, specifier: string) => {
    const resolved = resolveModulePath(path, specifier, modulePaths)
    return names.split(',').map((part: string) => {
      const [importedName, exportedName] = part.split(/\s+as\s+/).map((value) => value.trim()).filter(Boolean)
      if (!importedName) return ''
      const sourceName = importedName === 'default' ? 'default' : importedName
      const targetName = exportedName || importedName
      const sourceIdentifier = `__hafa_reexport_${reExportIndex++}__`
      return `const ${sourceIdentifier} = __hafa_require__(${JSON.stringify(resolved)})[${JSON.stringify(sourceName)}];\n${exportTarget(targetName)} = ${sourceIdentifier};`
    }).filter(Boolean).join('\n')
  })

  transformed = replaceOutsideBlockComments(transformed, /(^|[;\n])(\s*)export\s+default\s+/g, (_match, prefix: string, spacing: string) => {
    hasDefaultExport = true
    return `${prefix}${spacing}const __hafa_default__ = `
  })
  if (hasDefaultExport) exportedNames.add('default')

  transformed = transformed.replace(/export\s+(function|class)\s+([A-Za-z_$][\w$]*)/g, (_match, keyword: string, name: string) => {
    exportedNames.add(name)
    return `${keyword} ${name}`
  })

  transformed = transformed.replace(/export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/g, (_match, keyword: string, name: string) => {
    exportedNames.add(name)
    return `${keyword} ${name}`
  })

  transformed = transformed.replace(/export\s+\{([^}]+)\};?/g, (_match, names: string) => {
    names.split(',').forEach((part: string) => {
      const [localName, exportedName] = part.split(/\s+as\s+/).map((value) => value.trim()).filter(Boolean)
      if (localName) exportAliases.push({ localName, exportedName: exportedName || localName })
    })
    return ''
  })

  const exportLines = Array.from(exportedNames).map((name) => {
    if (name === 'default') return `${exportTarget('default')} = __hafa_default__;`
    return `${exportTarget(name)} = ${name};`
  }).concat(exportAliases.map(({ localName, exportedName }) => {
    const localExpression = localName === 'default' ? '__hafa_default__' : localName
    return `${exportTarget(exportedName)} = ${localExpression};`
  }))

  return `${transformed}\n${exportLines.join('\n')}`
}

function exportTarget(name: string) {
  return `__hafa_exports__[${JSON.stringify(name)}]`
}

function replaceOutsideBlockComments(
  code: string,
  pattern: RegExp,
  replacer: (match: string, ...groups: string[]) => string,
) {
  const blockCommentRanges: Array<[number, number]> = []
  code.replace(/\/\*[\s\S]*?\*\//g, (match, offset: number) => {
    blockCommentRanges.push([offset, offset + match.length])
    return match
  })

  return code.replace(pattern, (match: string, ...args: Array<string | number>) => {
    const offset = args[args.length - 2] as number
    const isInsideBlockComment = blockCommentRanges.some(([start, end]) => offset >= start && offset < end)
    if (isInsideBlockComment) return match
    return replacer(match, ...(args.slice(0, -2) as string[]))
  })
}

function bundleJavaScriptProject(files: ProjectFile[], entryPath: string, fallbackCode: string) {
  const jsFiles = files.filter((file) => file.language === 'javascript')
  if (jsFiles.length <= 1 && !/\bimport\b|\bexport\b/.test(fallbackCode)) return fallbackCode

  const modulePaths = new Set(jsFiles.map((file) => file.path))
  const modules = Object.fromEntries(jsFiles.map((file) => [file.path, transformJavaScriptModule(file.path, file.content, modulePaths)]))
  const moduleObject = JSON.stringify(modules).replace(/</g, '\\u003c')

  return `
const __hafa_modules__ = ${moduleObject};
const __hafa_cache__ = {};
function __hafa_require__(path) {
  if (__hafa_cache__[path]) return __hafa_cache__[path].exports;
  const code = __hafa_modules__[path];
  if (code === undefined) throw new Error("Cannot find module " + path);
  const module = { exports: {} };
  __hafa_cache__[path] = module;
  const __hafa_exports__ = module.exports;
  const fn = new Function("__hafa_require__", "__hafa_exports__", "module", code + "\\nreturn module.exports;");
  module.exports = fn(__hafa_require__, __hafa_exports__, module);
  return module.exports;
}
__hafa_require__(${JSON.stringify(entryPath)});
`
}

function rubyStringLiteral(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value))
  return `[${bytes.join(',')}].pack('C*').force_encoding('UTF-8')`
}

function namedImportPattern(bindings: string) {
  return `{ ${bindings
    .replace(/[{}]/g, '')
    .split(',')
    .map((part) => {
      const [importedName, localName] = part.split(/\s+as\s+/).map((value) => value.trim()).filter(Boolean)
      return localName ? `${importedName}: ${localName}` : importedName
    })
    .filter(Boolean)
    .join(', ')} }`
}

async function runJavaScript(id: string, code: string, timeoutMs: number, files: ProjectFile[] = [], entryPath = 'main.js') {
  const quickjs = await quickJsModulePromise
  const runtime = quickjs.newRuntime({
    interruptHandler: shouldInterruptAfterDeadline(Date.now() + timeoutMs),
    memoryLimitBytes: 8 * 1024 * 1024,
    maxStackSizeBytes: 512 * 1024,
  })
  const vm = runtime.newContext()
  const stdout: string[] = []
  const stderr: string[] = []

  const writeConsole = (stream: 'stdout' | 'stderr', values: QuickJSHandle[]) => {
    const line = values.map((value) => stringifyQuickJsValue(vm.dump(value))).join(' ')
    ;(stream === 'stderr' ? stderr : stdout).push(`${line}\n`)
  }

  try {
    const consoleHandle = vm.newObject()
    const logHandle = vm.newFunction('log', (...args) => {
      writeConsole('stdout', args)
      return vm.undefined
    })
    const warnHandle = vm.newFunction('warn', (...args) => {
      writeConsole('stderr', args)
      return vm.undefined
    })
    const printHandle = vm.newFunction('print', (...args) => {
      writeConsole('stdout', args)
      return vm.undefined
    })

    vm.setProp(consoleHandle, 'log', logHandle)
    vm.setProp(consoleHandle, 'info', logHandle)
    vm.setProp(consoleHandle, 'warn', warnHandle)
    vm.setProp(consoleHandle, 'error', warnHandle)
    vm.setProp(vm.global, 'console', consoleHandle)
    vm.setProp(vm.global, 'print', printHandle)

    logHandle.dispose()
    warnHandle.dispose()
    printHandle.dispose()
    consoleHandle.dispose()

    self.postMessage({ id, type: 'started' } satisfies RunResponse)

    const bundledCode = bundleJavaScriptProject(files, entryPath, code)
    const result = vm.evalCode(bundledCode, entryPath)
    if (result.error) {
      stderr.push(`${stringifyQuickJsValue(vm.dump(result.error))}\n`)
      result.error.dispose()
    } else {
      result.value.dispose()
    }
  } finally {
    vm.dispose()
    runtime.dispose()
  }

  return { stdout: stdout.join(''), stderr: stderr.join('') }
}

function captureRubyOutput(args: unknown[], stream: string[]) {
  const text = args.map(String).join(' ')
  stream.push(text.endsWith('\n') ? text : `${text}\n`)
}

async function runRuby(id: string, code: string, files: ProjectFile[] = [], entryPath = 'main.rb') {
  const stdout: string[] = []
  const stderr: string[] = []
  const originalLog = console.log
  const originalWarn = console.warn

  console.log = (...args: unknown[]) => captureRubyOutput(args, stdout)
  console.warn = (...args: unknown[]) => captureRubyOutput(args, stderr)

  try {
    const module = await getRubyModule()
    const { vm } = await DefaultRubyVM(module, { consolePrint: true })
    self.postMessage({ id, type: 'started' } satisfies RunResponse)

    try {
      const rubyFiles = files.filter((file) => file.language === 'ruby')
      const fileMap = Object.fromEntries(rubyFiles.map((file) => [file.path, file.content]))
      fileMap[entryPath] = code
      const rubyHash = Object.entries(fileMap)
        .map(([path, content]) => `${rubyStringLiteral(path)} => ${rubyStringLiteral(content)}`)
        .join(', ')
      vm.eval(`
        $hafa_code_files = { ${rubyHash} }
        $hafa_code_loaded = {}

        module Kernel
          def require_relative(path)
            caller_path = caller_locations(1, 1)&.first&.path.to_s
            base = caller_path.include?("/") ? caller_path.split("/")[0...-1].join("/") : ""
            candidate = [base, path].reject(&:empty?).join("/")
            candidate = "#{candidate}.rb" unless candidate.end_with?(".rb")
            source = $hafa_code_files[candidate]
            raise LoadError, "cannot load such file -- #{path}" unless source
            return false if $hafa_code_loaded[candidate]

            $hafa_code_loaded[candidate] = true
            TOPLEVEL_BINDING.eval(source, candidate)
            true
          end
        end

        TOPLEVEL_BINDING.eval($hafa_code_files.fetch(${rubyStringLiteral(entryPath)}), ${rubyStringLiteral(entryPath)})
      `)
    } catch (error) {
      captureRubyOutput([error instanceof Error ? error.message : String(error)], stderr)
    }
  } finally {
    console.log = originalLog
    console.warn = originalWarn
  }

  return { stdout: stdout.join(''), stderr: stderr.join('') }
}

self.onmessage = (event: MessageEvent<RunRequest>) => {
  const startedAt = performance.now()
  const { id, code, entryPath, files, language, timeoutMs } = event.data
  const run = language === 'ruby'
    ? runRuby(id, code, files, entryPath)
    : runJavaScript(id, code, timeoutMs, files, entryPath)

  run
    .then(({ stdout, stderr }) => {
      self.postMessage({
        id,
        type: 'result',
        stdout,
        stderr,
        durationMs: Math.round(performance.now() - startedAt),
      } satisfies RunResponse)
    })
    .catch((error) => {
      self.postMessage({
        id,
        type: 'result',
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        durationMs: Math.round(performance.now() - startedAt),
      } satisfies RunResponse)
    })
}
