import { useEffect, useState } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react'
import { Cloud, Loader2 } from 'lucide-react'

export function AuthControls({ cloudEnabled, sessionLoading = false }: { cloudEnabled: boolean; sessionLoading?: boolean }) {
  const { isLoaded } = useAuth()
  const [loadTimedOut, setLoadTimedOut] = useState(false)

  useEffect(() => {
    if (!cloudEnabled || isLoaded) return

    const timeout = window.setTimeout(() => setLoadTimedOut(true), 8_000)
    return () => window.clearTimeout(timeout)
  }, [cloudEnabled, isLoaded])

  if (!cloudEnabled) {
    return <span className="cloud-pill muted"><Cloud size={15} /> Add a valid Clerk key for cloud save</span>
  }

  if (!isLoaded && loadTimedOut) {
    return <span className="cloud-pill muted"><Cloud size={15} /> Cloud sign-in unavailable</span>
  }

  if (!isLoaded || sessionLoading) {
    return <span className="cloud-pill muted"><Loader2 className="spin" size={15} /> Loading sign-in</span>
  }

  return (
    <div className="auth-actions">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="secondary"><Cloud size={16} /> Sign in to sync</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <span className="cloud-pill"><Cloud size={15} /> Cloud sync on</span>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  )
}
