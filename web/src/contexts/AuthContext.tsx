/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { api, setAuthTokenGetter, type CloudUser } from '../lib/api'

interface AuthContextType {
  isSignedIn: boolean
  isLoading: boolean
  user: CloudUser | null
  syncSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  isLoading: true,
  user: null,
  syncSession: async () => {},
})

export function useAuthContext() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { user: clerkUser } = useUser()
  const [user, setUser] = useState<CloudUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        return await getToken()
      } catch {
        return null
      }
    })
  }, [getToken])

  const syncSession = useCallback(async () => {
    if (!isSignedIn) return
    const res = await api.createSession()
    if (res.data?.user) setUser(res.data.user)
    if (res.error) console.error('Session sync failed:', res.error)
  }, [isSignedIn])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      queueMicrotask(() => {
        setUser(null)
        setIsLoading(false)
      })
      return
    }

    syncSession().finally(() => queueMicrotask(() => setIsLoading(false)))
  }, [isLoaded, isSignedIn, clerkUser?.id, syncSession])

  return (
    <AuthContext.Provider value={{ isSignedIn: isSignedIn ?? false, isLoading: !isLoaded || isLoading, user, syncSession }}>
      {children}
    </AuthContext.Provider>
  )
}
