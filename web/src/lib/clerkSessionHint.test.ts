import { describe, expect, it } from 'vitest'
import {
  SIGNED_IN_HINT_STORAGE_KEY,
  SIGN_IN_INTENT_STORAGE_KEY,
  SIGN_IN_INTENT_TTL_MS,
  clerkSessionCookiePresent,
  clerkStartupFor,
  rememberSignedIn,
  rememberSignInIntent,
} from './clerkSessionHint'

const NOW = 1_800_000_000_000
const base = { cookie: '', hash: '', search: '', storage: localStorage, now: NOW }

describe('Clerk session hints', () => {
  it('reads Clerk session cookies, ignoring the signed-out marker', () => {
    expect(clerkSessionCookiePresent('')).toBe(false)
    expect(clerkSessionCookiePresent('theme=dark; __client_uat=0')).toBe(false)
    expect(clerkSessionCookiePresent('__client_uat_Xy-12=0; other=1')).toBe(false)
    expect(clerkSessionCookiePresent('__client_uat=1729400000')).toBe(true)
    expect(clerkSessionCookiePresent('a=b; __client_uat_Xy-12=1729400000')).toBe(true)
    expect(clerkSessionCookiePresent('__session=eyJhbGciOi.payload.sig')).toBe(true)
    expect(clerkSessionCookiePresent('__session=')).toBe(false)
    expect(clerkSessionCookiePresent('my__client_uat=1')).toBe(false)
  })

  it('keeps anonymous visits on demand', () => {
    expect(clerkStartupFor(base)).toBe('on-demand')
    expect(clerkStartupFor({ ...base, cookie: '__client_uat=0' })).toBe('on-demand')
    expect(clerkStartupFor({ ...base, search: '?lesson=abc', hash: '#share=xyz' })).toBe('on-demand')
  })

  it('loads after the editor when a session is likely', () => {
    expect(clerkStartupFor({ ...base, cookie: '__client_uat=1729400000' })).toBe('after-editor')
    rememberSignedIn(true)
    expect(localStorage.getItem(SIGNED_IN_HINT_STORAGE_KEY)).toBe('1')
    expect(clerkStartupFor(base)).toBe('after-editor')
    rememberSignedIn(false)
    expect(clerkStartupFor(base)).toBe('on-demand')
  })

  it('loads at once for Clerk redirects, invitations, and a sign-in in progress', () => {
    expect(clerkStartupFor({ ...base, search: '?__clerk_status=verified' })).toBe('immediate')
    expect(clerkStartupFor({ ...base, hash: '#__clerk_db_jwt=abc' })).toBe('immediate')
    expect(clerkStartupFor({ ...base, hash: '#invite=token123' })).toBe('immediate')

    rememberSignInIntent(localStorage, NOW - 1_000)
    expect(clerkStartupFor(base)).toBe('immediate')
    expect(clerkStartupFor({ ...base, now: NOW + SIGN_IN_INTENT_TTL_MS })).toBe('on-demand')

    rememberSignedIn(true)
    expect(localStorage.getItem(SIGN_IN_INTENT_STORAGE_KEY)).toBeNull()
  })
})
