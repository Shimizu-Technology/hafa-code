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
  await expect(page.locator('.terminal')).toContainText('Hafa adai, Lina! Lessons: 3', { timeout: 15_000 })
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

  await expect(page.locator('.terminal')).toContainText('Hafa adai, Lina! Lessons: 3', { timeout: 15_000 })
  await expect(page.locator('.terminal-footer')).toContainText('success')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('TypeScript and SQL expose complete guides and three-tier practice catalogs', async ({ page }) => {
  await openStudent(page)

  for (const language of [
    { shortLabel: 'TS', guideLabel: 'TypeScript guide' },
    { shortLabel: 'SQL', guideLabel: 'SQL guide' },
  ]) {
    await page.locator('.sidebar-content').getByRole('button', { name: language.shortLabel, exact: true }).click()
    await page.locator('.guide-toolbar-button').click()
    await expect(page.getByRole('tabpanel', { name: language.guideLabel })).toBeVisible()
    await expect(page.getByText('8 of 8 topics')).toBeVisible()

    await page.getByRole('tab', { name: 'Practice' }).click()
    await expect(page.getByText('0 of 15 complete')).toBeVisible()
    for (const tier of ['Starter', 'Builder', 'Stretch']) {
      await expect(page.getByRole('progressbar', { name: `0 of 5 ${tier} challenges complete` })).toBeVisible()
    }

    await expect(page.locator('.practice-language-tabs').getByRole('button', { name: language.shortLabel, exact: true })).toHaveAttribute('aria-current', 'page')
    await page.getByRole('button', { name: 'Close learning sidecar' }).click()
  }
})

test('SQL runs seeded queries, preserves deliberate changes, resets, and explains errors', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'EditContext', { configurable: true, value: undefined })
  })
  await openStudent(page)
  await page.locator('.sidebar-content').getByRole('button', { name: 'SQL', exact: true }).click()

  await expect(page.getByLabel('Project name')).toHaveValue('SQL Data Playground')
  await expect(page.getByRole('button', { name: 'schema.sql' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'seed.sql' })).toBeVisible()
  await page.getByRole('button', { name: 'View schema' }).click()
  await expect(page.locator('.file-tab-list').getByRole('button', { name: 'schema.sql' })).toHaveClass(/active/)
  await page.getByRole('button', { name: 'View starter rows' }).click()
  await expect(page.locator('.file-tab-list').getByRole('button', { name: 'seed.sql' })).toHaveClass(/active/)
  await page.locator('.file-tab-list').getByRole('button', { name: 'main.sql' }).click()
  await page.getByRole('button', { name: 'Run SQL' }).click()
  const initialResult = page.getByRole('region', { name: 'Query result, 3 rows' })
  await expect(initialResult.getByRole('columnheader')).toHaveText(['name', 'village', 'completed_lessons'])
  await expect(initialResult.getByRole('row').nth(1)).toContainText('Lina')

  const editor = page.getByRole('textbox', { name: 'Editor content' })
  await page.locator('.monaco-editor .view-lines').click()
  await expect(editor).toBeFocused()
  expect(await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue("UPDATE learners SET completed_lessons = completed_lessons + 1 WHERE name = 'Kai';"))).toBe(true)
  await page.getByRole('button', { name: 'Run SQL' }).click()
  await expect(page.getByText('1 row changed across 1 statement.')).toBeVisible()

  expect(await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue("SELECT completed_lessons FROM learners WHERE name = 'Kai';"))).toBe(true)
  await page.getByRole('button', { name: 'Run SQL' }).click()
  await expect(page.getByRole('region', { name: 'Query result, 1 row' })).toContainText('3')

  await page.getByRole('button', { name: 'Reset database' }).click()
  await expect(page.getByText(/Database reset from schema\.sql and seed\.sql/)).toBeVisible()
  await page.getByRole('button', { name: 'Run SQL' }).click()
  await expect(page.getByRole('region', { name: 'Query result, 1 row' })).toContainText('2')

  expect(await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue('SELECT * FROM missing_table;'))).toBe(true)
  await page.getByRole('button', { name: 'Run SQL' }).click()
  await expect(page.locator('.sql-message.error')).toContainText('no such table')
  await expect(page.getByText('SQLite cannot find that table')).toBeVisible()
})

test('SQL results remain usable without page overflow on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openStudent(page)
  await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Projects' }).click()
  await page.getByRole('button', { name: 'SQL', exact: true }).click()
  await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Output' }).click()
  await page.getByRole('button', { name: 'View schema' }).click()
  await expect(page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Code' })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.file-tab-list').getByRole('button', { name: 'schema.sql' })).toHaveClass(/active/)
  await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Output' }).click()
  await page.getByRole('button', { name: 'Run SQL' }).click()

  await expect(page.getByRole('region', { name: 'Query result, 3 rows' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset database' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
