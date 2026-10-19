import { expect, test, type Page } from '@playwright/test'
import { buildStarterLink } from '../src/lib/starterLinks'

const LESSON_URL = 'https://learn.codeschoolofguam.com/lessons/42'
const STARTER = 'items = [12, 8, 15]\nprint("Total:", sum(items))\n'

function lessonPath(extraQuery = '') {
  const url = new URL(buildStarterLink({
    title: 'Expense summary project',
    kind: 'python',
    files: [{ path: 'expense_summary.py', content: STARTER }],
    starterKey: 'csg-python-pilot:project',
    returnUrl: LESSON_URL,
    returnLabel: 'Independent expense-summary project',
  }).url)
  return `/${url.search}${extraQuery}${url.hash}`
}

async function stubLearn(page: Page) {
  await page.route('https://learn.codeschoolofguam.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>CSG Learn lesson</title><h1>Lesson 42</h1>' }))
}

async function openLesson(page: Page, extraQuery = '') {
  await page.goto(lessonPath(extraQuery))
  await expect(page.getByLabel('Project name')).toHaveValue(/^Expense summary project/)
  await page.locator('.monaco-editor').first().waitFor()
}

test('starter link with a return: run, copy for Learn, and go back to the lesson', async ({ page, context }) => {
  test.setTimeout(120_000)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await stubLearn(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await openLesson(page)

  const bar = page.getByRole('region', { name: 'Lesson' })
  await expect(bar).toBeVisible()
  await expect(bar.getByText('Code School of Guam')).toBeVisible()
  await expect(bar.getByText('Independent expense-summary project')).toBeVisible()
  await expect(bar.getByRole('link', { name: /Back to your lesson/ })).toHaveAttribute('href', LESSON_URL)
  expect(new URL(page.url()).hash).toBe('')
  const primaries = page.locator('button.primary:visible')
  await expect(primaries).toHaveCount(1)
  await expect(primaries.first()).toHaveAttribute('data-hafa-run-button')
  const editor = await page.locator('.editor-panel .monaco-editor').boundingBox()
  expect(editor!.y).toBeLessThanOrEqual(260)

  await page.getByRole('button', { name: 'Run Python' }).click()
  await expect(page.locator('.output-panel')).toHaveAttribute('data-run-status', 'success', { timeout: 90_000 })
  await expect(page.locator('.output-panel')).toContainText('Total: 35')

  await bar.getByRole('button', { name: /Copy code for Learn/ }).click()
  await expect(page.getByText('Code copied. Paste it into the lesson’s submission box.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(STARTER)

  await bar.getByRole('link', { name: /Back to your lesson/ }).click()
  await expect(page).toHaveURL(LESSON_URL)
  await expect(page.getByRole('heading', { name: 'Lesson 42' })).toBeVisible()
})

test('reopening the lesson link after editing keeps the work and offers Start over', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLesson(page)
  expect(await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue('print("my own work")\n'))).toBe(true)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('hafa-code-projects-v2') ?? '')).toContain('my own work')

  await openLesson(page)
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('my own work')
  const toast = page.locator('.toast').filter({ hasText: 'Welcome back. Your saved work on “Expense summary project” is open.' })
  await expect(toast).toBeVisible()
  await page.waitForTimeout(4_500)
  await expect(toast).toBeVisible()
  const titles = await page.evaluate(() => JSON.parse(localStorage.getItem('hafa-code-projects-v2') ?? '{}').projects.map((project: { title: string }) => project.title))
  expect(titles).toEqual(['Expense summary project'])

  await toast.getByRole('button', { name: 'Start over' }).click()
  await expect(page.getByLabel('Project name')).toHaveValue('Expense summary project (2)')
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('Total:')
  await expect(page.getByRole('region', { name: 'Lesson' })).toBeVisible()
})

test('a signed-in learner keeps the lesson bar after the project syncs and reloads', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const session = page.waitForResponse((response) => response.url().endsWith('/api/v1/sessions') && response.request().method() === 'POST')
  await openLesson(page, '&e2e_user=student')
  expect((await session).status()).toBe(200)
  await expect(page.getByText('Classroom test session')).toBeVisible()
  expect(await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue('print("synced work")\n'))).toBe(true)
  await expect(page.getByText('Saved to cloud + local backup')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('hafa-code-projects-v2') ?? '{}')
    return /^\d+$/.test(library.activeProjectId ?? '')
  })).toBe(true)
  const links = await page.evaluate(() => JSON.parse(localStorage.getItem('hafa-code-lesson-links-v1') ?? '{}'))
  expect(Object.keys(links.projects).every((id) => /^\d+$/.test(id))).toBe(true)

  await page.goto('/?e2e_user=student')
  await expect(page.getByLabel('Project name')).toHaveValue('Expense summary project')
  await expect(page.getByRole('region', { name: 'Lesson' })).toBeVisible()

  await openLesson(page, '&e2e_user=student')
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('synced work')
  await expect(page.getByText('Welcome back. Your saved work on “Expense summary project” is open.')).toBeVisible()
})

test('a disallowed return URL is ignored without a message', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const path = lessonPath().replace(/&return=[^&]+/, `&return=${encodeURIComponent('https://learn.codeschoolofguam.com.evil.com/phish')}`)
  await page.goto(path)
  await expect(page.getByLabel('Project name')).toHaveValue('Expense summary project')
  await expect(page.getByRole('region', { name: 'Lesson' })).toHaveCount(0)
  await expect(page.locator('a[href*="evil"]')).toHaveCount(0)
})

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`the lesson bar fits a phone at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openLesson(page)
    const bar = page.getByRole('region', { name: 'Lesson' })
    await expect(bar).toBeVisible()
    const back = bar.getByRole('link', { name: /lesson/i })
    const copy = bar.getByRole('button', { name: /Copy (code )?for Learn/ })
    for (const control of [back, copy]) {
      await expect(control).toBeVisible()
      const box = await control.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(viewport.height < 500 ? 40 : 44)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    await expect(page.getByRole('button', { name: 'Run Python' }).first()).toBeVisible()
    await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Output' }).click()
    await expect(bar).toBeVisible()
  })
}

test('keyboard only: reach Copy code for Learn and Back to your lesson', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await stubLearn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLesson(page)
  const bar = page.getByRole('region', { name: 'Lesson' })
  const back = bar.getByRole('link', { name: /Back to your lesson/ })
  const copy = bar.getByRole('button', { name: /Copy code for Learn/ })

  await page.getByLabel('Project name').focus()
  let reachedBack = false
  for (let index = 0; index < 40 && !reachedBack; index += 1) {
    await page.keyboard.press('Tab')
    reachedBack = await back.evaluate((element) => element === document.activeElement)
  }
  expect(reachedBack).toBe(true)
  await expect(back).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Tab')
  await expect(copy).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Code copied. Paste it into the lesson’s submission box.')).toBeVisible()
  await back.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(LESSON_URL)
})
