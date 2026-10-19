import { useEffect, useState } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react'
import { Cloud, Loader2 } from 'lucide-react'
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

function CloudAuthControls({ sessionLoading }: { sessionLoading: boolean }) {
  const { isLoaded } = useAuth()
  const [loadTimedOut, setLoadTimedOut] = useState(false)

  useEffect(() => {
    if (isLoaded) return

    const timeout = window.setTimeout(() => setLoadTimedOut(true), 8_000)
    return () => window.clearTimeout(timeout)
  }, [isLoaded])

  if (!isLoaded && loadTimedOut) {
    return <span className="cloud-pill muted"><Cloud size={15} aria-hidden="true" /> Cloud sign-in unavailable</span>
  }

  if (!isLoaded || sessionLoading) {
    return <span className="cloud-pill muted"><Loader2 className="spin" size={15} aria-hidden="true" /> Loading sign-in</span>
  }

  return (
    <div className="auth-actions">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="secondary sign-in-button" title="Sign in to sync your projects to your account"><Cloud size={16} aria-hidden="true" /> Sign in</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <span className="cloud-pill"><Cloud size={15} aria-hidden="true" /> Cloud sync on</span>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  )
}
