export interface DiagnosticSpan { line: number; column: number; endLine: number; endColumn: number; label: string | null; primary: boolean }

export interface RustDiagnostic {
  level: string
  message: string
  code: string | null
  rendered: string
  spans: DiagnosticSpan[]
}

export interface ParsedDiagnostics {
  /** Errors and warnings about the learner's code, in rustc's order. */
  diagnostics: RustDiagnostic[]
  /** rustc's own human-readable output, with error codes kept. */
  rendered: string
  errorCount: number
  warningCount: number
}

interface RawSpan { line_start?: number; column_start?: number; line_end?: number; column_end?: number; label?: string | null; is_primary?: boolean; file_name?: string }
interface RawDiagnostic { $message_type?: string; level?: string; message?: string; code?: { code?: string } | null; rendered?: string | null; spans?: RawSpan[] }

const SOURCE_FILE = /\/main\.rs\b/g
/** rustc's closing summary lines are not about a line of code. */
const SUMMARY = /^(aborting due to|Some errors have detailed explanations|For more information about (this|an) error)/

const tidy = (text: string) => text.replace(SOURCE_FILE, 'main.rs')

/** Parses rustc --error-format=json output; lines that are not JSON (for example an internal crash) are kept as text. */
export function parseDiagnostics(stderr: string): ParsedDiagnostics {
  const diagnostics: RustDiagnostic[] = []
  const renderedParts: string[] = []
  for (const line of stderr.split('\n')) {
    if (!line.trim()) continue
    let raw: RawDiagnostic | null = null
    if (line.startsWith('{')) {
      try {
        raw = JSON.parse(line) as RawDiagnostic
      } catch {
        raw = null
      }
    }
    if (!raw || typeof raw.message !== 'string') {
      renderedParts.push(tidy(line))
      continue
    }
    const rendered = tidy((raw.rendered ?? raw.message).trimEnd())
    renderedParts.push(rendered)
    if (SUMMARY.test(raw.message) || raw.level === 'failure-note') continue
    diagnostics.push({
      level: raw.level ?? 'error',
      message: raw.message,
      code: raw.code?.code ?? null,
      rendered,
      spans: (raw.spans ?? [])
        .filter((span) => typeof span.line_start === 'number' && (!span.file_name || span.file_name.endsWith('main.rs')))
        .map((span) => ({
          line: span.line_start!,
          column: span.column_start ?? 1,
          endLine: span.line_end ?? span.line_start!,
          endColumn: span.column_end ?? (span.column_start ?? 1) + 1,
          label: span.label ?? null,
          primary: Boolean(span.is_primary),
        })),
    })
  }
  return {
    diagnostics,
    rendered: renderedParts.join('\n\n'),
    errorCount: diagnostics.filter((diagnostic) => diagnostic.level === 'error').length,
    warningCount: diagnostics.filter((diagnostic) => diagnostic.level === 'warning').length,
  }
}

export function primarySpan(diagnostic: RustDiagnostic) {
  return diagnostic.spans.find((span) => span.primary) ?? diagnostic.spans[0] ?? null
}
