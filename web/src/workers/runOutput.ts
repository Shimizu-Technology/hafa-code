import type { RunnerResponse } from './runnerProtocol'

/** Generous for real lessons, small enough that a runaway loop cannot freeze or crash the tab. */
export const OUTPUT_LIMIT_CHARS = 1_000_000
export const OUTPUT_LIMIT_LINES = 10_000
export const OUTPUT_LIMIT_MESSAGE = 'Output limit reached — check your loop. Hafa Code stopped this program because it printed more than 10,000 lines or 1 MB of output.'

const FLUSH_INTERVAL_MS = 50
const FLUSH_SIZE_CHARS = 16_384

type Stream = 'stdout' | 'stderr'

interface RunOutputOptions {
  maxChars?: number
  maxLines?: number
  now?: () => number
  schedule?: (callback: () => void, delayMs: number) => unknown
}

function countNewlines(text: string) {
  let count = 0
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) count += 1
  return count
}

function sliceToLineLimit(text: string, allowedLines: number) {
  let index = -1
  for (let line = 0; line < allowedLines; line += 1) {
    index = text.indexOf('\n', index + 1)
    if (index === -1) return text
  }
  return text.slice(0, index + 1)
}

/**
 * Collects a run's output in the worker, sends it to the page in batches, and
 * stops accepting output once the cap is reached so the page stays responsive.
 */
export function createRunOutput(
  id: string,
  post: (message: RunnerResponse) => void,
  { maxChars = OUTPUT_LIMIT_CHARS, maxLines = OUTPUT_LIMIT_LINES, now = () => performance.now(), schedule = (callback, delayMs) => setTimeout(callback, delayMs) }: RunOutputOptions = {},
) {
  const captured: Record<Stream, string[]> = { stdout: [], stderr: [] }
  let pending: { stream: Stream; text: string }[] = []
  let pendingChars = 0
  let totalChars = 0
  let totalLines = 0
  let lastFlushAt = now()
  let flushScheduled = false
  let limited = false

  const flush = () => {
    flushScheduled = false
    if (pending.length === 0) return
    const batches = pending
    pending = []
    pendingChars = 0
    lastFlushAt = now()
    batches.forEach(({ stream, text }) => post({ id, type: 'output', stream, text }))
  }

  const queue = (stream: Stream, text: string) => {
    if (!text) return
    captured[stream].push(text)
    const last = pending[pending.length - 1]
    if (last?.stream === stream) last.text += text
    else pending.push({ stream, text })
    pendingChars += text.length
  }

  const write = (stream: Stream, text: string) => {
    if (limited) return false
    const lines = countNewlines(text)
    const overChars = totalChars + text.length > maxChars
    const overLines = totalLines + lines > maxLines
    if (overChars || overLines) {
      let allowed = overChars ? text.slice(0, Math.max(0, maxChars - totalChars)) : text
      allowed = sliceToLineLimit(allowed, Math.max(0, maxLines - totalLines))
      queue(stream, allowed)
      totalChars += allowed.length
      totalLines += countNewlines(allowed)
      limited = true
      flush()
      post({ id, type: 'output_limit', text: OUTPUT_LIMIT_MESSAGE })
      return false
    }

    queue(stream, text)
    totalChars += text.length
    totalLines += lines
    if (pendingChars >= FLUSH_SIZE_CHARS || now() - lastFlushAt >= FLUSH_INTERVAL_MS) {
      flush()
    } else if (!flushScheduled) {
      // Synchronous runtimes keep the worker busy, so size/time checks above
      // handle floods; this timer delivers trailing output once the run yields.
      flushScheduled = true
      schedule(flush, FLUSH_INTERVAL_MS)
    }
    return true
  }

  return {
    write,
    flush,
    get limited() { return limited },
    stdout: () => captured.stdout.join(''),
    stderr: () => captured.stderr.join(''),
    hasStderr: () => captured.stderr.length > 0,
  }
}

export type RunOutput = ReturnType<typeof createRunOutput>
