import { expect, test, type Page } from '@playwright/test'

async function openStudent(page: Page) {
  const session = page.waitForResponse((response) => response.url().endsWith('/api/v1/sessions') && response.request().method() === 'POST')
  await page.goto('/?e2e_user=student')
  expect((await session).status()).toBe(200)
}

test('TypeScript runs a typed multi-file project and explains compiler errors', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'EditContext', { configurable: true, value: undefined })
  })
  await openStudent(page)
  await page.locator('.sidebar-content').getByRole('button', { name: 'TS', exact: true }).click()

  await expect(page.getByLabel('Project name')).toHaveValue('TypeScript Playground')
  await expect(page.getByRole('button', { name: 'main.ts' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'greeting.ts' })).toBeVisible()
  await page.getByRole('button', { name: 'Run TypeScript' }).click()
  await expect(page.locator('.terminal')).toContainText('Hafa adai, Lina! Lessons: 3')
  await expect(page.locator('.terminal-footer')).toContainText('success')

  const editor = page.getByRole('textbox', { name: 'Editor content' })
  await page.locator('.monaco-editor .view-lines').click()
  await expect(editor).toBeFocused()
  expect(await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue([
    'import { greeting } from "./greeting"',
    '',
    'const lessons: number = 3',
    'const message: number = greeting("Lina", lessons)',
    'console.log(message)',
  ].join('\n')))).toBe(true)
  await expect.poll(() => page.evaluate(() => window.__HAFA_E2E_EDITOR__?.getMarkers()
    .some((marker) => marker.code === '2322' && marker.path.endsWith('/main.ts')))).toBe(true)
  await page.getByRole('button', { name: 'Run again' }).click()

  await expect(page.locator('.terminal')).toContainText('error TS2322')
  await expect(page.locator('.terminal')).toContainText('main.ts:4:7')
  await expect(page.getByText('This value does not match the TypeScript type')).toBeVisible()
})

test('TypeScript stays usable without horizontal overflow on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openStudent(page)
  await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Projects' }).click()
  await page.getByRole('button', { name: 'TS', exact: true }).click()
  await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Output' }).click()
  await page.getByRole('button', { name: 'Run TypeScript' }).click()

  await expect(page.locator('.terminal')).toContainText('Hafa adai, Lina! Lessons: 3')
  await expect(page.locator('.terminal-footer')).toContainText('success')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
