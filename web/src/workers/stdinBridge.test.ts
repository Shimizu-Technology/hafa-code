import { describe, expect, it, vi } from 'vitest'
import { createStdinBridge } from './stdinBridge'

describe('stdin bridge', () => {
  it('requests terminal input and resolves with the submitted value', async () => {
    const onRequest = vi.fn()
    const bridge = createStdinBridge(onRequest)
    const value = bridge.read()

    expect(onRequest).toHaveBeenCalledOnce()
    bridge.write('Hafa adai')

    await expect(value).resolves.toBe('Hafa adai')
  })

  it('rejects pending input when execution is stopped', async () => {
    const bridge = createStdinBridge(() => undefined)
    const value = bridge.read()

    bridge.abort()

    await expect(value).rejects.toThrow('Execution stopped.')
  })
})
