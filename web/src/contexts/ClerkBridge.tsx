import { useEffect } from 'react'
import { ClerkProvider, useAuth, useClerk } from '@clerk/clerk-react'

/** What the always-loaded auth provider needs from Clerk, without importing Clerk itself. */
export interface ClerkSnapshot {
  isLoaded: boolean
  isSignedIn: boolean
  userId: string | null
  /** Clerk could not start (script blocked, offline, or a bad key). */
  failed: boolean
  getToken: () => Promise<string | null>
  openSignIn: () => void
  openSignUp: () => void
  /** Mounts Clerk's account menu into `node`; returns the unmount function. */
  mountUserButton: (node: HTMLDivElement) => () => void
}

export interface ClerkBridgeProps {
  publishableKey: string
  onSnapshot: (snapshot: ClerkSnapshot) => void
}

/**
 * Loaded on demand by CloudAuthProvider. It renders no UI of its own and sits beside the
 * app instead of around it, so the workspace never remounts when Clerk arrives.
 */
export default function ClerkBridge({ publishableKey, onSnapshot }: ClerkBridgeProps) {
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <ClerkReporter onSnapshot={onSnapshot} />
    </ClerkProvider>
  )
}

function ClerkReporter({ onSnapshot }: Pick<ClerkBridgeProps, 'onSnapshot'>) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth()
  const clerk = useClerk()
  const failed = !isLoaded && (clerk as { status?: string }).status === 'error'

  useEffect(() => {
    onSnapshot({
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      userId: userId ?? null,
      failed,
      getToken: async () => {
        try {
          return await getToken()
        } catch {
          return null
        }
      },
      // Clerk queues these until its script has loaded, then opens the modal.
      openSignIn: () => clerk.openSignIn(),
      openSignUp: () => clerk.openSignUp(),
      mountUserButton: (node) => {
        clerk.mountUserButton(node)
        return () => clerk.unmountUserButton(node)
      },
    })
  }, [clerk, failed, getToken, isLoaded, isSignedIn, onSnapshot, userId])

  return null
}
