export type RunnerStatus = 'idle' | 'running' | 'success' | 'error' | 'timeout' | 'stopped'

export interface RunnerOutcome {
  status: Exclude<RunnerStatus, 'idle' | 'running'>
  stdout: string
  stderr: string
  durationMs: number | null
  failurePhase?: 'startup' | 'execution' | 'validation'
  /** The program printed more than the browser runner keeps and was stopped. */
  outputLimited?: boolean
}
