import { afterEach, describe, expect, it, vi } from 'vitest'

// The shared test setup replaces editorRuntime; this file checks the real loader.
vi.unmock('./editorRuntime')

const monacoSetup = vi.hoisted(() => ({ fail: true, loads: 0 }))
vi.mock('./monacoSetup', () => {
  monacoSetup.loads += 1
  if (monacoSetup.fail) throw new Error('chunk failed')
  return {}
})

describe('editor runtime loader', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('reports a failed chunk, then loads on retry', async () => {
    const runtime = await import('./editorRuntime')
    expect(runtime.editorRuntimeReady()).toBe(false)
    await expect(runtime.loadEditorRuntime()).rejects.toThrow()
    expect(runtime.editorRuntimeReady()).toBe(false)

    // "Try again" in the placeholder calls the loader again in the same page.
    monacoSetup.fail = false
    await runtime.loadEditorRuntime()
    expect(runtime.editorRuntimeReady()).toBe(true)
    expect(monacoSetup.loads).toBe(2)
    await expect(runtime.whenEditorRuntimeReady()).resolves.toBeUndefined()
  })
})
