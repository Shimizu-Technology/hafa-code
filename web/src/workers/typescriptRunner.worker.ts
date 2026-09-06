import { newQuickJSWASMModule, newVariant, RELEASE_SYNC, shouldInterruptAfterDeadline } from 'quickjs-emscripten'
import type { QuickJSHandle } from 'quickjs-emscripten'
import quickJsWasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url'
import typeScriptLibraries from 'virtual:hafa-typescript-libraries'
import { installRunner, postRunnerMessage, type RunRequest } from './runnerProtocol'
import { bundleCommonJsModules } from './commonJsBundle'
import { compileTypeScriptProject } from './typescriptCompiler'

const quickJsModulePromise = newQuickJSWASMModule(newVariant(RELEASE_SYNC, { wasmLocation: quickJsWasmUrl }))
const MAX_OUTPUT_BYTES = 256 * 1024

function stringifyQuickJsValue(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'undefined') return 'undefined'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

async function runTypeScript({ id, files, entryPath, timeoutMs }: RunRequest) {
  postRunnerMessage({ id, type: 'started' })
  const compiled = compileTypeScriptProject(files, entryPath, typeScriptLibraries)
  if (compiled.diagnostics.length || !compiled.entryModule) {
    return { stdout: '', stderr: `${compiled.diagnostics.join('\n')}\n`, exitCode: 1 }
  }

  const quickjs = await quickJsModulePromise
  const runtime = quickjs.newRuntime({
    interruptHandler: shouldInterruptAfterDeadline(Date.now() + timeoutMs),
    memoryLimitBytes: 8 * 1024 * 1024,
    maxStackSizeBytes: 512 * 1024,
  })
  const vm = runtime.newContext()
  const output = { stdout: '', stderr: '' }
  let outputBytes = 0
  let outputTruncated = false

  const writeConsole = (stream: 'stdout' | 'stderr', values: QuickJSHandle[]) => {
    if (outputTruncated) return
    const text = `${values.map((value) => stringifyQuickJsValue(vm.dump(value))).join(' ')}\n`
    const nextBytes = new TextEncoder().encode(text).byteLength
    if (outputBytes + nextBytes > MAX_OUTPUT_BYTES) {
      const notice = '[Output stopped after 256 KB.]\n'
      output.stderr += notice
      postRunnerMessage({ id, type: 'output', stream: 'stderr', text: notice })
      outputTruncated = true
      return
    }
    outputBytes += nextBytes
    output[stream] += text
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

    const result = vm.evalCode(bundleCommonJsModules(compiled.modules, compiled.entryModule), entryPath)
    if (result.error) {
      const text = `${stringifyQuickJsValue(vm.dump(result.error))}\n`
      output.stderr += text
      postRunnerMessage({ id, type: 'output', stream: 'stderr', text })
      result.error.dispose()
    } else {
      result.value.dispose()
    }
  } finally {
    vm.dispose()
    runtime.dispose()
  }

  return { ...output, exitCode: output.stderr ? 1 : 0 }
}

installRunner(runTypeScript)
