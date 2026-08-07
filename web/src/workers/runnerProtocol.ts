import type { ProjectFile } from '../lib/projectTypes'

export interface RunRequest {
  id: string
  type: 'run'
  code: string
  entryPath: string
  files: ProjectFile[]
  stdin?: string
  timeoutMs: number
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

export type RunnerRequest = RunRequest | StdinRequest | AbortRequest

export interface RunnerResponse {
  id: string
  type: 'started' | 'output' | 'input_request' | 'result'
  stream?: 'stdout' | 'stderr'
  text?: string
  stdout?: string
  stderr?: string
  durationMs?: number
}

export interface RunnerResult {
  stdout: string
  stderr: string
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

    const startedAt = performance.now()
    run(request)
      .then(({ stdout, stderr }) => {
        postRunnerMessage({
          id: request.id,
          type: 'result',
          stdout,
          stderr,
          durationMs: Math.round(performance.now() - startedAt),
        })
      })
      .catch((error) => {
        postRunnerMessage({
          id: request.id,
          type: 'result',
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(performance.now() - startedAt),
        })
      })
  }
}
