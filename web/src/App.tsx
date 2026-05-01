import { useEffect, useMemo, useRef, useState } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react'
import {
  Archive,
  BookOpen,
  Cloud,
  Copy,
  Download,
  Files,
  Globe,
  History,
  Import,
  Layers3,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RotateCcw,
  Rocket,
  Save,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import './App.css'
import {
  RUNNER_TIMEOUT_MS,
  buildHtmlPreview,
  type ProjectFile,
  type ProjectCheckpoint,
  type ProjectKind,
  type RunnerLanguage,
  type SavedProject,
} from './lib/codeRunner'
import {
  createLocalCheckpoint,
  createProject,
  decodeSharedProject,
  duplicateProject,
  encodeProjectForShare,
  exportProject,
  loadLocalCheckpoints,
  loadProjectLibrary,
  parseImportedProject,
  saveProjectLibrary,
  snapshotToProject,
  type ProjectLibrary,
} from './lib/projectStorage'
import { useAuthContext } from './contexts/AuthContext'
import { api } from './lib/api'
import { hasClerkPublishableKey } from './lib/clerk'

type RunStatus = 'idle' | 'running' | 'success' | 'error' | 'timeout'
type ConfirmAction = 'archive' | 'delete' | 'checkpoint' | null
type MobileTab = 'home' | 'projects' | 'code' | 'output' | 'history'

interface RunState {
  status: RunStatus
  stdout: string
  stderr: string
  durationMs: number | null
}

const emptyRunState: RunState = { status: 'idle', stdout: '', stderr: '', durationMs: null }
const kindLabels: Record<ProjectKind, string> = {
  ruby: 'Ruby',
  javascript: 'JavaScript',
  web: 'HTML/CSS/JS',
}

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

function formatCheckpointTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'just now'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
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
  const runRef = useRef<() => void>(() => {})

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

  useEffect(() => {
    runRef.current = run
  })

  const outputIsEmpty = !runState.stdout && !runState.stderr

  useEffect(() => {
    const handleRunRequest = () => runRef.current()
    window.addEventListener('hafa-code-run-active-project', handleRunRequest)
    return () => window.removeEventListener('hafa-code-run-active-project', handleRunRequest)
  }, [])

  return (
    <section className="panel output-panel surface-grid">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Output</p>
          <h2><Terminal size={18} /> Browser runner</h2>
          <p className="helper-text">Runs locally in a worker with a {RUNNER_TIMEOUT_MS / 1000}s guardrail.</p>
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
        {runState.status === 'running' && <p className="muted inline"><Loader2 className="spin" size={15} /> Loading runtime and executing...</p>}
        {runState.status !== 'running' && outputIsEmpty && (
          <div className="empty-output">
            <Zap size={28} />
            <p>Press Run to see stdout and errors here.</p>
          </div>
        )}
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

interface PreviewConsoleMessage {
  source: 'hafa-code-preview-console'
  level: 'log' | 'warn' | 'error'
  message: string
}

function WebPreview({ files }: { files: ProjectFile[] }) {
  const preview = useMemo(() => buildHtmlPreview(files), [files])
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [consoleMessages, setConsoleMessages] = useState<PreviewConsoleMessage[]>([])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const message = event.data as Partial<PreviewConsoleMessage>
      if (message.source !== 'hafa-code-preview-console' || !message.level || !message.message) return

      setConsoleMessages((current) => [...current, message as PreviewConsoleMessage].slice(-20))
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <section className="panel preview-panel surface-grid">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Preview</p>
          <h2><Globe size={18} /> Web page</h2>
          <p className="helper-text">Sandboxed iframe, no same-origin access.</p>
        </div>
      </div>
      <iframe ref={iframeRef} title="Web preview" sandbox="allow-scripts allow-modals" referrerPolicy="no-referrer" srcDoc={preview} />
      <div className="preview-console" aria-live="polite">
        <div className="preview-console-header">
          <span>Browser console</span>
          {consoleMessages.length > 0 && (
            <button className="ghost compact" type="button" onClick={() => setConsoleMessages([])}>Clear</button>
          )}
        </div>
        {consoleMessages.length === 0 ? (
          <p>No console messages yet.</p>
        ) : (
          consoleMessages.map((message, index) => (
            <pre key={`${message.level}-${index}`} className={`preview-console-line ${message.level}`}>{message.message}</pre>
          ))
        )}
      </div>
    </section>
  )
}

function AuthControls({ cloudEnabled }: { cloudEnabled: boolean }) {
  const { isLoaded } = useAuth()
  const [loadTimedOut, setLoadTimedOut] = useState(false)

  useEffect(() => {
    if (!cloudEnabled || isLoaded) return

    const timeout = window.setTimeout(() => setLoadTimedOut(true), 8_000)
    return () => window.clearTimeout(timeout)
  }, [cloudEnabled, isLoaded])

  if (!cloudEnabled) {
    return <span className="cloud-pill muted"><Cloud size={15} /> Add a valid Clerk key for cloud save</span>
  }

  if (!isLoaded && loadTimedOut) {
    return <span className="cloud-pill muted"><Cloud size={15} /> Cloud sign-in unavailable</span>
  }

  if (!isLoaded) {
    return <span className="cloud-pill muted"><Loader2 className="spin" size={15} /> Loading sign-in</span>
  }

  return (
    <div className="auth-actions">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="secondary"><Cloud size={16} /> Sign in to sync</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <span className="cloud-pill"><Cloud size={15} /> Cloud sync on</span>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  )
}

function isCloudProjectId(id: string) {
  return /^\d+$/.test(id)
}

function isArchived(project: SavedProject) {
  return Boolean(project.archivedAt)
}

async function writeClipboardText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function mergeCloudAndLocalProjects(cloudProjects: SavedProject[], localLibrary: ProjectLibrary): ProjectLibrary {
  const localOnlyProjects = localLibrary.projects.filter((candidate) => !isCloudProjectId(candidate.id))
  const projects = [...cloudProjects, ...localOnlyProjects]
  const activeProjectId = projects.some((candidate) => candidate.id === localLibrary.activeProjectId)
    ? localLibrary.activeProjectId
    : projects[0].id

  return { activeProjectId, projects }
}

export default function App() {
  const initial = useMemo(() => loadInitialLibraryWithSharedProject(), [])
  const [library, setLibrary] = useState<ProjectLibrary>(initial.library)
  const initialProject = initial.library.projects.find((candidate) => candidate.id === initial.library.activeProjectId) ?? initial.library.projects[0]
  const [activePath, setActivePath] = useState(initialProject.files[0].path)
  const [notice, setNotice] = useState(initial.notice)
  const [showArchived, setShowArchived] = useState(isArchived(initialProject))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [editorExpanded, setEditorExpanded] = useState(false)
  const [projectActionsOpen, setProjectActionsOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [pendingCheckpoint, setPendingCheckpoint] = useState<ProjectCheckpoint | null>(null)
  const [checkpoints, setCheckpoints] = useState<ProjectCheckpoint[]>(() => loadLocalCheckpoints(initialProject.id))
  const [mobileTab, setMobileTab] = useState<MobileTab>('home')
  const [hasImportedServerShare, setHasImportedServerShare] = useState(() => !new URLSearchParams(window.location.hash.replace(/^#/, '')).has('share'))
  const [hasLoadedCloudProjects, setHasLoadedCloudProjects] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const syncTimerRef = useRef<number | null>(null)
  const replacingCloudIdRef = useRef(false)
  const libraryRef = useRef(library)
  const { isSignedIn, user } = useAuthContext()
  const cloudEnabled = hasClerkPublishableKey(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

  const project = library.projects.find((candidate) => candidate.id === library.activeProjectId) ?? library.projects[0]
  const activeFile = project.files.find((file) => file.path === activePath) ?? project.files[0]
  const activeProjects = library.projects.filter((candidate) => !isArchived(candidate))
  const archivedProjects = library.projects.filter(isArchived)
  const visibleProjects = showArchived ? archivedProjects : activeProjects

  const activateProject = (nextProject: SavedProject) => {
    setLibrary((current) => ({ ...current, activeProjectId: nextProject.id }))
    setActivePath(nextProject.files[0].path)
  }

  const activateFallbackProject = (projects: SavedProject[], archivedView = showArchived) => {
    const preferred = projects.find((candidate) => (archivedView ? isArchived(candidate) : !isArchived(candidate))) ?? projects[0]
    if (preferred) {
      setLibrary({ activeProjectId: preferred.id, projects })
      setActivePath(preferred.files[0].path)
      return
    }

    const fallback = createProject('ruby')
    setLibrary({ activeProjectId: fallback.id, projects: [fallback] })
    setActivePath(fallback.files[0].path)
  }

  useEffect(() => {
    libraryRef.current = library
    saveProjectLibrary(library)
  }, [library])

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(() => {
      if (!cancelled) setCheckpoints(loadLocalCheckpoints(project.id))
    })

    if (isSignedIn && isCloudProjectId(project.id)) {
      api.getCheckpoints(project.id).then((res) => {
        if (!cancelled && res.data) setCheckpoints(res.data)
      })
    }

    return () => {
      cancelled = true
    }
  }, [isSignedIn, project.id])

  useEffect(() => {
    if (hasImportedServerShare) return

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const shareToken = params.get('share')
    if (!shareToken) return

    api.getShare(shareToken).then((res) => {
      if (res.data) {
        setLibrary((current) => ({ activeProjectId: res.data!.id, projects: [res.data!, ...current.projects] }))
        setActivePath(res.data.files[0].path)
        setShowArchived(false)
        setNotice('Shared project imported locally.')
        window.history.replaceState(null, '', window.location.pathname)
      } else {
        setNotice(`Could not import share: ${res.error || 'unknown error'}`)
      }
      setHasImportedServerShare(true)
    })
  }, [hasImportedServerShare])

  useEffect(() => {
    if (!notice) return

    const timeout = window.setTimeout(() => setNotice(''), 4_500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (!isSignedIn || hasLoadedCloudProjects) return

    api.getProjects().then((res) => {
      if (res.error) {
        setNotice(`Cloud sync unavailable: ${res.error}`)
        return
      }
      if (res.data && res.data.length > 0) {
        const merged = mergeCloudAndLocalProjects(res.data, libraryRef.current)
        const nextProject = merged.projects.find((candidate) => candidate.id === merged.activeProjectId) ?? merged.projects[0]
        setLibrary(merged)
        setActivePath(nextProject.files[0].path)
        setShowArchived(isArchived(nextProject))
        setNotice(`Loaded ${res.data.length} cloud project${res.data.length === 1 ? '' : 's'} and kept local drafts.`)
      } else {
        setNotice('Signed in. Local projects will sync to your account as you edit.')
      }
      setHasLoadedCloudProjects(true)
    })
  }, [hasLoadedCloudProjects, isSignedIn])

  useEffect(() => {
    if (!isSignedIn || !hasLoadedCloudProjects || replacingCloudIdRef.current) return
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)

    syncTimerRef.current = window.setTimeout(async () => {
      if (isCloudProjectId(project.id)) {
        const res = await api.updateProject(project)
        if (res.error) setNotice(`Cloud save failed: ${res.error}`)
        return
      }

      const res = await api.createProject(project)
      if (res.error || !res.data) {
        setNotice(`Cloud save failed: ${res.error || 'unknown error'}`)
        return
      }

      replacingCloudIdRef.current = true
      setLibrary((current) => ({
        activeProjectId: current.activeProjectId === project.id ? res.data!.id : current.activeProjectId,
        projects: current.projects.map((candidate) => candidate.id === project.id ? res.data! : candidate),
      }))
      window.setTimeout(() => { replacingCloudIdRef.current = false }, 0)
    }, 900)

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
    }
  }, [hasLoadedCloudProjects, isSignedIn, library, project])

  const setActiveProject = (projectId: string) => {
    const nextProject = library.projects.find((candidate) => candidate.id === projectId)
    if (!nextProject) return
    activateProject(nextProject)
    setMobileTab('code')
  }

  const addProject = (kind: ProjectKind) => {
    const next = createProject(kind)
    setLibrary((current) => ({ activeProjectId: next.id, projects: [next, ...current.projects] }))
    setActivePath(next.files[0].path)
    setShowArchived(false)
    setMobileTab('code')
    setNotice(`${next.title} created.`)
  }

  const requestArchiveProject = () => {
    if (activeProjects.length <= 1) {
      setNotice('Keep at least one active project in the library.')
      return
    }
    setProjectActionsOpen(false)
    setConfirmAction('archive')
  }

  const requestDeleteProject = () => {
    if (library.projects.length <= 1) {
      setNotice('Keep at least one project in the library.')
      return
    }
    setProjectActionsOpen(false)
    setConfirmAction('delete')
  }

  const removeProject = (projectId: string) => {
    if (library.projects.length === 1) {
      setNotice('Keep at least one project in the library.')
      return
    }
    const remaining = library.projects.filter((candidate) => candidate.id !== projectId)
    if (projectId === library.activeProjectId) {
      activateFallbackProject(remaining)
    } else {
      setLibrary((current) => ({ ...current, projects: remaining }))
    }
    if (isSignedIn && isCloudProjectId(projectId)) {
      api.deleteProject(projectId).then((res) => {
        setNotice(res.error ? `Cloud delete failed: ${res.error}` : 'Project deleted from cloud.')
      })
    } else {
      setNotice('Project deleted locally.')
    }
  }

  const archiveProject = () => {
    if (activeProjects.length <= 1) {
      setNotice('Keep at least one active project in the library.')
      return
    }
    const archivedAt = new Date().toISOString()
    const projects = library.projects.map((candidate) => candidate.id === project.id
      ? { ...candidate, archivedAt, updatedAt: archivedAt }
      : candidate)
    activateFallbackProject(projects, false)
    setShowArchived(false)
    setNotice(`${project.title || 'Project'} archived.`)

    if (isSignedIn && isCloudProjectId(project.id)) {
      api.archiveProject(project.id).then((res) => {
        if (res.error || !res.data) {
          setNotice(`Cloud archive failed: ${res.error || 'unknown error'}`)
          return
        }
        setLibrary((current) => ({
          ...current,
          projects: current.projects.map((candidate) => candidate.id === res.data!.id ? res.data! : candidate),
        }))
      })
    }
  }

  const restoreProject = () => {
    const restoredAt = new Date().toISOString()
    const projects = library.projects.map((candidate) => candidate.id === project.id
      ? { ...candidate, archivedAt: null, updatedAt: restoredAt }
      : candidate)
    setLibrary({ activeProjectId: project.id, projects })
    setActivePath(project.files[0].path)
    setShowArchived(false)
    setNotice(`${project.title || 'Project'} restored.`)

    if (isSignedIn && isCloudProjectId(project.id)) {
      api.unarchiveProject(project.id).then((res) => {
        if (res.error || !res.data) {
          setNotice(`Cloud restore failed: ${res.error || 'unknown error'}`)
          return
        }
        setLibrary((current) => ({
          ...current,
          projects: current.projects.map((candidate) => candidate.id === res.data!.id ? res.data! : candidate),
        }))
      })
    }
  }

  const cloneProject = () => {
    setProjectActionsOpen(false)
    const copy = duplicateProject(project)
    setLibrary((current) => ({ activeProjectId: copy.id, projects: [copy, ...current.projects] }))
    setActivePath(copy.files[0].path)
    setShowArchived(false)
    setMobileTab('code')
    setNotice('Project duplicated.')
  }

  const confirmProjectAction = () => {
    if (confirmAction === 'archive') archiveProject()
    if (confirmAction === 'delete') removeProject(project.id)
    if (confirmAction === 'checkpoint' && pendingCheckpoint) restoreCheckpoint(pendingCheckpoint)
    setConfirmAction(null)
    setPendingCheckpoint(null)
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

  const runFromMobileCode = () => {
    setMobileTab('output')
    if (project.kind !== 'web') window.setTimeout(() => window.dispatchEvent(new CustomEvent('hafa-code-run-active-project')), 0)
  }

  const requestRestoreCheckpoint = (checkpoint: ProjectCheckpoint) => {
    setPendingCheckpoint(checkpoint)
    setConfirmAction('checkpoint')
  }

  const saveCheckpoint = async () => {
    const title = `Checkpoint ${formatCheckpointTime(new Date().toISOString())}`
    let cloudCheckpointError = ''

    if (isSignedIn && isCloudProjectId(project.id)) {
      const res = await api.createCheckpoint(project.id, title)
      if (res.data) {
        setCheckpoints((current) => [res.data!, ...current].slice(0, 30))
        setNotice('Checkpoint saved to cloud.')
        return
      }
      cloudCheckpointError = res.error || 'unknown error'
    }

    const checkpoint = createLocalCheckpoint(project, title)
    setCheckpoints((current) => [checkpoint, ...current].slice(0, 30))
    setNotice(cloudCheckpointError
      ? `Cloud checkpoint failed: ${cloudCheckpointError}. Saved locally instead.`
      : 'Checkpoint saved locally.')
  }

  const restoreCheckpoint = async (checkpoint: ProjectCheckpoint) => {
    if (isSignedIn && isCloudProjectId(project.id) && isCloudProjectId(checkpoint.id)) {
      const res = await api.restoreCheckpoint(project.id, checkpoint.id)
      if (res.data) {
        setLibrary((current) => ({
          activeProjectId: res.data!.id,
          projects: current.projects.map((candidate) => candidate.id === res.data!.id ? res.data! : candidate),
        }))
        setActivePath(res.data.files[0].path)
        setMobileTab('code')
        setNotice(`Restored ${checkpoint.title}.`)
        return
      }
      setNotice(`Restore failed: ${res.error || 'unknown error'}`)
      return
    }

    if (!checkpoint.snapshot) {
      setNotice('This checkpoint can only be restored from cloud.')
      return
    }

    const restored = snapshotToProject(project, checkpoint.snapshot)
    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((candidate) => candidate.id === project.id ? restored : candidate),
    }))
    setActivePath(restored.files[0].path)
    setMobileTab('code')
    setNotice(`Restored ${checkpoint.title}.`)
  }

  const copyShareLink = async () => {
    const share = await api.createShare(project)
    const url = share.data
      ? `${window.location.origin}${window.location.pathname}#share=${share.data.token}`
      : `${window.location.origin}${window.location.pathname}#project=${encodeProjectForShare(project)}`
    const didCopy = await writeClipboardText(url)
    if (!didCopy) {
      window.prompt('Copy this share link:', url)
    }
    if (share.data) {
      setNotice(didCopy ? 'Share snapshot link copied.' : 'Clipboard was blocked, so I opened a copyable share link.')
    } else {
      setNotice(didCopy
        ? `Offline share link copied.${share.error ? ` Server share failed: ${share.error}` : ''}`
        : 'Clipboard was blocked, so I opened a copyable share link.')
    }
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const imported = parseImportedProject(await file.text())
      setLibrary((current) => ({ activeProjectId: imported.id, projects: [imported, ...current.projects] }))
      setActivePath(imported.files[0].path)
      setShowArchived(false)
      setNotice('Project imported.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <main className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${editorExpanded ? 'editor-expanded' : ''} mobile-tab-${mobileTab}`}>
      <header className="hero panel hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Open-source coding playground</p>
          <h1>Hafa Code</h1>
          <p className="lede">A tiny Replit alternative for CSG and FD students: Ruby, JavaScript, and HTML/CSS/JS in the browser.</p>
          <div className="trust-row" aria-label="Platform guardrails">
            <span><ShieldCheck size={15} /> Browser-sandboxed</span>
            <span><Rocket size={15} /> No setup</span>
            <span><BookOpen size={15} /> Beginner-first</span>
          </div>
        </div>
        <div className="hero-card" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-card-inner">
            <Layers3 size={26} />
            <strong>{activeProjects.length}</strong>
            <span>{isSignedIn ? 'active cloud projects' : 'active local projects'}</span>
          </div>
        </div>
        <div className="hero-actions desktop-hero-actions">
          <AuthControls cloudEnabled={cloudEnabled} />
          <button className="secondary" onClick={() => exportProject(project)}><Download size={16} /> Export</button>
          <button className="secondary" onClick={() => importInputRef.current?.click()}><Import size={16} /> Import</button>
          <button onClick={copyShareLink}><Copy size={16} /> Share</button>
          <input ref={importInputRef} hidden type="file" accept="application/json,.json" onChange={(event) => handleImportFile(event.target.files?.[0])} />
        </div>
        <details className="mobile-actions-menu">
          <summary>
            <span>Sync and share</span>
            <strong>{isSignedIn ? 'Cloud on' : 'Local only'}</strong>
          </summary>
          <div className="mobile-actions-content">
            <AuthControls cloudEnabled={cloudEnabled} />
            <button className="secondary" onClick={() => exportProject(project)}><Download size={16} /> Export</button>
            <button className="secondary" onClick={() => importInputRef.current?.click()}><Import size={16} /> Import</button>
            <button onClick={copyShareLink}><Copy size={16} /> Share</button>
          </div>
        </details>
      </header>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button className="ghost" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}

      <section className="mobile-home-panel panel surface-grid">
        <div>
          <p className="eyebrow">Welcome</p>
          <h2>Start building in the browser</h2>
          <p className="helper-text">
            Pick up {project.title || 'your project'}, create something new, or jump straight into the runner.
          </p>
        </div>
        <div className="mobile-home-stats" aria-label="Project summary">
          <span><strong>{activeProjects.length}</strong> active</span>
          <span><strong>{archivedProjects.length}</strong> archived</span>
          <span><strong>{checkpoints.length}</strong> checkpoints</span>
        </div>
        <div className="mobile-home-create" aria-label="Create new project">
          {(['ruby', 'javascript', 'web'] as ProjectKind[]).map((kind) => (
            <button key={kind} className="secondary compact" onClick={() => addProject(kind)}>
              <Plus size={14} /> {kind === 'javascript' ? 'JS' : kind === 'web' ? 'Web' : 'Ruby'}
            </button>
          ))}
        </div>
        <div className="mobile-home-actions">
          <button type="button" onClick={() => setMobileTab('code')}><BookOpen size={16} /> Continue coding</button>
          <button className="secondary" type="button" onClick={runFromMobileCode}>
            {project.kind === 'web' ? <Globe size={16} /> : <Play size={16} />}
            {project.kind === 'web' ? 'Open preview' : 'Run project'}
          </button>
          <button className="secondary" type="button" onClick={() => setMobileTab('projects')}><Files size={16} /> Projects</button>
        </div>
      </section>

      <div className="layout-grid">
        <aside className="panel project-sidebar surface-grid">
          <div className="sidebar-header">
            <h2><Files size={18} /> Projects</h2>
            <div className="sidebar-tools">
              <span>{showArchived ? archivedProjects.length : activeProjects.length}</span>
              <button
                className="ghost icon-button desktop-only"
                type="button"
                aria-label="Collapse project sidebar"
                onClick={() => setSidebarCollapsed(true)}
              >
                <PanelLeftClose size={17} />
              </button>
            </div>
          </div>
          <button
            className="ghost collapsed-sidebar-button"
            type="button"
            aria-label="Expand project sidebar"
            onClick={() => setSidebarCollapsed(false)}
          >
            <PanelLeftOpen size={18} />
          </button>
          <details className="mobile-project-menu" open={mobileTab === 'projects' ? true : undefined}>
            <summary>
              <span>{project.title || 'Untitled Project'}</span>
              <small>{showArchived ? `${archivedProjects.length} archived` : `${activeProjects.length} active`}</small>
            </summary>
            <div className="mobile-project-content">
              <div className="project-view-toggle" aria-label="Project view">
                <button className={!showArchived ? 'active' : ''} type="button" onClick={() => setShowArchived(false)}>
                  Active <span>{activeProjects.length}</span>
                </button>
                <button className={showArchived ? 'active' : ''} type="button" onClick={() => setShowArchived(true)}>
                  Archived <span>{archivedProjects.length}</span>
                </button>
              </div>
              <div className="new-project-grid">
                {(['ruby', 'javascript', 'web'] as ProjectKind[]).map((kind) => (
                  <button key={kind} className="secondary compact" onClick={() => addProject(kind)}>
                    <Plus size={14} /> {kind === 'javascript' ? 'JS' : kind === 'web' ? 'Web' : 'Ruby'}
                  </button>
                ))}
              </div>
              <div className="project-list">
                {visibleProjects.length === 0 && (
                  <p className="empty-project-list">{showArchived ? 'No archived projects yet.' : 'No active projects yet.'}</p>
                )}
                {visibleProjects.map((candidate) => (
                  <button
                    key={candidate.id}
                    className={`project-card ${candidate.id === project.id ? 'active' : ''}`}
                    onClick={() => setActiveProject(candidate.id)}
                  >
                    <span>{candidate.title || 'Untitled Project'}</span>
                    <small>{kindLabels[candidate.kind]}</small>
                  </button>
                ))}
              </div>
            </div>
          </details>
          <div className="sidebar-content">
            <p className="sidebar-note">{isSignedIn ? `Signed in${user?.full_name ? ` as ${user.full_name}` : ''}. Projects sync to your account.` : 'Everything is private to this browser until you export, share, or sign in.'}</p>
            <div className="project-view-toggle" aria-label="Project view">
              <button className={!showArchived ? 'active' : ''} type="button" onClick={() => setShowArchived(false)}>
                Active <span>{activeProjects.length}</span>
              </button>
              <button className={showArchived ? 'active' : ''} type="button" onClick={() => setShowArchived(true)}>
                Archived <span>{archivedProjects.length}</span>
              </button>
            </div>
          <div className="new-project-grid">
            {(['ruby', 'javascript', 'web'] as ProjectKind[]).map((kind) => (
              <button key={kind} className="secondary compact" onClick={() => addProject(kind)}>
                <Plus size={14} /> {kind === 'javascript' ? 'JS' : kind === 'web' ? 'Web' : 'Ruby'}
              </button>
            ))}
          </div>
          <div className="project-list">
            {visibleProjects.length === 0 && (
              <p className="empty-project-list">{showArchived ? 'No archived projects yet.' : 'No active projects yet.'}</p>
            )}
            {visibleProjects.map((candidate) => (
              <button
                key={candidate.id}
                className={`project-card ${candidate.id === project.id ? 'active' : ''}`}
                onClick={() => setActiveProject(candidate.id)}
              >
                <span>{candidate.title || 'Untitled Project'}</span>
                <small>{kindLabels[candidate.kind]}</small>
              </button>
            ))}
          </div>
          </div>
        </aside>

        <section className="main-workspace">
          <div className="project-toolbar panel surface-grid">
            <div className="title-field">
              <label htmlFor="project-title">Project name</label>
              <input id="project-title" value={project.title} onChange={(event) => renameProject(event.target.value)} />
              <small>
                {isSignedIn ? 'Autosaved to cloud + local backup' : 'Autosaved locally'}
                {isArchived(project) ? ' · archived' : ''}
                {' · updated '}
                {formatUpdatedAt(project.updatedAt)}
              </small>
            </div>
            <div className="toolbar-actions">
              {isArchived(project) ? (
                <button className="secondary" onClick={restoreProject}><RotateCcw size={16} /> Restore</button>
              ) : (
                <button className="secondary" onClick={requestArchiveProject} disabled={activeProjects.length <= 1}><Archive size={16} /> Archive</button>
              )}
              <button className="secondary" onClick={cloneProject}><Copy size={16} /> Duplicate</button>
              <button className="danger" onClick={requestDeleteProject}><Trash2 size={16} /> Delete</button>
            </div>
          <button className="secondary mobile-project-actions-button" onClick={() => setProjectActionsOpen(true)}>
            <MoreHorizontal size={16} /> Actions
          </button>
          </div>

          <section className="history-panel panel surface-grid" aria-label="Project checkpoints">
            <div className="history-header">
              <div>
                <p className="eyebrow">History</p>
                <h2><History size={17} /> Checkpoints</h2>
              </div>
              <button className="secondary compact" type="button" onClick={saveCheckpoint}>
                <Save size={14} /> Save checkpoint
              </button>
            </div>
            <div className="checkpoint-list">
              {checkpoints.length === 0 ? (
                <p className="empty-project-list">No checkpoints yet.</p>
              ) : checkpoints.slice(0, 5).map((checkpoint) => (
                <button
                  key={checkpoint.id}
                  className="checkpoint-card secondary"
                  type="button"
                  onClick={() => requestRestoreCheckpoint(checkpoint)}
                  title={`Restore ${checkpoint.title}`}
                >
                  <span>{checkpoint.title}</span>
                  <small>{formatCheckpointTime(checkpoint.createdAt)}</small>
                </button>
              ))}
            </div>
          </section>

          <div className="workspace">
            <section className="panel editor-panel">
              <div className="file-tabs">
                <div className="file-tab-list">
                  {project.files.map((file) => (
                    <button key={file.path} className={file.path === activeFile.path ? 'active' : ''} onClick={() => setActivePath(file.path)}>
                      {file.path}
                    </button>
                  ))}
                </div>
                <button
                  className="ghost icon-button editor-focus-button"
                  type="button"
                  aria-label={editorExpanded ? 'Exit editor focus mode' : 'Expand code editor'}
                  title={editorExpanded ? 'Exit focus' : 'Focus editor'}
                  onClick={() => setEditorExpanded((current) => !current)}
                >
                  {editorExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </button>
              </div>
              <div className="mobile-code-runbar">
                <button type="button" onClick={runFromMobileCode} disabled={project.kind !== 'web' && !activeFile.content.trim()}>
                  {project.kind === 'web' ? <Globe size={16} /> : <Play size={16} />}
                  {project.kind === 'web' ? 'Open preview' : `Run ${project.kind === 'ruby' ? 'Ruby' : 'JS'}`}
                </button>
              </div>
              <MonacoEditor
                height="var(--workspace-pane-height)"
                language={languageForFile(activeFile)}
                theme="vs-dark"
                value={activeFile.content}
                loading={<div className="editor-loading"><Loader2 className="spin" size={20} /> Loading editor...</div>}
                onChange={(value) => updateActiveFile(value ?? '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  tabSize: 2,
                  insertSpaces: true,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 16, bottom: 16 },
                }}
              />
            </section>

            {project.kind === 'web' ? <WebPreview files={project.files} /> : <RunnerPanel key={`${project.id}:${activeFile.path}`} project={project} activeFile={activeFile} />}
          </div>
        </section>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Workspace sections">
        <button className={mobileTab === 'home' ? 'active' : ''} type="button" onClick={() => setMobileTab('home')}>
          <Layers3 size={18} />
          <span>Home</span>
        </button>
        <button className={mobileTab === 'projects' ? 'active' : ''} type="button" onClick={() => setMobileTab('projects')}>
          <Files size={18} />
          <span>Projects</span>
        </button>
        <button className={mobileTab === 'code' ? 'active' : ''} type="button" onClick={() => setMobileTab('code')}>
          <BookOpen size={18} />
          <span>Code</span>
        </button>
        <button className={mobileTab === 'output' ? 'active' : ''} type="button" onClick={() => setMobileTab('output')}>
          {project.kind === 'web' ? <Globe size={18} /> : <Terminal size={18} />}
          <span>{project.kind === 'web' ? 'Preview' : 'Output'}</span>
        </button>
        <button className={mobileTab === 'history' ? 'active' : ''} type="button" onClick={() => setMobileTab('history')}>
          <History size={18} />
          <span>History</span>
        </button>
      </nav>

      {projectActionsOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setProjectActionsOpen(false)}>
          <section className="modal-sheet project-actions-sheet" role="dialog" aria-modal="true" aria-labelledby="project-actions-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Project</p>
                <h2 id="project-actions-title">Actions</h2>
              </div>
              <button className="ghost icon-button" aria-label="Close project actions" onClick={() => setProjectActionsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-action-grid">
              {isArchived(project) ? (
                <button className="secondary" onClick={() => {
                  setProjectActionsOpen(false)
                  restoreProject()
                }}><RotateCcw size={16} /> Restore</button>
              ) : (
                <button className="secondary" onClick={requestArchiveProject} disabled={activeProjects.length <= 1}><Archive size={16} /> Archive</button>
              )}
              <button className="secondary" onClick={cloneProject}><Copy size={16} /> Duplicate</button>
              <button className="danger" onClick={requestDeleteProject}><Trash2 size={16} /> Delete</button>
            </div>
          </section>
        </div>
      )}

      {confirmAction && (
        <div className="modal-backdrop" role="presentation" onClick={() => {
          setConfirmAction(null)
          setPendingCheckpoint(null)
        }}>
          <section className="modal-sheet confirm-sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">{confirmAction === 'delete' ? 'Delete project' : confirmAction === 'checkpoint' ? 'Restore checkpoint' : 'Archive project'}</p>
                <h2 id="confirm-title">
                  {confirmAction === 'delete' ? 'Delete this project?' : confirmAction === 'checkpoint' ? 'Restore this checkpoint?' : 'Archive this project?'}
                </h2>
              </div>
              <button className="ghost icon-button" aria-label="Cancel" onClick={() => {
                setConfirmAction(null)
                setPendingCheckpoint(null)
              }}>
                <X size={18} />
              </button>
            </div>
            <p id="confirm-description" className="confirm-copy">
              {confirmAction === 'delete'
                ? `"${project.title || 'Untitled Project'}" will be removed from this browser${isSignedIn && isCloudProjectId(project.id) ? ' and your cloud account' : ''}.`
                : confirmAction === 'checkpoint'
                  ? `Your current code will be replaced with "${pendingCheckpoint?.title || 'this checkpoint'}". Save a checkpoint first if you want to keep the current version.`
                : `"${project.title || 'Untitled Project'}" will move out of your active project list. You can restore it from Archived.`}
            </p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => {
                setConfirmAction(null)
                setPendingCheckpoint(null)
              }}>Cancel</button>
              <button className={confirmAction === 'delete' ? 'danger' : ''} onClick={confirmProjectAction}>
                {confirmAction === 'delete' ? <Trash2 size={16} /> : confirmAction === 'checkpoint' ? <RotateCcw size={16} /> : <Archive size={16} />}
                {confirmAction === 'delete' ? 'Delete project' : confirmAction === 'checkpoint' ? 'Restore checkpoint' : 'Archive project'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
