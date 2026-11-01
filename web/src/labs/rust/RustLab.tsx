import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Bug, Code2, Dumbbell, FlaskConical, FolderOpen, Laptop, Play, Terminal, Trash2, TriangleAlert, X } from 'lucide-react'
import { BottomNav } from '../../components/BottomNav'
import { FloatingDock } from '../../components/FloatingDock'
import { Toast } from '../../components/Toast'
import { useModalFocus } from '../../hooks/useModalFocus'
import { useOverlaySidecar } from '../../hooks/useOverlaySidecar'
import { usePhoneLayout } from '../../hooks/usePhoneLayout'
import { useResponsiveEditorFontSize } from '../../hooks/usePreferences'
import { assessEnvironment, readEnvironment, runAvailability } from './capability'
import { challengeById, outputMatches, type RustChallenge } from './challenges'
import { parseDiagnostics } from './diagnostics'
import { coachCompileError, coachPanic } from './errorCoach'
import type { RustGuideTopic, RustGuideTopicId } from './guide'
import { LabAppBar } from './LabAppBar'
import { LabChallengePanel } from './LabChallengePanel'
import { LabLearning, type LabLearningTab } from './LabLearning'
import { LabOutputPanel } from './LabOutputPanel'
import { LabProjects } from './LabProjects'
import { RustEditor, type RustEditorHandle } from './RustEditor'
import { RustToolchain, STOPPED_MESSAGE, ToolchainError, runProgram, type RunningProgram } from './rustLabClient'
import type { OutputLine, RunPhase, RunReport, ToolchainStatus } from './runTypes'
import {
  MAX_IMPORT_FILE_BYTES, MAX_INPUT_BYTES, MAX_PROJECTS, MAX_SOURCE_BYTES, ProjectImportError, byteLength, cleanTitle, createProject, exportFileName, exportProject, importProject, loadState, saveState,
  type RustLabProject, type RustLabState,
} from './storage'
import {
  TOOLCHAIN, TOOLCHAIN_DOWNLOAD_BYTES, formatMegabytes, removeToolchainDownload, toolchainCacheState, type ToolchainCacheState,
} from './toolchain'
import { useLabPreferences } from './useLabPreferences'

type PhoneTab = 'projects' | 'code' | 'output'

/** The experiment note is hidden once the learner dismisses it, per browser, like the workspace welcome. */
export const INTRO_DISMISSED_KEY = 'hafa-code-rust-lab-intro-dismissed-v1'

function introDismissed() {
  try {
    return localStorage.getItem(INTRO_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberIntroDismissed() {
  try {
    localStorage.setItem(INTRO_DISMISSED_KEY, 'true')
  } catch {
    // Storage may be blocked; the note stays hidden for this visit.
  }
}

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function DeleteDialog({ title, onCancel, onConfirm }: { title: string; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useModalFocus<HTMLElement>(true, onCancel)
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="modal-sheet confirm-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lab-delete-title"
        aria-describedby="lab-delete-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Delete project</p>
            <h2 id="lab-delete-title">Delete this project?</h2>
          </div>
          <button className="ghost icon-button" type="button" aria-label="Cancel" onClick={onCancel}><X size={18} aria-hidden="true" /></button>
        </div>
        <p id="lab-delete-description" className="confirm-copy">
          "{title}" will be removed from this browser. Export it first if you might want it back.
        </p>
        <div className="confirm-actions">
          <button className="secondary" type="button" onClick={onCancel}>Cancel</button>
          <button className="primary" type="button" onClick={onConfirm}><Trash2 size={16} aria-hidden="true" /> Delete project</button>
        </div>
      </section>
    </div>
  )
}

export function RustLab() {
  const preferences = useLabPreferences()
  const readiness = useMemo(() => assessEnvironment(readEnvironment()), [])
  const [tryHere, setTryHere] = useState(false)
  const availability = runAvailability(readiness, tryHere)
  const phoneLayout = usePhoneLayout()
  const overlayLearning = useOverlaySidecar()
  const editorFontSize = useResponsiveEditorFontSize()
  const [state, setState] = useState<RustLabState>(() => loadState())
  // Checked on every save: storage can fill up (it is shared with the workspace) after the page opens.
  const [saveFailed, setSaveFailed] = useState(false)
  const [notice, setNotice] = useState('')
  const [phoneTab, setPhoneTab] = useState<PhoneTab>('code')
  const [learningOpen, setLearningOpen] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1600px)').matches)
  const [learningTab, setLearningTab] = useState<LabLearningTab>('guide')
  const [topicId, setTopicId] = useState<RustGuideTopicId>('variables')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [introVisible, setIntroVisible] = useState(() => !introDismissed())
  const [toolchainStatus, setToolchainStatus] = useState<ToolchainStatus>({ kind: 'idle' })
  const [cacheState, setCacheState] = useState<ToolchainCacheState>('none')
  const [phase, setPhase] = useState<RunPhase>('idle')
  const [output, setOutput] = useState<OutputLine[]>([])
  const [report, setReport] = useState<RunReport | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const toolchainRef = useRef<RustToolchain | null>(null)
  const runningRef = useRef(false)
  const programRef = useRef<RunningProgram | null>(null)
  const editorRef = useRef<RustEditorHandle | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId) ?? state.projects[0]
  const activeChallenge = project.challengeId ? challengeById(project.challengeId) : null
  const busy = phase === 'loading' || phase === 'compiling' || phase === 'running'
  const coaching = report?.coaching ?? null

  useEffect(() => {
    // Writing to localStorage is the external system here; its result is only known afterwards.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveFailed(!saveState(state))
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
    const testWindow = window as Window & { __HAFA_RUST_LAB__?: { setSource: (source: string) => void; editor: () => RustEditorHandle | null } }
    testWindow.__HAFA_RUST_LAB__ = {
      editor: () => editorRef.current,
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

  const clearRun = () => {
    setReport(null)
    setOutput([])
  }

  const addProject = useCallback((next: RustLabProject, message?: string) => {
    if (state.projects.length >= MAX_PROJECTS) {
      setNotice(`The Rust Lab keeps up to ${MAX_PROJECTS} projects. Delete one to add another.`)
      return false
    }
    setState((current) => ({ ...current, activeProjectId: next.id, projects: [next, ...current.projects] }))
    if (message) setNotice(message)
    setReport(null)
    setOutput([])
    return true
  }, [state.projects.length])

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
      // A stopped load was already disposed; disposing again could end a newer load on this instance.
      const stopped = error instanceof ToolchainError && error.message === STOPPED_MESSAGE
      if (!stopped) toolchain.dispose()
      const message = error instanceof ToolchainError && error.integrity
        ? `${error.message} Try again later; if this keeps happening, the lab's files may be out of date.`
        : error instanceof Error ? error.message : String(error)
      setToolchainStatus(stopped ? { kind: 'idle' } : { kind: 'failed', message })
      void toolchainCacheState().then(setCacheState)
      return false
    }
  }, [])

  /**
   * Compile and run. `source` comes straight from the editor for keyboard runs, which can
   * arrive before React has re-rendered with the last keystroke.
   */
  const run = async (consented = false, source = project.source) => {
    if (phoneLayout) setPhoneTab('output')
    if (availability !== 'available') {
      setAnnouncement(availability === 'unsupported' ? 'This browser cannot run Rust.' : 'Running Rust needs a desktop browser.')
      return
    }
    // A ref, not `busy`: two runs started in the same tick would both see a stale `busy`.
    if (runningRef.current) return
    runningRef.current = true
    try {
      await runOnce(consented, source)
    } finally {
      runningRef.current = false
    }
  }

  const runOnce = async (consented: boolean, source: string) => {
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
      const stopped = error instanceof Error && error.message === STOPPED_MESSAGE
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
  }

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
  useEffect(() => { runRef.current = run })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // The editor handles its own Ctrl/Cmd+Enter (with its current text) and marks the event handled.
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.defaultPrevented) {
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

  const dismissIntro = () => {
    setIntroVisible(false)
    rememberIntroDismissed()
    // The note held focus; keep keyboard users in the page rather than on <body>.
    window.setTimeout(() => document.querySelector<HTMLElement>('.lab-app-bar .lab-wordmark')?.focus(), 0)
  }

  const openLearning = (tab: LabLearningTab) => {
    setLearningTab(tab)
    setLearningOpen(true)
  }

  const showCodeAfterChoosing = () => {
    if (overlayLearning) setLearningOpen(false)
    if (phoneLayout) setPhoneTab('code')
  }

  const startChallenge = (challenge: RustChallenge) => {
    const existing = state.projects.find((candidate) => candidate.challengeId === challenge.id)
    if (existing) {
      setState((current) => ({ ...current, activeProjectId: existing.id }))
      clearRun()
      setNotice(`Opened your "${existing.title}" project.`)
      showCodeAfterChoosing()
      return
    }
    if (addProject(createProject({ title: `Challenge: ${challenge.title}`, source: challenge.starter, challengeId: challenge.id }), `Started "${challenge.title}". Run your code to check it.`)) {
      showCodeAfterChoosing()
    }
  }

  const tryExample = (topic: RustGuideTopic) => {
    if (addProject(createProject({ title: `Example: ${topic.title}`, source: topic.example }), `Opened the "${topic.title}" example as a new project.`)) {
      showCodeAfterChoosing()
    }
  }

  const deleteProject = () => {
    const title = project.title
    setState((current) => {
      const remaining = current.projects.filter((candidate) => candidate.id !== current.activeProjectId)
      const projects = remaining.length ? remaining : [createProject()]
      return { ...current, projects, activeProjectId: projects[0].id }
    })
    clearRun()
    setDeleteOpen(false)
    setNotice(`Deleted "${title}".`)
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      if (file.size > MAX_IMPORT_FILE_BYTES) throw new ProjectImportError('That file is too large for the Rust Lab.')
      if (addProject(importProject(file.name, await file.text()), `Imported "${file.name}".`) && phoneLayout) setPhoneTab('code')
    } catch (error) {
      setNotice(error instanceof ProjectImportError ? error.message : 'That file could not be imported.')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const exportCurrent = () => {
    downloadText(exportFileName(project), exportProject(project))
    setNotice(`Exported "${project.title}" as ${exportFileName(project)}.`)
  }

  const selectProject = (id: string) => {
    if (id === project.id) {
      if (phoneLayout) setPhoneTab('code')
      return
    }
    setState((current) => ({ ...current, activeProjectId: id }))
    clearRun()
    if (phoneLayout) setPhoneTab('code')
  }

  const newProject = () => {
    if (addProject(createProject(), 'Created a new project.') && phoneLayout) setPhoneTab('code')
  }

  const changeStdin = (value: string) => {
    if (byteLength(value) > MAX_INPUT_BYTES) {
      setNotice(`Program input is limited to ${MAX_INPUT_BYTES / 1000} KB; that change was not kept.`)
      return false
    }
    updateProject({ stdin: value })
    return true
  }

  const editorTheme = preferences.resolvedTheme === 'dark' ? 'hafa-dark' : 'hafa-light'
  const runLabel = availability === 'available' ? 'Run Rust' : 'Run on a computer'
  const learningVisible = learningOpen && !overlayLearning
  const challengeResult = report?.challenge && activeChallenge && report.challenge.id === activeChallenge.id
    ? { passed: report.challenge.passed, compiled: Boolean(report.program) }
    : null
  const skipToEditor = () => {
    if (phoneLayout) setPhoneTab('code')
    window.setTimeout(() => editorRef.current?.focusLine(1), 0)
  }

  return (
    <main
      className={`app-shell rust-lab mobile-tab-${phoneTab}${learningVisible ? ' learning-open' : ''}`}
      data-theme={preferences.resolvedTheme}
      data-color-mode={preferences.colorMode}
    >
      <button className="skip-link" type="button" onClick={skipToEditor}>Skip to code editor</button>
      <LabAppBar
        projectTitle={project.title}
        saveLabel={saveFailed ? 'Not saving' : 'Saved in this browser'}
        busy={busy}
        cacheState={cacheState}
        colorMode={preferences.colorMode}
        theme={preferences.theme}
        onColorModeChange={preferences.setColorMode}
        onThemeChange={preferences.setTheme}
        onRename={(title) => updateProject({ title })}
        onRenameDone={(title) => updateProject({ title: cleanTitle(title) })}
        onOpenGuide={() => openLearning('guide')}
        onOpenPractice={() => openLearning('practice')}
        onNewProject={newProject}
        onDeleteProject={() => setDeleteOpen(true)}
        onExport={exportCurrent}
        onImport={() => importInputRef.current?.click()}
        onRemoveDownload={() => void removeDownload()}
      />
      <input ref={importInputRef} className="sr-only" type="file" accept=".json,.rs,application/json" tabIndex={-1} aria-hidden="true" onChange={(event) => void onImport(event.target.files?.[0])} />

      {introVisible && (
        <aside className="lab-intro" aria-label="About this experiment">
          <FlaskConical size={16} aria-hidden="true" />
          <p>
            <strong>Experimental.</strong> Rust runs in Chrome or Edge on a computer after a one-time {formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)} download.
            Projects stay in this browser, so export anything you want to keep.
          </p>
          <button className="ghost icon-button lab-intro-dismiss" type="button" aria-label="Hide this note" title="Hide this note" onClick={dismissIntro}>
            <X size={16} aria-hidden="true" />
          </button>
        </aside>
      )}

      {saveFailed && (
        <p className="status-banner lab-save-warning" role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>This browser is not saving Rust Lab projects (storage is full or blocked). Export your work to keep it.</span>
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

      <div className={`coding-stage${learningVisible ? ' learning-open' : ''}`}>
        <div className="layout-grid">
          <LabProjects
            projects={state.projects}
            activeProjectId={project.id}
            busy={busy}
            projectsOpen={phoneTab === 'projects'}
            onSelect={selectProject}
            onNew={newProject}
            onImport={() => importInputRef.current?.click()}
            onRename={(title) => updateProject({ title })}
            onRenameDone={(title) => updateProject({ title: cleanTitle(title) })}
          />

          <section className="main-workspace" aria-label="Code and output">
            {activeChallenge && (
              <LabChallengePanel
                key={`${project.id}:${activeChallenge.id}`}
                challenge={activeChallenge}
                completed={state.completedChallenges.includes(activeChallenge.id)}
                result={challengeResult}
                onOpenPractice={() => openLearning('practice')}
              />
            )}
            <div className="workspace">
              <section className="panel editor-panel lab-editor-panel" aria-labelledby="lab-editor-heading">
                <h2 id="lab-editor-heading" className="sr-only">Editor</h2>
                {/* Phones: one row, the file tab and Run. Guide and Practice are in the bottom navigation. */}
                <div className="editor-header lab-editor-header">
                  <div className="file-tabs">
                    <div className="file-tab-list">
                      <span className="lab-file-tab">main.rs <span className="entry-dot">Rust 2021</span></span>
                    </div>
                  </div>
                  <div className="mobile-code-runbar">
                    <button className={availability === 'available' ? 'primary' : 'secondary'} type="button" disabled={busy} onClick={() => void run()}>
                      {availability === 'available' ? <Play size={16} aria-hidden="true" /> : <Laptop size={16} aria-hidden="true" />} {runLabel}
                    </button>
                  </div>
                </div>
                <RustEditor
                  value={project.source}
                  theme={editorTheme}
                  fontSize={editorFontSize}
                  canRun={availability === 'available'}
                  diagnostics={report?.diagnostics?.diagnostics ?? []}
                  onChange={(source) => {
                    // Larger code would not survive a reload, so keep the last version that fits.
                    if (byteLength(source) > MAX_SOURCE_BYTES) {
                      setNotice(`main.rs is limited to ${MAX_SOURCE_BYTES / 1000} KB in the Rust Lab; that change was not kept.`)
                      return false
                    }
                    updateProject({ source })
                    return true
                  }}
                  onRun={(source) => void run(false, source)}
                  onReady={(handle) => { editorRef.current = handle }}
                />
              </section>

              <LabOutputPanel
                availability={availability}
                unsupportedReasons={readiness.status === 'unsupported' ? readiness.reasons : []}
                warnings={readiness.status === 'ready' ? readiness.warnings : []}
                phase={phase}
                report={report}
                output={output}
                toolchain={toolchainStatus}
                cacheState={cacheState}
                stdin={project.stdin}
                onStdinChange={changeStdin}
                onRun={() => void run()}
                onStop={stop}
                onDownload={() => void downloadFromCard()}
                onFocusLine={(line, column) => {
                  if (phoneLayout) setPhoneTab('code')
                  window.setTimeout(() => editorRef.current?.focusLine(line, column), 0)
                }}
                onExport={exportCurrent}
                onTryHere={() => {
                  setTryHere(true)
                  setAnnouncement('Run is on. The compiler still asks before it downloads.')
                }}
              />
            </div>
          </section>
        </div>

        <LabLearning
          open={learningOpen}
          tab={learningTab}
          topicId={topicId}
          coaching={coaching}
          completedChallenges={state.completedChallenges}
          startedChallenges={state.projects.flatMap((candidate) => candidate.challengeId ? [candidate.challengeId] : [])}
          activeChallengeId={activeChallenge?.id ?? null}
          busy={busy}
          onTabChange={setLearningTab}
          onTopicChange={setTopicId}
          onClose={() => setLearningOpen(false)}
          onTryExample={tryExample}
          onStartChallenge={startChallenge}
        />
      </div>

      <footer className="oss-footer lab-footer" data-dock-avoid>
        <span>
          Rust compiler: rustc {TOOLCHAIN.rustcVersion} (MIT or Apache-2.0) with LLVM lld, built for WebAssembly by the{' '}
          <a href="https://github.com/oligamiq/rust_wasm" target="_blank" rel="noreferrer noopener">rust_wasm</a> and{' '}
          <a href="https://github.com/oligamiq/rubrc" target="_blank" rel="noreferrer noopener">rubrc</a> projects.
          Edition 2021, standard library only; no crates. See THIRD_PARTY_NOTICES.md for licenses.
        </span>
      </footer>

      <BottomNav<PhoneTab | 'guide' | 'practice'>
        label="Rust Lab sections"
        onSelect={(id) => {
          if (id === 'guide' || id === 'practice') openLearning(id)
          else {
            setLearningOpen(false)
            setPhoneTab(id)
          }
        }}
        items={[
          { id: 'projects', label: 'Projects', icon: FolderOpen, current: phoneTab === 'projects' && !learningOpen },
          { id: 'code', label: 'Code', icon: Code2, current: phoneTab === 'code' && !learningOpen },
          { id: 'output', label: 'Output', icon: Terminal, current: phoneTab === 'output' && !learningOpen },
          { id: 'guide', label: 'Guide', icon: BookOpen, current: learningOpen && learningTab === 'guide', ariaLabel: 'Rust guide' },
          { id: 'practice', label: 'Practice', icon: Dumbbell, current: learningOpen && learningTab === 'practice', ariaLabel: 'Rust practice' },
        ]}
      />

      <FloatingDock>
        {notice && <Toast key={notice} message={notice} onDismiss={() => setNotice('')} />}
        {coaching && !(learningOpen && learningTab === 'coach') && (
          <button className="learning-coach-launcher" type="button" onClick={() => openLearning('coach')}>
            <Bug size={17} aria-hidden="true" /> Fix this error
          </button>
        )}
      </FloatingDock>

      {deleteOpen && <DeleteDialog title={project.title} onCancel={() => setDeleteOpen(false)} onConfirm={deleteProject} />}
    </main>
  )
}
