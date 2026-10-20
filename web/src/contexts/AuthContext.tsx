/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { Component, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, setAuthTokenGetter, type CloudOrganization, type CloudUser } from '../lib/api'
import {
  currentClerkStartup,
  rememberSignedIn,
  rememberSignInIntent,
  type ClerkStartup,
} from '../lib/clerkSessionHint'
import { createLazyModule } from '../lib/lazyModule'
import { holdOptionalDownloadsUntil, runAfterEditor } from '../lib/startupScheduler'
import type { ClerkSnapshot } from './ClerkBridge'

/**
 * - `off`: no Clerk key; the app is a local-only playground.
 * - `signed-out`: Clerk has not been needed yet, or it loaded and nobody is signed in.
 * - `checking`: this browser probably has a session; Clerk is loading in the background.
 * - `opening`: the learner pressed Sign in and Clerk is downloading.
 * - `ready`: Clerk is loaded (signed in or out).
 * - `unavailable`: Clerk could not load (offline, blocked, or a bad key).
 */
export type CloudAuthStatus = 'off' | 'signed-out' | 'checking' | 'opening' | 'ready' | 'unavailable'

export interface CloudAuthControls {
  status: CloudAuthStatus
  /**
   * Clerk's own script failed after loading started. Clerk keeps that failed instance for
   * the page, so a retry reloads the page (projects autosave locally on every change).
   */
  retryReloadsPage: boolean
  openSignIn: () => void
  openSignUp: () => void
  /** Mounts Clerk's account menu; null until Clerk is loaded. */
  mountUserButton: ((node: HTMLDivElement) => () => void) | null
}

interface AuthContextType {
  isSignedIn: boolean
  isLoading: boolean
  user: CloudUser | null
  organizations: CloudOrganization[]
  syncSession: () => Promise<void>
  cloudAuth: CloudAuthControls
}

const OFFLINE_CLOUD_AUTH: CloudAuthControls = {
  status: 'off',
  retryReloadsPage: false,
  openSignIn: () => {},
  openSignUp: () => {},
  mountUserButton: null,
}

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  isLoading: false,
  user: null,
  organizations: [],
  syncSession: async () => {},
  cloudAuth: OFFLINE_CLOUD_AUTH,
})

export function useAuthContext() {
  return useContext(AuthContext)
}

const clerkBridge = createLazyModule(() => import('./ClerkBridge'))

/** Clerk renders beside the app, so an error inside it must never take the editor down with it. */
class ClerkErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Cloud sign-in stopped working:', error)
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Optional downloads and the neutral "Checking your account" state wait for a returning
 * learner's sign-in, but never longer than this; after it the app shows Sign in.
 */
const SIGN_IN_HOLD_LIMIT_MS = 20_000

let startupPlan: { startup: ClerkStartup; settle: () => void } | null = null

/** Decided once per page so StrictMode's double render cannot create a second hold. */
function clerkStartupPlan() {
  if (!startupPlan) {
    const startup = currentClerkStartup()
    let settle = () => {}
    if (startup !== 'on-demand') {
      holdOptionalDownloadsUntil(new Promise<void>((resolve) => {
        settle = resolve
        window.setTimeout(resolve, SIGN_IN_HOLD_LIMIT_MS)
      }))
    }
    startupPlan = { startup, settle }
  }
  return startupPlan
}

/** Test-only: forget the per-page startup decision. */
export function resetClerkStartupPlanForTests() {
  startupPlan = null
}

/**
 * Cloud sign-in without putting Clerk on the critical path. Clerk's code downloads
 * when the learner presses Sign in, or after the editor is ready when this browser
 * probably has a session. Until a likely session is confirmed, `isLoading` stays true
 * so the app shows a neutral state instead of flashing signed-out controls.
 */
export function CloudAuthProvider({ publishableKey, children }: { publishableKey: string; children: ReactNode }) {
  const [{ startup, settle }] = useState(clerkStartupPlan)
  const expectingSession = startup !== 'on-demand'
  const [requested, setRequested] = useState(startup === 'immediate')
  const [opening, setOpening] = useState(false)
  const [snapshot, setSnapshot] = useState<ClerkSnapshot | null>(null)
  const snapshotRef = useRef<ClerkSnapshot | null>(null)
  const pendingOpenRef = useRef<'sign-in' | 'sign-up' | null>(null)
  const { module: bridge, state: bridgeState, retry: retryBridge } = clerkBridge.useModule(requested)
  const [user, setUser] = useState<CloudUser | null>(null)
  const [organizations, setOrganizations] = useState<CloudOrganization[]>([])
  const [firstAnswer, setFirstAnswer] = useState(false)
  const [bridgeCrashed, setBridgeCrashed] = useState(false)
  const clerkFailed = bridgeState === 'failed' || bridgeCrashed || Boolean(snapshot?.failed)
  const isLoaded = Boolean(snapshot?.isLoaded)
  // Set after a failed first attempt or a stalled one (SIGN_IN_HOLD_LIMIT_MS). The app has then
  // settled as signed out, and a retry from Sign in does not bring back the neutral state.
  const [gaveUpWaiting, setGaveUpWaiting] = useState(false)
  if (clerkFailed && !gaveUpWaiting) setGaveUpWaiting(true)
  const isSignedIn = isLoaded && Boolean(snapshot?.isSignedIn)

  useEffect(() => {
    setAuthTokenGetter(async () => {
      const current = snapshotRef.current
      return current?.isLoaded && current.isSignedIn ? current.getToken() : null
    })
  }, [])

  useEffect(() => {
    if (startup !== 'after-editor') return
    return runAfterEditor(() => setRequested(true))
  }, [startup])

  const handleSnapshot = useCallback((next: ClerkSnapshot) => {
    snapshotRef.current = next
    setSnapshot(next)
    const pending = pendingOpenRef.current
    if (pending) {
      pendingOpenRef.current = null
      if (pending === 'sign-in') next.openSignIn()
      else next.openSignUp()
    }
  }, [])

  const handleBridgeCrash = useCallback(() => {
    snapshotRef.current = null
    setSnapshot(null)
    setBridgeCrashed(true)
  }, [])

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
      rememberSignedIn(false)
      queueMicrotask(() => {
        setUser(null)
        setOrganizations([])
        setFirstAnswer(true)
      })
      return
    }

    rememberSignedIn(true)
    syncSession().finally(() => queueMicrotask(() => setFirstAnswer(true)))
  }, [isLoaded, isSignedIn, snapshot?.userId, syncSession])

  useEffect(() => {
    if (isLoaded || clerkFailed) setOpening(false)
    if (clerkFailed) pendingOpenRef.current = null
  }, [clerkFailed, isLoaded])

  useEffect(() => {
    if (firstAnswer || clerkFailed) settle()
  }, [clerkFailed, firstAnswer, settle])

  useEffect(() => {
    if (!expectingSession || firstAnswer || gaveUpWaiting) return
    const timeout = window.setTimeout(() => setGaveUpWaiting(true), SIGN_IN_HOLD_LIMIT_MS)
    return () => window.clearTimeout(timeout)
  }, [expectingSession, firstAnswer, gaveUpWaiting])

  const open = useCallback((intent: 'sign-in' | 'sign-up') => {
    rememberSignInIntent()
    const current = snapshotRef.current
    if (current?.failed) {
      window.location.reload()
      return
    }
    if (current) {
      if (intent === 'sign-in') current.openSignIn()
      else current.openSignUp()
      return
    }
    pendingOpenRef.current = intent
    setOpening(true)
    setRequested(true)
    setBridgeCrashed(false)
    if (bridgeState === 'failed') retryBridge()
  }, [bridgeState, retryBridge])

  const mountUserButton = useCallback((node: HTMLDivElement) => (
    snapshotRef.current?.mountUserButton(node) ?? (() => {})
  ), [])

  const status: CloudAuthStatus = clerkFailed
    ? 'unavailable'
    : isLoaded
      ? 'ready'
      : opening
        ? 'opening'
        : expectingSession && !gaveUpWaiting
          ? 'checking'
          : 'signed-out'

  const retryReloadsPage = Boolean(snapshot?.failed)
  const cloudAuth = useMemo<CloudAuthControls>(() => ({
    status,
    retryReloadsPage,
    openSignIn: () => open('sign-in'),
    openSignUp: () => open('sign-up'),
    mountUserButton: isLoaded ? mountUserButton : null,
  }), [isLoaded, mountUserButton, open, retryReloadsPage, status])

  const isLoading = expectingSession && !firstAnswer && !clerkFailed && !gaveUpWaiting
  const Bridge = bridge?.default

  return (
    <AuthContext.Provider value={{ isSignedIn, isLoading, user, organizations, syncSession, cloudAuth }}>
      {children}
      {Bridge && !bridgeCrashed && (
        <ClerkErrorBoundary onError={handleBridgeCrash}>
          <Bridge publishableKey={publishableKey} onSnapshot={handleSnapshot} />
        </ClerkErrorBoundary>
      )}
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

const E2E_CLOUD_AUTH: CloudAuthControls = { ...OFFLINE_CLOUD_AUTH, status: 'ready' }

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
    <AuthContext.Provider value={{ isSignedIn: Boolean(personaId), isLoading, user, organizations, syncSession, cloudAuth: E2E_CLOUD_AUTH }}>
      {children}
    </AuthContext.Provider>
  )
}
