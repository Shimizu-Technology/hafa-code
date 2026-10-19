import type { RunnerLanguage } from './projectTypes'

/**
 * Keeps at most one idle, already-started worker per runtime so the first Run
 * after opening a project does not wait for the runtime download, and switching
 * between projects of the same language keeps the runtime warm.
 */
const idleWorkers = new Map<RunnerLanguage, Worker>()

const RUNTIME_READY_KEY_PREFIX = 'hafa-code-runtime-ready:'

export function prewarmRunnerWorker(language: RunnerLanguage, createWorker: () => Worker) {
  if (idleWorkers.has(language)) return
  const worker = createWorker()
  const handleMessage = (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type !== 'warm') return
    worker.removeEventListener('message', handleMessage)
    markRuntimeReady(language)
  }
  worker.addEventListener('message', handleMessage)
  worker.postMessage({ id: `warmup:${language}`, type: 'warmup' })
  idleWorkers.set(language, worker)
}

export function takeIdleRunnerWorker(language: RunnerLanguage) {
  const worker = idleWorkers.get(language) ?? null
  idleWorkers.delete(language)
  return worker
}

/** Returns an idle worker for reuse; extra workers are terminated. */
export function releaseIdleRunnerWorker(language: RunnerLanguage, worker: Worker) {
  if (idleWorkers.has(language) && idleWorkers.get(language) !== worker) {
    worker.terminate()
    return
  }
  idleWorkers.set(language, worker)
}

export function hasIdleRunnerWorker(language: RunnerLanguage) {
  return idleWorkers.has(language)
}

export function resetRunnerWorkerPool() {
  idleWorkers.forEach((worker) => worker.terminate())
  idleWorkers.clear()
}

/** Remembers that this browser has downloaded the runtime once, for honest loading copy. */
export function markRuntimeReady(language: RunnerLanguage) {
  try {
    localStorage.setItem(`${RUNTIME_READY_KEY_PREFIX}${language}`, '1')
  } catch {
    // Loading copy falls back to the first-time message.
  }
}

export function runtimeWasReady(language: RunnerLanguage) {
  try {
    return localStorage.getItem(`${RUNTIME_READY_KEY_PREFIX}${language}`) === '1'
  } catch {
    return false
  }
}
