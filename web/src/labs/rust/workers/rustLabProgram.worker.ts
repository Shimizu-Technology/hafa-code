/// <reference lib="webworker" />
/**
 * Runs one compiled wasm32-wasip1 program with no filesystem, network, or clock beyond WASI's
 * basics. The page terminates this worker for Stop and the time limit.
 */
import { ConsoleStdout, File, OpenFile, WASI } from '@bjorn3/browser_wasi_shim'
import { OutputWriter, type OutputStream } from '../programOutput'
import type { ProgramRequest, ProgramResponse } from '../protocol'

declare const self: DedicatedWorkerGlobalScope

const post = (message: ProgramResponse) => self.postMessage(message)

class OutputLimitReached extends Error {}

self.onmessage = async (event: MessageEvent<ProgramRequest>) => {
  const { wasm, stdin, outputLimitBytes, output } = event.data
  const startedAt = performance.now()
  const log = new OutputWriter(output)
  let written = 0
  let outputLimited = false

  const writer = (stream: OutputStream) => new ConsoleStdout((bytes) => {
    const allowed = Math.max(0, outputLimitBytes - written)
    written += bytes.length
    const fits = log.write(stream, bytes.slice(0, allowed))
    if (written > outputLimitBytes || !fits) {
      outputLimited = true
      throw new OutputLimitReached()
    }
  })

  const wasi = new WASI(['main'], ['RUST_BACKTRACE=0'], [
    new OpenFile(new File(new TextEncoder().encode(stdin))),
    writer('stdout'),
    writer('stderr'),
  ])
  let exitCode: number
  let panicked = false
  try {
    const { instance } = await WebAssembly.instantiate(wasm, { wasi_snapshot_preview1: wasi.wasiImport })
    exitCode = wasi.start(instance as { exports: { memory: WebAssembly.Memory; _start: () => unknown } })
  } catch (error) {
    if (outputLimited || error instanceof OutputLimitReached) {
      exitCode = 1
    } else if (error instanceof WebAssembly.RuntimeError) {
      // Programs are built with panic=abort: a panic prints its message, then traps.
      panicked = true
      exitCode = 101
    } else {
      log.write('stderr', new TextEncoder().encode(`\n${error instanceof Error ? error.message : String(error)}`))
      exitCode = 1
    }
  }
  post({ type: 'exit', exitCode, panicked, outputLimited, durationMs: Math.round(performance.now() - startedAt) })
}
