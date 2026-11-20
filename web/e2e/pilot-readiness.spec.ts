import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { buildStarterLink } from '../src/lib/starterLinks'

// All source and shares in this suite are throwaway QA fixtures.
const source = '# Own readiness fixture: Lina — å\nitems = [12, 8, 15]\nprint("Total:", sum(items))\n'
const editedSource = source + '# learner edit: keep this exact line after recovery\n'
const lessonUrl = 'https://learn.codeschoolofguam.com/lessons/419'
function starterPath() {
  const url = new URL(buildStarterLink({ title: 'Own readiness fixture', kind: 'python', files: [{ path: 'main.py', content: source }], starterKey: 'qa-readiness:own', returnUrl: lessonUrl, returnLabel: 'Readiness QA' }).url)
  return `/${url.search}${url.hash}`
}
async function backup(page: Page, destination?: string) {
  await page.getByRole('button', { name: 'More project actions' }).click()
  await page.getByRole('button', { name: 'Workspace backup', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download complete backup' }).click()
  const result = await download
  if (destination) await result.saveAs(destination)
  const file = destination ?? await result.path()
  await page.getByRole('button', { name: 'Close workspace backup' }).click()
  return file!
}
async function showCode(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Workspace sections' })
  if (await nav.isVisible()) await nav.getByRole('button', { name: 'Code', exact: true }).click()
  await expect(page.locator('.monaco-editor')).toBeVisible()
}
async function copyFallback(page: Page, expected: string) {
  await page.getByRole('region', { name: 'Lesson' }).getByRole('button', { name: /Copy (code )?for Learn/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Copy your code' })
  await expect(dialog.getByLabel('Code to copy')).toHaveValue(expected)
  await dialog.getByRole('button', { name: 'Select all code' }).click()
  expect(await dialog.getByLabel('Code to copy').evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart)).toBe(expected.length)
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test.describe(`pilot ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport })
    test('Q1/Q2 cold run, deliberate error, fix, autosave and reload', async ({ page }, testInfo) => {
      test.setTimeout(120_000)
      await page.goto(starterPath())
      await expect(page.getByLabel('Project name')).toHaveValue('Own readiness fixture')
      const start = Date.now()
      await page.getByRole('button', { name: 'Run Python' }).first().click()
      await expect(page.locator('.terminal')).toContainText('Total: 35', { timeout: 90_000 })
      console.log(`${testInfo.project.name} ${viewport.width} Q1 cold wall ${Date.now() - start}ms`)
      await showCode(page)
      const editor = page.getByRole('textbox', { name: /^Editor content/ }).first()
      await editor.focus()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText('print(missing_readiness_name)\n')
      await page.getByRole('button', { name: /Run Python|Run again/ }).first().click()
      await expect(page.locator('.terminal')).toContainText('NameError')
      await page.getByRole('button', { name: 'Fix this error' }).click()
      await expect(page.getByText('Python does not know that name')).toBeVisible()
      const closeCoach = page.getByRole('button', { name: 'Close learning sidecar' })
      if (await closeCoach.isVisible()) await closeCoach.click()
      await showCode(page)
      await editor.focus()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText(editedSource)
      await page.getByRole('button', { name: /Run Python|Run again/ }).first().click()
      await expect(page.locator('.terminal')).toContainText('Total: 35')
      await page.reload()
      await showCode(page)
      await expect(page.locator('.monaco-editor .view-lines')).toContainText('learner edit: keep this exact line')
      const file = await backup(page)
      expect(await readFile(file, 'utf8')).toContain('Own readiness fixture')
      console.log(`${testInfo.project.name} ${viewport.width} Q2 passed error/fix/reload`)
    })

    test('Q3/Q4 exact workspace restore, lesson reopening and denied clipboard', async ({ page, browser }, testInfo) => {
      await page.addInitScript(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('QA denial') } }))
      await page.goto(starterPath())
      await showCode(page)
      await page.getByRole('textbox', { name: /^Editor content/ }).first().focus()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText(editedSource)
      await copyFallback(page, editedSource)
      const file = await backup(page, testInfo.outputPath('own-workspace-backup.json'))
      const originalBackup = JSON.parse(await readFile(file, 'utf8'))
      await page.context().close()
      const restored = await browser.newContext({ viewport, baseURL: testInfo.project.use.baseURL })
      try {
        await restored.addInitScript(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('QA denial') } }))
        const next = await restored.newPage()
        await next.goto('/')
        await next.getByRole('button', { name: 'More project actions' }).click()
        await next.getByRole('button', { name: 'Workspace backup', exact: true }).click()
        await next.getByRole('dialog', { name: 'Move or protect your work' }).locator('input[type=file]').setInputFiles(file)
        await expect(next.getByText(/Restored.*workspace|Workspace.*restored|Restored.*project/i).first()).toBeVisible()
        const close = next.getByRole('button', { name: 'Close workspace backup' })
        if (await close.isVisible()) await close.click()
        await next.goto(starterPath())
        // Copying code replaces the notice with its clipboard result. Verify
        // the reopen outcome before performing that separate action.
        await expect(next.getByText('Welcome back. Your saved work on “Own readiness fixture” is open.', { exact: true })).toBeVisible()
        await showCode(next)
        await copyFallback(next, editedSource)
        await expect(next.getByRole('region', { name: 'Lesson' }).getByRole('link')).toHaveAttribute('href', lessonUrl)
        const restoredFile = await backup(next)
        const roundTrip = JSON.parse(await readFile(restoredFile, 'utf8'))
        // The complete exported record verifies every source byte, not just rendered lines.
        const projects = (value: unknown): unknown => {
          const obj = value as Record<string, unknown>
          if (Array.isArray(obj.projects)) return obj.projects
          if (obj.data) return projects(obj.data)
          if (obj.library) return projects(obj.library)
          return undefined
        }
        const ownProjects = (value: unknown) => (projects(value) as { title: string; files: { content: string }[] }[]).filter(p => p.title === 'Own readiness fixture')
        expect(ownProjects(roundTrip)).toHaveLength(1)
        expect(ownProjects(originalBackup)).toHaveLength(1)
        expect(ownProjects(roundTrip)[0].files).toEqual(ownProjects(originalBackup)[0].files)
        expect(ownProjects(roundTrip)[0].files[0].content).toBe(editedSource)
        console.log(`${testInfo.project.name} ${viewport.width} Q3/Q4 exact restore and fallback passed`)
      } finally { await restored.close() }
    })

    test('Q5 share opens an editable byte-exact copy without lesson metadata', async ({ page, browser }, testInfo) => {
      await page.goto(starterPath())
      await showCode(page)
      await page.getByRole('textbox', { name: /^Editor content/ }).first().focus()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText(editedSource)
      await page.getByRole('button', { name: 'Share', exact: true }).first().click()
      await page.getByRole('button', { name: 'Create share link' }).click()
      const link = await page.getByRole('dialog', { name: 'Copy project link' }).getByRole('textbox').inputValue()
      expect(link).not.toContain('return=')
      expect(link).not.toContain('starter=')
      await page.context().close()
      const imported = await browser.newContext({ viewport, baseURL: testInfo.project.use.baseURL })
      try {
        const next = await imported.newPage()
        // Shares intentionally use the public canonical origin; use this test's local host.
        const url = new URL(link)
        await next.goto(`${url.pathname}${url.search}${url.hash}`.startsWith('/') ? new URL(`${url.pathname}${url.search}${url.hash}`, testInfo.project.use.baseURL).href : link)
        await showCode(next)
        await expect(next.getByRole('region', { name: 'Lesson' })).toHaveCount(0)
        await expect(next.getByLabel('Project name')).toBeEditable()
        await next.getByRole('button', { name: 'More project actions' }).click()
        const download = next.waitForEvent('download')
        await next.getByRole('button', { name: /Download.*\.py|Export.*\.py/ }).click()
        const file = await (await download).path()
        expect(await readFile(file!, 'utf8')).toBe(editedSource)
        console.log(`${testInfo.project.name} ${viewport.width} Q5 byte-exact editable copy passed`)
      } finally { await imported.close() }
    })
  })
}
