/// <reference lib="webworker" />
/**
 * Runs one compiled wasm32-wasip1 program with no filesystem, network, or clock beyond WASI's
 * basics. The page terminates this worker for Stop and the time limit.
 */
import { ConsoleStdout, File, OpenFile, WASI } from '@bjorn3/browser_wasi_shim'
import type { ProgramRequest, ProgramResponse } from '../protocol'

declare const self: DedicatedWorkerGlobalScope

const post = (message: ProgramResponse) => self.postMessage(message)
const FLUSH_INTERVAL_MS = 50

class OutputLimitReached extends Error {}

self.onmessage = async (event: MessageEvent<ProgramRequest>) => {
  const { wasm, stdin, outputLimitBytes } = event.data
  const startedAt = performance.now()
  const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() }
  const buffered = { stdout: '', stderr: '' }
  let written = 0
  let lastFlush = performance.now()
  let outputLimited = false

  const flush = () => {
    for (const stream of ['stdout', 'stderr'] as const) {
      if (buffered[stream]) post({ type: 'output', stream, text: buffered[stream] })
      buffered[stream] = ''
    }
    lastFlush = performance.now()
  }
  const writer = (stream: 'stdout' | 'stderr') => new ConsoleStdout((bytes) => {
    const allowed = Math.max(0, outputLimitBytes - written)
    written += bytes.length
    buffered[stream] += decoders[stream].decode(bytes.subarray(0, allowed), { stream: true })
    if (written > outputLimitBytes) {
      outputLimited = true
      throw new OutputLimitReached()
    }
    if (performance.now() - lastFlush > FLUSH_INTERVAL_MS) flush()
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
      buffered.stderr += `\n${error instanceof Error ? error.message : String(error)}`
      exitCode = 1
    }
  }
  flush()
  post({ type: 'exit', exitCode, panicked, outputLimited, durationMs: Math.round(performance.now() - startedAt) })
}
