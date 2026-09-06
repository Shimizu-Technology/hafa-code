import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, setAuthTokenGetter } from './api'

afterEach(() => {
  setAuthTokenGetter(async () => null)
  vi.unstubAllGlobals()
})

describe('API authentication failures', () => {
  it('returns the normal error result when the token provider rejects', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    setAuthTokenGetter(async () => {
      throw new Error('Session token unavailable')
    })

    await expect(api.getInvitation('test-invite')).resolves.toEqual({
      data: null,
      error: 'Session token unavailable',
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
