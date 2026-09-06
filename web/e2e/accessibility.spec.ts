import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const CLASSROOM_ID = '92001'

async function openPersona(page: Page, persona: 'student' | 'teacher') {
  const session = page.waitForResponse((response) => response.url().endsWith('/api/v1/sessions') && response.request().method() === 'POST')
  await page.goto(`/?e2e_user=${persona}`)
  expect((await session).status()).toBe(200)
}

async function switchToClassroom(page: Page) {
  const workspace = page.getByLabel('Switch workspace')
  if (!await workspace.isVisible()) {
    await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Projects' }).click()
  }
  await workspace.selectOption(CLASSROOM_ID)
  await expect(page.getByRole('heading', { name: 'FDMS Web Development', exact: true })).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
}

function usefulViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  return violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    nodes: nodes.map((node) => ({
      target: node.target.join(' '),
      summary: node.failureSummary,
    })),
  }))
}

test('personal and classroom workspaces pass automated WCAG checks', async ({ page }) => {
  await openPersona(page, 'student')
  const personalResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(usefulViolations(personalResults.violations)).toEqual([])

  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.getByRole('button', { name: 'Color-safe', exact: true }).click()
  await expect(page.locator('main.app-shell')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('main.app-shell')).toHaveAttribute('data-color-mode', 'colorblind')
  await expect(page.getByRole('button', { name: 'Dark', exact: true })).toHaveCSS('text-decoration-line', /underline/)
  const darkColorSafeResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(usefulViolations(darkColorSafeResults.violations)).toEqual([])

  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.getByRole('button', { name: 'Color-safe', exact: true }).click()
  await expect(page.locator('main.app-shell')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('main.app-shell')).toHaveAttribute('data-color-mode', 'default')
  await switchToClassroom(page)
  const classroomResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(usefulViolations(classroomResults.violations)).toEqual([])

  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.getByRole('button', { name: 'Color-safe', exact: true }).click()
  const darkColorSafeClassroomResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(usefulViolations(darkColorSafeClassroomResults.violations)).toEqual([])
})

test('project, file, history, sharing, and classroom controls work from the keyboard', async ({ page }) => {
  await openPersona(page, 'student')

  const shareButton = page.locator('.desktop-hero-actions').getByRole('button', { name: 'Share' })
  await shareButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Copy project link' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Copy project link' })).toHaveCount(0)
  await expect(shareButton).toBeFocused()

  await switchToClassroom(page)
  const classProject = page.locator('.sidebar-content').getByRole('button', { name: /Class Gallery/ })
  await classProject.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Project name')).toHaveValue('Class Gallery')

  const fileBrowser = page.locator('.file-browser')
  await fileBrowser.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(fileBrowser).toHaveAttribute('open', '')

  const history = page.locator('.checkpoint-menu')
  await history.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(history.locator('.checkpoint-popover')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(history).not.toHaveAttribute('open', '')
  await expect(history.locator('summary')).toBeFocused()

  await openPersona(page, 'teacher')
  await switchToClassroom(page)
  const classroomButton = page.getByRole('button', { name: 'Classroom' })
  await classroomButton.focus()
  await page.keyboard.press('Enter')
  const reviewTab = page.getByRole('tab', { name: 'Review work' })
  await reviewTab.focus()
  await expect(reviewTab).toHaveAttribute('aria-controls', 'classroom-review-panel')
  await expect(page.getByRole('tabpanel', { name: 'Review work' })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'People' })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'People' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel', { name: 'People' })).toBeVisible()
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeFocused()
  await expect(page.getByRole('tabpanel', { name: 'Settings' })).toBeVisible()
  await expect(page.getByLabel('School year or term')).toBeVisible()
})

test('zoom-equivalent and mobile layouts keep content and primary targets usable', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 450 })
  await openPersona(page, 'student')
  await switchToClassroom(page)
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: 'Code', exact: true }).click()
  await expect(page.getByLabel(/Project source uses/)).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  const primaryTargets = page.locator('.mobile-bottom-nav button:visible, .mobile-code-runbar button:visible, .mobile-project-actions-button:visible')
  const targetCount = await primaryTargets.count()
  expect(targetCount).toBeGreaterThan(0)
  for (let index = 0; index < targetCount; index += 1) {
    const box = await primaryTargets.nth(index).boundingBox()
    expect(box, `target ${index + 1} should have a box`).not.toBeNull()
    expect(box!.width, `target ${index + 1} should be at least 44 px wide`).toBeGreaterThanOrEqual(44)
    expect(box!.height, `target ${index + 1} should be at least 44 px high`).toBeGreaterThanOrEqual(44)
  }

  await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'History' }).click()
  const mobileHistory = page.locator('.checkpoint-menu')
  const mobileHistorySummary = mobileHistory.locator('summary')
  await expect(mobileHistory).toHaveAttribute('open', '')
  await mobileHistorySummary.focus()
  await page.keyboard.press('Escape')
  await expect(mobileHistory).not.toHaveAttribute('open', '')
  await expect(mobileHistorySummary).toBeFocused()
})
