import { useEffect, useMemo, useRef, useState } from 'react'
import MonacoEditor from '@monaco-editor/react'
import {
  Copy,
  Download,
  Files,
  Globe,
  Import,
  Loader2,
  Play,
  Plus,
  Square,
  Terminal,
  Trash2,
} from 'lucide-react'
import './App.css'
import {
  RUNNER_TIMEOUT_MS,
  buildHtmlPreview,
  type ProjectFile,
  type ProjectKind,
  type RunnerLanguage,
  type SavedProject,
} from './lib/codeRunner'
import {
  createProject,
  decodeSharedProject,
  duplicateProject,
  encodeProjectForShare,
  exportProject,
  loadProjectLibrary,
  parseImportedProject,
  saveProjectLibrary,
  type ProjectLibrary,
} from './lib/projectStorage'

type RunStatus = 'idle' | 'running' | 'success' | 'error' | 'timeout'

interface RunState {
  status: RunStatus
  stdout: string
  stderr: string
  durationMs: number | null
}

const emptyRunState: RunState = { status: 'idle', stdout: '', stderr: '', durationMs: null }

function languageForFile(file: ProjectFile) {
  if (file.language === 'ruby') return 'ruby'
  if (file.language === 'html') return 'html'
  if (file.language === 'css') return 'css'
  return 'javascript'
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'just now'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function loadInitialLibraryWithSharedProject(): { library: ProjectLibrary; notice: string } {
  const library = loadProjectLibrary()
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const sharedProject = params.get('project')
  if (!sharedProject) return { library, notice: '' }

  try {
    const imported = decodeSharedProject(sharedProject)
    window.history.replaceState(null, '', window.location.pathname)
    return {
      library: { activeProjectId: imported.id, projects: [imported, ...library.projects] },
      notice: 'Shared project imported locally.',
    }
  } catch {
    return { library, notice: 'Could not import the shared project link.' }
  }
}

function RunnerPanel({ project, activeFile }: { project: SavedProject; activeFile: ProjectFile }) {
  const [runState, setRunState] = useState<RunState>(emptyRunState)
  const workerRef = useRef<Worker | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const runIdRef = useRef<string | null>(null)

  const stopWorker = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    workerRef.current?.terminate()
    workerRef.current = null
    runIdRef.current = null
  }

  useEffect(() => stopWorker, [])

  const run = () => {
    if (project.kind === 'web') return
    if (runState.status === 'running') stopWorker()

    const runId = crypto.randomUUID()
    const startedAt = performance.now()
    const worker = new Worker(new URL('./workers/codeRunner.worker.ts', import.meta.url), { type: 'module' })

    workerRef.current = worker
    runIdRef.current = runId
    setRunState({ status: 'running', stdout: '', stderr: '', durationMs: null })

    timeoutRef.current = window.setTimeout(() => {
      stopWorker()
      setRunState({ status: 'timeout', stdout: '', stderr: 'Code runner did not start in time.', durationMs: Math.round(performance.now() - startedAt) })
    }, 30_000)

    worker.onmessage = (event: MessageEvent<{ id: string; type: 'started' | 'result'; stdout?: string; stderr?: string; durationMs?: number }>) => {
      if (event.data.id !== runIdRef.current) return

      if (event.data.type === 'started') {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
        timeoutRef.current = window.setTimeout(() => {
          stopWorker()
          setRunState({ status: 'timeout', stdout: '', stderr: `Execution stopped after ${RUNNER_TIMEOUT_MS}ms.`, durationMs: Math.round(performance.now() - startedAt) })
        }, RUNNER_TIMEOUT_MS + 250)
        return
      }

      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      workerRef.current?.terminate()
      workerRef.current = null
      runIdRef.current = null

      const stderr = event.data.stderr ?? ''
      setRunState({
        status: stderr.trim() ? 'error' : 'success',
        stdout: event.data.stdout ?? '',
        stderr,
        durationMs: event.data.durationMs ?? Math.round(performance.now() - startedAt),
      })
    }

    worker.onerror = (event) => {
      stopWorker()
      setRunState({ status: 'error', stdout: '', stderr: event.message || 'Runner failed.', durationMs: Math.round(performance.now() - startedAt) })
    }

    worker.postMessage({ id: runId, code: activeFile.content, language: project.kind as RunnerLanguage, timeoutMs: RUNNER_TIMEOUT_MS })
  }

  const outputIsEmpty = !runState.stdout && !runState.stderr

  return (
    <section className="panel output-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Output</p>
          <h2><Terminal size={18} /> Browser runner</h2>
        </div>
        {runState.status === 'running' ? (
          <button className="secondary" onClick={() => {
            stopWorker()
            setRunState((current) => ({ ...current, status: 'timeout', stderr: current.stderr || 'Execution stopped.' }))
          }}>
            <Square size={16} /> Stop
          </button>
        ) : (
          <button onClick={run} disabled={!activeFile.content.trim()}>
            <Play size={16} /> Run {project.kind === 'ruby' ? 'Ruby' : 'JS'}
          </button>
        )}
      </div>
      <div className="terminal">
        {runState.status === 'running' && <p className="muted inline"><Loader2 className="spin" size={15} /> Running in browser...</p>}
        {runState.status !== 'running' && outputIsEmpty && <p className="muted">Output will appear here.</p>}
        {runState.stdout && <pre>{runState.stdout}</pre>}
        {runState.stderr && <pre className="error-text">{runState.stderr}</pre>}
      </div>
      <div className="terminal-footer">
        <span>{runState.status === 'idle' ? 'Ready' : runState.status}</span>
        <span>{runState.durationMs === null ? `${RUNNER_TIMEOUT_MS}ms limit` : `${runState.durationMs}ms`}</span>
      </div>
    </section>
  )
}

function WebPreview({ files }: { files: ProjectFile[] }) {
  const preview = useMemo(() => buildHtmlPreview(files), [files])

  return (
    <section className="panel preview-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Preview</p>
          <h2><Globe size={18} /> Web page</h2>
        </div>
      </div>
      <iframe title="Web preview" sandbox="allow-scripts" srcDoc={preview} />
    </section>
  )
}

export default function App() {
  const initial = useMemo(() => loadInitialLibraryWithSharedProject(), [])
  const [library, setLibrary] = useState<ProjectLibrary>(initial.library)
  const initialProject = initial.library.projects.find((candidate) => candidate.id === initial.library.activeProjectId) ?? initial.library.projects[0]
  const [activePath, setActivePath] = useState(initialProject.files[0].path)
  const [notice, setNotice] = useState(initial.notice)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const project = library.projects.find((candidate) => candidate.id === library.activeProjectId) ?? library.projects[0]
  const activeFile = project.files.find((file) => file.path === activePath) ?? project.files[0]

  useEffect(() => {
    saveProjectLibrary(library)
  }, [library])

  const setActiveProject = (projectId: string) => {
    const nextProject = library.projects.find((candidate) => candidate.id === projectId)
    if (!nextProject) return
    setLibrary((current) => ({ ...current, activeProjectId: projectId }))
    setActivePath(nextProject.files[0].path)
  }

  const addProject = (kind: ProjectKind) => {
    const next = createProject(kind)
    setLibrary((current) => ({ activeProjectId: next.id, projects: [next, ...current.projects] }))
    setActivePath(next.files[0].path)
    setNotice(`${next.title} created.`)
  }

  const removeProject = (projectId: string) => {
    if (library.projects.length === 1) {
      setNotice('Keep at least one project in the library.')
      return
    }
    const remaining = library.projects.filter((candidate) => candidate.id !== projectId)
    const activeProjectId = projectId === library.activeProjectId ? remaining[0].id : library.activeProjectId
    setLibrary({ activeProjectId, projects: remaining })
    setActivePath(remaining.find((candidate) => candidate.id === activeProjectId)?.files[0].path ?? remaining[0].files[0].path)
    setNotice('Project deleted locally.')
  }

  const cloneProject = () => {
    const copy = duplicateProject(project)
    setLibrary((current) => ({ activeProjectId: copy.id, projects: [copy, ...current.projects] }))
    setActivePath(copy.files[0].path)
    setNotice('Project duplicated.')
  }

  const renameProject = (title: string) => {
    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((candidate) => candidate.id === project.id
        ? { ...candidate, title, updatedAt: new Date().toISOString() }
        : candidate),
    }))
  }

  const updateActiveFile = (content: string) => {
    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((candidate) => candidate.id === project.id
        ? {
            ...candidate,
            files: candidate.files.map((file) => file.path === activeFile.path ? { ...file, content } : file),
            updatedAt: new Date().toISOString(),
          }
        : candidate),
    }))
  }

  const copyShareLink = async () => {
    const encoded = encodeProjectForShare(project)
    const url = `${window.location.origin}${window.location.pathname}#project=${encoded}`
    await navigator.clipboard.writeText(url)
    setNotice('Share link copied. It imports a local copy for whoever opens it.')
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const imported = parseImportedProject(await file.text())
      setLibrary((current) => ({ activeProjectId: imported.id, projects: [imported, ...current.projects] }))
      setActivePath(imported.files[0].path)
      setNotice('Project imported.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Open-source coding playground</p>
          <h1>Hafa Code</h1>
          <p className="lede">A tiny Replit alternative for CSG and FD students: Ruby, JavaScript, and HTML/CSS/JS in the browser.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary" onClick={() => exportProject(project)}><Download size={16} /> Export</button>
          <button className="secondary" onClick={() => importInputRef.current?.click()}><Import size={16} /> Import</button>
          <button onClick={copyShareLink}><Copy size={16} /> Share</button>
          <input ref={importInputRef} hidden type="file" accept="application/json,.json" onChange={(event) => handleImportFile(event.target.files?.[0])} />
        </div>
      </header>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button className="ghost" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}

      <div className="layout-grid">
        <aside className="panel project-sidebar">
          <div className="sidebar-header">
            <h2><Files size={18} /> Projects</h2>
            <span>{library.projects.length}</span>
          </div>
          <div className="new-project-grid">
            {(['ruby', 'javascript', 'web'] as ProjectKind[]).map((kind) => (
              <button key={kind} className="secondary compact" onClick={() => addProject(kind)}>
                <Plus size={14} /> {kind === 'javascript' ? 'JS' : kind === 'web' ? 'Web' : 'Ruby'}
              </button>
            ))}
          </div>
          <div className="project-list">
            {library.projects.map((candidate) => (
              <button
                key={candidate.id}
                className={`project-card ${candidate.id === project.id ? 'active' : ''}`}
                onClick={() => setActiveProject(candidate.id)}
              >
                <span>{candidate.title}</span>
                <small>{candidate.kind === 'javascript' ? 'JavaScript' : candidate.kind === 'web' ? 'HTML/CSS/JS' : 'Ruby'}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="main-workspace">
          <div className="project-toolbar panel">
            <div className="title-field">
              <label htmlFor="project-title">Project name</label>
              <input id="project-title" value={project.title} onChange={(event) => renameProject(event.target.value)} />
              <small>Saved locally · updated {formatUpdatedAt(project.updatedAt)}</small>
            </div>
            <div className="toolbar-actions">
              <button className="secondary" onClick={cloneProject}><Copy size={16} /> Duplicate</button>
              <button className="danger" onClick={() => removeProject(project.id)}><Trash2 size={16} /> Delete</button>
            </div>
          </div>

          <div className="workspace">
            <section className="panel editor-panel">
              <div className="file-tabs">
                {project.files.map((file) => (
                  <button key={file.path} className={file.path === activeFile.path ? 'active' : ''} onClick={() => setActivePath(file.path)}>
                    {file.path}
                  </button>
                ))}
              </div>
              <MonacoEditor
                height="560px"
                language={languageForFile(activeFile)}
                theme="vs-dark"
                value={activeFile.content}
                onChange={(value) => updateActiveFile(value ?? '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  tabSize: 2,
                  insertSpaces: true,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                }}
              />
            </section>

            {project.kind === 'web' ? <WebPreview files={project.files} /> : <RunnerPanel key={`${project.id}:${activeFile.path}`} project={project} activeFile={activeFile} />}
          </div>
        </section>
      </div>
    </main>
  )
}
