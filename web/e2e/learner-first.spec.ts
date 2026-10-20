import { expect, test, type Page } from '@playwright/test'

async function openPython(page: Page) {
  const session = page.waitForResponse((response) => response.url().endsWith('/api/v1/sessions') && response.request().method() === 'POST')
  await page.goto('/?e2e_user=student&lang=python')
  expect((await session).status()).toBe(200)
  await expect(page.getByLabel('Project name')).toHaveValue(/^Python Playground/)
  await page.locator('.monaco-editor').first().waitFor()
}

test('the editor starts high and Run is the only visible primary action', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await openPython(page)
    const editor = await page.locator('.editor-panel .monaco-editor').boundingBox()
    expect(editor!.y, `editor top at ${viewport.width}`).toBeLessThanOrEqual(200)
    const primaries = page.locator('button.primary:visible')
    await expect(primaries).toHaveCount(1)
    await expect(primaries.first()).toHaveAttribute('data-hafa-run-button')
    await expect(page.locator('.welcome-hero')).toHaveCount(0)
  }
})

test('a first visit gets a light welcome that leads to a Python project', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  // An anonymous first visit: no saved projects, no sign-in, no project or language link.
  await page.goto('/')
  const welcome = page.locator('.welcome-hero')
  await expect(welcome).toBeVisible()
  await welcome.getByRole('button', { name: 'New Python project' }).click()
  await expect(welcome).toHaveCount(0)
  await expect(page.getByLabel('Project name')).toHaveValue(/^Python Playground/)
})

test('keyboard focus is visible with the focus-ring token', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openPython(page)
  const share = page.locator('.app-bar').getByRole('button', { name: 'Share' })
  await share.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(share).toBeFocused()
  await expect(share).toHaveCSS('outline-style', 'solid')
  await expect(share).toHaveCSS('outline-width', '2px')
  await expect(share).toHaveCSS('outline-color', 'rgb(19, 111, 99)')
})

test('a menu action that opens a dialog returns focus to the menu button', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openPython(page)
  const more = page.getByRole('button', { name: 'More project actions' })
  await more.focus()
  await page.keyboard.press('Enter')
  const duplicate = page.getByRole('group', { name: 'Project actions' }).getByRole('button', { name: 'Duplicate' })
  await duplicate.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Where should the copy live?' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Where should the copy live?' })).toHaveCount(0)
  await expect(more).toBeFocused()
})

test('Python indents with four spaces', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openPython(page)
  expect(await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue('for i in range(2):'))).toBe(true)
  await page.locator('.monaco-editor .view-lines').click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('Enter')
  await page.keyboard.insertText('42')
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('\u00a0\u00a0\u00a0\u00a042')
})

test('runs show success timing, then an error headline, then "Fixed"', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openPython(page)
  const panel = page.locator('.output-panel')
  await page.getByRole('button', { name: 'Run Python' }).click()
  await expect(panel).toHaveAttribute('data-run-status', 'success', { timeout: 90_000 })
  await expect(page.locator('.run-status')).toContainText(/Ran in \d+ ms/)

  expect(await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue('total = 5\nprint(totl)\n'))).toBe(true)
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(panel).toHaveAttribute('data-run-status', 'error')
  await expect(page.locator('.run-error-headline')).toContainText("Did you mean: 'total'?")

  expect(await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue('total = 5\nprint(total)\n'))).toBe(true)
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(page.locator('.run-status')).toContainText('Fixed. It runs now.')
})

test('the runner keeps a usable width beside the editor and sidecar', async ({ page }) => {
  for (const width of [1280, 1440, 1600, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await openPython(page)
    await page.locator('.app-bar').getByRole('button', { name: 'Python guide' }).click()
    const runner = await page.locator('.output-panel').boundingBox()
    const editor = await page.locator('.editor-panel').boundingBox()
    expect(runner!.width, `runner at ${width}`).toBeGreaterThanOrEqual(380)
    expect(editor!.width, `editor at ${width}`).toBeGreaterThanOrEqual(480)
    await page.getByRole('button', { name: 'Close learning sidecar' }).click()
  }
})

test('toasts sit bottom-right without covering controls and leave on their own', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openPython(page)
  await page.locator('.sidebar-content').getByRole('button', { name: 'JS', exact: true }).click()
  const toast = page.locator('.floating-dock .toast')
  await expect(toast).toHaveAttribute('data-tone', 'success')
  const box = (await toast.boundingBox())!
  expect(box.x + box.width).toBeGreaterThan(1440 - 40)
  // Bottom-right, lifted only as far as needed to clear the output footer and page footer.
  expect(box.y + box.height).toBeLessThanOrEqual(900)
  expect(box.y).toBeGreaterThan(900 / 2)
  const covered = await page.evaluate(() => {
    const toastNode = document.querySelector('.floating-dock .toast')!
    const t = toastNode.getBoundingClientRect()
    return [...document.querySelectorAll<HTMLElement>('button, summary, input, a, select')]
      .filter((element) => !toastNode.contains(element) && element.getClientRects().length > 0)
      .filter((element) => {
        const r = element.getBoundingClientRect()
        return r.width > 0 && r.left < t.right && t.left < r.right && r.top < t.bottom && t.top < r.bottom
      })
      .map((element) => element.textContent?.trim() || element.getAttribute('aria-label') || element.tagName)
  })
  expect(covered).toEqual([])
  await expect(toast).toHaveCount(0, { timeout: 6_000 })
})

test('a phone turned sideways keeps the navigation rail and Run reachable', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await openPython(page)
  const navigation = page.getByRole('navigation', { name: 'Workspace sections' })
  await expect(navigation).toBeVisible()
  const nav = (await navigation.boundingBox())!
  expect(nav.y + nav.height).toBeLessThanOrEqual(390)
  const run = page.locator('[data-hafa-run-button]:visible').first()
  const runBox = (await run.boundingBox())!
  // The rail sits beside the code instead of over it.
  expect(nav.x + nav.width).toBeLessThanOrEqual(runBox.x)
  expect(runBox.y + runBox.height).toBeLessThanOrEqual(390)
  expect(runBox.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
