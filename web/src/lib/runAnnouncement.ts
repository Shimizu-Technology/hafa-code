import type { RunnerStatus } from './runnerOutcome'

export type RunAnnouncementInput = {
  status: RunnerStatus
  phase: 'idle' | 'loading' | 'executing' | 'input'
  awaitingInput: boolean
  /** "Fixed. It runs now." after an error. */
  fixed: boolean
  durationMs: number | null
  stdout: string
  /** The error headline shown above the output, if any. */
  headline: string | null
  /** Where the error is, such as "receipt.py · line 2". */
  location?: string | null
  /** The visible status for timeouts and stopped runs. */
  statusLabel: string
  runLabel: string
  entryPath: string
  firstLoad: boolean
}

function sentence(text: string) {
  const trimmed = text.trim()
  return /[.?!…]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function lineCount(text: string) {
  const trimmed = text.replace(/\n+$/, '')
  return trimmed ? trimmed.split('\n').length : 0
}

/**
 * One short, polite screen-reader message per run step: the status and, for an error,
 * its headline. Never the program's output itself, and never the ticking timer.
 */
export function runAnnouncement(input: RunAnnouncementInput): string {
  if (input.awaitingInput) return 'Your program is waiting for input. Type it in the Program input box, then press Enter.'

  switch (input.status) {
    case 'idle':
      return ''
    case 'running':
      return input.phase === 'loading'
        ? `Loading ${input.runLabel}${input.firstLoad ? ', first time only' : ''}.`
        : `Running ${input.entryPath}.`
    case 'success': {
      const lines = lineCount(input.stdout)
      const timing = input.durationMs === null ? '' : ` in ${input.durationMs} ms`
      const output = lines === 0 ? 'No output.' : `${lines} ${lines === 1 ? 'line' : 'lines'} of output.`
      return `${input.fixed ? 'Fixed. It runs now. ' : ''}Ran${timing}. ${output}`
    }
    case 'error':
      return input.headline
        ? [sentence(`Error: ${input.headline}`), input.location ? sentence(input.location) : ''].filter(Boolean).join(' ')
        : `${sentence(input.statusLabel)} Details are in the program output.`
    default:
      return sentence(input.statusLabel)
  }
}
