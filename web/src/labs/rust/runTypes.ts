import type { ParsedDiagnostics } from './diagnostics'
import type { RustCoaching } from './errorCoach'
import type { ProgramResult, ToolchainProgress } from './rustLabClient'

export type ToolchainStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; progress: ToolchainProgress | null }
  | { kind: 'ready'; fromCache: boolean; durationMs: number }
  | { kind: 'failed'; message: string }

export type RunPhase = 'idle' | 'needs-consent' | 'loading' | 'compiling' | 'running'

export type OutputLine = { stream: 'stdout' | 'stderr' | 'system'; text: string }

export interface RunReport {
  kind: 'compile-error' | 'compiler-crashed' | 'finished' | 'stopped'
  diagnostics: ParsedDiagnostics | null
  coaching: RustCoaching | null
  program: ProgramResult | null
  compileMs: number | null
  challenge: { id: string; passed: boolean } | null
}
