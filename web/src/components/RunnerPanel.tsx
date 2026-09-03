import { useCallback, useEffect, useRef, useState } from 'react'
import { CornerDownLeft, Loader2, Play, Square, Terminal, Zap } from 'lucide-react'
import { RUNNER_STARTUP_TIMEOUT_MS, RUNNER_TIMEOUT_MS, projectKindDefinition, type ProjectFile, type SavedProject } from '../lib/codeRunner'
import type { RunnerOutcome, RunnerStatus } from '../lib/runnerOutcome'
import type { RunnerRequest, RunnerResponse, RunRequest } from '../workers/runnerProtocol'

type RunPhase = 'idle' | 'loading' | 'executing' | 'input'

interface RunState {
  status: RunnerStatus
  stdout: string
  stderr: string
  durationMs: number | null
}

type TerminalLine = {
  id: string
  kind: 'command' | 'stdout' | 'stderr' | 'input' | 'system'
  text: string
}

const emptyRunState: RunState = { status: 'idle', stdout: '', stderr: '', durationMs: null }

interface RunnerPanelProps {
  project: SavedProject
  entryFile: ProjectFile
  onRunCancel?: () => void
  onRunComplete?: (outcome: RunnerOutcome) => void
}

export function RunnerPanel({ project, entryFile, onRunCancel, onRunComplete }: RunnerPanelProps) {
  const runner = projectKindDefinition(project.kind).runner
  const startupTimeoutMs = runner?.startupTimeoutMs ?? RUNNER_STARTUP_TIMEOUT_MS
  const executionTimeoutMs = runner?.executionTimeoutMs ?? RUNNER_TIMEOUT_MS
  const [runState, setRunState] = useState<RunState>(emptyRunState)
  const [runPhase, setRunPhase] = useState<RunPhase>('idle')
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([])
  const [terminalInput, setTerminalInput] = useState('')
  const [awaitingInput, setAwaitingInput] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const runIdRef = useRef<string | null>(null)
  const runRef = useRef<() => void>(() => {})
  const armExecutionTimeoutRef = useRef<() => void>(() => {})
  const outputEmittedRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const streamedOutputRef = useRef({ stdout: '', stderr: '' })
  const detachWorkerListenersRef = useRef<() => void>(() => {})
  const onRunCancelRef = useRef(onRunCancel)
  const terminalScrollRef = useRef<HTMLDivElement | null>(null)
  const terminalInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    onRunCancelRef.current = onRunCancel
  }, [onRunCancel])

  const appendTerminalLine = (line: Omit<TerminalLine, 'id'>) => {
    setTerminalLines((current) => [...current, { id: crypto.randomUUID(), ...line }])
  }

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
    stopWorker()
    if (cancelledActiveRun) onRunCancelRef.current?.()
  }, [stopWorker])

  useEffect(() => {
    terminalScrollRef.current?.scrollTo({ top: terminalScrollRef.current.scrollHeight })
  }, [terminalLines, awaitingInput])

  useEffect(() => {
    if (awaitingInput) terminalInputRef.current?.focus()
  }, [awaitingInput])

  const run = () => {
    if (!runner) return
    if (runIdRef.current) {
      onRunCancelRef.current?.()
      stopWorker()
    }
    else clearRunTimer()

    const runId = crypto.randomUUID()
    const startedAt = performance.now()
    const worker = workerRef.current ?? runner.createWorker()

    workerRef.current = worker
    runIdRef.current = runId
    startedAtRef.current = startedAt
    streamedOutputRef.current = { stdout: '', stderr: '' }
    outputEmittedRef.current = false
    setAwaitingInput(false)
    setRunPhase('loading')
    setTerminalInput('')
    setTerminalLines([
      {
        id: crypto.randomUUID(),
        kind: 'command',
        text: runner.terminalCommand(entryFile.path),
      },
    ])
    setRunState({ status: 'running', stdout: '', stderr: '', durationMs: null })

    timeoutRef.current = window.setTimeout(() => {
      if (runIdRef.current !== runId) return
      stopWorker()
      const message = 'The browser runtime took too long to load. Check your connection, then try again.'
      appendTerminalLine({ kind: 'system', text: message })
      const outcome: RunnerOutcome = {
        status: 'timeout',
        stdout: streamedOutputRef.current.stdout,
        stderr: streamedOutputRef.current.stderr || message,
        durationMs: Math.round(performance.now() - startedAt),
      }
      setRunState(outcome)
      onRunComplete?.(outcome)
      startedAtRef.current = null
    }, startupTimeoutMs)

    const armExecutionTimeout = () => {
      clearRunTimer()
      timeoutRef.current = window.setTimeout(() => {
        if (runIdRef.current !== runId) return
        stopWorker()
        const message = `Execution stopped after ${executionTimeoutMs}ms.`
        const outcome: RunnerOutcome = {
          status: 'timeout',
          stdout: streamedOutputRef.current.stdout,
          stderr: streamedOutputRef.current.stderr || message,
          durationMs: Math.round(performance.now() - startedAt),
        }
        appendTerminalLine({ kind: 'system', text: message })
        setRunState(outcome)
        onRunComplete?.(outcome)
        startedAtRef.current = null
      }, executionTimeoutMs + 250)
    }
    armExecutionTimeoutRef.current = armExecutionTimeout

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
        setRunPhase('executing')
        armExecutionTimeout()
        return
      }

      if (event.data.type === 'output') {
        outputEmittedRef.current = true
        const stream = event.data.stream === 'stderr' ? 'stderr' : 'stdout'
        const text = event.data.text ?? ''
        streamedOutputRef.current[stream] += text
        appendTerminalLine({ kind: stream, text })
        return
      }

      if (event.data.type === 'input_request') {
        clearRunTimer()
        setAwaitingInput(true)
        setRunPhase('input')
        return
      }

      clearRunTimer()
      detachWorkerListeners()
      runIdRef.current = null
      setAwaitingInput(false)
      setRunPhase('idle')

      if (!outputEmittedRef.current) {
        if (event.data.stdout) appendTerminalLine({ kind: 'stdout', text: event.data.stdout })
        if (event.data.stderr) appendTerminalLine({ kind: 'stderr', text: event.data.stderr })
      }

      const stderr = event.data.stderr ?? ''
      const status: RunnerOutcome['status'] = event.data.exitCode === undefined
        ? (stderr.trim() ? 'error' : 'success')
        : (event.data.exitCode === 0 ? 'success' : 'error')
      const outcome: RunnerOutcome = {
        status,
        stdout: event.data.stdout ?? '',
        stderr,
        durationMs: event.data.durationMs ?? Math.round(performance.now() - startedAt),
      }
      setRunState(outcome)
      onRunComplete?.(outcome)
      startedAtRef.current = null
    }

    const handleWorkerError = (event: ErrorEvent) => {
      if (runIdRef.current !== runId) return
      detachWorkerListeners()
      stopWorker()
      const details = event.message || 'The browser runner stopped unexpectedly.'
      const message = /fetch|network|load/i.test(details)
        ? `The browser runtime could not load. Check your connection and try again.\n${details}`
        : details
      const outcome: RunnerOutcome = {
        status: 'error',
        stdout: streamedOutputRef.current.stdout,
        stderr: streamedOutputRef.current.stderr || message,
        durationMs: Math.round(performance.now() - startedAt),
      }
      appendTerminalLine({ kind: 'stderr', text: message })
      setRunState(outcome)
      onRunComplete?.(outcome)
      startedAtRef.current = null
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

  const submitTerminalInput = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!awaitingInput || !workerRef.current || !runIdRef.current) return

    const value = terminalInput
    appendTerminalLine({ kind: 'input', text: value })
    setTerminalInput('')
    setAwaitingInput(false)
    setRunPhase('executing')
    workerRef.current.postMessage({ id: runIdRef.current, type: 'stdin', value } satisfies RunnerRequest)
    armExecutionTimeoutRef.current()
  }

  const stopRun = () => {
    stopWorker()
    appendTerminalLine({ kind: 'system', text: 'Execution stopped.' })
    const outcome: RunnerOutcome = {
      status: 'stopped',
      stdout: streamedOutputRef.current.stdout,
      stderr: streamedOutputRef.current.stderr || 'Execution stopped.',
      durationMs: startedAtRef.current === null ? runState.durationMs : Math.round(performance.now() - startedAtRef.current),
    }
    setRunState(outcome)
    onRunComplete?.(outcome)
    startedAtRef.current = null
  }

  const runStatusLabel = awaitingInput
    ? 'Waiting for input'
    : runState.status === 'running'
      ? runPhase === 'loading' ? 'Loading runtime' : 'Running'
      : runState.status === 'idle' ? 'Ready' : runState.status

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
          <p className="helper-text">Runs privately in your browser. The first run loads the runtime; repeat runs stay warm.</p>
        </div>
        {runState.status === 'running' ? (
          <button className="secondary" onClick={stopRun}>
            <Square size={16} /> Stop
          </button>
        ) : (
          <button onClick={run} disabled={!entryFile.content.trim()}>
            <Play size={16} /> {runState.status === 'idle' ? `Run ${runner?.runLabel}` : 'Run again'}
          </button>
        )}
      </div>
      <div className="terminal" ref={terminalScrollRef}>
        {runState.status === 'running' && terminalLines.length <= 1 && !awaitingInput && (
          <div className="runner-progress" role="status" aria-live="polite">
            <Loader2 className="spin" size={16} />
            <div>
              <strong>{runPhase === 'loading' ? `Preparing ${runner?.runLabel}…` : `Running ${entryFile.path}…`}</strong>
              {runPhase === 'loading' && <span>{runner?.startupNote ?? 'First load may take a few seconds. Later runs are faster.'}</span>}
            </div>
          </div>
        )}
        {runState.status !== 'running' && outputIsEmpty && terminalLines.length === 0 && (
          <div className="empty-output">
            <Zap size={28} />
            <p>Press Run to start a browser terminal session.</p>
          </div>
        )}
        {terminalLines.map((line) => (
          <pre key={line.id} className={`terminal-line ${line.kind}`}>{line.text}</pre>
        ))}
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
        <span>{runStatusLabel}</span>
        <span>{awaitingInput ? 'press Enter to continue' : runState.durationMs === null ? `${executionTimeoutMs}ms limit` : `${runState.durationMs}ms`}</span>
      </div>
    </section>
  )
}
