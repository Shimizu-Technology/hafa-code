import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClerkBridgeProps, ClerkSnapshot } from './ClerkBridge'

const bridge = vi.hoisted(() => ({
  imports: 0,
  fail: false,
  crash: false,
  props: null as null | { onSnapshot: (snapshot: ClerkSnapshot) => void },
}))

// Stands in for the lazy Clerk chunk; counting imports proves when Clerk would download.
function bridgeFactory() {
  bridge.imports += 1
  if (bridge.fail) throw new Error('chunk failed')
  return {
    default: (props: ClerkBridgeProps) => {
      if (bridge.crash) throw new Error('Clerk render failed')
      bridge.props = props
      return null
    },
  }
}
vi.mock('./ClerkBridge', bridgeFactory)

const api = vi.hoisted(() => ({
  createSession: vi.fn(async () => ({
    data: { user: { id: 7, email: 'learner@example.com' }, organizations: [{ id: 3, name: 'FDMS' }] },
  })),
  tokenGetter: null as null | (() => Promise<string | null>),
}))

vi.mock('../lib/api', () => ({
  api: { createSession: api.createSession },
  setAuthTokenGetter: (getter: () => Promise<string | null>) => { api.tokenGetter = getter },
}))

function snapshot(overrides: Partial<ClerkSnapshot> = {}): ClerkSnapshot {
  return {
    isLoaded: true,
    isSignedIn: false,
    userId: null,
    failed: false,
    getToken: async () => 'clerk-token',
    openSignIn: vi.fn(),
    openSignUp: vi.fn(),
    mountUserButton: () => () => {},
    ...overrides,
  }
}

async function renderProvider() {
  const { CloudAuthProvider, resetClerkStartupPlanForTests, useAuthContext } = await import('./AuthContext')
  resetClerkStartupPlanForTests()
  function Probe() {
    const auth = useAuthContext()
    return (
      <div>
        <p data-testid="state">{`${auth.cloudAuth.status}|${auth.isLoading ? 'loading' : 'settled'}|${auth.isSignedIn ? 'in' : 'out'}|${auth.user?.email ?? '-'}`}</p>
        <button type="button" onClick={auth.cloudAuth.openSignIn}>Sign in</button>
      </div>
    )
  }
  render(<CloudAuthProvider publishableKey="pk_test_aGFmYS1lMmUuY2xlcmsuYWNjb3VudHMuZGV2JA"><Probe /></CloudAuthProvider>)
}

const state = () => screen.getByTestId('state').textContent

function clearCookies() {
  for (const name of ['__client_uat', '__client_uat_abc123', '__session']) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  }
}

describe('CloudAuthProvider', () => {
  beforeEach(() => {
    vi.resetModules()
    bridge.imports = 0
    bridge.fail = false
    bridge.crash = false
    bridge.props = null
    api.createSession.mockClear()
    clearCookies()
  })

  afterEach(() => {
    cleanup()
    clearCookies()
    vi.doUnmock('./ClerkBridge')
    vi.doMock('./ClerkBridge', bridgeFactory)
  })

  it('does not download Clerk for an anonymous visit until Sign in is pressed', async () => {
    await renderProvider()
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(state()).toBe('signed-out|settled|out|-')
    expect(bridge.imports).toBe(0)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }))
    expect(state()).toBe('opening|settled|out|-')
    await waitFor(() => expect(bridge.props).not.toBeNull())
    expect(bridge.imports).toBe(1)

    // Clerk queues the modal until its script is ready; the provider asks as soon as the bridge exists.
    const loading = snapshot({ isLoaded: false })
    act(() => bridge.props!.onSnapshot(loading))
    expect(loading.openSignIn).toHaveBeenCalledTimes(1)
    act(() => bridge.props!.onSnapshot(snapshot()))
    expect(state()).toBe('ready|settled|out|-')
    expect(localStorage.getItem('hafa-code-sign-in-intent-v1')).not.toBeNull()
  })

  it('loads Clerk after the editor for a likely session and shows a neutral state until it is known', async () => {
    document.cookie = '__client_uat_abc123=1729400000; path=/'
    await renderProvider()
    expect(state()).toBe('checking|loading|out|-')
    await waitFor(() => expect(bridge.props).not.toBeNull())

    act(() => bridge.props!.onSnapshot(snapshot({ isLoaded: false })))
    expect(state()).toBe('checking|loading|out|-')
    act(() => bridge.props!.onSnapshot(snapshot({ isSignedIn: true, userId: 'user_1' })))
    await waitFor(() => expect(state()).toBe('ready|settled|in|learner@example.com'))
    expect(api.createSession).toHaveBeenCalledTimes(1)
    await expect(api.tokenGetter!()).resolves.toBe('clerk-token')
    expect(localStorage.getItem('hafa-code-signed-in-hint-v1')).toBe('1')
  })

  it('forgets the marker when a likely session turns out to be signed out', async () => {
    localStorage.setItem('hafa-code-signed-in-hint-v1', '1')
    await renderProvider()
    expect(state()).toBe('checking|loading|out|-')
    await waitFor(() => expect(bridge.props).not.toBeNull())
    act(() => bridge.props!.onSnapshot(snapshot()))
    await waitFor(() => expect(state()).toBe('ready|settled|out|-'))
    expect(api.createSession).not.toHaveBeenCalled()
    await expect(api.tokenGetter!()).resolves.toBeNull()
    expect(localStorage.getItem('hafa-code-signed-in-hint-v1')).toBeNull()
  })

  it('settles as unavailable when the Clerk chunk cannot load, and retries on the next press', async () => {
    localStorage.setItem('hafa-code-signed-in-hint-v1', '1')
    bridge.fail = true
    vi.doMock('./ClerkBridge', bridgeFactory)
    await renderProvider()
    await waitFor(() => expect(state()).toBe('unavailable|settled|out|-'), { timeout: 3000 })

    bridge.fail = false
    vi.doMock('./ClerkBridge', bridgeFactory)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(bridge.props).not.toBeNull())
    expect(state()).toBe('opening|settled|out|-')
  })

  it('loads Clerk at once when returning from a Clerk redirect', async () => {
    window.history.replaceState(null, '', '/?__clerk_status=verified')
    await renderProvider()
    await waitFor(() => expect(bridge.props).not.toBeNull())
    expect(state()).toBe('checking|loading|out|-')
  })

  it('keeps the app running when Clerk throws while rendering', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('hafa-code-signed-in-hint-v1', '1')
    bridge.crash = true
    await renderProvider()
    await waitFor(() => expect(state()).toBe('unavailable|settled|out|-'))
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
    vi.mocked(console.error).mockRestore()
  })
})
