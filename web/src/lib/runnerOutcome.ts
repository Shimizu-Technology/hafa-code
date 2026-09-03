export type RunnerStatus = 'idle' | 'running' | 'success' | 'error' | 'timeout' | 'stopped'

export interface RunnerOutcome {
  status: Exclude<RunnerStatus, 'idle' | 'running'>
  stdout: string
  stderr: string
  durationMs: number | null
}
