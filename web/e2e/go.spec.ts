import { expect, test, type Page } from '@playwright/test'

async function openGoProject(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'EditContext', { configurable: true, value: undefined })
  })
  const session = page.waitForResponse((response) => response.url().endsWith('/api/v1/sessions') && response.request().method() === 'POST')
  await page.goto('/?e2e_user=student')
  expect((await session).status()).toBe(200)
  await page.locator('.sidebar-content').getByRole('button', { name: 'Go', exact: true }).click()
  await expect(page.getByLabel('Project name')).toHaveValue(/^Go Playground/)
}

async function setCode(page: Page, source: string) {
  expect(await page.evaluate((value) => window.__HAFA_E2E_EDITOR__?.setValue(value), source)).toBe(true)
}

test('Go runs the starter, reads stdin, and explains compiler errors and panics', async ({ page }) => {
  test.setTimeout(120_000)
  await openGoProject(page)
  await expect(page.getByRole('button', { name: 'main.go' })).toBeVisible()

  await page.getByRole('button', { name: 'Run Go' }).click()
  await expect(page.locator('.terminal')).toContainText('go run .')
  await expect(page.locator('.terminal')).toContainText('Hafa adai, Go!\nLine 1\nLine 2\nLine 3', { timeout: 60_000 })
  await expect(page.locator('.output-panel')).toHaveAttribute('data-run-status', 'success')

  await page.locator('.monaco-editor .view-lines').click()
  await setCode(page, 'package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n\t"strings"\n)\n\nfunc main() {\n\treader := bufio.NewReader(os.Stdin)\n\tfmt.Print("Name: ")\n\tname, _ := reader.ReadString(\'\\n\')\n\tfmt.Printf("Hafa adai, %s!\\n", strings.TrimSpace(name))\n}\n')
  await page.getByRole('button', { name: 'Run again' }).click()
  const input = page.getByRole('textbox', { name: 'Program input' })
  await expect(input).toBeFocused({ timeout: 15_000 })
  await input.fill('Lina')
  await input.press('Enter')
  await expect(page.locator('.terminal')).toContainText('Hafa adai, Lina!')
  await expect(page.locator('.output-panel')).toHaveAttribute('data-run-status', 'success')

  await setCode(page, 'package main\n\nimport (\n\t"fmt"\n\t"strings"\n)\n\nfunc main() {\n\ttotal := 5\n\tfmt.Println("done")\n}\n')
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(page.locator('.terminal')).toContainText('main.go:5:2: "strings" imported and not used')
  await expect(page.locator('.terminal')).toContainText('main.go:9:2: declared and not used: total')
  await expect(page.locator('.run-error-headline')).toContainText('main.go:5:2: "strings" imported and not used')
  await page.getByRole('button', { name: 'Fix this error' }).click()
  await expect(page.getByText('This import is not used')).toBeVisible()
  await page.getByRole('button', { name: 'Close learning sidecar' }).click()

  await setCode(page, 'package main\n\nimport "fmt"\n\nfunc pick(items []int, i int) int {\n\treturn items[i]\n}\n\nfunc main() {\n\tfmt.Println("before")\n\tfmt.Println(pick([]int{1}, 3))\n}\n')
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(page.locator('.terminal')).toContainText('panic: reflect: slice index out of range')
  await expect(page.locator('.terminal')).toContainText('main.go:6:9')
  await expect(page.locator('.terminal')).toContainText('exit status 2')
  await expect(page.locator('.output-panel')).toHaveAttribute('data-run-status', 'error')
  await page.getByRole('button', { name: 'Fix this error' }).click()
  await expect(page.getByText('The index is outside the slice')).toBeVisible()
  await expect(page.locator('.learning-sidecar')).toContainText('main.go · line 6')
  await page.getByRole('button', { name: 'Close learning sidecar' }).click()

  await setCode(page, 'package main\n\nimport "fmt"\n\nfunc main() {\n\tresults := make(chan int)\n\tfmt.Println("waiting")\n\t<-results\n}\n')
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(page.locator('.terminal')).toContainText('fatal error: all goroutines are asleep - deadlock!')
  await page.getByRole('button', { name: 'Fix this error' }).click()
  await expect(page.getByText('Every goroutine is waiting')).toBeVisible()
})

test('Go stops an endless loop with Stop and at the time limit', async ({ page }) => {
  test.setTimeout(120_000)
  await openGoProject(page)
  await page.locator('.monaco-editor .view-lines').click()
  await setCode(page, 'package main\n\nfunc main() {\n\tcount := 0\n\tfor {\n\t\tcount++\n\t}\n}\n')

  await page.getByRole('button', { name: 'Run Go' }).click()
  await expect(page.locator('.output-panel')).toHaveAttribute('data-run-status', 'running')
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.locator('.terminal')).toContainText('Execution stopped.')

  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(page.locator('.output-panel')).toHaveAttribute('data-run-status', 'timeout', { timeout: 60_000 })
  await expect(page.locator('.terminal')).toContainText('Execution stopped after 3000ms.')

  await setCode(page, 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("recovered after the timeout")\n}\n')
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(page.locator('.terminal')).toContainText('recovered after the timeout', { timeout: 60_000 })
  await expect(page.locator('.output-panel')).toHaveAttribute('data-run-status', 'success')
})

test('Go exposes its guide and practice catalog and checks a challenge end to end', async ({ page }) => {
  test.setTimeout(120_000)
  await openGoProject(page)
  await page.locator('.guide-toolbar-button').click()
  await expect(page.getByRole('tabpanel', { name: 'Go guide' })).toBeVisible()
  await expect(page.getByText('8 of 8 topics')).toBeVisible()

  await page.getByRole('tab', { name: 'Practice' }).click()
  await expect(page.getByText('0 of 15 complete')).toBeVisible()
  for (const tier of ['Starter', 'Builder', 'Stretch']) {
    await expect(page.getByRole('progressbar', { name: `0 of 5 ${tier} challenges complete` })).toBeVisible()
  }
  await expect(page.locator('.practice-language-tabs').getByRole('button', { name: 'Go', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('Go stays usable without horizontal overflow on a phone viewport', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'EditContext', { configurable: true, value: undefined })
  })
  const session = page.waitForResponse((response) => response.url().endsWith('/api/v1/sessions') && response.request().method() === 'POST')
  await page.goto('/?e2e_user=student')
  expect((await session).status()).toBe(200)
  await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Projects' }).click()
  await page.getByRole('button', { name: 'Go', exact: true }).click()
  await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Output' }).click()
  await page.getByRole('button', { name: 'Run Go' }).click()

  await expect(page.locator('.terminal')).toContainText('Hafa adai, Go!', { timeout: 60_000 })
  await expect(page.locator('.output-panel')).toHaveAttribute('data-run-status', 'success')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
