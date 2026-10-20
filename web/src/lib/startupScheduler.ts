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

/**
 * Runs a large, optional download (such as the Python runtime prefetch) only after the
 * first paint is done and the editor is usable, so it never competes with them:
 * - wait for the window `load` event and the editor chunk;
 * - then, on a normal connection, run when the browser is idle (2 s at most);
 * - on Data Saver or a 2G/3G connection, wait for the learner's first tap or key press.
 * Returns a cancel function.
 */
export function runAfterStartup(task: () => void, options: { editorReady?: () => Promise<void> } = {}) {
  const editorReady = options.editorReady ?? whenEditorRuntimeReady
  let cancelled = false
  let cleanup = () => {}

  const pageLoaded = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true }))

  void Promise.all([pageLoaded, editorReady().catch(() => {})]).then(() => {
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
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => { if (!cancelled) task() }, { timeout: 2_000 })
      cleanup = () => window.cancelIdleCallback(id)
    } else {
      const id = window.setTimeout(() => { if (!cancelled) task() }, 300)
      cleanup = () => window.clearTimeout(id)
    }
  })

  return () => {
    cancelled = true
    cleanup()
  }
}
