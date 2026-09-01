import { newQuickJSWASMModule, newVariant, RELEASE_SYNC, shouldInterruptAfterDeadline } from 'quickjs-emscripten'
import type { QuickJSHandle } from 'quickjs-emscripten'
import quickJsWasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url'
import type { ProjectFile } from '../lib/projectTypes'
import { installRunner, postRunnerMessage, type RunRequest } from './runnerProtocol'

const quickJsModulePromise = newQuickJSWASMModule(
  newVariant(RELEASE_SYNC, { wasmLocation: quickJsWasmUrl }),
)

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

async function runJavaScript({ id, code, timeoutMs, files, entryPath }: RunRequest) {
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
    const text = `${line}\n`
    ;(stream === 'stderr' ? stderr : stdout).push(text)
    postRunnerMessage({ id, type: 'output', stream, text })
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

    postRunnerMessage({ id, type: 'started' })

    const result = vm.evalCode(bundleJavaScriptProject(files, entryPath, code), entryPath)
    if (result.error) {
      const text = `${stringifyQuickJsValue(vm.dump(result.error))}\n`
      stderr.push(text)
      postRunnerMessage({ id, type: 'output', stream: 'stderr', text })
      result.error.dispose()
    } else {
      result.value.dispose()
    }
  } finally {
    vm.dispose()
    runtime.dispose()
  }

  return { stdout: stdout.join(''), stderr: stderr.join(''), exitCode: stderr.length ? 1 : 0 }
}

installRunner(runJavaScript)
