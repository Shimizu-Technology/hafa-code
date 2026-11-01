import type { RustDiagnostic } from './diagnostics'
import type { RunPhase, RunReport, ToolchainStatus } from './runTypes'

export type RunTone = 'neutral' | 'running' | 'success' | 'danger'

/** The short status beside "Output", like the workspace runner's status chip. */
export function runStatus(phase: RunPhase, report: RunReport | null, toolchain: ToolchainStatus): { label: string; tone: RunTone } {
  if (phase === 'loading') return { label: toolchain.kind === 'loading' && toolchain.progress?.phase === 'downloading' ? 'Downloading compiler' : 'Starting compiler', tone: 'running' }
  if (phase === 'compiling') return { label: 'Compiling', tone: 'running' }
  if (phase === 'running') return { label: 'Running', tone: 'running' }
  if (!report) return { label: 'Ready', tone: 'neutral' }
  if (report.kind === 'compile-error') return { label: 'Did not compile', tone: 'danger' }
  if (report.kind === 'compiler-crashed') return { label: 'Compiler crashed', tone: 'danger' }
  if (report.kind === 'stopped') return { label: 'Stopped', tone: 'neutral' }
  const program = report.program!
  if (program.timedOut) return { label: 'Stopped at the time limit', tone: 'danger' }
  if (program.outputLimited) return { label: 'Output limit reached', tone: 'danger' }
  if (program.panicked) return { label: 'Panicked', tone: 'danger' }
  if (program.exitCode !== 0) return { label: `Exited with code ${program.exitCode}`, tone: 'danger' }
  return { label: 'Finished', tone: 'success' }
}

/** One line under the output with timings and counts, or what the run limits are. */
export function runSummary(report: RunReport | null): string {
  if (!report) return '10 s run limit · 256 KB of output'
  const compile = report.compileMs !== null ? `compiled in ${(report.compileMs / 1000).toFixed(1)} s` : null
  if (report.kind === 'compile-error') {
    const count = report.diagnostics?.errorCount ?? 0
    return `${count} ${count === 1 ? 'error' : 'errors'}${compile ? ` · ${compile}` : ''}`
  }
  if (report.kind === 'compiler-crashed') return 'A limit of the experimental compiler, not your code. Run again to restart it.'
  if (report.kind === 'stopped' || !report.program) return 'Stopped before it finished'
  const warnings = report.diagnostics?.warningCount ?? 0
  return [
    compile,
    `ran in ${(report.program.durationMs / 1000).toFixed(2)} s`,
    warnings ? `${warnings} ${warnings === 1 ? 'warning' : 'warnings'}` : null,
  ].filter(Boolean).join(' · ')
}

export function runHeadline(report: RunReport | null, errors: RustDiagnostic[]): string | null {
  if (!report) return null
  if (report.kind === 'compile-error') {
    const first = errors[0]
    return first ? `error${first.code ? `[${first.code}]` : ''}: ${first.message}` : 'rustc could not compile main.rs'
  }
  if (report.kind === 'compiler-crashed') return 'The compiler crashed'
  const program = report.program
  if (!program || report.kind === 'stopped') return null
  if (program.timedOut) return 'Stopped after 10 seconds. Look for a loop that never ends.'
  if (program.outputLimited) return 'Stopped: the program printed more than 256 KB.'
  if (program.panicked) return 'The program panicked'
  return null
}
