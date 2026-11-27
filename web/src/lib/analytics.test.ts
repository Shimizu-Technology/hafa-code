import { afterEach, describe, expect, it, vi } from 'vitest'

const initMock = vi.fn()

vi.mock('posthog-js', () => ({
  default: {
    init: initMock,
  },
}))

describe('Håfa Code analytics', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    initMock.mockClear()
  })

  it('redacts sensitive query params, strips #invite fragments, and preserves unrelated params', async () => {
    const { sanitizeAnalyticsUrl } = await import('./analytics.ts')

    expect(
      sanitizeAnalyticsUrl('https://code.shimizu-technology.com/?email=learner@example.test&lang=python#invite=SECRET_TOKEN'),
    ).toBe('https://code.shimizu-technology.com/?email=%5BREDACTED%5D&lang=python')

    expect(sanitizeAnalyticsUrl('/?invitation_token=abc&tab=lab#invite=tok')).toBe(
      '/?invitation_token=%5BREDACTED%5D&tab=lab',
    )

    expect(sanitizeAnalyticsUrl('http://[::1')).toBe('http://[::1')
  })

  it('sanitizes top-level URL properties, nested replay metadata, and network requests', async () => {
    const { maskReplayNetworkRequest, sanitizeAnalyticsEvent } = await import('./analytics.ts')

    expect(sanitizeAnalyticsEvent(null)).toBeNull()

    const sanitized = sanitizeAnalyticsEvent({
      uuid: '1',
      event: '$snapshot',
      properties: {
        $current_url: 'https://code.shimizu-technology.com/?email=learner@example.test#invite=tok',
        $referrer: 'https://code.shimizu-technology.com/?token=secret',
        $initial_current_url: 'https://code.shimizu-technology.com/?jwt=1',
        $initial_referrer: 'https://code.shimizu-technology.com/?code=2',
        $session_entry_url: 'https://code.shimizu-technology.com/?state=3',
        $session_entry_referrer: 'https://code.shimizu-technology.com/?key=4',
        lang: 'python',
        $snapshot_data: [
          {
            type: 4,
            data: { href: 'https://code.shimizu-technology.com/?email=learner@example.test#invite=tok' },
          },
        ],
      },
    })

    expect(sanitized?.properties.$current_url).toBe('https://code.shimizu-technology.com/?email=%5BREDACTED%5D')
    expect(sanitized?.properties.lang).toBe('python')
    expect(sanitized?.properties.$snapshot_data).toEqual([
      {
        type: 4,
        data: { href: 'https://code.shimizu-technology.com/?email=%5BREDACTED%5D' },
      },
    ])

    expect(
      maskReplayNetworkRequest({
        name: 'https://code.shimizu-technology.com/?email=learner@example.test#invite=tok',
      }),
    ).toEqual({
      name: 'https://code.shimizu-technology.com/?email=%5BREDACTED%5D',
    })
  })

  it('initializes PostHog once in production with a valid key and reuses the promise', async () => {
    vi.stubEnv('VITE_PUBLIC_POSTHOG_KEY', 'phc_valid_key')
    vi.stubEnv('PROD', true)

    const { loadPostHog, isAnalyticsEnabled } = await import('./analytics.ts')
    expect(isAnalyticsEnabled).toBe(true)

    const p1 = loadPostHog()
    const p2 = loadPostHog()
    expect(p1).toBe(p2)
    await p1

    expect(initMock).toHaveBeenCalledTimes(1)
    expect(initMock).toHaveBeenCalledWith(
      'phc_valid_key',
      expect.objectContaining({
        disable_session_recording: false,
        session_recording: expect.objectContaining({
          maskAllInputs: true,
          maskTextSelector: '.monaco-editor',
          recordBody: false,
          recordHeaders: false,
        }),
      }),
    )
  })

  it('skips loading when key is missing, placeholder, or in dev without opt-in', async () => {
    vi.stubEnv('VITE_PUBLIC_POSTHOG_KEY', 'YOUR_POSTHOG_KEY')
    vi.stubEnv('PROD', true)
    const mod1 = await import('./analytics.ts')
    expect(await mod1.loadPostHog()).toBeNull()
    expect(initMock).not.toHaveBeenCalled()

    vi.resetModules()
    vi.stubEnv('VITE_PUBLIC_POSTHOG_KEY', 'phc_valid_key')
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_ENABLE_ANALYTICS_IN_DEV', 'false')
    const mod2 = await import('./analytics.ts')
    expect(await mod2.loadPostHog()).toBeNull()
    expect(initMock).not.toHaveBeenCalled()
  })
})
