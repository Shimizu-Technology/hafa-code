// wasm_exec.js comes from the same pinned Go toolchain as the module and
// defines globalThis.Go. Both are produced by scripts/build-go-runtime.mjs.
import '../../runtimes/go/dist/wasm_exec.js'
import goRunnerWasmUrl from '../../runtimes/go/dist/hafago.wasm?url'
import { formatGoDiagnostics, GO_DEADLOCK_MESSAGE, runGoModule, validateGoProject, type GoProcessConstructor } from './goRunnerCore'
import { createRunOutput } from './runOutput'
import { installRunner, postRunnerMessage, type RunRequest } from './runnerProtocol'
import { createStdinBridge } from './stdinBridge'

const inputBridges = new Map<string, ReturnType<typeof createStdinBridge>>()
let modulePromise: Promise<WebAssembly.Module> | null = null

function loadGoModule() {
  modulePromise ??= WebAssembly.compileStreaming(fetch(goRunnerWasmUrl)).catch((error) => {
    modulePromise = null
    throw error
  })
  return modulePromise
}

async function runGo(request: RunRequest) {
  const { id } = request
  const files = validateGoProject(request)
  const module = await loadGoModule()
  const output = createRunOutput(id, postRunnerMessage)
  const inputBridge = createStdinBridge(() => {
    output.flush()
    postRunnerMessage({ id, type: 'input_request' })
  })
  inputBridges.set(id, inputBridge)

  try {
    const outcome = await runGoModule({
      module,
      Go: (globalThis as unknown as { Go: GoProcessConstructor }).Go,
      globals: globalThis as Parameters<typeof runGoModule>[0]['globals'],
      files,
      write: (stream, text) => { output.write(stream, text) },
      readLine: () => inputBridge.read(),
      onStarted: () => postRunnerMessage({ id, type: 'started' }),
    })

    if (outcome.kind === 'diagnostics') {
      return { stdout: '', stderr: formatGoDiagnostics(outcome.diagnostics), exitCode: 1, errorKind: 'validation' as const }
    }
    // `go run` reports a failing program's status after its own output.
    const exitCode = outcome.kind === 'deadlock' ? 2 : outcome.exitCode
    if (outcome.kind === 'deadlock') output.write('stderr', `${GO_DEADLOCK_MESSAGE}\n`)
    if (exitCode !== 0) output.write('stderr', `exit status ${exitCode}\n`)
    return { stdout: output.stdout(), stderr: output.stderr(), exitCode }
  } finally {
    output.flush()
    inputBridge.abort()
    inputBridges.delete(id)
  }
}

installRunner(runGo, {
  onStdin: ({ id, value }) => inputBridges.get(id)?.write(value),
  onAbort: ({ id }) => inputBridges.get(id)?.abort(),
  onWarmup: async () => { await loadGoModule() },
})
