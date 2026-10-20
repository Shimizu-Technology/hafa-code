import { useEffect, useRef } from 'react'
import { Cloud, Loader2, RotateCcw } from 'lucide-react'
import { useAuthContext } from '../contexts/AuthContext'
import { e2eAuthEnabled } from '../lib/e2eAuth'

export function AuthControls({ cloudEnabled, sessionLoading = false }: { cloudEnabled: boolean; sessionLoading?: boolean }) {
  if (!cloudEnabled) {
    return <span className="cloud-pill muted" title="Add a valid Clerk key to turn on cloud save"><Cloud size={15} aria-hidden="true" /> Cloud save off</span>
  }

  if (e2eAuthEnabled) {
    return <span className="cloud-pill"><Cloud size={15} aria-hidden="true" /> Classroom test session</span>
  }

  return <CloudAuthControls sessionLoading={sessionLoading} />
}

/** Signed-out learners get a plain button; Clerk's code downloads only when it is pressed. */
export function SignInButton({ className = 'secondary sign-in-button', label = 'Sign in' }: { className?: string; label?: string }) {
  const { cloudAuth } = useAuthContext()
  const opening = cloudAuth.status === 'opening'
  return (
    <button
      className={className}
      type="button"
      title="Sign in to sync your projects to your account"
      aria-busy={opening || undefined}
      onClick={cloudAuth.openSignIn}
    >
      {opening ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Cloud size={16} aria-hidden="true" />}
      {opening ? 'Opening sign-in…' : label}
    </button>
  )
}

function CloudAuthControls({ sessionLoading }: { sessionLoading: boolean }) {
  const { cloudAuth, isSignedIn } = useAuthContext()

  if (cloudAuth.status === 'unavailable') {
    return (
      <button
        className="secondary sign-in-button"
        type="button"
        title={cloudAuth.retryReloadsPage
          ? 'Cloud sign-in could not load. Reload the page to try again; your projects are saved in this browser.'
          : 'Cloud sign-in could not load. Check your connection, then try again.'}
        onClick={cloudAuth.openSignIn}
      >
        <RotateCcw size={16} aria-hidden="true" /> {cloudAuth.retryReloadsPage ? 'Reload to sign in' : 'Retry sign-in'}
      </button>
    )
  }

  if (cloudAuth.status === 'checking' || (isSignedIn && sessionLoading)) {
    return <span className="cloud-pill muted" role="status"><Loader2 className="spin" size={15} aria-hidden="true" /> Checking your account</span>
  }

  if (!isSignedIn) {
    return (
      <div className="auth-actions">
        <SignInButton />
      </div>
    )
  }

  return (
    <div className="auth-actions">
      <span className="cloud-pill"><Cloud size={15} aria-hidden="true" /> Cloud sync on</span>
      {cloudAuth.mountUserButton && <ClerkUserButton mount={cloudAuth.mountUserButton} />}
    </div>
  )
}

function ClerkUserButton({ mount }: { mount: (node: HTMLDivElement) => () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    return mount(ref.current)
  }, [mount])
  return <div className="clerk-user-button" ref={ref} />
}
