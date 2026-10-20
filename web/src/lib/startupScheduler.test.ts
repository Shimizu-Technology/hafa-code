import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectionIsConstrained, runAfterStartup } from './startupScheduler'

function setConnection(connection: object | undefined) {
  Object.defineProperty(navigator, 'connection', { configurable: true, value: connection })
}

describe('runAfterStartup', () => {
  afterEach(() => {
    setConnection(undefined)
    vi.useRealTimers()
  })

  it('reads Data Saver and slow connections as constrained', () => {
    expect(connectionIsConstrained()).toBe(false)
    setConnection({ effectiveType: '4g' })
    expect(connectionIsConstrained()).toBe(false)
    setConnection({ effectiveType: '3g' })
    expect(connectionIsConstrained()).toBe(true)
    setConnection({ effectiveType: '4g', saveData: true })
    expect(connectionIsConstrained()).toBe(true)
  })

  it('waits for the editor before running on a normal connection', async () => {
    vi.useFakeTimers()
    let releaseEditor = () => {}
    const editorReady = () => new Promise<void>((resolve) => { releaseEditor = resolve })
    const task = vi.fn()
    runAfterStartup(task, { editorReady })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(task).not.toHaveBeenCalled()
    releaseEditor()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('waits for the first tap or key press on a constrained connection', async () => {
    setConnection({ effectiveType: '2g' })
    const task = vi.fn()
    runAfterStartup(task, { editorReady: () => Promise.resolve() })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(task).not.toHaveBeenCalled()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(task).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('does nothing once cancelled', async () => {
    vi.useFakeTimers()
    const task = vi.fn()
    const cancel = runAfterStartup(task, { editorReady: () => Promise.resolve() })
    cancel()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(task).not.toHaveBeenCalled()
  })
})
