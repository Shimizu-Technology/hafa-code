import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

// Compare serial and parallel selection without launching any servers.
function inventory(serial) {
  const result = spawnSync(process.execPath, ['node_modules/playwright/cli.js', 'test', '--list', '--reporter=json'], {
    encoding: 'utf8',
    env: { ...process.env, CI: '1', E2E_BROWSER: 'chromium', E2E_SERIAL_CI: serial ? '1' : '' },
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  const report = JSON.parse(result.stdout)
  assert.deepEqual(report.errors, [])
  const identities = []
  function visit(suite, parents = []) {
    const titles = [...parents, suite.title]
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        const project = test.projectName === 'chromium-anonymous' ? 'chromium' : test.projectName
        identities.push(JSON.stringify([project, spec.file, ...titles, spec.title]))
      }
    }
    for (const child of suite.suites ?? []) visit(child, titles)
  }
  for (const suite of report.suites) visit(suite)
  assert.equal(new Set(identities).size, identities.length, 'Each test must be selected exactly once')
  return identities.sort()
}

const before = inventory(true)
const after = inventory(false)
assert.ok(before.length > 0)
assert.deepEqual(after, before, 'Parallel CI must preserve every serial test exactly once')
console.log(`Coverage verified: ${before.length} serial = ${after.length} parallel tests; no omissions or duplicates`)
