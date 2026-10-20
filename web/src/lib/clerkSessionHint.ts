/**
 * Decides when the Clerk sign-in code (about 300 KB) should download.
 *
 * Most learners never sign in, so an anonymous visit loads Clerk only when they press
 * "Sign in". A browser that probably has a session (Clerk's session cookies, or our own
 * marker from an earlier signed-in visit) loads it right after the editor is ready, so
 * cloud projects still arrive without a tap. A return from a Clerk redirect or an
 * invitation link loads it immediately because the learner is in the middle of signing in.
 */
export type ClerkStartup = 'immediate' | 'after-editor' | 'on-demand'

export const SIGNED_IN_HINT_STORAGE_KEY = 'hafa-code-signed-in-hint-v1'
export const SIGN_IN_INTENT_STORAGE_KEY = 'hafa-code-sign-in-intent-v1'
/** Long enough to finish an email code or a Google redirect, short enough to forget a closed modal. */
export const SIGN_IN_INTENT_TTL_MS = 15 * 60_000

const SESSION_COOKIE_PATTERN = /^(__client_uat|__session)(_[A-Za-z0-9-]+)?$/

/** Clerk writes `__client_uat=0` when signed out and a timestamp when a session exists. */
export function clerkSessionCookiePresent(cookie: string) {
  return cookie.split(';').some((part) => {
    const separator = part.indexOf('=')
    if (separator < 0) return false
    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    const match = SESSION_COOKIE_PATTERN.exec(name)
    if (!match || !value) return false
    return match[1] === '__session' || value !== '0'
  })
}

function readStorage(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeStorage(storage: Storage | undefined, key: string, value: string | null) {
  try {
    if (value === null) storage?.removeItem(key)
    else storage?.setItem(key, value)
  } catch {
    // Private browsing can refuse storage; the cookie check still works.
  }
}

function defaultStorage() {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function signInIntentIsFresh(storage = defaultStorage(), now = Date.now()) {
  const startedAt = Number(readStorage(storage, SIGN_IN_INTENT_STORAGE_KEY))
  return Number.isFinite(startedAt) && startedAt > 0 && now - startedAt >= 0 && now - startedAt < SIGN_IN_INTENT_TTL_MS
}

export function clerkStartupFor({
  cookie,
  hash,
  search,
  storage,
  now = Date.now(),
}: {
  cookie: string
  hash: string
  search: string
  storage?: Storage
  now?: number
}): ClerkStartup {
  // Clerk adds __clerk_* parameters or an sso-callback route when it hands a session back
  // (OAuth, email links, handshake).
  if (/[?&#]__clerk_|sso-callback/.test(`${search}${hash}`)) return 'immediate'
  if (new URLSearchParams(hash.replace(/^#/, '')).has('invite')) return 'immediate'
  if (signInIntentIsFresh(storage, now)) return 'immediate'
  if (clerkSessionCookiePresent(cookie) || readStorage(storage, SIGNED_IN_HINT_STORAGE_KEY) === '1') return 'after-editor'
  return 'on-demand'
}

export function currentClerkStartup(): ClerkStartup {
  return clerkStartupFor({
    cookie: typeof document === 'undefined' ? '' : document.cookie,
    hash: window.location.hash,
    search: window.location.search,
    storage: defaultStorage(),
  })
}

/** Remembers whether this browser was last signed in, so the next visit loads Clerk early. */
export function rememberSignedIn(signedIn: boolean, storage = defaultStorage()) {
  writeStorage(storage, SIGNED_IN_HINT_STORAGE_KEY, signedIn ? '1' : null)
  if (signedIn) writeStorage(storage, SIGN_IN_INTENT_STORAGE_KEY, null)
}

/** Marks a sign-in in progress so a redirect back to Hafa Code finishes it without another tap. */
export function rememberSignInIntent(storage = defaultStorage(), now = Date.now()) {
  writeStorage(storage, SIGN_IN_INTENT_STORAGE_KEY, String(now))
}
