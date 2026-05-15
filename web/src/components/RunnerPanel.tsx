import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Play, Square, Terminal, Zap } from 'lucide-react'
import { RUNNER_TIMEOUT_MS, type ProjectFile, type RunnerLanguage, type SavedProject } from '../lib/codeRunner'

type RunStatus = 'idle' | 'running' | 'success' | 'error' | 'timeout'

interface RunState {
  status: RunStatus
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

export function RunnerPanel({ project, entryFile }: { project: SavedProject; entryFile: ProjectFile }) {
  const [runState, setRunState] = useState<RunState>(emptyRunState)
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([])
  const [terminalInput, setTerminalInput] = useState('')
  const [awaitingInput, setAwaitingInput] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const runIdRef = useRef<string | null>(null)
  const runRef = useRef<() => void>(() => {})
  const armExecutionTimeoutRef = useRef<() => void>(() => {})
  const outputEmittedRef = useRef(false)
  const terminalScrollRef = useRef<HTMLDivElement | null>(null)
  const terminalInputRef = useRef<HTMLInputElement | null>(null)

  const appendTerminalLine = (line: Omit<TerminalLine, 'id'>) => {
    setTerminalLines((current) => [...current, { id: crypto.randomUUID(), ...line }])
  }

  const clearRunTimer = useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }, [])

  const stopWorker = useCallback(() => {
    clearRunTimer()
    const worker = workerRef.current
    const runId = runIdRef.current
    if (worker && runId) worker.postMessage({ id: runId, type: 'abort' })
    window.setTimeout(() => worker?.terminate(), 0)
    workerRef.current = null
    runIdRef.current = null
    setAwaitingInput(false)
  }, [clearRunTimer])

  useEffect(() => stopWorker, [stopWorker])

  useEffect(() => {
    terminalScrollRef.current?.scrollTo({ top: terminalScrollRef.current.scrollHeight })
  }, [terminalLines, awaitingInput])

  useEffect(() => {
    if (awaitingInput) terminalInputRef.current?.focus()
  }, [awaitingInput])

  const run = () => {
    if (project.kind === 'web') return
    if (runState.status === 'running') stopWorker()

    const runId = crypto.randomUUID()
    const startedAt = performance.now()
    const worker = new Worker(new URL('../workers/codeRunner.worker.ts', import.meta.url), { type: 'module' })

    workerRef.current = worker
    runIdRef.current = runId
    outputEmittedRef.current = false
    setAwaitingInput(false)
    setTerminalInput('')
    setTerminalLines([
      {
        id: crypto.randomUUID(),
        kind: 'command',
        text: project.kind === 'ruby' ? `ruby ${entryFile.path}` : `node ${entryFile.path}`,
      },
    ])
    setRunState({ status: 'running', stdout: '', stderr: '', durationMs: null })

    timeoutRef.current = window.setTimeout(() => {
      stopWorker()
      setRunState({ status: 'timeout', stdout: '', stderr: 'Code runner did not start in time.', durationMs: Math.round(performance.now() - startedAt) })
    }, 30_000)

    const armExecutionTimeout = () => {
      clearRunTimer()
      timeoutRef.current = window.setTimeout(() => {
        stopWorker()
        appendTerminalLine({ kind: 'system', text: `Execution stopped after ${RUNNER_TIMEOUT_MS}ms.` })
        setRunState({ status: 'timeout', stdout: '', stderr: `Execution stopped after ${RUNNER_TIMEOUT_MS}ms.`, durationMs: Math.round(performance.now() - startedAt) })
      }, RUNNER_TIMEOUT_MS + 250)
    }
    armExecutionTimeoutRef.current = armExecutionTimeout

    worker.onmessage = (event: MessageEvent<{ id: string; type: 'started' | 'output' | 'input_request' | 'result'; stream?: 'stdout' | 'stderr'; text?: string; stdout?: string; stderr?: string; durationMs?: number }>) => {
      if (event.data.id !== runIdRef.current) return

      if (event.data.type === 'started') {
        armExecutionTimeout()
        return
      }

      if (event.data.type === 'output') {
        outputEmittedRef.current = true
        appendTerminalLine({ kind: event.data.stream === 'stderr' ? 'stderr' : 'stdout', text: event.data.text ?? '' })
        return
      }

      if (event.data.type === 'input_request') {
        clearRunTimer()
        setAwaitingInput(true)
        return
      }

      clearRunTimer()
      workerRef.current?.terminate()
      workerRef.current = null
      runIdRef.current = null
      setAwaitingInput(false)

      if (!outputEmittedRef.current) {
        if (event.data.stdout) appendTerminalLine({ kind: 'stdout', text: event.data.stdout })
        if (event.data.stderr) appendTerminalLine({ kind: 'stderr', text: event.data.stderr })
      }

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
      appendTerminalLine({ kind: 'stderr', text: event.message || 'Runner failed.' })
      setRunState({ status: 'error', stdout: '', stderr: event.message || 'Runner failed.', durationMs: Math.round(performance.now() - startedAt) })
    }

    worker.postMessage({
      id: runId,
      entryPath: entryFile.path,
      files: project.files,
      code: entryFile.content,
      language: project.kind as RunnerLanguage,
      timeoutMs: RUNNER_TIMEOUT_MS,
    })
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
    workerRef.current.postMessage({ id: runIdRef.current, type: 'stdin', value })
    armExecutionTimeoutRef.current()
  }

  const stopRun = () => {
    stopWorker()
    appendTerminalLine({ kind: 'system', text: 'Execution stopped.' })
    setRunState((current) => ({
      status: 'timeout',
      stdout: current.stdout,
      stderr: current.stderr || 'Execution stopped.',
      durationMs: current.durationMs,
    }))
  }

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
          <button className="secondary" onClick={stopRun}>
            <Square size={16} /> Stop
          </button>
        ) : (
          <button onClick={run} disabled={!entryFile.content.trim()}>
            <Play size={16} /> Run {project.kind === 'ruby' ? 'Ruby' : 'JS'}
          </button>
        )}
      </div>
      <div className="terminal" ref={terminalScrollRef}>
        {runState.status === 'running' && terminalLines.length <= 1 && !awaitingInput && <p className="muted inline"><Loader2 className="spin" size={15} /> Loading runtime and executing...</p>}
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
              spellCheck={false}
            />
          </form>
        )}
      </div>
      <div className="terminal-footer">
        <span>{awaitingInput ? 'waiting for input' : runState.status === 'idle' ? 'Ready' : runState.status}</span>
        <span>{awaitingInput ? 'press Enter to continue' : runState.durationMs === null ? `${RUNNER_TIMEOUT_MS}ms limit` : `${runState.durationMs}ms`}</span>
      </div>
    </section>
  )
}
