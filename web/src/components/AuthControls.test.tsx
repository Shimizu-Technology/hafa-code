import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthControls } from './AuthControls'
import type { CloudAuthControls, CloudAuthStatus } from '../contexts/AuthContext'

const auth = vi.hoisted(() => ({
  isSignedIn: false,
  cloudAuth: null as unknown as CloudAuthControls,
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuthContext: () => auth,
}))

function setStatus(status: CloudAuthStatus, isSignedIn = false) {
  auth.isSignedIn = isSignedIn
  auth.cloudAuth = { status, retryReloadsPage: false, openSignIn: vi.fn(), openSignUp: vi.fn(), mountUserButton: isSignedIn ? vi.fn(() => () => {}) : null }
}

describe('AuthControls', () => {
  afterEach(cleanup)

  it('renders the local-only state without requiring a Clerk provider', () => {
    render(<AuthControls cloudEnabled={false} />)

    expect(screen.getByText('Cloud save off')).toBeTruthy()
    expect(screen.getByTitle('Add a valid Clerk key to turn on cloud save')).toBeTruthy()
  })

  it('offers Sign in before Clerk has loaded and shows progress while it opens', async () => {
    setStatus('signed-out')
    const { rerender } = render(<AuthControls cloudEnabled />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }))
    expect(auth.cloudAuth.openSignIn).toHaveBeenCalledTimes(1)

    setStatus('opening')
    rerender(<AuthControls cloudEnabled />)
    const opening = screen.getByRole('button', { name: 'Opening sign-in…' })
    expect(opening.getAttribute('aria-busy')).toBe('true')
  })

  it('shows a neutral state, not Sign in, while a likely session is checked', () => {
    setStatus('checking')
    render(<AuthControls cloudEnabled />)
    expect(screen.getByRole('status').textContent).toContain('Checking your account')
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()
  })

  it('mounts the account menu for a signed-in learner and offers a retry when Clerk is unavailable', () => {
    setStatus('ready', true)
    const { rerender } = render(<AuthControls cloudEnabled />)
    expect(screen.getByText('Cloud sync on')).toBeTruthy()
    expect(auth.cloudAuth.mountUserButton).toHaveBeenCalledTimes(1)

    setStatus('unavailable')
    rerender(<AuthControls cloudEnabled />)
    expect(screen.getByRole('button', { name: 'Retry sign-in' })).toBeTruthy()

    auth.cloudAuth = { ...auth.cloudAuth, retryReloadsPage: true }
    rerender(<AuthControls cloudEnabled />)
    expect(screen.getByRole('button', { name: 'Reload to sign in' })).toBeTruthy()
  })
})
