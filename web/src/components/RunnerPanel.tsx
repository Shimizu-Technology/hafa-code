import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, CircleAlert, CircleCheck, Copy, CornerDownLeft, Loader2, Play, Square, Terminal, TriangleAlert } from 'lucide-react'
import { RUNNER_STARTUP_TIMEOUT_MS, RUNNER_TIMEOUT_MS, projectKindDefinition, type ProjectFile, type SavedProject } from '../lib/codeRunner'
import type { RunnerOutcome, RunnerStatus } from '../lib/runnerOutcome'
import { coachRunnerError, errorHeadline, type ErrorCoachContext } from '../lib/errorCoach'
import { appendTerminalChunks, emptyTerminalBuffer, type TerminalBuffer, type TerminalLine } from '../lib/terminalBuffer'
import {
  hasIdleRunnerWorker,
  markRuntimeReady,
  prewarmRunnerWorker,
  releaseIdleRunnerWorker,
  runtimeWasReady,
  takeIdleRunnerWorker,
} from '../lib/runnerWorkerPool'
import { writeClipboardText } from '../lib/workspace'
import { claimFirstSuccess, runMilestone, type RunMilestone } from '../lib/runMilestones'
import type { RunnerRequest, RunnerResponse, RunRequest } from '../workers/runnerProtocol'
import { OUTPUT_LIMIT_CHARS, OUTPUT_LIMIT_LINES, OUTPUT_LIMIT_MESSAGE } from '../workers/runOutput'

type RunPhase = 'idle' | 'loading' | 'executing' | 'input'
type CopyStatus = 'idle' | 'copied' | 'failed'

interface RunState {
  status: RunnerStatus
  stdout: string
  stderr: string
  durationMs: number | null
  failurePhase?: RunnerOutcome['failurePhase']
  outputLimited?: boolean
  fullTraceback?: string
}

type TerminalChunk = Omit<TerminalLine, 'id'>

const emptyRunState: RunState = { status: 'idle', stdout: '', stderr: '', durationMs: null }
const PREWARM_DELAY_MS = 600
/** How long the one-time first-success outline stays before it fades. */
export const FIRST_SUCCESS_MOMENT_MS = 1_600

function formatSeconds(ms: number) {
  const seconds = ms / 1000
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`
}

function scheduleFrame(callback: () => void) {
  if (typeof window.requestAnimationFrame === 'function') {
    const frame = window.requestAnimationFrame(callback)
    return () => window.cancelAnimationFrame(frame)
  }
  const timer = window.setTimeout(callback, 16)
  return () => window.clearTimeout(timer)
}

function countLines(text: string) {
  let count = 0
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) count += 1
  return count
}

interface RunnerPanelProps {
  project: SavedProject
  entryFile: ProjectFile
  onRunCancel?: () => void
  onRunComplete?: (outcome: RunnerOutcome) => void
  onErrorAdviceChange?: (context: ErrorCoachContext) => void
}

export function RunnerPanel({ project, entryFile, onRunCancel, onRunComplete, onErrorAdviceChange }: RunnerPanelProps) {
  const runner = projectKindDefinition(project.kind).runner
  const startupTimeoutMs = runner?.startupTimeoutMs ?? RUNNER_STARTUP_TIMEOUT_MS
  const executionTimeoutMs = runner?.executionTimeoutMs ?? RUNNER_TIMEOUT_MS
  const [runState, setRunState] = useState<RunState>(emptyRunState)
  const [runPhase, setRunPhase] = useState<RunPhase>('idle')
  const [terminal, setTerminal] = useState<TerminalBuffer>(() => emptyTerminalBuffer())
  const [terminalInput, setTerminalInput] = useState('')
  const [awaitingInput, setAwaitingInput] = useState(false)
  const [loadingSeconds, setLoadingSeconds] = useState(0)
  const [firstRuntimeLoad, setFirstRuntimeLoad] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [hasTranscript, setHasTranscript] = useState(false)
  const [milestone, setMilestone] = useState<RunMilestone>(null)
  const [celebrating, setCelebrating] = useState(false)
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const lastFinishedStatusRef = useRef<RunnerStatus | null>(null)
  const hadSuccessRef = useRef(false)
  const celebrateTimerRef = useRef<number | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const runIdRef = useRef<string | null>(null)
  const runRef = useRef<() => void>(() => {})
  const armExecutionTimeoutRef = useRef<() => void>(() => {})
  const streamedOutputSeenRef = useRef({ stdout: false, stderr: false })
  const startedAtRef = useRef<number | null>(null)
  const streamedOutputRef = useRef({ stdout: '', stderr: '' })
  const outputSizeRef = useRef({ chars: 0, lines: 0 })
  const transcriptRef = useRef('')
  const pendingChunksRef = useRef<TerminalChunk[]>([])
  const cancelFrameRef = useRef<(() => void) | null>(null)
  const detachWorkerListenersRef = useRef<() => void>(() => {})
  const onRunCancelRef = useRef(onRunCancel)
  const onRunCompleteRef = useRef(onRunComplete)
  const terminalScrollRef = useRef<HTMLDivElement | null>(null)
  const terminalInputRef = useRef<HTMLInputElement | null>(null)
  const copyResetRef = useRef<number | null>(null)

  useEffect(() => {
    onRunCancelRef.current = onRunCancel
    onRunCompleteRef.current = onRunComplete
  }, [onRunCancel, onRunComplete])

  const flushTerminal = useCallback(() => {
    cancelFrameRef.current?.()
    cancelFrameRef.current = null
    const chunks = pendingChunksRef.current
    if (chunks.length === 0) return
    pendingChunksRef.current = []
    setTerminal((current) => appendTerminalChunks(current, chunks))
  }, [])

  /** Streams arrive faster than React should render; batch them into one update per frame. */
  const queueTerminal = useCallback((chunk: TerminalChunk, { immediate = false } = {}) => {
    if (chunk.kind !== 'command') {
      transcriptRef.current += chunk.kind === 'input' || chunk.kind === 'system'
        ? `${chunk.text}\n`
        : chunk.text
      setHasTranscript(true)
    }
    pendingChunksRef.current.push(chunk)
    if (immediate) {
      flushTerminal()
      return
    }
    cancelFrameRef.current ??= scheduleFrame(flushTerminal)
  }, [flushTerminal])

  const clearRunTimer = useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }, [])

  const stopWorker = useCallback(() => {
    clearRunTimer()
    detachWorkerListenersRef.current()
    const worker = workerRef.current
    const runId = runIdRef.current
    if (worker && runId) worker.postMessage({ id: runId, type: 'abort' })
    window.setTimeout(() => worker?.terminate(), 0)
    workerRef.current = null
    runIdRef.current = null
    setAwaitingInput(false)
    setRunPhase('idle')
  }, [clearRunTimer])

  useEffect(() => () => {
    const cancelledActiveRun = runIdRef.current !== null
    cancelFrameRef.current?.()
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current)
    if (celebrateTimerRef.current) window.clearTimeout(celebrateTimerRef.current)
    if (!cancelledActiveRun && workerRef.current && runner?.prewarm) {
      // An idle, already-started runtime stays warm for the next project of this language.
      detachWorkerListenersRef.current()
      releaseIdleRunnerWorker(runner.language, workerRef.current)
      workerRef.current = null
      return
    }
    stopWorker()
    if (cancelledActiveRun) onRunCancelRef.current?.()
  }, [runner, stopWorker])

  useEffect(() => {
    if (!runner?.prewarm) return
    const timer = window.setTimeout(() => {
      if (workerRef.current || hasIdleRunnerWorker(runner.language)) return
      prewarmRunnerWorker(runner.language, runner.createWorker)
    }, PREWARM_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [runner])

  useEffect(() => {
    terminalScrollRef.current?.scrollTo({ top: terminalScrollRef.current.scrollHeight })
  }, [terminal, awaitingInput])

  useEffect(() => {
    if (awaitingInput) terminalInputRef.current?.focus()
  }, [awaitingInput])

  useEffect(() => {
    if (runPhase !== 'loading') return
    const interval = window.setInterval(() => {
      if (startedAtRef.current === null) return
      setLoadingSeconds(Math.floor((performance.now() - startedAtRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [runPhase])

  const run = () => {
    if (!runner) return
    if (runIdRef.current) {
      onRunCancelRef.current?.()
      stopWorker()
    }
    else clearRunTimer()

    const runId = crypto.randomUUID()
    const startedAt = performance.now()
    let programStarted = false
    const worker = workerRef.current
      ?? (runner.prewarm ? takeIdleRunnerWorker(runner.language) : null)
      ?? runner.createWorker()

    workerRef.current = worker
    runIdRef.current = runId
    startedAtRef.current = startedAt
    streamedOutputRef.current = { stdout: '', stderr: '' }
    streamedOutputSeenRef.current = { stdout: false, stderr: false }
    outputSizeRef.current = { chars: 0, lines: 0 }
    transcriptRef.current = ''
    pendingChunksRef.current = []
    cancelFrameRef.current?.()
    cancelFrameRef.current = null
    setHasTranscript(false)
    setCopyStatus('idle')
    setAwaitingInput(false)
    setRunPhase('loading')
    setLoadingSeconds(0)
    setRunStartedAt(startedAt)
    setMilestone(null)
    setFirstRuntimeLoad(Boolean(runner.firstLoadLabel) && !runtimeWasReady(runner.language))
    setTerminalInput('')
    setTerminal(emptyTerminalBuffer([
      {
        id: crypto.randomUUID(),
        kind: 'command',
        text: runner.terminalCommand(entryFile.path),
      },
    ]))
    setRunState({ status: 'running', stdout: '', stderr: '', durationMs: null })

    const finish = (outcome: RunnerOutcome, fullTraceback?: string) => {
      flushTerminal()
      setRunState(fullTraceback ? { ...outcome, fullTraceback } : outcome)
      // A project can change id when it first syncs to the cloud; one runner celebrates at most once.
      const firstSuccess = outcome.status === 'success' && !hadSuccessRef.current && claimFirstSuccess(project.id)
      if (outcome.status === 'success') hadSuccessRef.current = true
      const earned = runMilestone(lastFinishedStatusRef.current, outcome.status, firstSuccess)
      lastFinishedStatusRef.current = outcome.status
      setMilestone(earned)
      if (firstSuccess) {
        setCelebrating(true)
        if (celebrateTimerRef.current) window.clearTimeout(celebrateTimerRef.current)
        celebrateTimerRef.current = window.setTimeout(() => setCelebrating(false), FIRST_SUCCESS_MOMENT_MS)
      }
      onRunCompleteRef.current?.(outcome)
      startedAtRef.current = null
      setRunStartedAt(null)
    }

    timeoutRef.current = window.setTimeout(() => {
      if (runIdRef.current !== runId) return
      stopWorker()
      const message = 'The browser runtime took too long to load. Check your connection, then try again.'
      queueTerminal({ kind: 'system', text: message })
      finish({
        status: 'timeout',
        failurePhase: 'startup',
        stdout: streamedOutputRef.current.stdout,
        stderr: streamedOutputRef.current.stderr || message,
        durationMs: Math.round(performance.now() - startedAt),
      })
    }, startupTimeoutMs)

    const armExecutionTimeout = () => {
      clearRunTimer()
      timeoutRef.current = window.setTimeout(() => {
        if (runIdRef.current !== runId) return
        stopWorker()
        const message = `Execution stopped after ${executionTimeoutMs}ms.`
        queueTerminal({ kind: 'system', text: message })
        finish({
          status: 'timeout',
          failurePhase: 'execution',
          stdout: streamedOutputRef.current.stdout,
          stderr: streamedOutputRef.current.stderr || message,
          durationMs: Math.round(performance.now() - startedAt),
        })
      }, executionTimeoutMs + 250)
    }
    armExecutionTimeoutRef.current = armExecutionTimeout

    const stopForOutputLimit = () => {
      if (runIdRef.current !== runId) return
      stopWorker()
      queueTerminal({ kind: 'system', text: OUTPUT_LIMIT_MESSAGE })
      const stderr = streamedOutputRef.current.stderr
      finish({
        status: 'error',
        failurePhase: 'execution',
        outputLimited: true,
        stdout: streamedOutputRef.current.stdout,
        stderr: stderr ? `${stderr}${stderr.endsWith('\n') ? '' : '\n'}${OUTPUT_LIMIT_MESSAGE}` : OUTPUT_LIMIT_MESSAGE,
        durationMs: Math.round(performance.now() - startedAt),
      })
    }

    const detachWorkerListeners = () => {
      worker.removeEventListener('message', handleWorkerMessage)
      worker.removeEventListener('error', handleWorkerError)
      if (detachWorkerListenersRef.current === detachWorkerListeners) {
        detachWorkerListenersRef.current = () => {}
      }
    }

    const handleWorkerMessage = (event: MessageEvent<RunnerResponse>) => {
      if (event.data.id !== runIdRef.current) return

      if (event.data.type === 'started') {
        programStarted = true
        if (runner.firstLoadLabel) markRuntimeReady(runner.language)
        setRunPhase('executing')
        armExecutionTimeout()
        return
      }

      if (event.data.type === 'output_limit') {
        stopForOutputLimit()
        return
      }

      if (event.data.type === 'output') {
        const stream = event.data.stream === 'stderr' ? 'stderr' : 'stdout'
        const text = event.data.text ?? ''
        // Runtimes without their own cap are still stopped before the page slows down.
        const size = outputSizeRef.current
        size.chars += text.length
        size.lines += countLines(text)
        streamedOutputSeenRef.current[stream] = true
        streamedOutputRef.current[stream] += text
        queueTerminal({ kind: stream, text })
        if (size.chars > OUTPUT_LIMIT_CHARS || size.lines > OUTPUT_LIMIT_LINES) stopForOutputLimit()
        return
      }

      if (event.data.type === 'input_request') {
        clearRunTimer()
        flushTerminal()
        setAwaitingInput(true)
        setRunPhase('input')
        return
      }

      if (event.data.type !== 'result') return

      clearRunTimer()
      detachWorkerListeners()
      runIdRef.current = null
      setAwaitingInput(false)
      setRunPhase('idle')

      if (!streamedOutputSeenRef.current.stdout && event.data.stdout) queueTerminal({ kind: 'stdout', text: event.data.stdout })
      if (!streamedOutputSeenRef.current.stderr && event.data.stderr) queueTerminal({ kind: 'stderr', text: event.data.stderr })

      const stdout = streamedOutputSeenRef.current.stdout ? streamedOutputRef.current.stdout : (event.data.stdout ?? '')
      const stderr = streamedOutputSeenRef.current.stderr ? streamedOutputRef.current.stderr : (event.data.stderr ?? '')
      const status: RunnerOutcome['status'] = event.data.exitCode === undefined
        ? (stderr.trim() ? 'error' : 'success')
        : (event.data.exitCode === 0 ? 'success' : 'error')
      finish({
        status,
        ...(status === 'error' ? { failurePhase: event.data.errorKind === 'validation' ? 'validation' as const : programStarted ? 'execution' as const : 'startup' as const } : {}),
        stdout,
        stderr,
        durationMs: event.data.durationMs ?? Math.round(performance.now() - startedAt),
      }, event.data.fullTraceback)
    }

    const handleWorkerError = (event: ErrorEvent) => {
      if (runIdRef.current !== runId) return
      detachWorkerListeners()
      stopWorker()
      const details = event.message || 'The browser runner stopped unexpectedly.'
      const message = /fetch|network|load/i.test(details)
        ? `The browser runtime could not load. Check your connection and try again.\n${details}`
        : details
      queueTerminal({ kind: 'stderr', text: message })
      finish({
        status: 'error',
        failurePhase: programStarted ? 'execution' : 'startup',
        stdout: streamedOutputRef.current.stdout,
        stderr: streamedOutputRef.current.stderr || message,
        durationMs: Math.round(performance.now() - startedAt),
      })
    }

    worker.addEventListener('message', handleWorkerMessage)
    worker.addEventListener('error', handleWorkerError)
    detachWorkerListenersRef.current = detachWorkerListeners

    worker.postMessage({
      id: runId,
      type: 'run',
      entryPath: entryFile.path,
      files: project.files,
      code: entryFile.content,
      timeoutMs: RUNNER_TIMEOUT_MS,
      startupTimeoutMs,
    } satisfies RunRequest)
  }

  useEffect(() => {
    runRef.current = run
  })

  const outputIsEmpty = !runState.stdout && !runState.stderr
  const errorAdvice = useMemo(() => (
    runState.status === 'error' || runState.status === 'timeout'
      ? coachRunnerError(project.kind, entryFile.path, {
          status: runState.status,
          stdout: runState.stdout,
          stderr: runState.stderr,
          durationMs: runState.durationMs ?? 0,
          failurePhase: runState.failurePhase,
          outputLimited: runState.outputLimited,
        })
      : null
  ), [entryFile.path, project.kind, runState])

  const headline = runState.status !== 'error' || runState.failurePhase === 'startup'
    ? null
    : runState.outputLimited
      ? 'Output limit reached — check your loop'
      : errorHeadline(project.kind, runState.stderr)

  useEffect(() => {
    onErrorAdviceChange?.(errorAdvice ? { advice: errorAdvice, kind: project.kind } : null)
  }, [errorAdvice, onErrorAdviceChange, project.kind])

  const submitTerminalInput = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!awaitingInput || !workerRef.current || !runIdRef.current) return

    const value = terminalInput
    queueTerminal({ kind: 'input', text: value }, { immediate: true })
    setTerminalInput('')
    setAwaitingInput(false)
    setRunPhase('executing')
    workerRef.current.postMessage({ id: runIdRef.current, type: 'stdin', value } satisfies RunnerRequest)
    armExecutionTimeoutRef.current()
  }

  const stopRun = () => {
    stopWorker()
    queueTerminal({ kind: 'system', text: 'Execution stopped.' }, { immediate: true })
    const outcome: RunnerOutcome = {
      status: 'stopped',
      stdout: streamedOutputRef.current.stdout,
      stderr: streamedOutputRef.current.stderr || 'Execution stopped.',
      durationMs: startedAtRef.current === null ? runState.durationMs : Math.round(performance.now() - startedAtRef.current),
    }
    setRunState(outcome)
    lastFinishedStatusRef.current = outcome.status
    setMilestone(null)
    onRunCompleteRef.current?.(outcome)
    startedAtRef.current = null
    setRunStartedAt(null)
  }

  const copyOutput = async () => {
    const copied = await writeClipboardText(transcriptRef.current)
    setCopyStatus(copied ? 'copied' : 'failed')
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current)
    if (copied) copyResetRef.current = window.setTimeout(() => setCopyStatus('idle'), 2000)
  }

  const runStatusLabel = awaitingInput
    ? 'Waiting for input'
    : runState.status === 'running'
      ? runPhase === 'loading' ? 'Loading runtime' : 'Running'
      : runState.status === 'idle'
        ? 'Ready'
        : runState.status === 'success'
          ? milestone === 'fixed' ? 'Fixed. It runs now.' : `Ran in ${runState.durationMs ?? 0} ms`
          : runState.status === 'error'
            ? 'Error'
            : runState.status === 'timeout'
              ? runState.failurePhase === 'startup' ? 'Runtime did not load' : 'Stopped at the time limit'
              : 'Stopped'
  const statusTone = runState.status === 'running' || awaitingInput
    ? 'running'
    : runState.status === 'success'
      ? 'success'
      : runState.status === 'error' || runState.status === 'timeout'
        ? 'danger'
        : 'neutral'

  const footerDetail = awaitingInput
    ? 'press Enter to continue'
    : runState.status === 'running' && runPhase === 'loading'
      ? `startup limit ${formatSeconds(startupTimeoutMs)}`
      : `${formatSeconds(executionTimeoutMs)} run limit`

  const loadingTitle = firstRuntimeLoad && runner?.firstLoadLabel
    ? runner.firstLoadLabel
    : `Preparing ${runner?.runLabel}…`

  useEffect(() => {
    const handleRunRequest = () => runRef.current()
    window.addEventListener('hafa-code-run-active-project', handleRunRequest)
    return () => window.removeEventListener('hafa-code-run-active-project', handleRunRequest)
  }, [])

  useEffect(() => {
    const handleCancelRequest = () => {
      if (!runIdRef.current) return
      onRunCancelRef.current?.()
      stopWorker()
    }
    window.addEventListener('hafa-code-cancel-active-run', handleCancelRequest)
    return () => window.removeEventListener('hafa-code-cancel-active-run', handleCancelRequest)
  }, [stopWorker])

  const lastStderrIndex = terminal.lines.reduce((found, line, index) => line.kind === 'stderr' ? index : found, -1)

  return (
    <section
      className={`panel output-panel${celebrating ? ' first-success' : ''}`}
      data-run-status={awaitingInput ? 'input' : runState.status}
    >
      <div className="panel-header runner-header">
        <div className="runner-title">
          <h2><Terminal size={18} aria-hidden="true" /> Output</h2>
          <p className="run-status" data-tone={statusTone} aria-live="polite">
            {statusTone === 'running'
              ? <Loader2 className="spin" size={14} aria-hidden="true" />
              : statusTone === 'success'
                ? <CircleCheck size={14} aria-hidden="true" />
                : statusTone === 'danger'
                  ? <CircleAlert size={14} aria-hidden="true" />
                  : null}
            <span className="run-status-label">{runStatusLabel}</span>
            {runState.status === 'running' && !awaitingInput && runStartedAt !== null && <ElapsedTime startedAt={runStartedAt} />}
            {milestone === 'fixed' && runState.durationMs !== null && <span className="run-status-detail">{runState.durationMs} ms</span>}
          </p>
        </div>
        {runState.status === 'running' ? (
          <button className="secondary" onClick={stopRun} data-hafa-run-button>
            <Square size={16} aria-hidden="true" /> Stop
          </button>
        ) : (
          <button className="primary" onClick={run} disabled={!entryFile.content.trim()} data-hafa-run-button>
            <Play size={16} aria-hidden="true" /> {runState.status === 'idle' ? `Run ${runner?.runLabel}` : 'Run again'}
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{copyStatus === 'copied' ? 'Output copied to the clipboard.' : ''}</p>
      {copyStatus === 'failed' && (
        <p className="runner-copy-error" role="alert">Copy was blocked by this browser. Select the output below and copy it manually.</p>
      )}
      <div className="terminal" ref={terminalScrollRef} tabIndex={0} role="region" aria-label="Program output">
        {headline && (
          <div className="run-error-headline" role="alert">
            <TriangleAlert size={17} aria-hidden="true" />
            <div>
              <strong>{headline}</strong>
              {errorAdvice?.location && !runState.outputLimited && <span>{errorAdvice.location}</span>}
            </div>
          </div>
        )}
        {runState.status === 'running' && terminal.lines.length <= 1 && !awaitingInput && (
          <div className="runner-progress" role="status" aria-live="polite">
            <Loader2 className="spin" size={16} />
            <div>
              <strong>{runPhase === 'loading' ? loadingTitle : `Running ${entryFile.path}…`}</strong>
              {runPhase === 'loading' && loadingSeconds > 0 && <span className="runner-progress-elapsed">{loadingSeconds}s</span>}
              {runPhase === 'loading' && <span>{runner?.startupNote ?? 'First load may take a few seconds. Later runs are faster.'}</span>}
              {runPhase === 'loading' && firstRuntimeLoad && (
                <ol className="runner-steps" aria-label="Startup steps">
                  <li data-state="current">Download {runner?.runLabel} · first time only</li>
                  <li data-state="todo">Start {runner?.runLabel}</li>
                  <li data-state="todo">Run {entryFile.path}</li>
                </ol>
              )}
            </div>
          </div>
        )}
        {runState.status !== 'running' && outputIsEmpty && terminal.lines.length === 0 && (
          <div className="empty-output">
            <p><strong>Press Run</strong> to see what your program prints.</p>
            <p>It runs privately in your browser. The first run loads the runtime; repeat runs stay warm.</p>
          </div>
        )}
        {terminal.hiddenLineCount > 0 && (
          <p className="terminal-trimmed-note">
            {terminal.hiddenLineCount.toLocaleString()} earlier {terminal.hiddenLineCount === 1 ? 'line is' : 'lines are'} hidden to keep the page fast. Copy output includes everything.
          </p>
        )}
        {terminal.lines.map((line, index) => (
          <pre key={line.id} className={`terminal-line ${line.kind}${line.kind === 'stderr' && headline ? ' traceback' : ''}`}>
            {line.kind === 'stderr' && headline && index === lastStderrIndex
              ? <TracebackText text={line.text} headline={headline} />
              : line.text}
          </pre>
        ))}
        {runState.fullTraceback && runState.status === 'error' && (
          <details className="terminal-full-traceback">
            <summary>{runner?.fullTracebackLabel ?? 'Show full error details'}</summary>
            <pre>{runState.fullTraceback}</pre>
          </details>
        )}
        {awaitingInput && (
          <form className="terminal-input-row" onSubmit={submitTerminalInput}>
            <span aria-hidden="true">&gt;</span>
            <input
              ref={terminalInputRef}
              value={terminalInput}
              onChange={(event) => setTerminalInput(event.target.value)}
              placeholder="Type input, then press Enter"
              aria-label="Program input"
              autoComplete="off"
              autoCapitalize="off"
              enterKeyHint="send"
              spellCheck={false}
            />
            <button type="submit" className="terminal-input-submit" aria-label="Submit program input">
              <CornerDownLeft size={15} /> <span>Send</span>
            </button>
          </form>
        )}
      </div>
      <div className="terminal-footer">
        <span className="terminal-footer-detail">{footerDetail}</span>
        <button
          className="ghost runner-copy-button"
          type="button"
          onClick={copyOutput}
          disabled={!hasTranscript}
          aria-label={copyStatus === 'copied' ? 'Output copied' : 'Copy output'}
        >
          {copyStatus === 'copied' ? <Check size={14} /> : <Copy size={14} />}
          <span>{copyStatus === 'copied' ? 'Copied' : 'Copy output'}</span>
        </button>
      </div>
    </section>
  )
}

/** Ticks only itself while a run is active, so the terminal does not re-render every 100 ms. */
function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(interval)
  }, [])
  return <span className="run-status-detail">{(Math.max(0, now - startedAt) / 1000).toFixed(1)}s</span>
}

/** Keeps the traceback readable but quiet, with the final cause line emphasized. */
function TracebackText({ text, headline }: { text: string; headline: string }) {
  const index = text.lastIndexOf(headline)
  if (index === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <span className="terminal-error-line">{headline}</span>
      {text.slice(index + headline.length)}
    </>
  )
}
