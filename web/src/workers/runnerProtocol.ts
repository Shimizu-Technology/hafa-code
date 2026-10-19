import type { ProjectFile } from '../lib/projectTypes'

export class RunnerValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RunnerValidationError'
  }
}

export interface RunRequest {
  id: string
  type: 'run'
  code: string
  entryPath: string
  files: ProjectFile[]
  stdin?: string
  timeoutMs: number
  startupTimeoutMs: number
}

export interface StdinRequest {
  id: string
  type: 'stdin'
  value: string
}

export interface AbortRequest {
  id: string
  type: 'abort'
}

export interface WarmupRequest {
  id: string
  type: 'warmup'
}

export type RunnerRequest = RunRequest | StdinRequest | AbortRequest | WarmupRequest

export interface RunnerResponse {
  id: string
  type: 'started' | 'output' | 'output_limit' | 'input_request' | 'result' | 'warm'
  stream?: 'stdout' | 'stderr'
  text?: string
  stdout?: string
  stderr?: string
  durationMs?: number
  exitCode?: number
  errorKind?: 'validation'
  /** Unfiltered traceback when the visible error hides runtime-internal frames. */
  fullTraceback?: string
}

export interface RunnerResult {
  stdout: string
  stderr: string
  exitCode: number
  errorKind?: 'validation'
  fullTraceback?: string
}

export type RunHandler = (request: RunRequest) => Promise<RunnerResult>

export function postRunnerMessage(message: RunnerResponse) {
  self.postMessage(message)
}

export function installRunner(
  run: RunHandler,
  controls: {
    onStdin?: (request: StdinRequest) => void
    onAbort?: (request: AbortRequest) => void
    onWarmup?: (request: WarmupRequest) => Promise<void>
  } = {},
) {
  self.onmessage = (event: MessageEvent<RunnerRequest>) => {
    const request = event.data
    if (request.type === 'stdin') {
      controls.onStdin?.(request)
      return
    }

    if (request.type === 'abort') {
      controls.onAbort?.(request)
      return
    }

    if (request.type === 'warmup') {
      // Warmup is best effort; a failed download is retried by the next real run.
      ;(controls.onWarmup ? controls.onWarmup(request) : Promise.resolve())
        .then(() => postRunnerMessage({ id: request.id, type: 'warm' }))
        .catch(() => {})
      return
    }

    const startedAt = performance.now()
    run(request)
      .then(({ stdout, stderr, exitCode, errorKind, fullTraceback }) => {
        postRunnerMessage({
          id: request.id,
          type: 'result',
          stdout,
          stderr,
          exitCode,
          ...(errorKind ? { errorKind } : {}),
          ...(fullTraceback ? { fullTraceback } : {}),
          durationMs: Math.round(performance.now() - startedAt),
        })
      })
      .catch((error) => {
        postRunnerMessage({
          id: request.id,
          type: 'result',
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
          exitCode: 1,
          ...(error instanceof RunnerValidationError ? { errorKind: 'validation' as const } : {}),
          durationMs: Math.round(performance.now() - startedAt),
        })
      })
  }
}
