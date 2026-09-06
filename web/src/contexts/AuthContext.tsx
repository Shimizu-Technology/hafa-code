/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { api, setAuthTokenGetter, type CloudOrganization, type CloudUser } from '../lib/api'

interface AuthContextType {
  isSignedIn: boolean
  isLoading: boolean
  user: CloudUser | null
  organizations: CloudOrganization[]
  syncSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  isLoading: true,
  user: null,
  organizations: [],
  syncSession: async () => {},
})

export function useAuthContext() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { user: clerkUser } = useUser()
  const [user, setUser] = useState<CloudUser | null>(null)
  const [organizations, setOrganizations] = useState<CloudOrganization[]>([])
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
    if (res.data?.organizations) setOrganizations(res.data.organizations)
    if (res.error) console.error('Session sync failed:', res.error)
  }, [isSignedIn])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      queueMicrotask(() => {
        setUser(null)
        setOrganizations([])
        setIsLoading(false)
      })
      return
    }

    syncSession().finally(() => queueMicrotask(() => setIsLoading(false)))
  }, [isLoaded, isSignedIn, clerkUser?.id, syncSession])

  return (
    <AuthContext.Provider value={{ isSignedIn: isSignedIn ?? false, isLoading: !isLoaded || isLoading, user, organizations, syncSession }}>
      {children}
    </AuthContext.Provider>
  )
}

const E2E_PERSONA_IDS: Record<string, number> = {
  teacher: 91_001,
  student: 91_002,
  classmate: 91_003,
  invitee: 91_004,
  admin: 91_005,
  instructor: 91_006,
  dualStudent: 91_007,
  outsider: 91_008,
}

function selectedE2EPersonaId() {
  const persona = new URLSearchParams(window.location.search).get('e2e_user')
  return persona ? E2E_PERSONA_IDS[persona] : undefined
}

export function configureE2EAuthToken() {
  const personaId = selectedE2EPersonaId()
  setAuthTokenGetter(async () => personaId ? `test_token_${personaId}` : null)
}

/** Uses Rails' test-only tokens for deterministic browser tests. Never mount outside the guarded E2E Vite mode. */
export function E2EAuthProvider({ children }: { children: ReactNode }) {
  const personaId = selectedE2EPersonaId()
  const [user, setUser] = useState<CloudUser | null>(null)
  const [organizations, setOrganizations] = useState<CloudOrganization[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const syncSession = useCallback(async () => {
    if (!personaId) return
    const res = await api.createSession()
    if (res.data?.user) setUser(res.data.user)
    if (res.data?.organizations) setOrganizations(res.data.organizations)
    if (res.error) console.error('E2E session sync failed:', res.error)
  }, [personaId])

  useEffect(() => {
    syncSession().finally(() => queueMicrotask(() => setIsLoading(false)))
  }, [syncSession])

  return (
    <AuthContext.Provider value={{ isSignedIn: Boolean(personaId), isLoading, user, organizations, syncSession }}>
      {children}
    </AuthContext.Provider>
  )
}
