import { useSyncExternalStore } from 'react'

/**
 * Monaco is the largest part of the app (about 1 MB compressed). It loads in its own
 * chunk after the first paint so a learner sees the workspace and their code right away;
 * the editor takes over when the chunk arrives. Until then EditorWorkspace shows a
 * read-only copy of the file.
 */
let ready = false
let failed = false
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

export function loadEditorRuntime(): Promise<void> {
  loading ??= import('./monacoSetup').then(
    () => {
      ready = true
      failed = false
      notify()
    },
    (error: unknown) => {
      // A flaky connection can drop the chunk; let the next attempt try again.
      loading = null
      failed = true
      notify()
      throw error
    },
  )
  return loading
}

export function editorRuntimeReady() {
  return ready
}

/** Resolves once Monaco is ready (or immediately if it already is). */
export function whenEditorRuntimeReady(): Promise<void> {
  return ready ? Promise.resolve() : loadEditorRuntime()
}

type EditorRuntimeState = 'loading' | 'ready' | 'failed'

function snapshot(): EditorRuntimeState {
  return ready ? 'ready' : failed ? 'failed' : 'loading'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useEditorRuntime(): EditorRuntimeState {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
