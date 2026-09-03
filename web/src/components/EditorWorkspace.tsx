import MonacoEditor from '@monaco-editor/react'
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
import type { RunnerOutcome } from '../lib/runnerOutcome'
import { formatFileLanguage, languageForFile } from '../lib/workspace'
import { RunnerPanel } from './RunnerPanel'
import { WebPreview } from './WebPreview'

type EditorWorkspaceProps = {
  activeFile: ProjectFile
  canEditProject: boolean
  editorExpanded: boolean
  editorFontSize: number
  entryFile: ProjectFile
  project: SavedProject
  onCreateFile: () => void
  onDeleteFile: (file: ProjectFile) => void
  onDuplicateFile: (file: ProjectFile) => void
  onEditorExpandedChange: (expanded: boolean) => void
  onOpenGuide: () => void
  onOpenPractice: () => void
  onRenameFile: (file: ProjectFile) => void
  onRunFromMobileCode: () => void
  onSelectFile: (path: string) => void
  onSetEntryPath: (file: ProjectFile) => void
  onUpdateActiveFile: (content: string) => void
  onRunnerCancel?: () => void
  onRunnerComplete?: (outcome: RunnerOutcome) => void
}

/** Renders file navigation, Monaco, and the matching output pane without owning project state. */
export function EditorWorkspace({
  activeFile,
  canEditProject,
  editorExpanded,
  editorFontSize,
  entryFile,
  project,
  onCreateFile,
  onDeleteFile,
  onDuplicateFile,
  onEditorExpandedChange,
  onOpenGuide,
  onOpenPractice,
  onRenameFile,
  onRunFromMobileCode,
  onSelectFile,
  onSetEntryPath,
  onUpdateActiveFile,
  onRunnerCancel,
  onRunnerComplete,
}: EditorWorkspaceProps) {
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
        <details className="file-browser" aria-label="Project files">
          <summary>
            <span><Files size={15} /> Files</span>
            <small>{project.files.length} files · entry {project.entryPath}</small>
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
          <button type="button" onClick={onRunFromMobileCode} disabled={project.kind !== 'web' && !entryFile.content.trim()}>
            {project.kind === 'web' ? <Globe size={16} /> : <Play size={16} />}
            {project.kind === 'web' ? 'Open preview' : `Run ${projectKindDefinition(project.kind).shortLabel}`}
          </button>
        </div>
        <MonacoEditor
          height="var(--workspace-pane-height)"
          language={languageForFile(activeFile)}
          theme="vs-dark"
          value={activeFile.content}
          loading={<div className="editor-loading"><Loader2 className="spin" size={20} /> Loading editor...</div>}
          onChange={(value) => onUpdateActiveFile(value ?? '')}
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
          }}
        />
      </section>

      {project.kind === 'web'
        ? <WebPreview key={project.id} files={project.files} entryPath={project.entryPath} />
        : <RunnerPanel key={`${project.id}:${project.entryPath}`} project={project} entryFile={entryFile} onRunCancel={onRunnerCancel} onRunComplete={onRunnerComplete} />}
    </div>
  )
}
