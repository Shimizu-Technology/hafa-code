import { useMemo, useRef, useState } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { Code2, Globe, Loader2, Play, Save, Square, Terminal } from 'lucide-react'
import './App.css'
import {
  RUNNER_TIMEOUT_MS,
  buildHtmlPreview,
  starterProject,
  type ProjectFile,
  type ProjectKind,
  type RunnerLanguage,
  type SavedProject,
} from './lib/codeRunner'

type RunStatus = 'idle' | 'running' | 'success' | 'error' | 'timeout'

interface RunState {
  status: RunStatus
  stdout: string
  stderr: string
  durationMs: number | null
}

const emptyRunState: RunState = { status: 'idle', stdout: '', stderr: '', durationMs: null }
const storageKey = 'hafa-code-project-v1'

function loadInitialProject() {
  const stored = localStorage.getItem(storageKey)
  if (!stored) return starterProject('ruby')

  try {
    return JSON.parse(stored) as SavedProject
  } catch {
    return starterProject('ruby')
  }
}

function languageForFile(file: ProjectFile) {
  if (file.language === 'ruby') return 'ruby'
  if (file.language === 'html') return 'html'
  if (file.language === 'css') return 'css'
  return 'javascript'
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
  const [project, setProject] = useState<SavedProject>(loadInitialProject)
  const [activePath, setActivePath] = useState(project.files[0].path)
  const activeFile = project.files.find((file) => file.path === activePath) ?? project.files[0]

  const switchKind = (kind: ProjectKind) => {
    const next = starterProject(kind)
    setProject(next)
    setActivePath(next.files[0].path)
  }

  const updateActiveFile = (content: string) => {
    setProject((current) => ({
      ...current,
      files: current.files.map((file) => file.path === activeFile.path ? { ...file, content } : file),
      updatedAt: new Date().toISOString(),
    }))
  }

  const saveLocal = () => {
    localStorage.setItem(storageKey, JSON.stringify(project))
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Open-source coding playground</p>
          <h1>Hafa Code</h1>
          <p className="lede">A tiny Replit alternative for CSG and FD students: Ruby, JavaScript, and HTML/CSS/JS in the browser.</p>
        </div>
        <button className="secondary" onClick={saveLocal}><Save size={16} /> Save local</button>
      </header>

      <nav className="mode-tabs" aria-label="Playground mode">
        {(['ruby', 'javascript', 'web'] as ProjectKind[]).map((kind) => (
          <button key={kind} className={project.kind === kind ? 'active' : ''} onClick={() => switchKind(kind)}>
            {kind === 'web' ? <Globe size={16} /> : <Code2 size={16} />}
            {kind === 'javascript' ? 'JavaScript' : kind === 'ruby' ? 'Ruby' : 'HTML/CSS/JS'}
          </button>
        ))}
      </nav>

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

        {project.kind === 'web' ? <WebPreview files={project.files} /> : <RunnerPanel project={project} activeFile={activeFile} />}
      </div>
    </main>
  )
}
