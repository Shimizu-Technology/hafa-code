import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The experimental Rust Lab (docs/RUST_LAB.md). Tests tagged @rust-toolchain download the
// pinned 38.7 MB compiler through the dev server; set E2E_SKIP_RUST_TOOLCHAIN=1 to skip them
// on a machine without network access.
const SKIP_TOOLCHAIN = process.env.E2E_SKIP_RUST_TOOLCHAIN === '1'
const TOOLCHAIN_PATH = '/assets/rust-toolchain/'

declare global {
  interface Window {
    __HAFA_RUST_LAB__?: { setSource: (source: string) => void; editor: () => { getText: () => string } | null }
  }
}

function trackToolchainRequests(page: Page) {
  const requests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith(TOOLCHAIN_PATH)) requests.push(request.url())
  })
  return requests
}

async function setSource(page: Page, source: string) {
  await page.evaluate((text) => window.__HAFA_RUST_LAB__?.setSource(text), source)
}

async function runAndWait(page: Page, pattern: RegExp, timeout = 60_000) {
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.locator('.lab-status')).toContainText(pattern, { timeout })
}

test('only the Rust Lab page is cross-origin isolated', async ({ page, request }) => {
  const lab = await request.get('/labs/rust/')
  expect(lab.headers()['cross-origin-embedder-policy']).toBe('require-corp')
  expect(lab.headers()['cross-origin-opener-policy']).toBe('same-origin')
  const workspace = await request.get('/')
  expect(workspace.headers()['cross-origin-embedder-policy']).toBeUndefined()

  await page.goto('/labs/rust/')
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
  await page.goto('/')
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false)
})

test('the lab asks before downloading the compiler and shows its size', async ({ page }) => {
  const toolchainRequests = trackToolchainRequests(page)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/labs/rust/')
  await expect(page.getByRole('heading', { name: /Rust Lab/ })).toBeVisible()
  await expect(page.getByText('Experimental', { exact: true })).toBeVisible()
  await expect(page.getByLabel('About this experiment')).toContainText('38.7 MB')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Download and run' })).toBeVisible()
  await expect(page.getByText(/One-time download of 38\.7 MB/)).toBeVisible()
  expect(toolchainRequests).toEqual([])

  // An edit past the 200 KB limit is refused: the real editor goes back to the saved text and
  // keeps the cursor where the learner was typing.
  await expect.poll(() => page.evaluate(() => Boolean(window.__HAFA_RUST_LAB__?.editor()))).toBe(true)
  const savedText = await page.evaluate(() => window.__HAFA_RUST_LAB__!.editor()!.getText())
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate((text) => navigator.clipboard.writeText(text), `// ${'x'.repeat(200_001)}`)
  await page.locator('.monaco-editor .view-line').first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('ControlOrMeta+V')
  await expect(page.getByText(/main\.rs is limited to 200 KB/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__HAFA_RUST_LAB__!.editor()!.getText())).toBe(savedText)
  await page.keyboard.type('!')
  const [firstLine, ...rest] = savedText.split('\n')
  await expect.poll(() => page.evaluate(() => window.__HAFA_RUST_LAB__!.editor()!.getText())).toBe([`${firstLine}!`, ...rest].join('\n'))

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.monaco-editor').analyze()
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target.join(' ')) }))).toEqual([])
})

for (const { name, viewport, isMobile } of [
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, isMobile: true },
]) {
  test.describe(`on a ${name}`, () => {
    test.use({ viewport, isMobile, hasTouch: isMobile })

    test('explains that the lab is for desktop browsers without downloading anything', async ({ page }) => {
      const toolchainRequests = trackToolchainRequests(page)
      await page.goto('/labs/rust/')
      await expect(page.getByRole('heading', { name: 'The Rust Lab is for desktop browsers' })).toBeVisible()
      await expect(page.getByText(/Nothing was downloaded/)).toBeVisible()
      await expect(page.getByRole('link', { name: 'Back to Hafa Code' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.getByRole('button', { name: 'Open the lab anyway' }).click()
      await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible()
      expect(toolchainRequests).toEqual([])
    })
  })
}

test.describe('with the real compiler @rust-toolchain', () => {
  test.skip(SKIP_TOOLCHAIN, 'E2E_SKIP_RUST_TOOLCHAIN=1')
  test.setTimeout(240_000)

  test('compiles, runs, coaches errors, stops loops, and checks challenges', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/labs/rust/')
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await page.getByRole('button', { name: 'Download and run' }).click()
    await expect(page.locator('.lab-status')).toContainText('Finished', { timeout: 180_000 })
    await expect(page.locator('.lab-program-output')).toContainText('Hafa adai, Ana!')
    await expect(page.locator('.lab-program-output')).toContainText('Level: Builder')

    // A borrow error keeps rustc's code and gets coaching.
    await setSource(page, 'fn main() {\n    let s = String::from("hi");\n    let t = s;\n    println!("{} {}", s, t);\n}\n')
    await runAndWait(page, /Did not compile/)
    await expect(page.getByLabel('rustc output')).toContainText('error[E0382]: borrow of moved value: `s`')
    const coach = page.getByRole('region', { name: /A value was used after it moved/ })
    await expect(coach).toContainText('E0382')
    await expect(coach).toContainText('line 4')

    // Input is provided before the run.
    await setSource(page, 'use std::io;\nfn main() {\n    let mut name = String::new();\n    io::stdin().read_line(&mut name).unwrap();\n    println!("Hafa adai, {}!", name.trim());\n}\n')
    await page.getByText('Program input (stdin)').click()
    await page.getByLabel(/Text your program reads/).fill('Leon\n')
    await runAndWait(page, /Finished/)
    await expect(page.locator('.lab-program-output')).toHaveText('Hafa adai, Leon!\n')

    // A panic is explained.
    await setSource(page, 'fn main() {\n    let v: Vec<i32> = Vec::new();\n    println!("{}", v[3]);\n}\n')
    await runAndWait(page, /panicked/)
    await expect(page.getByRole('region', { name: /An index was past the end of a list/ })).toBeVisible()

    // Typing and pressing Ctrl/Cmd+Enter at once compiles what was just typed, once.
    await setSource(page, 'fn main() {\n    let x = 5;\n    println!("{x}");\n}\n')
    await page.locator('.monaco-editor .view-line').nth(1).click()
    await page.keyboard.press('End')
    await page.keyboard.type('\nx = 6;', { delay: 25 })
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(page.locator('.lab-status')).toContainText('Did not compile')
    await expect(page.getByRole('region', { name: /An immutable variable was assigned twice/ })).toContainText('E0384')

    // Stop ends a loop that never finishes.
    // Output printed just before an endless loop is kept after Stop.
    await setSource(page, 'fn main() {\n    println!("started");\n    eprintln!("still here");\n    let mut n: u64 = 0;\n    loop { n = n.wrapping_add(1); }\n}\n')
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.locator('.lab-status')).toContainText('Running', { timeout: 30_000 })
    await page.getByRole('button', { name: 'Stop' }).click()
    await expect(page.locator('.lab-status')).toHaveText('Stopped.')
    await expect(page.locator('.lab-program-output')).toHaveText('started\nstill here\n')

    // A runaway allocation stops at the program's memory limit instead of growing to 4 GiB.
    await setSource(page, 'fn main() {\n    let mut blocks: Vec<Vec<u8>> = Vec::new();\n    loop {\n        blocks.push(vec![1u8; 16 * 1024 * 1024]);\n        println!("{} MB", blocks.len() * 16);\n    }\n}\n')
    await runAndWait(page, /panicked/)
    await expect(page.locator('.lab-program-output')).toContainText('memory allocation of 16777216 bytes failed')
    const lastReport = Number((await page.locator('.lab-program-output').innerText()).match(/(\d+) MB\n(?![\s\S]*\d+ MB\n)/)?.[1])
    expect(lastReport).toBeGreaterThanOrEqual(400)
    expect(lastReport).toBeLessThan(512)

    // A challenge fails with its starter and passes with a correct solution.
    await page.getByRole('tab', { name: 'Practice' }).click()
    await page.getByRole('button', { name: /Grow the list safely/ }).click()
    await page.getByRole('button', { name: 'Start challenge' }).click()
    await runAndWait(page, /Did not compile/)
    await expect(page.locator('.lab-challenge-result')).toContainText('Not yet')
    await expect(page.getByRole('region', { name: /A borrow overlaps a change/ })).toContainText('E0502')
    await setSource(page, 'fn main() {\n    let mut numbers = vec![4, 8];\n    let first = numbers[0];\n    numbers.push(15);\n    println!("first was {first}");\n    println!("{:?}", numbers);\n}\n')
    await runAndWait(page, /Finished/)
    await expect(page.locator('.lab-challenge-result')).toContainText('Challenge passed')

    // Projects and the downloaded compiler survive a reload.
    await page.reload()
    await expect(page.getByLabel('Project', { exact: true })).toHaveValue(/.+/)
    await expect(page.locator('.lab-challenge-strip')).toContainText('Grow the list safely')
    await expect(page.getByText('The compiler is saved in this browser')).toBeVisible()
    await runAndWait(page, /Finished/)
    await expect(page.getByText(/from this browser/)).toBeVisible()
  })

  test('every guide example and challenge solution compiles to the expected output', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/labs/rust/')
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await page.getByRole('button', { name: 'Download and run' }).click()
    await expect(page.locator('.lab-status')).toContainText('Finished', { timeout: 180_000 })

    await page.getByRole('tab', { name: 'Guide' }).click()
    for (const title of ['println! and variables', 'Ownership and moves', 'Borrowing and references', 'Structs, enums, and match', 'Result and the ? operator']) {
      const toggle = page.getByRole('button', { name: new RegExp(title.replace(/[?!]/g, '\\$&')) })
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
      await page.getByRole('button', { name: 'Open as a new project' }).click()
      await runAndWait(page, /Finished/)
      await expect(page.locator('.lab-status')).not.toContainText('warning')
      await page.getByRole('tab', { name: 'Guide' }).click()
    }

    const solutions: Record<string, string> = {
      'Count down to launch': 'fn main() {\n    let mut count = 3;\n    while count > 0 {\n        println!("{count}");\n        count -= 1;\n    }\n    println!("Liftoff!");\n}\n',
      'Keep the name': 'fn greet(name: &str) {\n    println!("Hello, {name}!");\n}\n\nfn main() {\n    let name = String::from("Ana");\n    greet(&name);\n    println!("{} has {} letters", name, name.len());\n}\n',
      'Area of every shape': 'enum Shape {\n    Square(u32),\n    Rectangle(u32, u32),\n    Triangle { base: u32, height: u32 },\n}\n\nfn area(shape: &Shape) -> u32 {\n    match shape {\n        Shape::Square(side) => side * side,\n        Shape::Rectangle(width, height) => width * height,\n        Shape::Triangle { base, height } => base * height / 2,\n    }\n}\n\nfn main() {\n    let shapes = [("square", Shape::Square(3)), ("rectangle", Shape::Rectangle(2, 4)), ("triangle", Shape::Triangle { base: 4, height: 3 })];\n    for (name, shape) in &shapes {\n        println!("{name}: {}", area(shape));\n    }\n}\n',
      'Add up the valid scores': 'fn parse_score(text: &str) -> Result<u32, String> {\n    text.parse::<u32>().map_err(|error| error.to_string())\n}\n\nfn main() {\n    let mut total = 0;\n    for text in ["10", "abc", "20"] {\n        match parse_score(text) {\n            Ok(score) => total += score,\n            Err(_) => println!("skipped: {text}"),\n        }\n    }\n    println!("total: {total}");\n}\n',
    }
    for (const [title, solution] of Object.entries(solutions)) {
      await page.getByRole('tab', { name: 'Practice' }).click()
      await page.getByRole('button', { name: new RegExp(title) }).click()
      await page.getByRole('button', { name: 'Start challenge' }).click()
      await runAndWait(page, /Finished|Did not compile/)
      await expect(page.locator('.lab-challenge-result')).toContainText('Not yet')
      await setSource(page, solution)
      await runAndWait(page, /Finished/)
      await expect(page.locator('.lab-challenge-result')).toContainText('Challenge passed')
    }
  })
})
