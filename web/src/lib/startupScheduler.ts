import { whenEditorRuntimeReady } from './editorRuntime'

type NetworkInformationLike = { saveData?: boolean; effectiveType?: string }

/**
 * True when the browser reports Data Saver or a slow connection (Chromium only;
 * Safari does not expose this, so iPhones take the idle path).
 */
export function connectionIsConstrained(nav: Navigator = navigator) {
  const connection = (nav as Navigator & { connection?: NetworkInformationLike }).connection
  if (!connection) return false
  return Boolean(connection.saveData) || ['slow-2g', '2g', '3g'].includes(connection.effectiveType ?? '')
}

const INTERACTION_EVENTS = ['pointerdown', 'keydown'] as const

const startupHolds = new Set<Promise<unknown>>()

/**
 * Keeps optional downloads (the Python prefetch) waiting until `work` settles. Sign-in
 * for a returning signed-in learner uses this so their cloud projects are not stuck
 * behind a 13 MB runtime download.
 */
export function holdOptionalDownloadsUntil(work: Promise<unknown>) {
  const hold = work.then(() => {}, () => {})
  startupHolds.add(hold)
  void hold.then(() => startupHolds.delete(hold))
}

function pageLoaded() {
  return document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true }))
}

function whenIdle(task: () => void, timeout: number) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(task, { timeout })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(task, Math.min(300, timeout))
  return () => window.clearTimeout(id)
}

/**
 * Runs a small download the learner needs soon (such as Clerk for a returning signed-in
 * learner) once the editor has arrived: no interaction wait on slow connections, and at
 * most `idleTimeout` ms of waiting for an idle moment. Returns a cancel function.
 */
export function runAfterEditor(task: () => void, options: { editorReady?: () => Promise<void>; idleTimeout?: number } = {}) {
  const editorReady = options.editorReady ?? whenEditorRuntimeReady
  let cancelled = false
  let cleanup = () => {}
  void editorReady().catch(() => {}).then(() => {
    if (cancelled) return
    cleanup = whenIdle(() => { if (!cancelled) task() }, options.idleTimeout ?? 1_000)
  })
  return () => {
    cancelled = true
    cleanup()
  }
}

/**
 * Runs a large, optional download (such as the Python runtime prefetch) only after the
 * first paint is done and the editor is usable, so it never competes with them:
 * - wait for the window `load` event, the editor chunk, and any `holdOptionalDownloadsUntil` work;
 * - then, on a normal connection, run when the browser is idle (2 s at most);
 * - on Data Saver or a 2G/3G connection, wait for the learner's first tap or key press.
 * Returns a cancel function.
 */
export function runAfterStartup(task: () => void, options: { editorReady?: () => Promise<void> } = {}) {
  const editorReady = options.editorReady ?? whenEditorRuntimeReady
  let cancelled = false
  let cleanup = () => {}

  void Promise.all([pageLoaded(), editorReady().catch(() => {})])
    .then(() => Promise.all([...startupHolds]))
    .then(() => {
      if (cancelled) return
      if (connectionIsConstrained()) {
        const handleInteraction = () => {
          removeListeners()
          if (!cancelled) task()
        }
        const removeListeners = () => INTERACTION_EVENTS.forEach((type) => window.removeEventListener(type, handleInteraction, true))
        INTERACTION_EVENTS.forEach((type) => window.addEventListener(type, handleInteraction, true))
        cleanup = removeListeners
        return
      }
      cleanup = whenIdle(() => { if (!cancelled) task() }, 2_000)
    })

  return () => {
    cancelled = true
    cleanup()
  }
}
