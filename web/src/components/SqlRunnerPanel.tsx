import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Database, Loader2, Play, RotateCcw, Square } from 'lucide-react'
import { RUNNER_STARTUP_TIMEOUT_MS, RUNNER_TIMEOUT_MS, type ProjectFile, type SavedProject } from '../lib/codeRunner'
import { coachRunnerError, type ErrorCoachContext } from '../lib/errorCoach'
import type { RunnerOutcome } from '../lib/runnerOutcome'
import type { SqlQueryResult, SqlRunnerRequest, SqlRunnerResponse } from '../workers/sqlRunnerProtocol'

type SqlStatus = 'idle' | 'loading' | 'running' | 'success' | 'error' | 'stopped'
type SqlAction = 'run' | 'reset'

interface SqlRunnerPanelProps {
  project: SavedProject
  entryFile: ProjectFile
  onRunCancel?: () => void
  onRunComplete?: (outcome: RunnerOutcome) => void
  onErrorAdviceChange?: (context: ErrorCoachContext) => void
}

function displayCell(value: string | number | null) {
  return value === null ? 'NULL' : String(value)
}

function resultAsText(result: SqlQueryResult) {
  if (!result.columns.length) return `${result.changeCount} row${result.changeCount === 1 ? '' : 's'} changed`
  return [result.columns.join(' | '), ...result.rows.map((row) => row.map(displayCell).join(' | '))].join('\n')
}

export function SqlRunnerPanel({ project, entryFile, onRunCancel, onRunComplete, onErrorAdviceChange }: SqlRunnerPanelProps) {
  const [status, setStatus] = useState<SqlStatus>('idle')
  const [result, setResult] = useState<SqlQueryResult | null>(null)
  const [error, setError] = useState('')
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [resetNotice, setResetNotice] = useState('')
  const [action, setAction] = useState<SqlAction>('run')
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef<string | null>(null)
  const actionRef = useRef<SqlAction>('run')
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const detachWorkerListenersRef = useRef<() => void>(() => {})
  const runRef = useRef<() => void>(() => {})
  const onRunCancelRef = useRef(onRunCancel)
  const onRunCompleteRef = useRef(onRunComplete)

  useEffect(() => {
    onRunCancelRef.current = onRunCancel
    onRunCompleteRef.current = onRunComplete
  }, [onRunCancel, onRunComplete])

  const clearTimer = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const destroyWorker = useCallback(() => {
    clearTimer()
    const worker = workerRef.current
    const requestId = requestIdRef.current
    if (worker && requestId) worker.postMessage({ id: requestId, type: 'abort' } satisfies SqlRunnerRequest)
    detachWorkerListenersRef.current()
    detachWorkerListenersRef.current = () => {}
    worker?.terminate()
    workerRef.current = null
    requestIdRef.current = null
  }, [clearTimer])

  const finishWithError = useCallback((message: string, nextStatus: SqlStatus = 'error') => {
    clearTimer()
    requestIdRef.current = null
    const elapsed = startedAtRef.current === null ? 0 : Math.round(performance.now() - startedAtRef.current)
    setStatus(nextStatus)
    setError(message)
    setResult(null)
    setDurationMs(elapsed)
    if (actionRef.current === 'run') {
      onRunCompleteRef.current?.({ status: nextStatus === 'stopped' ? 'stopped' : 'error', stdout: '', stderr: message, durationMs: elapsed })
    }
    startedAtRef.current = null
  }, [clearTimer])

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current
    const worker = new Worker(new URL('../workers/sqlRunner.worker.ts', import.meta.url), { type: 'module' })
    const handleMessage = (event: MessageEvent<SqlRunnerResponse>) => {
      if (event.data.id !== requestIdRef.current) return
      if (event.data.type === 'started') {
        clearTimer()
        setStatus('running')
        timerRef.current = window.setTimeout(() => {
          destroyWorker()
          finishWithError(`SQL execution stopped after ${RUNNER_TIMEOUT_MS}ms.`, 'error')
        }, RUNNER_TIMEOUT_MS + 250)
        return
      }

      clearTimer()
      requestIdRef.current = null
      setDurationMs(event.data.durationMs)
      if (event.data.error) {
        setStatus('error')
        setError(event.data.error)
        setResult(null)
        if (actionRef.current === 'run') {
          onRunCompleteRef.current?.({ status: 'error', stdout: '', stderr: event.data.error, durationMs: event.data.durationMs })
        }
      } else if (actionRef.current === 'reset') {
        setStatus('success')
        setError('')
        setResult(null)
        setResetNotice(`Database reset from schema.sql and seed.sql · ${event.data.tableCount ?? 0} table${event.data.tableCount === 1 ? '' : 's'} ready`)
      } else if (event.data.result) {
        setStatus('success')
        setError('')
        setResult(event.data.result)
        setResetNotice(event.data.result.databaseReset ? 'Schema or seed changed, so the database was rebuilt before this run.' : '')
        onRunCompleteRef.current?.({ status: 'success', stdout: resultAsText(event.data.result), stderr: '', durationMs: event.data.durationMs })
      }
      startedAtRef.current = null
    }
    const handleError = (event: ErrorEvent) => {
      if (!requestIdRef.current) return
      const message = event.message || 'The SQLite browser worker stopped unexpectedly.'
      destroyWorker()
      finishWithError(message)
    }
    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError)
    detachWorkerListenersRef.current = () => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
    }
    workerRef.current = worker
    return worker
  }, [clearTimer, destroyWorker, finishWithError])

  const start = useCallback((action: SqlAction) => {
    if (requestIdRef.current) return
    const requestId = crypto.randomUUID()
    requestIdRef.current = requestId
    actionRef.current = action
    setAction(action)
    startedAtRef.current = performance.now()
    setStatus('loading')
    setError('')
    setResetNotice('')
    if (action === 'run') setResult(null)
    timerRef.current = window.setTimeout(() => {
      destroyWorker()
      finishWithError('The SQLite runtime took too long to load. Check your connection, then try again.')
    }, RUNNER_STARTUP_TIMEOUT_MS)

    try {
      const worker = getWorker()
      worker.postMessage(action === 'run'
        ? { id: requestId, type: 'run', entryPath: entryFile.path, files: project.files }
        : { id: requestId, type: 'reset', files: project.files } satisfies SqlRunnerRequest)
    } catch (workerError) {
      destroyWorker()
      finishWithError(workerError instanceof Error ? workerError.message : 'The SQLite browser worker could not start.')
    }
  }, [destroyWorker, entryFile.path, finishWithError, getWorker, project.files])

  const stop = () => {
    onRunCancelRef.current?.()
    destroyWorker()
    finishWithError('SQL execution stopped.', 'stopped')
  }

  useEffect(() => {
    runRef.current = () => start('run')
  }, [start])

  useEffect(() => {
    const handleRun = () => runRef.current()
    const handleCancel = () => {
      if (requestIdRef.current) stop()
    }
    window.addEventListener('hafa-code-run-active-project', handleRun)
    window.addEventListener('hafa-code-cancel-active-run', handleCancel)
    return () => {
      window.removeEventListener('hafa-code-run-active-project', handleRun)
      window.removeEventListener('hafa-code-cancel-active-run', handleCancel)
    }
  })

  useEffect(() => () => {
    const cancelled = requestIdRef.current !== null
    destroyWorker()
    if (cancelled) onRunCancelRef.current?.()
  }, [destroyWorker])

  const advice = useMemo(() => error
    ? coachRunnerError('sql', entryFile.path, { status: 'error', stdout: '', stderr: error, durationMs: durationMs ?? 0 })
    : null, [durationMs, entryFile.path, error])

  useEffect(() => {
    onErrorAdviceChange?.(advice ? { advice, kind: 'sql' } : null)
  }, [advice, onErrorAdviceChange])

  const busy = status === 'loading' || status === 'running'
  const rowLabel = result ? `${result.rowCount} row${result.rowCount === 1 ? '' : 's'}` : ''

  return (
    <section className="panel output-panel sql-output-panel surface-grid">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Results</p>
          <h2><Database size={18} /> SQLite workspace</h2>
          <p className="helper-text">Runs privately in a project-scoped browser database. Schema and seed edits rebuild it automatically.</p>
        </div>
        <div className="sql-runner-actions">
          <button className="secondary" type="button" onClick={() => start('reset')} disabled={busy}>
            <RotateCcw size={16} /> Reset database
          </button>
          {busy ? (
            <button type="button" onClick={stop}><Square size={16} /> Stop</button>
          ) : (
            <button type="button" onClick={() => start('run')} disabled={!entryFile.content.trim()}><Play size={16} /> Run SQL</button>
          )}
        </div>
      </div>

      <div className="sql-result-stage" aria-live="polite">
        {busy && (
          <div className="runner-progress" role="status">
            <Loader2 className="spin" size={18} />
            <div><strong>{status === 'loading' ? 'Preparing SQLite…' : action === 'reset' ? 'Resetting database…' : `Running ${entryFile.path}…`}</strong><span>The first run may take a few seconds. Later queries stay warm.</span></div>
          </div>
        )}
        {!busy && error && <div className="sql-message error" role="alert"><strong>SQLite could not run this SQL.</strong><pre>{error}</pre></div>}
        {!busy && resetNotice && <p className="sql-message success">{resetNotice}</p>}
        {!busy && result && result.columns.length > 0 && (
          <div className="sql-table-region" role="region" aria-label={`Query result, ${rowLabel}`} tabIndex={0}>
            <table>
              <caption>Query result · {rowLabel}{result.rowsTruncated ? ` · showing first ${result.rows.length}` : ''}</caption>
              <thead><tr>{result.columns.map((column, index) => <th key={`${column}-${index}`} scope="col">{column}</th>)}</tr></thead>
              <tbody>
                {result.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={columnIndex} className={value === null ? 'sql-null' : ''}>{displayCell(value)}</td>)}</tr>)}
              </tbody>
            </table>
            {result.rowCount === 0 && <p className="sql-empty-result">The query ran successfully and returned 0 rows.</p>}
          </div>
        )}
        {!busy && result && result.columns.length === 0 && (
          <div className="sql-message success"><strong>Statement complete.</strong><span>{result.changeCount} row{result.changeCount === 1 ? '' : 's'} changed across {result.statementCount} statement{result.statementCount === 1 ? '' : 's'}.</span></div>
        )}
        {!busy && !error && !result && !resetNotice && (
          <div className="empty-output"><Database size={28} /><p>Run main.sql to see a table, or reset the database from schema.sql and seed.sql.</p></div>
        )}
      </div>

      <div className="terminal-footer">
        <span>{busy ? status === 'loading' ? 'Loading runtime' : 'Running' : status === 'idle' ? 'Ready' : status}</span>
        <span>{durationMs === null ? `${RUNNER_TIMEOUT_MS}ms query limit` : `${durationMs}ms`}</span>
      </div>
    </section>
  )
}
