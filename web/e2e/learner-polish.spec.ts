import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { buildStarterLink } from '../src/lib/starterLinks'

const LESSON_URL = 'https://learn.codeschoolofguam.com/lessons/42'
const STARTER = 'first = 12\nsecond = 8\ntotal = first + second\nprint(f"Total: {total}")\n'

function lessonPath() {
  const url = new URL(buildStarterLink({
    title: 'Lesson 2 — values and variables',
    kind: 'python',
    files: [{ path: 'receipt.py', content: STARTER }],
    starterKey: 'csg-python-pilot:lesson-2',
    returnUrl: LESSON_URL,
    returnLabel: 'Lesson 2 — values, variables, and input',
  }).url)
  return `/${url.search}${url.hash}`
}

async function openLesson(page: Page) {
  await page.goto(lessonPath())
  await expect(page.getByLabel('Project name')).toHaveValue(/^Lesson 2/)
  await page.locator('.monaco-editor').first().waitFor()
}

async function box(page: Page, selector: string) {
  const found = await page.locator(selector).filter({ visible: true }).first().boundingBox()
  expect(found, selector).not.toBeNull()
  return found!
}

/** Serious and critical axe findings only (moderate and minor are reported, not gated). */
async function expectNoSeriousAxeViolations(page: Page, label: string) {
  await page.waitForTimeout(300)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const blocking = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target.join(' ')) }))
  expect(blocking, label).toEqual([])
}

for (const viewport of [{ width: 844, height: 390, minEditor: 240 }, { width: 667, height: 375, minEditor: 225 }]) {
  test(`a sideways phone at ${viewport.width}x${viewport.height} gives the code the height`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize(viewport)
    await openLesson(page)
    const editor = await box(page, '.editor-panel .monaco-editor')
    expect(editor.height, 'editor height').toBeGreaterThanOrEqual(viewport.minEditor)
    expect(editor.y + editor.height, 'editor bottom stays on screen').toBeLessThanOrEqual(viewport.height)

    // The lesson bar is one 44px row; the navigation is a rail beside the code, not over it.
    const lesson = await box(page, '.lesson-bar')
    expect(lesson.height).toBeLessThanOrEqual(48)
    const rail = await box(page, '.mobile-bottom-nav')
    expect(rail.x + rail.width).toBeLessThanOrEqual(editor.x)
    for (const selector of ['.lesson-back', '.lesson-copy', '[data-hafa-run-button]', '.mobile-bottom-nav button', '.file-tabs .mobile-editor-guide-button', '.mobile-code-runbar button:not(.primary)']) {
      const target = await box(page, selector)
      expect(target.height, `${selector} height`).toBeGreaterThanOrEqual(44)
      expect(target.width, `${selector} width`).toBeGreaterThanOrEqual(44)
    }
    const run = await box(page, '[data-hafa-run-button]')
    expect(run.y + run.height).toBeLessThanOrEqual(editor.y)
    for (const button of await page.locator('.mobile-bottom-nav button').all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

    // Output fills the same space and keeps Run and Copy output on screen.
    await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Output' }).click()
    const footer = await box(page, '.terminal-footer')
    expect(footer.y + footer.height).toBeLessThanOrEqual(viewport.height)
    await expectNoSeriousAxeViolations(page, `landscape ${viewport.width} output`)
  })
}

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`the phone editor ends above the navigation at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openLesson(page)
    const editor = await box(page, '.editor-panel .monaco-editor')
    const nav = await box(page, '.mobile-bottom-nav')
    expect(editor.y + editor.height).toBeLessThanOrEqual(nav.y)
    expect(editor.height).toBeGreaterThanOrEqual(160)
    await expectNoSeriousAxeViolations(page, `phone ${viewport.width} code tab`)
  })
}

for (const viewport of [{ width: 1280, height: 600 }, { width: 1280, height: 720 }, { width: 1440, height: 640 }]) {
  test(`a long toast never covers controls or the footer at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openLesson(page)
    // Edit, then open the same lesson link again: the welcome-back toast has two lines and Start over.
    await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue('print("my work")\n'))
    await page.waitForTimeout(400)
    await page.goto('about:blank')
    await openLesson(page)
    const toast = page.locator('.floating-dock .toast')
    await expect(toast).toContainText('Welcome back')
    for (const scroll of ['top', 'bottom'] as const) {
      await page.evaluate((where) => window.scrollTo(0, where === 'top' ? 0 : document.documentElement.scrollHeight), scroll)
      await page.waitForTimeout(400)
      const result = await page.evaluate(() => {
        const toastNode = document.querySelector('.floating-dock .toast')!
        const t = toastNode.getBoundingClientRect()
        const covered = [...document.querySelectorAll<HTMLElement>('button, summary, input, a, select, footer, .terminal-footer')]
          .filter((element) => !toastNode.contains(element) && element.getClientRects().length > 0)
          .filter((element) => {
            const r = element.getBoundingClientRect()
            return r.width > 0 && r.left < t.right && t.left < r.right && r.top < t.bottom && t.top < r.bottom
          })
          .map((element) => element.className || element.tagName)
        return { covered, top: t.top, bottom: t.bottom, lines: Math.round(toastNode.querySelector('.toast-message')!.getBoundingClientRect().height / 21) }
      })
      expect(result.covered, `covered at scroll ${scroll}`).toEqual([])
      expect(result.top).toBeGreaterThanOrEqual(0)
      expect(result.bottom).toBeLessThanOrEqual(viewport.height)
      expect(result.lines).toBeLessThanOrEqual(5)
    }
    await expect(toast.getByRole('button', { name: 'Start over' })).toBeVisible()
  })
}

test('a long project list gets search and keeps one project compact', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openLesson(page)
  const list = await box(page, '.sidebar-content .project-list')
  const card = await box(page, '.sidebar-content .project-card')
  expect(list.height - card.height, 'no forced empty space under one project').toBeLessThanOrEqual(4)
  await expect(page.getByRole('searchbox', { name: 'Search projects' })).toHaveCount(0)

  const now = new Date().toISOString()
  await page.evaluate((stamp) => {
    const projects = Array.from({ length: 35 }, (_, index) => ({
      id: `seed-${index}`, title: index === 20 ? 'Expense tracker' : `Python Playground (${index + 1})`, kind: 'python', visibility: 'private',
      entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: `print(${index})\n` }], createdAt: stamp, updatedAt: stamp,
    }))
    localStorage.setItem('hafa-code-projects-v2', JSON.stringify({ activeProjectId: 'seed-0', projects }))
  }, now)
  await page.goto('/')
  await page.locator('.monaco-editor').first().waitFor()
  const sidebar = page.locator('.sidebar-content')
  const search = sidebar.getByRole('searchbox', { name: 'Search projects' })
  await expect(search).toBeVisible()
  const scroller = await sidebar.locator('.project-list').evaluate((element) => ({ overflow: getComputedStyle(element).overflowY, scrolls: element.scrollHeight > element.clientHeight }))
  expect(scroller).toEqual({ overflow: 'auto', scrolls: true })
  // The sticky sidebar ends inside the first screen, so the last project is reachable without page scrolling.
  const sidebarBox = await box(page, '.project-sidebar')
  expect(sidebarBox.y + sidebarBox.height).toBeLessThanOrEqual(800)
  await search.fill('expense')
  await expect(sidebar.locator('.project-card')).toHaveCount(1)
  await expect(sidebar.getByText('1 of 35 projects')).toBeVisible()
  await sidebar.locator('.project-card').click()
  await expect(page.getByLabel('Project name')).toHaveValue('Expense tracker')
  await search.press('Escape')
  await expect(sidebar.locator('.project-card')).toHaveCount(35)
  await expect(sidebar.locator('.project-card-title').first()).toHaveCSS('-webkit-line-clamp', '2')
  await expect(sidebar.locator('.project-card').first()).toHaveCSS('text-align', 'left')
})

test('run results are announced once, politely, without the output', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLesson(page)
  const announcement = page.getByTestId('run-announcement')
  await expect(announcement).toHaveAttribute('aria-live', 'polite')
  await expect(page.locator('.run-status')).not.toHaveAttribute('aria-live', /.+/)
  await page.getByRole('button', { name: 'Run Python' }).click()
  await expect(page.locator('.output-panel')).toHaveAttribute('data-run-status', 'success', { timeout: 90_000 })
  await expect(announcement).toHaveText(/^Ran in \d+ ms\. 1 line of output\.$/)

  await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue('total = 5\nprint(totl)\n'))
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(page.locator('.output-panel')).toHaveAttribute('data-run-status', 'error')
  await expect(announcement).toContainText("Error: NameError: name 'totl' is not defined")
  await expect(announcement).not.toContainText('Traceback')
  await expect(page.locator('[role="alert"]:visible')).toHaveCount(0)
  await expectNoSeriousAxeViolations(page, 'error state')

  // An empty file explains why Run is unavailable.
  await page.evaluate(() => window.__HAFA_E2E_EDITOR__?.setValue(''))
  const run = page.locator('.output-panel [data-hafa-run-button]')
  await expect(run).toBeDisabled()
  await expect(page.locator('.run-empty-hint')).toHaveText('receipt.py is empty. Type some code in it, then press Run.')
  await expect(run).toHaveAttribute('aria-describedby', /.+/)
})

test('first visit, workspace, and dialogs have no serious accessibility findings, and Tab order is sensible', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.locator('.welcome-hero')).toBeVisible()
  await expectNoSeriousAxeViolations(page, 'first visit')

  await openLesson(page)
  await expectNoSeriousAxeViolations(page, 'workspace with lesson bar')

  await page.getByRole('button', { name: 'More project actions' }).click()
  await page.getByRole('group', { name: 'Project actions' }).getByRole('button', { name: 'Workspace backup' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectNoSeriousAxeViolations(page, 'workspace backup dialog')
  await page.keyboard.press('Escape')

  await page.locator('.app-bar').getByRole('button', { name: 'Share' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectNoSeriousAxeViolations(page, 'share dialog')
  await page.keyboard.press('Escape')

  // Keyboard order: skip link, app bar, lesson bar, editor header, then "Skip the editor and go to Run".
  await page.locator('body').click({ position: { x: 2, y: 2 } })
  await page.evaluate(() => window.scrollTo(0, 0))
  const order: string[] = []
  await page.locator('.skip-link').focus()
  for (let index = 0; index < 40; index += 1) {
    const label = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null
      return element ? (element.getAttribute('aria-label') || element.textContent || element.tagName).trim().slice(0, 40) : ''
    })
    order.push(label)
    if (/Skip the editor/.test(label)) break
    await page.keyboard.press('Tab')
  }
  const position = (pattern: RegExp) => order.findIndex((label) => pattern.test(label))
  expect(position(/^Skip to code editor/)).toBe(0)
  expect(position(/Back to your lesson/)).toBeGreaterThan(position(/^Share$/))
  expect(position(/Copy code for Learn/)).toBeGreaterThan(position(/Back to your lesson/))
  expect(position(/Skip the editor and go to Run/)).toBeGreaterThan(position(/Copy code for Learn/))
})
