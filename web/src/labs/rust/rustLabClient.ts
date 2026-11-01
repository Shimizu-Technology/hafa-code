import { OutputReader, createOutputBuffer } from './programOutput'
import type { ProgramRequest, ProgramResponse, ToolchainPhase, ToolchainRequest, ToolchainResponse } from './protocol'

export interface ToolchainProgress { phase: ToolchainPhase; loadedBytes: number; totalBytes: number }
export interface CompileResult { wasm: ArrayBuffer | null; diagnostics: string; durationMs: number; crashed: boolean }
export interface ProgramResult { exitCode: number; panicked: boolean; outputLimited: boolean; timedOut: boolean; stopped: boolean; durationMs: number }

export const COMPILE_TIMEOUT_MS = 90_000
export const RUN_TIMEOUT_MS = 10_000
export const OUTPUT_LIMIT_BYTES = 256 * 1024
const OUTPUT_POLL_MS = 50

/** The message for work cut short by dispose(): Stop, Cancel, or a newer load. */
export const STOPPED_MESSAGE = 'The compiler was stopped.'

export class ToolchainError extends Error {
  readonly integrity: boolean

  constructor(message: string, integrity = false) {
    super(message)
    this.name = 'ToolchainError'
    this.integrity = integrity
  }
}

/**
 * The page's handle on the toolchain worker. One instance holds the loaded compiler;
 * dispose() terminates every worker (and frees the memory) at once.
 */
export class RustToolchain {
  private worker: Worker | null = null
  private nextId = 1
  /** The load in progress, so dispose() can settle it instead of leaving its caller waiting. */
  private pendingLoad: { worker: Worker; reject: (error: Error) => void } | null = null
  private pending = new Map<number, { resolve: (result: CompileResult) => void; reject: (error: Error) => void; timer: number }>()

  load(onProgress: (progress: ToolchainProgress) => void): Promise<{ fromCache: boolean; durationMs: number }> {
    this.dispose()
    const worker = new Worker(new URL('./workers/rustLabToolchain.worker.ts', import.meta.url), { type: 'module', name: 'Rust Lab toolchain' })
    this.worker = worker
    return new Promise((resolve, reject) => {
      this.pendingLoad = { worker, reject }
      const settleLoad = () => {
        if (this.pendingLoad?.worker === worker) this.pendingLoad = null
      }
      worker.onmessage = (event: MessageEvent<ToolchainResponse>) => {
        const message = event.data
        if (message.type === 'progress') onProgress(message)
        else if (message.type === 'ready') {
          settleLoad()
          resolve({ fromCache: message.fromCache, durationMs: message.durationMs })
        } else if (message.type === 'failed') {
          const error = new ToolchainError(message.message, message.integrity)
          settleLoad()
          reject(error)
          this.rejectPending(error)
        } else if (message.type === 'compiled') {
          const pending = this.pending.get(message.id)
          if (!pending) return
          window.clearTimeout(pending.timer)
          this.pending.delete(message.id)
          pending.resolve({ wasm: message.wasm, diagnostics: message.diagnostics, durationMs: message.durationMs, crashed: message.crashed })
        }
      }
      worker.onerror = (event) => {
        const error = new ToolchainError(event.message || 'The Rust toolchain worker stopped unexpectedly.')
        settleLoad()
        reject(error)
        this.rejectPending(error)
      }
      this.send({ type: 'load' })
    })
  }

  compile(source: string): Promise<CompileResult> {
    if (!this.worker) return Promise.reject(new ToolchainError('The Rust toolchain is not loaded.'))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id)
        reject(new ToolchainError('rustc did not finish within 90 seconds, so the compiler was restarted.'))
      }, COMPILE_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      this.send({ type: 'compile', id, source })
    })
  }

  get loaded() {
    return this.worker !== null
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    const load = this.pendingLoad
    this.pendingLoad = null
    load?.reject(new ToolchainError(STOPPED_MESSAGE))
    this.rejectPending(new ToolchainError(STOPPED_MESSAGE))
  }

  private send(request: ToolchainRequest) {
    this.worker?.postMessage(request)
  }

  private rejectPending(error: Error) {
    for (const { reject, timer } of this.pending.values()) {
      window.clearTimeout(timer)
      reject(error)
    }
    this.pending.clear()
  }
}

export interface RunningProgram { done: Promise<ProgramResult>; stop: () => void }

/** Runs a compiled program in its own worker; stop() and the time limit terminate it. */
export function runProgram(
  wasm: ArrayBuffer,
  stdin: string,
  onOutput: (stream: 'stdout' | 'stderr', text: string) => void,
  timeoutMs = RUN_TIMEOUT_MS,
): RunningProgram {
  const worker = new Worker(new URL('./workers/rustLabProgram.worker.ts', import.meta.url), { type: 'module', name: 'Rust Lab program' })
  const startedAt = performance.now()
  const output = createOutputBuffer(OUTPUT_LIMIT_BYTES)
  const reader = new OutputReader(output)
  const drain = () => {
    for (const { stream, text } of reader.read()) onOutput(stream, text)
  }
  const poll = window.setInterval(drain, OUTPUT_POLL_MS)
  let settle: (result: ProgramResult) => void = () => {}
  const done = new Promise<ProgramResult>((resolve) => { settle = resolve })
  let finished = false
  const finish = (result: Omit<ProgramResult, 'durationMs'> & { durationMs?: number }) => {
    if (finished) return
    finished = true
    window.clearTimeout(timer)
    window.clearInterval(poll)
    worker.terminate()
    // Whatever the program wrote before it ended or was stopped is still in shared memory.
    drain()
    settle({ durationMs: Math.round(performance.now() - startedAt), ...result })
  }
  const timer = window.setTimeout(() => finish({ exitCode: 124, panicked: false, outputLimited: false, timedOut: true, stopped: false }), timeoutMs)
  worker.onmessage = (event: MessageEvent<ProgramResponse>) => {
    finish({ ...event.data, timedOut: false, stopped: false })
  }
  worker.onerror = (event) => {
    onOutput('stderr', event.message || 'The program worker stopped unexpectedly.')
    finish({ exitCode: 1, panicked: false, outputLimited: false, timedOut: false, stopped: false })
  }
  const request: ProgramRequest = { type: 'run', wasm, stdin, outputLimitBytes: OUTPUT_LIMIT_BYTES, output }
  worker.postMessage(request, [wasm])
  return {
    done,
    stop: () => finish({ exitCode: 130, panicked: false, outputLimited: false, timedOut: false, stopped: true }),
  }
}
