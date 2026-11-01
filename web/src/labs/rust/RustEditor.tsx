import { Component, lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import type { OnMount } from '@monaco-editor/react'
import type * as MonacoApi from 'monaco-editor'
import { focusOutside, isApplePlatform } from '../../lib/focusNavigation'
import type { RustDiagnostic } from './diagnostics'

type Monaco = typeof MonacoApi

const MODIFIER_KEY_CODES = new Set([4, 5, 6, 57]) // Shift, Ctrl, Alt, Meta

const MonacoEditor = lazy(async () => {
  await import('./rustMonaco')
  return import('@monaco-editor/react')
})

/** A failed editor download (a lazy import) is cached as failed, so recovery means reloading the page. */
class EditorBoundary extends Component<{ children: ReactNode; value: string }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="lab-editor-fallback" role="alert">
        <p>The editor could not load. Your code is saved in this browser.</p>
        <button className="lab-button" type="button" onClick={() => window.location.reload()}>Reload the page</button>
        <pre aria-label="Code (read-only)">{this.props.value}</pre>
      </div>
    )
  }
}

function applyMarkers(monaco: Monaco, editor: MonacoApi.editor.IStandaloneCodeEditor, diagnostics: RustDiagnostic[]) {
  const model = editor.getModel()
  if (!model) return
  monaco.editor.setModelMarkers(model, 'rustc', diagnostics.flatMap((diagnostic) => diagnostic.spans
    .filter((span) => span.primary)
    .map((span) => ({
      severity: diagnostic.level === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      message: diagnostic.message,
      code: diagnostic.code ?? undefined,
      startLineNumber: span.line,
      startColumn: span.column,
      endLineNumber: span.endLine,
      endColumn: span.endColumn,
    }))))
}

export interface RustEditorHandle { focusLine: (line: number, column?: number) => void }

type RustEditorProps = {
  value: string
  readOnly?: boolean
  theme: 'hafa-light' | 'hafa-dark'
  diagnostics: RustDiagnostic[]
  onChange: (value: string) => void
  /** Called with the editor's current text. */
  onRun: (source: string) => void
  onReady?: (handle: RustEditorHandle) => void
}

function Fallback({ value }: { value: string }) {
  return (
    <div className="lab-editor-fallback" aria-busy="true">
      <p className="lab-muted">Loading the editor…</p>
      <pre aria-label="Code (read-only while the editor loads)">{value}</pre>
    </div>
  )
}

export function RustEditor({ value, readOnly, theme, diagnostics, onChange, onRun, onReady }: RustEditorProps) {
  const monacoRef = useRef<Monaco | null>(null)
  const editorRef = useRef<MonacoApi.editor.IStandaloneCodeEditor | null>(null)
  const runRef = useRef(onRun)
  useEffect(() => { runRef.current = onRun }, [onRun])

  const diagnosticsRef = useRef(diagnostics)
  useEffect(() => {
    diagnosticsRef.current = diagnostics
    if (monacoRef.current && editorRef.current) applyMarkers(monacoRef.current, editorRef.current, diagnostics)
  }, [diagnostics])

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco as unknown as Monaco
    // Diagnostics may already exist when the lazily loaded editor mounts.
    applyMarkers(monacoRef.current, editor, diagnosticsRef.current)
    // Tab indents code, so Escape then Tab (or Shift+Tab) leaves the editor, as in the workspace.
    const escapeArmed = editor.createContextKey<boolean>('rustLabEscapeArmed', false)
    const leaveEditor = (direction: 1 | -1) => {
      escapeArmed.set(false)
      focusOutside(editor.getContainerDomNode(), direction)
    }
    editor.onKeyDown((event) => {
      if (event.keyCode === monaco.KeyCode.Escape) escapeArmed.set(true)
      else if (event.keyCode !== monaco.KeyCode.Tab && !MODIFIER_KEY_CODES.has(event.keyCode)) escapeArmed.set(false)
    })
    editor.onDidBlurEditorText(() => escapeArmed.set(false))
    editor.addCommand(monaco.KeyCode.Tab, () => leaveEditor(1), 'rustLabEscapeArmed')
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Tab, () => leaveEditor(-1), 'rustLabEscapeArmed')
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current(editor.getValue()))
    onReady?.({
      focusLine(line, column = 1) {
        editor.revealLineInCenter(line)
        editor.setPosition({ lineNumber: line, column })
        editor.focus()
      },
    })
  }

  const modifier = isApplePlatform() ? 'Cmd' : 'Ctrl'
  return (
    <>
      <div className="lab-editor-surface">
        <EditorBoundary value={value}>
        <Suspense fallback={<Fallback value={value} />}>
          <MonacoEditor
            language="rust"
            path="file:///main.rs"
            theme={theme}
            value={value}
            loading={<Fallback value={value} />}
            onChange={(next) => onChange(next ?? '')}
            onMount={handleMount}
            options={{
              readOnly,
              fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 14,
              lineHeight: 22,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              detectIndentation: false,
              insertSpaces: true,
              ariaLabel: `Rust code editor for main.rs. Tab indents. Press Escape, then Tab, to leave the editor. Press ${modifier}+Enter to run.`,
              accessibilitySupport: 'auto',
              padding: { top: 12, bottom: 12 },
            }}
          />
        </Suspense>
        </EditorBoundary>
      </div>
      <p className="lab-keyboard-hint" aria-hidden="true">
        <span><kbd>Esc</kbd> then <kbd>Tab</kbd> leaves the editor</span>
        <span><kbd>{modifier}</kbd>+<kbd>Enter</kbd> runs</span>
      </p>
    </>
  )
}
