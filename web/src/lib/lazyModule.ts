import { useEffect, useSyncExternalStore } from 'react'

export type LazyModuleState = 'idle' | 'loading' | 'ready' | 'failed'

export interface LazyModule<T> {
  /** Starts (or reuses) the download. A failed attempt can be retried by calling it again. */
  load: () => Promise<T>
  /** The module if it has already arrived. */
  peek: () => T | null
  /**
   * Re-renders when the module arrives or fails. Pass `needed: true` to start the
   * download from a component; `false` only observes.
   */
  useModule: (needed: boolean) => { module: T | null; state: LazyModuleState; retry: () => void }
}

/**
 * Wraps a dynamic import so sidecar code (Practice Lab, guides, sign-in) downloads only
 * when a learner needs it. Unlike React.lazy, a failed chunk does not throw into the tree:
 * the caller shows a "Try again" state and the next `load()` starts a fresh attempt.
 */
export function createLazyModule<T>(importer: () => Promise<T>): LazyModule<T> {
  let module: T | null = null
  let state: LazyModuleState = 'idle'
  let loading: Promise<T> | null = null
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())

  const load = () => {
    if (module) return Promise.resolve(module)
    if (!loading) {
      state = 'loading'
      notify()
      loading = importer().then(
        (loaded) => {
          module = loaded
          state = 'ready'
          notify()
          return loaded
        },
        (error: unknown) => {
          loading = null
          state = 'failed'
          notify()
          throw error
        },
      )
    }
    return loading
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  const snapshot = () => state
  const retry = () => {
    void load().catch(() => {})
  }

  function useModule(needed: boolean) {
    const current = useSyncExternalStore(subscribe, snapshot, snapshot)
    useEffect(() => {
      if (needed && state === 'idle') retry()
    }, [needed])
    return { module: current === 'ready' ? module : null, state: current, retry }
  }

  return { load, peek: () => module, useModule }
}
