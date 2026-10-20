import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// Runs against a production build whose Clerk key points at a host that does not exist.
// The spec serves a small stand-in for Clerk's script there, so the app's real lazy loading,
// service worker, and Rails API calls run; the stand-in hands out Rails' test-only tokens.
const CLERK_HOST = 'hafa-e2e.clerk.accounts.dev'
const STUDENT_ID = 91_002

const STUB_CLERK_SCRIPT = `(() => {
  const persona = localStorage.getItem('e2e-stub-clerk-persona')
  const user = persona ? { id: 'user_e2e_' + persona, firstName: 'Test', lastName: 'Student', fullName: 'Test Student', primaryEmailAddress: { emailAddress: 'student@example.test' }, emailAddresses: [] } : null
  const session = persona ? { id: 'sess_e2e_' + persona, status: 'active', user, lastActiveToken: { jwt: { claims: { sub: 'user_e2e_' + persona, sid: 'sess_e2e_' + persona } } }, getToken: async () => 'test_token_' + persona } : null
  const client = { sessions: session ? [session] : [], signedInSessions: session ? [session] : [], activeSessions: session ? [session] : [], lastActiveSessionId: session ? session.id : null }
  const listeners = new Set()
  window.__stubClerk = { signInOpened: 0, signUpOpened: 0 }
  window.Clerk = {
    loaded: false,
    status: 'loading',
    version: '5.0.0-hafa-e2e-stub',
    client, session, user, organization: null,
    async load() { this.loaded = true; this.status = 'ready' },
    on(event, handler, options) { if (event === 'status' && options && options.notify) handler(this.status) },
    off() {},
    addListener(listener) {
      listeners.add(listener)
      listener({ client, session, user, organization: null })
      return () => listeners.delete(listener)
    },
    openSignIn() {
      window.__stubClerk.signInOpened += 1
      const dialog = document.createElement('div')
      dialog.setAttribute('role', 'dialog')
      dialog.setAttribute('aria-label', 'Stub Clerk sign in')
      document.body.append(dialog)
    },
    openSignUp() { window.__stubClerk.signUpOpened += 1 },
    mountUserButton(node) { node.innerHTML = '<button type="button">Stub account menu</button>' },
    unmountUserButton(node) { node.innerHTML = '' },
    __unstable__updateProps() {},
  }
})()`

interface Trace {
  clerkScript: number[]
  clerkChunk: number[]
  urls: string[]
}

async function trackClerk(context: BrowserContext): Promise<Trace> {
  const trace: Trace = { clerkScript: [], clerkChunk: [], urls: [] }
  await context.route(`https://${CLERK_HOST}/**`, (route) => {
    if (route.request().url().includes('/npm/@clerk/clerk-js@')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: STUB_CLERK_SCRIPT })
    }
    return route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' })
  })
  // Context-level events include requests the service worker makes while precaching.
  context.on('request', (request) => {
    const url = request.url()
    trace.urls.push(url)
    if (url.includes(CLERK_HOST)) trace.clerkScript.push(Date.now())
    if (/\/assets\/ClerkBridge-[\w-]+\.js/.test(url)) trace.clerkChunk.push(Date.now())
  })
  return trace
}

async function editorAndRunReady(page: Page) {
  await page.locator('.monaco-editor .view-lines').first().waitFor()
  await expect(page.locator('[data-hafa-run-button]:visible').first()).toBeEnabled()
}

test.describe('editor-first sign-in', () => {
  test('an anonymous visit never downloads Clerk until Sign in is pressed', async ({ context, page }) => {
    const trace = await trackClerk(context)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await editorAndRunReady(page)

    // Give idle-time work (Python prefetch, service worker precache) a chance to run.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
    await page.waitForTimeout(2_500)
    expect(trace.clerkScript, 'Clerk script requested on an anonymous visit').toHaveLength(0)
    expect(trace.clerkChunk, 'Clerk chunk requested on an anonymous visit').toHaveLength(0)
    const cached = await page.evaluate(async () => {
      const urls: string[] = []
      for (const key of await caches.keys()) {
        for (const request of await (await caches.open(key)).keys()) urls.push(new URL(request.url).pathname)
      }
      return urls
    })
    expect(cached.some((path) => path.includes('/assets/ClerkBridge-'))).toBe(false)
    expect(cached.some((path) => path.includes('/assets/LearningSidecar-'))).toBe(true)
    expect(cached.some((path) => path.includes('/assets/practiceLab-'))).toBe(true)

    const signIn = page.locator('.app-bar').getByRole('button', { name: 'Sign in' })
    await expect(signIn).toBeVisible()
    await signIn.click()
    await expect(page.getByRole('dialog', { name: 'Stub Clerk sign in' })).toBeAttached()
    expect(await page.evaluate(() => (window as unknown as { __stubClerk: { signInOpened: number } }).__stubClerk.signInOpened)).toBe(1)
    expect(trace.clerkChunk.length).toBeGreaterThan(0)
    expect(trace.clerkScript.length).toBeGreaterThan(0)
  })

  test('a returning signed-in learner gets Clerk after the editor, a neutral state, then their cloud work', async ({ context, page }) => {
    const trace = await trackClerk(context)
    await context.addCookies([{ name: '__client_uat', value: String(Math.floor(Date.now() / 1000)), url: test.info().project.use.baseURL! }])
    await context.addInitScript((persona) => {
      localStorage.setItem('e2e-stub-clerk-persona', persona)
      // Record whether signed-out controls ever flash for this learner.
      const w = window as unknown as { __signedOutFlash: string[]; __editorReadyAt: number }
      w.__signedOutFlash = []
      w.__editorReadyAt = 0
      new MutationObserver(() => {
        if (!w.__editorReadyAt && document.querySelector('.monaco-editor .view-lines')) w.__editorReadyAt = Date.now()
        for (const button of document.querySelectorAll('button')) {
          if (/^(Sign in|Opening sign-in…)$/.test(button.textContent?.trim() ?? '')) w.__signedOutFlash.push(button.textContent!.trim())
        }
        if (document.querySelector('.welcome-hero')) w.__signedOutFlash.push('welcome')
      }).observe(document, { childList: true, subtree: true })
    }, String(STUDENT_ID))
    await page.setViewportSize({ width: 1280, height: 800 })

    const session = page.waitForResponse((response) => response.url().endsWith('/api/v1/sessions') && response.request().method() === 'POST')
    await page.goto('/')
    await expect(page.locator('.app-bar').getByText('Checking your account')).toBeVisible()
    await editorAndRunReady(page)
    expect((await session).status()).toBe(200)

    await expect(page.locator('.app-bar').getByText('Cloud sync on')).toBeVisible()
    await expect(page.locator('.app-bar').getByRole('button', { name: 'Stub account menu' })).toBeVisible()
    const editorReadyAt = await page.evaluate(() => (window as unknown as { __editorReadyAt: number }).__editorReadyAt)
    expect(editorReadyAt).toBeGreaterThan(0)
    expect(trace.clerkChunk[0], 'Clerk waits for the editor').toBeGreaterThanOrEqual(editorReadyAt)
    expect(await page.evaluate(() => (window as unknown as { __signedOutFlash: string[] }).__signedOutFlash)).toEqual([])
    expect(await page.evaluate(() => localStorage.getItem('hafa-code-signed-in-hint-v1'))).toBe('1')

    // Cloud projects and teacher feedback still load for the signed-in learner.
    if (!await page.getByLabel('Switch workspace').isVisible()) await page.getByRole('button', { name: 'Workspace and display settings' }).click()
    await page.getByLabel('Switch workspace').selectOption('92001')
    await page.keyboard.press('Escape')
    const projects = page.locator('.sidebar-content')
    await projects.getByRole('button', { name: /Student Private Lab/ }).click()
    await expect(page.getByLabel('Project name')).toHaveValue('Student Private Lab')
    await expect(page.getByText('Explain why const is a good choice here.')).toBeVisible()
  })
})
