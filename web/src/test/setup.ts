import { afterEach, vi } from 'vitest'

// Monaco cannot run in jsdom. Component tests mock @monaco-editor/react and treat the
// lazily loaded editor runtime as ready; editorRuntime.test.ts covers the real loader.
// A test can set globalThis.__HAFA_EDITOR_RUNTIME_STATE__ to 'loading' or 'failed'.
vi.mock('../lib/editorRuntime', () => ({
  loadEditorRuntime: () => Promise.resolve(),
  editorRuntimeReady: () => true,
  whenEditorRuntimeReady: () => Promise.resolve(),
  useEditorRuntime: () => (globalThis as { __HAFA_EDITOR_RUNTIME_STATE__?: string }).__HAFA_EDITOR_RUNTIME_STATE__ ?? 'ready',
}))

afterEach(() => {
  delete (globalThis as { __HAFA_EDITOR_RUNTIME_STATE__?: string }).__HAFA_EDITOR_RUNTIME_STATE__
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})
