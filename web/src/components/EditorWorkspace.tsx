import MonacoEditor, { type OnMount } from '@monaco-editor/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Check,
  Copy,
  Dumbbell,
  FilePlus2,
  Files,
  Globe,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react'
import { projectKindDefinition, type ProjectFile, type SavedProject } from '../lib/codeRunner'
import { projectKindCanRun } from '../lib/languageRegistry'
import type { RunnerOutcome } from '../lib/runnerOutcome'
import type { ErrorCoachContext } from '../lib/errorCoach'
import { focusOutside, focusRunControl, isApplePlatform } from '../lib/focusNavigation'
import { formatFileLanguage, languageForFile, writeClipboardText } from '../lib/workspace'
import { RunnerPanel } from './RunnerPanel'
import { SqlRunnerPanel } from './SqlRunnerPanel'
import { WebPreview } from './WebPreview'

type EditorWorkspaceProps = {
  activeFile: ProjectFile
  canEditProject: boolean
  editorExpanded: boolean
  editorFontSize: number
  entryFile: ProjectFile
  project: SavedProject
  runnerInstanceKey: string
  onCreateFile: () => void
  onDeleteFile: (file: ProjectFile) => void
  onDuplicateFile: (file: ProjectFile) => void
  onEditorExpandedChange: (expanded: boolean) => void
  onOpenGuide: () => void
  onOpenSqlFile?: (path: string) => void
  onOpenPractice: () => void
  onErrorAdviceChange?: (context: ErrorCoachContext) => void
  onRenameFile: (file: ProjectFile) => void
  onRunFromMobileCode: () => void
  /** Cmd/Ctrl+Enter inside the editor. */
  onRunShortcut?: () => void
  onSelectFile: (path: string) => void
  onSetEntryPath: (file: ProjectFile) => void
  onUpdateActiveFile: (content: string) => void
  onRunnerCancel?: () => void
  onRunnerComplete?: (outcome: RunnerOutcome) => void
}

type Monaco = Parameters<OnMount>[1]
type CopyStatus = { state: 'idle' | 'copied' | 'failed'; path: string }

const MODIFIER_KEY_CODES = new Set([4, 5, 6, 57]) // Shift, Ctrl, Alt, Meta

function modelUri(projectId: string, path: string) {
  const encodedProjectId = encodeURIComponent(projectId)
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `file:///project/${encodedProjectId}/${encodedPath}`
}

/** Renders file navigation, Monaco, and the matching output pane without owning project state. */
export function EditorWorkspace({
  activeFile,
  canEditProject,
  editorExpanded,
  editorFontSize,
  entryFile,
  project,
  runnerInstanceKey,
  onCreateFile,
  onDeleteFile,
  onDuplicateFile,
  onEditorExpandedChange,
  onOpenGuide,
  onOpenSqlFile,
  onOpenPractice,
  onErrorAdviceChange,
  onRenameFile,
  onRunFromMobileCode,
  onRunShortcut,
  onSelectFile,
  onSetEntryPath,
  onUpdateActiveFile,
  onRunnerCancel,
  onRunnerComplete,
}: EditorWorkspaceProps) {
  const monacoRef = useRef<Monaco | null>(null)
  const managedTypeScriptModelsRef = useRef(new Set<string>())
  const onRunShortcutRef = useRef(onRunShortcut)
  const copyResetRef = useRef<number | null>(null)
  const [copyResult, setCopyResult] = useState<CopyStatus>({ state: 'idle', path: '' })
  // Feedback belongs to the file that was copied; switching files clears it.
  const copyStatus = copyResult.path === activeFile.path ? copyResult.state : 'idle'
  const runnable = projectKindCanRun(project.kind)
  const modifierLabel = isApplePlatform() ? '⌘' : 'Ctrl'

  useEffect(() => {
    onRunShortcutRef.current = onRunShortcut
  }, [onRunShortcut])

  useEffect(() => () => {
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current)
  }, [])

  const copyCode = async () => {
    const path = activeFile.path
    const copied = await writeClipboardText(activeFile.content)
    setCopyResult({ state: copied ? 'copied' : 'failed', path })
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current)
    copyResetRef.current = window.setTimeout(() => setCopyResult({ state: 'idle', path: '' }), copied ? 2000 : 6000)
  }

  const syncTypeScriptModels = useCallback((monaco: Monaco) => {
    const nextUris = new Set<string>()
    if (project.kind === 'typescript') {
      project.files.filter((file) => file.language === 'typescript').forEach((file) => {
        const uri = monaco.Uri.parse(modelUri(project.id, file.path))
        const uriText = uri.toString()
        nextUris.add(uriText)
        const model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(file.content, 'typescript', uri)
        if (model.getValue() !== file.content) model.setValue(file.content)
      })
    }

    managedTypeScriptModelsRef.current.forEach((uriText) => {
      if (!nextUris.has(uriText)) monaco.editor.getModel(monaco.Uri.parse(uriText))?.dispose()
    })
    managedTypeScriptModelsRef.current = nextUris
  }, [project.files, project.id, project.kind])

  const handleEditorMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco
    syncTypeScriptModels(monaco)

    // Tab indents code, so Escape then Tab (or Shift+Tab) is the way out for keyboard users.
    const escapeArmed = editor.createContextKey<boolean>('hafaEscapeArmed', false)
    const leaveEditor = (direction: 1 | -1) => {
      escapeArmed.set(false)
      focusOutside(editor.getContainerDomNode(), direction)
    }
    editor.onKeyDown((event) => {
      if (event.keyCode === monaco.KeyCode.Escape) escapeArmed.set(true)
      else if (event.keyCode !== monaco.KeyCode.Tab && !MODIFIER_KEY_CODES.has(event.keyCode)) escapeArmed.set(false)
    })
    editor.onDidBlurEditorText(() => escapeArmed.set(false))
    editor.addCommand(monaco.KeyCode.Tab, () => leaveEditor(1), 'hafaEscapeArmed')
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Tab, () => leaveEditor(-1), 'hafaEscapeArmed')
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunShortcutRef.current?.())
  }

  useEffect(() => {
    if (monacoRef.current) syncTypeScriptModels(monacoRef.current)
  }, [syncTypeScriptModels])

  useEffect(() => () => {
    const monaco = monacoRef.current
    if (!monaco) return
    managedTypeScriptModelsRef.current.forEach((uriText) => {
      monaco.editor.getModel(monaco.Uri.parse(uriText))?.dispose()
    })
    managedTypeScriptModelsRef.current.clear()
  }, [])

  return (
    <div className="workspace">
      <section className="panel editor-panel">
        <div className="file-tabs">
          <div className="file-tab-list">
            {project.files.map((file) => (
              <button key={file.path} className={file.path === activeFile.path ? 'active' : ''} onClick={() => onSelectFile(file.path)}>
                {file.path}
                {file.path === project.entryPath && <span className="entry-dot">entry</span>}
              </button>
            ))}
          </div>
          <button className="ghost icon-button" type="button" aria-label="Create file" title="Create file" onClick={onCreateFile} disabled={!canEditProject}>
            <FilePlus2 size={17} />
          </button>
          <button
            className="ghost editor-copy-button"
            type="button"
            onClick={copyCode}
            aria-label={copyStatus === 'copied' ? 'Code copied' : 'Copy code'}
            title={`Copy the code in ${activeFile.path}`}
          >
            {copyStatus === 'copied' ? <Check size={16} /> : <Copy size={16} />}
            <span>{copyStatus === 'copied' ? 'Copied' : 'Copy code'}</span>
          </button>
          <button className="secondary mobile-editor-guide-button" type="button" onClick={onOpenGuide} aria-label={`Open ${projectKindDefinition(project.kind).label} language guide`}>
            <BookOpen size={16} /> Guide
          </button>
          <button
            className="ghost icon-button editor-focus-button"
            type="button"
            aria-label={editorExpanded ? 'Exit editor focus mode' : 'Expand code editor'}
            title={editorExpanded ? 'Exit focus' : 'Focus editor'}
            onClick={() => onEditorExpandedChange(!editorExpanded)}
          >
            {editorExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
        <p className="sr-only" aria-live="polite">{copyStatus === 'copied' ? `${activeFile.path} copied to the clipboard.` : ''}</p>
        {copyStatus === 'failed' && (
          <p className="editor-copy-error" role="alert">
            Copy was blocked by this browser. Click in the code, press {modifierLabel}+A, then {modifierLabel}+C.
          </p>
        )}
        <details className="file-browser" aria-label="Project files">
          <summary>
            <span><Files size={15} /> Files</span>
            <small>{project.files.length} {project.files.length === 1 ? 'file' : 'files'} · entry {project.entryPath}</small>
          </summary>
          <div className="file-browser-actions">
            <button className="secondary compact" type="button" onClick={onCreateFile} disabled={!canEditProject}>
              <FilePlus2 size={14} /> New file
            </button>
          </div>
          <div className="file-browser-list">
            {project.files.map((file) => (
              <div key={file.path} className={`file-row ${file.path === activeFile.path ? 'active' : ''}`}>
                <button type="button" className="file-row-main" onClick={() => onSelectFile(file.path)}>
                  <span>{file.path}</span>
                  <small>{formatFileLanguage(file)}{file.path === project.entryPath ? ' · entry' : ''}</small>
                </button>
                <div className="file-row-actions">
                  {file.path !== project.entryPath && (
                    <button className="ghost icon-button" type="button" aria-label={`Set ${file.path} as entry`} title="Set as entry" onClick={() => onSetEntryPath(file)} disabled={!canEditProject}>
                      <Check size={15} />
                    </button>
                  )}
                  <button className="ghost icon-button" type="button" aria-label={`Rename ${file.path}`} title="Rename" onClick={() => onRenameFile(file)} disabled={!canEditProject}>
                    <Pencil size={15} />
                  </button>
                  <button className="ghost icon-button" type="button" aria-label={`Duplicate ${file.path}`} title="Duplicate" onClick={() => onDuplicateFile(file)} disabled={!canEditProject}>
                    <Copy size={15} />
                  </button>
                  <button className="ghost icon-button danger-icon" type="button" aria-label={`Delete ${file.path}`} title="Delete" onClick={() => onDeleteFile(file)} disabled={!canEditProject || project.files.length <= 1}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
        <div className="mobile-code-runbar">
          <button className="secondary" type="button" onClick={onOpenPractice} aria-label={`Open ${projectKindDefinition(project.kind).label} practice lab`}>
            <Dumbbell size={16} /> Practice
          </button>
          <button type="button" onClick={onRunFromMobileCode} disabled={project.kind !== 'web' && !entryFile.content.trim()} data-hafa-run-button>
            {project.kind === 'web' ? <Globe size={16} /> : <Play size={16} />}
            {project.kind === 'web' ? 'Open preview' : `Run ${projectKindDefinition(project.kind).shortLabel}`}
          </button>
        </div>
        <button className="skip-to-run" type="button" onClick={() => focusRunControl()}>
          {runnable ? 'Skip the editor and go to Run' : 'Skip the editor and go to the preview'}
        </button>
        <MonacoEditor
          height="calc(var(--workspace-pane-height) - var(--editor-hint-height))"
          language={languageForFile(activeFile)}
          path={modelUri(project.id, activeFile.path)}
          theme="vs-dark"
          value={activeFile.content}
          loading={<div className="editor-loading"><Loader2 className="spin" size={20} /> Loading editor...</div>}
          onChange={(value) => onUpdateActiveFile(value ?? '')}
          onMount={handleEditorMount}
          options={{
            readOnly: !canEditProject,
            minimap: { enabled: false },
            fontSize: editorFontSize,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            ariaLabel: `Editor content, ${activeFile.path}. Tab indents. Press Escape, then Tab, to leave the editor.${runnable ? ` Press ${modifierLabel}+Enter to run.` : ''}`,
          }}
        />
        <p className="editor-keyboard-hint" aria-hidden="true">
          <span><kbd>Esc</kbd> then <kbd>Tab</kbd> leaves the editor</span>
          {runnable && <span><kbd>{modifierLabel}</kbd>+<kbd>Enter</kbd> runs</span>}
        </p>
      </section>

      {project.kind === 'web'
        ? <WebPreview key={project.id} files={project.files} entryPath={project.entryPath} onErrorAdviceChange={onErrorAdviceChange} />
        : project.kind === 'sql'
          ? <SqlRunnerPanel key={runnerInstanceKey} project={project} entryFile={entryFile} onOpenFile={onOpenSqlFile} onRunCancel={onRunnerCancel} onRunComplete={onRunnerComplete} onErrorAdviceChange={onErrorAdviceChange} />
          : <RunnerPanel key={`${runnerInstanceKey}:${project.entryPath}`} project={project} entryFile={entryFile} onRunCancel={onRunnerCancel} onRunComplete={onRunnerComplete} onErrorAdviceChange={onErrorAdviceChange} />}
    </div>
  )
}
