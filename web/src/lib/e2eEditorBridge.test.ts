import { describe, expect, it, vi } from 'vitest'
import { runE2EEditorAction, setE2EEditorValue, type E2EEditor } from './e2eEditorBridge'

function editorWith(action: { run: () => Promise<void> | void } | null, focused = false): E2EEditor {
  return {
    getAction: vi.fn(() => action),
    hasTextFocus: vi.fn(() => focused),
    setValue: vi.fn(),
  }
}

describe('runE2EEditorAction', () => {
  it('selects the focused editor', async () => {
    const unfocusedRun = vi.fn()
    const focusedRun = vi.fn()

    await expect(runE2EEditorAction([
      editorWith({ run: unfocusedRun }),
      editorWith({ run: focusedRun }, true),
    ], 'actions.find')).resolves.toBe(true)

    expect(focusedRun).toHaveBeenCalledOnce()
    expect(unfocusedRun).not.toHaveBeenCalled()
  })

  it('falls back to the newest editor when none has text focus', async () => {
    const olderRun = vi.fn()
    const newestRun = vi.fn()

    await expect(runE2EEditorAction([
      editorWith({ run: olderRun }),
      editorWith({ run: newestRun }),
    ], 'actions.find')).resolves.toBe(true)

    expect(newestRun).toHaveBeenCalledOnce()
    expect(olderRun).not.toHaveBeenCalled()
  })

  it('returns false when the selected editor does not expose the action', async () => {
    await expect(runE2EEditorAction([editorWith(null, true)], 'missing.action')).resolves.toBe(false)
  })

  it('waits for the resolved action to finish', async () => {
    const run = vi.fn(async () => Promise.resolve())

    await expect(runE2EEditorAction([editorWith({ run }, true)], 'actions.find')).resolves.toBe(true)
    expect(run).toHaveBeenCalledOnce()
  })
})

describe('setE2EEditorValue', () => {
  it('sets the focused editor without touching another editor', () => {
    const older = editorWith(null)
    const focused = editorWith(null, true)

    expect(setE2EEditorValue([older, focused], 'const answer = 42')).toBe(true)
    expect(focused.setValue).toHaveBeenCalledWith('const answer = 42')
    expect(older.setValue).not.toHaveBeenCalled()
  })

  it('returns false when no editor exists', () => {
    expect(setE2EEditorValue([], 'anything')).toBe(false)
  })
})
