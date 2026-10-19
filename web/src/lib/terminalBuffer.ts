export type TerminalLineKind = 'command' | 'stdout' | 'stderr' | 'input' | 'system'

export interface TerminalLine {
  id: string
  kind: TerminalLineKind
  text: string
}

export interface TerminalBuffer {
  lines: TerminalLine[]
  /** Output lines dropped from the top so the terminal stays fast. */
  hiddenLineCount: number
}

/** The terminal renders at most this many lines; Copy output still includes everything. */
export const TERMINAL_RENDER_LINE_LIMIT = 2_000

const MERGEABLE_KINDS = new Set<TerminalLineKind>(['stdout', 'stderr'])

function lineCount(text: string) {
  if (!text) return 0
  const newlines = text.split('\n').length - 1
  return text.endsWith('\n') ? newlines : newlines + 1
}

function lastLines(text: string, count: number) {
  const parts = text.split('\n')
  const trailingNewline = text.endsWith('\n')
  const contentParts = trailingNewline ? parts.slice(0, -1) : parts
  const kept = contentParts.slice(-count).join('\n')
  return trailingNewline ? `${kept}\n` : kept
}

export function emptyTerminalBuffer(lines: TerminalLine[] = []): TerminalBuffer {
  return { lines, hiddenLineCount: 0 }
}

/**
 * Appends chunks in one state update, merging consecutive stdout/stderr text
 * and trimming the oldest output once the render limit is exceeded. The first
 * command line is always kept so the learner still sees what ran.
 */
export function appendTerminalChunks(
  buffer: TerminalBuffer,
  chunks: readonly Omit<TerminalLine, 'id'>[],
  createId: () => string = () => crypto.randomUUID(),
  limit = TERMINAL_RENDER_LINE_LIMIT,
): TerminalBuffer {
  if (chunks.length === 0) return buffer
  const lines = [...buffer.lines]
  chunks.forEach((chunk) => {
    const last = lines[lines.length - 1]
    if (last && last.kind === chunk.kind && MERGEABLE_KINDS.has(chunk.kind)) {
      lines[lines.length - 1] = { ...last, text: last.text + chunk.text }
    } else {
      lines.push({ id: createId(), ...chunk })
    }
  })

  const pinned = lines[0]?.kind === 'command' ? 1 : 0
  let total = lines.slice(pinned).reduce((sum, line) => sum + lineCount(line.text), 0)
  let hiddenLineCount = buffer.hiddenLineCount
  while (total > limit && lines.length > pinned) {
    const oldest = lines[pinned]
    const oldestLines = lineCount(oldest.text)
    const excess = total - limit
    if (oldestLines <= excess) {
      lines.splice(pinned, 1)
      total -= oldestLines
      hiddenLineCount += oldestLines
    } else {
      lines[pinned] = { ...oldest, text: lastLines(oldest.text, oldestLines - excess) }
      total -= excess
      hiddenLineCount += excess
    }
  }

  return { lines, hiddenLineCount }
}
