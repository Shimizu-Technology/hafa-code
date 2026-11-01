import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, BookOpen, Check, Download, Dumbbell, FlaskConical, Play, Plus, Square, TerminalSquare, Trash2, Upload } from 'lucide-react'
import { assessEnvironment, readEnvironment, type LabReadiness } from './capability'
import { RUST_CHALLENGES, challengeById, outputMatches, type RustChallenge } from './challenges'
import { parseDiagnostics, primarySpan, type ParsedDiagnostics } from './diagnostics'
import { coachCompileError, coachPanic, type RustCoaching } from './errorCoach'
import { RUST_GUIDE, guideTopic, type RustGuideTopicId } from './guide'
import { RustEditor, type RustEditorHandle } from './RustEditor'
import { RustToolchain, ToolchainError, runProgram, type ProgramResult, type RunningProgram, type ToolchainProgress } from './rustLabClient'
import {
  MAX_PROJECTS, MAX_SOURCE_BYTES, ProjectImportError, cleanTitle, createProject, exportFileName, exportProject, importProject, loadState, saveState,
  type RustLabProject, type RustLabState,
} from './storage'
import {
  TOOLCHAIN, TOOLCHAIN_DOWNLOAD_BYTES, formatMegabytes, removeToolchainDownload, toolchainCacheState, type ToolchainCacheState,
} from './toolchain'

type ToolchainStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; progress: ToolchainProgress | null }
  | { kind: 'ready'; fromCache: boolean; durationMs: number }
  | { kind: 'failed'; message: string }

type RunPhase = 'idle' | 'needs-consent' | 'loading' | 'compiling' | 'running'

type OutputLine = { stream: 'stdout' | 'stderr' | 'system'; text: string }

interface RunReport {
  kind: 'compile-error' | 'compiler-crashed' | 'finished' | 'stopped'
  diagnostics: ParsedDiagnostics | null
  coaching: RustCoaching | null
  program: ProgramResult | null
  compileMs: number | null
  challenge: { id: string; passed: boolean } | null
}

type SideTab = 'output' | 'guide' | 'practice'

const PHASE_LABEL: Record<ToolchainProgress['phase'], string> = {
  downloading: 'Downloading the compiler',
  unpacking: 'Unpacking rustc and the standard library',
  starting: 'Starting rustc',
}

function useResolvedTheme() {
  const query = '(prefers-color-scheme: dark)'
  const read = () => {
    let preference = 'system'
    try {
      preference = localStorage.getItem('hafa-code-theme-v1') ?? 'system'
    } catch {
      // Storage may be unavailable; follow the system.
    }
    return preference === 'dark' || (preference !== 'light' && window.matchMedia?.(query).matches) ? 'dark' : 'light'
  }
  const [theme, setTheme] = useState<'light' | 'dark'>(read)
  useEffect(() => {
    const media = window.matchMedia?.(query)
    const update = () => setTheme(read())
    media?.addEventListener('change', update)
    window.addEventListener('storage', update)
    return () => {
      media?.removeEventListener('change', update)
      window.removeEventListener('storage', update)
    }
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      if (localStorage.getItem('hafa-code-color-mode-v1') === 'colorblind') document.documentElement.dataset.colorMode = 'colorblind'
    } catch {
      // Ignore.
    }
  }, [theme])
  return theme
}

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function ExperimentalBanner() {
  return (
    <aside className="lab-banner" aria-label="About this experiment">
      <FlaskConical size={18} aria-hidden="true" />
      <p>
        <strong>Experimental.</strong> Rust compiles inside your browser after a one-time {formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)} download.
        It needs a desktop browser (Chrome or Edge work best), uses a lot of memory, and may be slow or stop working.
        Projects are saved only in this browser, so export anything you want to keep.
      </p>
    </aside>
  )
}

function LabHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="lab-header">
      <a className="lab-back" href="/"><ArrowLeft size={16} aria-hidden="true" /> Hafa Code</a>
      <h1 className="lab-title">Rust Lab <span className="lab-badge">Experimental</span></h1>
      <div className="lab-header-actions">{children}</div>
    </header>
  )
}

function GatePanel({ readiness, onContinue }: { readiness: Exclude<LabReadiness, { status: 'ready' }>; onContinue: () => void }) {
  if (readiness.status === 'unsupported') {
    return (
      <section className="lab-gate" aria-labelledby="gate-heading">
        <h2 id="gate-heading">This browser cannot run the Rust Lab</h2>
        <p>The in-browser Rust compiler needs features this browser or page is missing:</p>
        <ul>{readiness.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        <p>Open this page in a current desktop version of Chrome or Edge. Nothing was downloaded.</p>
        <a className="lab-button primary" href="/">Back to Hafa Code</a>
      </section>
    )
  }
  return (
    <section className="lab-gate" aria-labelledby="gate-heading">
      <h2 id="gate-heading">The Rust Lab is for desktop browsers</h2>
      <p>
        Compiling Rust here downloads {formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)} and needs about 1.5 GB of memory, which phones and
        tablets usually cannot spare. Nothing was downloaded.
      </p>
      <ul>{readiness.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      <p>Hafa Code's Ruby, JavaScript, Python, Java, and other languages work well on this device.</p>
      <div className="lab-gate-actions">
        <a className="lab-button primary" href="/">Back to Hafa Code</a>
        <button className="lab-button" type="button" onClick={onContinue}>Open the lab anyway</button>
      </div>
    </section>
  )
}

function ToolchainCard({
  status, cacheState, phase, onDownload, onRemove, onCancel,
}: {
  status: ToolchainStatus
  cacheState: ToolchainCacheState
  phase: RunPhase
  onDownload: () => void
  onRemove: () => void
  onCancel: () => void
}) {
  if (status.kind === 'loading') {
    const progress = status.progress
    const percent = progress && progress.totalBytes ? Math.min(100, Math.round((progress.loadedBytes / progress.totalBytes) * 100)) : 0
    return (
      <div className="lab-toolchain" role="status" aria-live="polite">
        <p className="lab-toolchain-title">{progress ? PHASE_LABEL[progress.phase] : 'Preparing the compiler'}…</p>
        {progress?.phase === 'downloading' && (
          <>
            <progress max={100} value={percent} aria-label="Compiler download progress">{percent}%</progress>
            <p className="lab-muted">{formatMegabytes(progress.loadedBytes)} of {formatMegabytes(progress.totalBytes)}</p>
          </>
        )}
        {progress && progress.phase !== 'downloading' && <p className="lab-muted">This takes a few seconds and uses a lot of memory.</p>}
        <button className="lab-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    )
  }
  if (status.kind === 'ready') {
    return (
      <div className="lab-toolchain compact" role="status">
        <p className="lab-muted">
          <Check size={14} aria-hidden="true" /> rustc {TOOLCHAIN.rustcVersion} ready
          ({status.fromCache ? 'from this browser' : 'downloaded'}, {(status.durationMs / 1000).toFixed(1)} s)
        </p>
      </div>
    )
  }
  if (status.kind === 'failed') {
    return (
      <div className="lab-toolchain error" role="alert">
        <p className="lab-toolchain-title">The compiler could not start</p>
        <p>{status.message}</p>
        <button className="lab-button primary" type="button" onClick={onDownload}>Try again</button>
      </div>
    )
  }
  if (cacheState === 'complete') {
    return (
      <div className="lab-toolchain compact">
        <p className="lab-muted">The compiler is saved in this browser and starts when you run.</p>
        <button className="lab-link-button" type="button" onClick={onRemove}>Remove download ({formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)})</button>
      </div>
    )
  }
  return (
    <div className={`lab-toolchain consent${phase === 'needs-consent' ? ' highlighted' : ''}`}>
      <p className="lab-toolchain-title">Download the Rust compiler to run code</p>
      <p>
        One-time download of {formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)} (rustc {TOOLCHAIN.rustcVersion} and the standard library).
        It is checked against pinned checksums and saved in this browser. Your code never leaves this computer.
      </p>
      <button className="lab-button primary" type="button" onClick={onDownload}>
        <Download size={16} aria-hidden="true" /> {phase === 'needs-consent' ? 'Download and run' : 'Download compiler'}
      </button>
      {cacheState === 'partial' && <p className="lab-muted">Part of it is already saved; only the rest downloads.</p>}
    </div>
  )
}

function CoachCard({ coaching, onOpenTopic }: { coaching: RustCoaching; onOpenTopic: (topic: RustGuideTopicId) => void }) {
  return (
    <section className="lab-coach" aria-labelledby="coach-heading">
      <p className="lab-eyebrow">Error coach</p>
      <h3 id="coach-heading">
        {coaching.code && <span className="lab-code-badge">{coaching.code}</span>} {coaching.title}
      </h3>
      {(coaching.location || coaching.detail) && (
        <p className="lab-coach-detail">
          {coaching.location && <strong>{coaching.location}: </strong>}
          {coaching.detail && <code>{coaching.detail}</code>}
        </p>
      )}
      <p>{coaching.explanation}</p>
      <ol>{coaching.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <div className="lab-coach-links">
        {coaching.topic && (
          <button className="lab-link-button" type="button" onClick={() => onOpenTopic(coaching.topic!)}>
            <BookOpen size={14} aria-hidden="true" /> Guide: {guideTopic(coaching.topic).title}
          </button>
        )}
        {coaching.docsUrl && (
          <a href={coaching.docsUrl} target="_blank" rel="noreferrer noopener">rustc's explanation of {coaching.code}</a>
        )}
      </div>
    </section>
  )
}

export function RustLab() {
  const theme = useResolvedTheme()
  const readiness = useMemo(() => assessEnvironment(readEnvironment()), [])
  const [continueAnyway, setContinueAnyway] = useState(false)
  const [state, setState] = useState<RustLabState>(() => loadState())
  const [saveFailed] = useState(() => !saveState(loadState()))
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<SideTab>('output')
  const [openTopic, setOpenTopic] = useState<RustGuideTopicId | null>('variables')
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(RUST_CHALLENGES[0].id)
  const [toolchainStatus, setToolchainStatus] = useState<ToolchainStatus>({ kind: 'idle' })
  const [cacheState, setCacheState] = useState<ToolchainCacheState>('none')
  const [phase, setPhase] = useState<RunPhase>('idle')
  const [output, setOutput] = useState<OutputLine[]>([])
  const [report, setReport] = useState<RunReport | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const toolchainRef = useRef<RustToolchain | null>(null)
  const programRef = useRef<RunningProgram | null>(null)
  const editorRef = useRef<RustEditorHandle | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId) ?? state.projects[0]
  const activeChallenge = project.challengeId ? challengeById(project.challengeId) : null
  const busy = phase === 'loading' || phase === 'compiling' || phase === 'running'

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    void toolchainCacheState().then(setCacheState)
    return () => {
      programRef.current?.stop()
      toolchainRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    if (import.meta.env.MODE !== 'e2e') return
    const testWindow = window as Window & { __HAFA_RUST_LAB__?: { setSource: (source: string) => void } }
    testWindow.__HAFA_RUST_LAB__ = {
      setSource: (source) => setState((current) => ({
        ...current,
        projects: current.projects.map((candidate) => candidate.id === current.activeProjectId ? { ...candidate, source, updatedAt: new Date().toISOString() } : candidate),
      })),
    }
  }, [])

  const updateProject = useCallback((changes: Partial<RustLabProject>) => {
    setState((current) => ({
      ...current,
      projects: current.projects.map((candidate) => candidate.id === current.activeProjectId
        ? { ...candidate, ...changes, updatedAt: new Date().toISOString() }
        : candidate),
    }))
  }, [])

  const addProject = useCallback((next: RustLabProject, message?: string) => {
    setState((current) => {
      if (current.projects.length >= MAX_PROJECTS) {
        setNotice(`The Rust Lab keeps up to ${MAX_PROJECTS} projects. Delete one to add another.`)
        return current
      }
      if (message) setNotice(message)
      return { ...current, activeProjectId: next.id, projects: [next, ...current.projects] }
    })
    setReport(null)
    setOutput([])
  }, [])

  const appendOutput = useCallback((stream: OutputLine['stream'], text: string) => {
    setOutput((current) => {
      const last = current[current.length - 1]
      if (last && last.stream === stream) return [...current.slice(0, -1), { stream, text: last.text + text }]
      return [...current, { stream, text }]
    })
  }, [])

  const loadToolchain = useCallback(async () => {
    const toolchain = toolchainRef.current ?? new RustToolchain()
    toolchainRef.current = toolchain
    setToolchainStatus({ kind: 'loading', progress: null })
    try {
      const result = await toolchain.load((progress) => setToolchainStatus({ kind: 'loading', progress }))
      setToolchainStatus({ kind: 'ready', ...result })
      setCacheState('complete')
      return true
    } catch (error) {
      toolchain.dispose()
      const message = error instanceof ToolchainError && error.integrity
        ? `${error.message} Try again later; if this keeps happening, the lab's files may be out of date.`
        : error instanceof Error ? error.message : String(error)
      setToolchainStatus(message === 'The compiler was stopped.' ? { kind: 'idle' } : { kind: 'failed', message })
      void toolchainCacheState().then(setCacheState)
      return false
    }
  }, [])

  const run = useCallback(async (consented = false) => {
    if (busy) return
    setTab('output')
    const toolchain = toolchainRef.current
    if (!toolchain?.loaded || toolchainStatus.kind !== 'ready') {
      if (cacheState !== 'complete' && !consented) {
        setPhase('needs-consent')
        setAnnouncement(`Download the ${formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)} Rust compiler to run code.`)
        return
      }
      setPhase('loading')
      setAnnouncement('Loading the Rust compiler.')
      if (!(await loadToolchain())) {
        setPhase('idle')
        setAnnouncement('The Rust compiler could not start.')
        return
      }
    }
    const source = project.source
    const challenge = activeChallenge
    setOutput([])
    setReport(null)
    setPhase('compiling')
    setAnnouncement('Compiling main.rs.')
    let compiled
    try {
      compiled = await toolchainRef.current!.compile(source)
    } catch (error) {
      toolchainRef.current?.dispose()
      setToolchainStatus({ kind: 'idle' })
      const stopped = error instanceof Error && error.message === 'The compiler was stopped.'
      appendOutput('system', stopped ? 'Compiling stopped. The compiler restarts on the next run.' : (error instanceof Error ? error.message : String(error)))
      setReport({ kind: stopped ? 'stopped' : 'compiler-crashed', diagnostics: null, coaching: null, program: null, compileMs: null, challenge: null })
      setPhase('idle')
      setAnnouncement(stopped ? 'Compiling stopped.' : 'The compiler stopped unexpectedly.')
      return
    }
    const diagnostics = parseDiagnostics(compiled.diagnostics)
    if (!compiled.wasm) {
      const crashed = compiled.crashed
      if (crashed) {
        toolchainRef.current?.dispose()
        setToolchainStatus({ kind: 'idle' })
      }
      setReport({
        kind: crashed ? 'compiler-crashed' : 'compile-error',
        diagnostics,
        coaching: crashed ? null : coachCompileError(diagnostics.diagnostics),
        program: null,
        compileMs: compiled.durationMs,
        challenge: challenge ? { id: challenge.id, passed: false } : null,
      })
      setPhase('idle')
      setAnnouncement(crashed
        ? 'The compiler crashed. It restarts on the next run.'
        : `Compile failed with ${diagnostics.errorCount} ${diagnostics.errorCount === 1 ? 'error' : 'errors'}.`)
      return
    }
    setPhase('running')
    setAnnouncement('Running.')
    let stdout = ''
    let stderr = ''
    const program = runProgram(compiled.wasm, project.stdin, (stream, text) => {
      if (stream === 'stdout') stdout += text
      else stderr += text
      appendOutput(stream, text)
    })
    programRef.current = program
    const result = await program.done
    programRef.current = null
    const passed = challenge ? !result.panicked && !result.timedOut && !result.stopped && result.exitCode === 0 && outputMatches(stdout, challenge.expectedOutput) : false
    if (challenge && passed) {
      setState((current) => current.completedChallenges.includes(challenge.id)
        ? current
        : { ...current, completedChallenges: [...current.completedChallenges, challenge.id] })
    }
    setReport({
      kind: result.stopped ? 'stopped' : 'finished',
      diagnostics,
      coaching: result.panicked ? coachPanic(stderr) : null,
      program: result,
      compileMs: compiled.durationMs,
      challenge: challenge && !result.stopped ? { id: challenge.id, passed } : null,
    })
    setPhase('idle')
    setAnnouncement(result.stopped ? 'Stopped.' : result.timedOut ? 'Stopped after the time limit.' : result.panicked ? 'The program panicked.' : challenge ? (passed ? 'Challenge passed.' : 'Challenge not passed yet.') : 'Finished.')
  }, [activeChallenge, appendOutput, busy, cacheState, loadToolchain, project.source, project.stdin, toolchainStatus.kind])

  const stop = useCallback(() => {
    if (phase === 'running') programRef.current?.stop()
    else if (phase === 'compiling' || phase === 'loading') {
      toolchainRef.current?.dispose()
      setToolchainStatus({ kind: 'idle' })
      if (phase === 'loading') {
        setPhase('idle')
        setAnnouncement('Download cancelled.')
      }
    }
  }, [phase])

  const runRef = useRef(run)
  useEffect(() => { runRef.current = run }, [run])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void runRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const downloadFromCard = async () => {
    if (phase === 'needs-consent') {
      await run(true)
      return
    }
    setPhase('loading')
    await loadToolchain()
    setPhase('idle')
  }

  const removeDownload = async () => {
    toolchainRef.current?.dispose()
    setToolchainStatus({ kind: 'idle' })
    await removeToolchainDownload()
    setCacheState(await toolchainCacheState())
    setNotice('Removed the saved compiler from this browser.')
  }

  const startChallenge = (challenge: RustChallenge) => {
    const existing = state.projects.find((candidate) => candidate.challengeId === challenge.id)
    if (existing) {
      setState((current) => ({ ...current, activeProjectId: existing.id }))
      setReport(null)
      setOutput([])
      setNotice(`Opened your "${existing.title}" project.`)
      return
    }
    addProject(createProject({ title: `Challenge: ${challenge.title}`, source: challenge.starter, challengeId: challenge.id }), `Started "${challenge.title}". Run your code to check it.`)
  }

  const deleteProject = () => {
    if (!window.confirm(`Delete "${project.title}" from this browser? This cannot be undone.`)) return
    setState((current) => {
      const remaining = current.projects.filter((candidate) => candidate.id !== current.activeProjectId)
      const projects = remaining.length ? remaining : [createProject()]
      return { ...current, projects, activeProjectId: projects[0].id }
    })
    setReport(null)
    setOutput([])
    setNotice(`Deleted "${project.title}".`)
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      if (file.size > MAX_SOURCE_BYTES * 2) throw new ProjectImportError('That file is too large for the Rust Lab.')
      addProject(importProject(file.name, await file.text()), `Imported "${file.name}".`)
    } catch (error) {
      setNotice(error instanceof ProjectImportError ? error.message : 'That file could not be imported.')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const openTopicInGuide = (topic: RustGuideTopicId) => {
    setOpenTopic(topic)
    setTab('guide')
  }

  if (readiness.status !== 'ready' && !continueAnyway) {
    return (
      <div className="lab-shell">
        <LabHeader />
        <main className="lab-gate-main">
          <ExperimentalBanner />
          <GatePanel readiness={readiness} onContinue={() => setContinueAnyway(true)} />
        </main>
      </div>
    )
  }

  const errors = report?.diagnostics?.diagnostics.filter((diagnostic) => diagnostic.level === 'error') ?? []
  const editorTheme = theme === 'dark' ? 'hafa-dark' : 'hafa-light'
  const runLabel = phase === 'loading' ? 'Loading…' : phase === 'compiling' ? 'Compiling…' : phase === 'running' ? 'Running…' : 'Run'

  return (
    <div className="lab-shell">
      <LabHeader>
        <label className="sr-only" htmlFor="lab-project-select">Project</label>
        <select
          id="lab-project-select"
          className="lab-select"
          value={project.id}
          disabled={busy}
          onChange={(event) => {
            setState((current) => ({ ...current, activeProjectId: event.target.value }))
            setReport(null)
            setOutput([])
          }}
        >
          {state.projects.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
        </select>
        <button className="lab-button" type="button" disabled={busy} onClick={() => addProject(createProject(), 'Created a new project.')}>
          <Plus size={16} aria-hidden="true" /> New
        </button>
        <button className="lab-button" type="button" disabled={busy} onClick={() => importInputRef.current?.click()}>
          <Upload size={16} aria-hidden="true" /> Import
        </button>
        <input ref={importInputRef} className="sr-only" type="file" accept=".json,.rs,application/json" tabIndex={-1} aria-hidden="true" onChange={(event) => void onImport(event.target.files?.[0])} />
        <button className="lab-button" type="button" onClick={() => downloadText(exportFileName(project), exportProject(project))}>
          <Download size={16} aria-hidden="true" /> Export
        </button>
      </LabHeader>
      <ExperimentalBanner />
      {readiness.status === 'ready' && readiness.warnings.map((warning) => <p key={warning} className="lab-warning">{warning}</p>)}
      {(notice || saveFailed) && (
        <p className="lab-notice" role="status">
          {saveFailed ? 'This browser is not saving Rust Lab projects (storage is full or blocked). Export your work to keep it.' : notice}
          {notice && !saveFailed && <button className="lab-link-button" type="button" onClick={() => setNotice(null)}>Dismiss</button>}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <main className="lab-main">
        <section className="lab-editor-panel" aria-labelledby="lab-editor-heading">
          <div className="lab-panel-bar">
            <div className="lab-file">
              <h2 id="lab-editor-heading" className="sr-only">Editor</h2>
              <label className="sr-only" htmlFor="lab-project-title">Project name</label>
              <input
                id="lab-project-title"
                className="lab-title-input"
                value={project.title}
                maxLength={80}
                onChange={(event) => updateProject({ title: event.target.value })}
                onBlur={(event) => updateProject({ title: cleanTitle(event.target.value) })}
              />
              <span className="lab-file-name">main.rs</span>
            </div>
            <div className="lab-run-controls">
              <button className="lab-button primary" type="button" onClick={() => void run()} disabled={busy} aria-keyshortcuts="Control+Enter Meta+Enter">
                <Play size={16} aria-hidden="true" /> {runLabel}
              </button>
              <button className="lab-button" type="button" onClick={stop} disabled={!busy}>
                <Square size={14} aria-hidden="true" /> Stop
              </button>
              <button className="lab-button icon" type="button" disabled={busy} onClick={deleteProject} aria-label={`Delete ${project.title}`} title="Delete project">
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          {activeChallenge && (
            <div className="lab-challenge-strip">
              <Dumbbell size={16} aria-hidden="true" />
              <p><strong>{activeChallenge.title}:</strong> {activeChallenge.prompt}</p>
            </div>
          )}
          <div className="lab-editor">
            <RustEditor
              value={project.source}
              theme={editorTheme}
              diagnostics={report?.diagnostics?.diagnostics ?? []}
              onChange={(source) => updateProject({ source })}
              onRun={() => void run()}
              onReady={(handle) => { editorRef.current = handle }}
            />
          </div>
          <details className="lab-stdin">
            <summary>Program input (stdin){project.stdin ? ' · has input' : ''}</summary>
            <label htmlFor="lab-stdin-text" className="lab-muted">Text your program reads with std::io::stdin(), one line per read_line. It is fixed before the run starts.</label>
            <textarea
              id="lab-stdin-text"
              rows={3}
              value={project.stdin}
              spellCheck={false}
              onChange={(event) => updateProject({ stdin: event.target.value.slice(0, 20_000) })}
            />
          </details>
        </section>

        <section className="lab-side" aria-label="Output and learning tools">
          <div className="lab-tabs" role="tablist" aria-label="Rust Lab panels">
            {([
              ['output', 'Output', TerminalSquare],
              ['guide', 'Guide', BookOpen],
              ['practice', 'Practice', Dumbbell],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                id={`lab-tab-${id}`}
                role="tab"
                type="button"
                aria-selected={tab === id}
                aria-controls={`lab-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
                onKeyDown={(event) => {
                  const order: SideTab[] = ['output', 'guide', 'practice']
                  const index = order.indexOf(id)
                  const next = event.key === 'ArrowRight' ? order[(index + 1) % 3] : event.key === 'ArrowLeft' ? order[(index + 2) % 3] : null
                  if (!next) return
                  event.preventDefault()
                  setTab(next)
                  document.getElementById(`lab-tab-${next}`)?.focus()
                }}
              >
                <Icon size={16} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>

          {tab === 'output' && (
            <div className="lab-panel" id="lab-panel-output" role="tabpanel" aria-labelledby="lab-tab-output">
              <ToolchainCard
                status={toolchainStatus}
                cacheState={cacheState}
                phase={phase}
                onDownload={() => void downloadFromCard()}
                onRemove={() => void removeDownload()}
                onCancel={stop}
              />
              <RunSummary report={report} phase={phase} />
              {report?.challenge && activeChallenge && (
                <ChallengeResult challenge={activeChallenge} passed={report.challenge.passed} compiled={Boolean(report.program)} />
              )}
              {report?.coaching && <CoachCard coaching={report.coaching} onOpenTopic={openTopicInGuide} />}
              {errors.length > 0 && (
                <ul className="lab-error-list" aria-label="Compile errors">
                  {errors.map((diagnostic, index) => {
                    const span = primarySpan(diagnostic)
                    return (
                      <li key={`${diagnostic.code}-${index}`}>
                        <button className="lab-link-button" type="button" disabled={!span} onClick={() => span && editorRef.current?.focusLine(span.line, span.column)}>
                          error{diagnostic.code ? `[${diagnostic.code}]` : ''}{span ? ` on line ${span.line}` : ''}: {diagnostic.message}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="lab-terminal" aria-label="Program output and rustc messages" tabIndex={0}>
                {report?.diagnostics?.rendered && (
                  <pre className="lab-rustc-output" aria-label="rustc output">{report.diagnostics.rendered}</pre>
                )}
                {output.length > 0 ? (
                  <pre className="lab-program-output">
                    {output.map((line, index) => (
                      <span key={index} className={`stream-${line.stream}`}>{line.text}</span>
                    ))}
                  </pre>
                ) : !report && <p className="lab-terminal-empty">Program output appears here. Press Run or Ctrl+Enter.</p>}
              </div>
            </div>
          )}

          {tab === 'guide' && (
            <div className="lab-panel" id="lab-panel-guide" role="tabpanel" aria-labelledby="lab-tab-guide">
              <p className="lab-muted">Five short topics. Each example is a complete program you can open and run.</p>
              {RUST_GUIDE.map((topic) => (
                <section key={topic.id} className={`lab-topic${openTopic === topic.id ? ' open' : ''}`} aria-labelledby={`topic-${topic.id}`}>
                  <h3>
                    <button
                      id={`topic-${topic.id}`}
                      type="button"
                      className="lab-topic-toggle"
                      aria-expanded={openTopic === topic.id}
                      onClick={() => setOpenTopic(openTopic === topic.id ? null : topic.id)}
                    >
                      {topic.title}
                      <span className="lab-muted">{topic.summary}</span>
                    </button>
                  </h3>
                  {openTopic === topic.id && (
                    <div className="lab-topic-body">
                      <ul>{topic.points.map((point) => <li key={point}>{point}</li>)}</ul>
                      <pre className="lab-example"><code>{topic.example}</code></pre>
                      <button
                        className="lab-button"
                        type="button"
                        disabled={busy}
                        onClick={() => addProject(createProject({ title: `Example: ${topic.title}`, source: topic.example }), `Opened the "${topic.title}" example as a new project.`)}
                      >
                        Open as a new project
                      </button>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          {tab === 'practice' && (
            <div className="lab-panel" id="lab-panel-practice" role="tabpanel" aria-labelledby="lab-tab-practice">
              <p className="lab-muted">
                {state.completedChallenges.filter((id) => challengeById(id)).length} of {RUST_CHALLENGES.length} challenges passed in this browser.
              </p>
              <ul className="lab-challenges">
                {RUST_CHALLENGES.map((challenge) => {
                  const done = state.completedChallenges.includes(challenge.id)
                  const selected = selectedChallengeId === challenge.id
                  return (
                    <li key={challenge.id} className={selected ? 'selected' : ''}>
                      <button type="button" className="lab-challenge-pick" aria-expanded={selected} onClick={() => setSelectedChallengeId(challenge.id)}>
                        <span className="lab-level">{challenge.level}</span>
                        <span>{challenge.title}</span>
                        {done && <span className="lab-done"><Check size={14} aria-hidden="true" /> Passed</span>}
                      </button>
                      {selected && (
                        <div className="lab-challenge-body">
                          <p>{challenge.prompt}</p>
                          <p className="lab-muted">Expected output:</p>
                          <pre className="lab-example">{challenge.expectedOutput}</pre>
                          <details>
                            <summary>Hints</summary>
                            <ul>{challenge.hints.map((hint) => <li key={hint}>{hint}</li>)}</ul>
                          </details>
                          <button className="lab-button primary" type="button" disabled={busy} onClick={() => startChallenge(challenge)}>
                            {state.projects.some((candidate) => candidate.challengeId === challenge.id) ? 'Continue challenge' : 'Start challenge'}
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>
      </main>
      <footer className="lab-footer">
        <p>
          Rust compiler: rustc {TOOLCHAIN.rustcVersion} for WebAssembly from the <a href="https://github.com/oligamiq/rust_wasm" target="_blank" rel="noreferrer noopener">rust_wasm</a> and{' '}
          <a href="https://github.com/oligamiq/rubrc" target="_blank" rel="noreferrer noopener">rubrc</a> projects (MIT or Apache-2.0). Edition 2021, standard library only; no crates.
        </p>
      </footer>
    </div>
  )
}

function RunSummary({ report, phase }: { report: RunReport | null; phase: RunPhase }) {
  if (phase === 'compiling') return <p className="lab-status running" role="status">Compiling main.rs with rustc…</p>
  if (phase === 'running') return <p className="lab-status running" role="status">Running… (stops after 10 seconds)</p>
  if (!report) return null
  const compile = report.compileMs !== null ? `compiled in ${(report.compileMs / 1000).toFixed(1)} s` : null
  if (report.kind === 'compile-error') {
    const count = report.diagnostics?.errorCount ?? 0
    return <p className="lab-status error"><strong>Did not compile</strong>: {count} {count === 1 ? 'error' : 'errors'}{compile ? `, ${compile}` : ''}</p>
  }
  if (report.kind === 'compiler-crashed') {
    return <p className="lab-status error"><strong>The compiler crashed</strong>. This is a limit of the experimental compiler, not your code. Run again to restart it.</p>
  }
  if (report.kind === 'stopped') return <p className="lab-status">Stopped.</p>
  const program = report.program!
  if (program.timedOut) return <p className="lab-status error"><strong>Stopped after 10 seconds.</strong> Look for a loop that never ends.</p>
  if (program.outputLimited) return <p className="lab-status error"><strong>Stopped:</strong> the program printed more than 256 KB.</p>
  if (program.panicked) return <p className="lab-status error"><strong>The program panicked</strong> ({compile}).</p>
  return (
    <p className={`lab-status ${program.exitCode === 0 ? 'success' : 'error'}`}>
      <strong>{program.exitCode === 0 ? 'Finished' : `Exited with code ${program.exitCode}`}</strong>
      {compile ? ` · ${compile}, ran in ${(program.durationMs / 1000).toFixed(2)} s` : ''}
      {report.diagnostics?.warningCount ? ` · ${report.diagnostics.warningCount} ${report.diagnostics.warningCount === 1 ? 'warning' : 'warnings'}` : ''}
    </p>
  )
}

function ChallengeResult({ challenge, passed, compiled }: { challenge: RustChallenge; passed: boolean; compiled: boolean }) {
  return (
    <div className={`lab-challenge-result ${passed ? 'passed' : 'not-yet'}`} role="status">
      {passed
        ? <p><Check size={16} aria-hidden="true" /> <strong>Challenge passed:</strong> {challenge.title}</p>
        : (
          <>
            <p><strong>Not yet.</strong> {compiled ? 'The output does not match the expected output:' : 'Fix the compile errors first. Expected output:'}</p>
            <pre className="lab-example">{challenge.expectedOutput}</pre>
          </>
        )}
    </div>
  )
}
