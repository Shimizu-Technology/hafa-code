import { newQuickJSWASMModule, newVariant, RELEASE_SYNC, shouldInterruptAfterDeadline } from 'quickjs-emscripten'
import type { QuickJSHandle } from 'quickjs-emscripten'
import { DefaultRubyVM } from '@ruby/wasm-wasi/dist/browser'
import quickJsWasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url'
import rubyWasmUrl from '@ruby/3.3-wasm-wasi/dist/ruby+stdlib.wasm?url'
import type { RunnerLanguage } from '../lib/codeRunner'

interface RunRequest {
  id: string
  code: string
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

async function runJavaScript(id: string, code: string, timeoutMs: number) {
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

    const result = vm.evalCode(code, 'main.js')
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

async function runRuby(id: string, code: string) {
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
      vm.eval(code)
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
  const { id, code, language, timeoutMs } = event.data
  const run = language === 'ruby' ? runRuby(id, code) : runJavaScript(id, code, timeoutMs)

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
