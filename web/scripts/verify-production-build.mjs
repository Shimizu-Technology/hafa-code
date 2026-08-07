import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const DIST_DIRECTORY = new URL('../dist/', import.meta.url)
const HEADERS_PATH = new URL('_headers', DIST_DIRECTORY)
const ASSETS_DIRECTORY = new URL('assets/', DIST_DIRECTORY)
const RUNNER_HEADER_PATH = '/assets/codeRunner.worker-*.js'

function parseHeaderRules(source) {
  const rules = new Map()
  let currentPath = null

  source.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    if (!/^\s/.test(line)) {
      currentPath = trimmed
      rules.set(currentPath, new Map())
      return
    }

    assert(currentPath, `Header appears before a path rule: ${trimmed}`)
    const separator = trimmed.indexOf(':')
    assert(separator > 0, `Invalid header line: ${trimmed}`)
    const name = trimmed.slice(0, separator).trim().toLowerCase()
    const value = trimmed.slice(separator + 1).trim()
    rules.get(currentPath).set(name, value)
  })

  return rules
}

function directiveSources(policy, directiveName) {
  const directive = policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === directiveName || part.startsWith(`${directiveName} `))

  assert(directive, `Missing ${directiveName} directive`)
  return directive.split(/\s+/).slice(1)
}

function wildcardPathMatches(pattern, candidate) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')
  return new RegExp(`^${escaped}$`).test(candidate)
}

const headers = parseHeaderRules(await readFile(HEADERS_PATH, 'utf8'))
const applicationPolicy = headers.get('/*')?.get('content-security-policy')
const runnerPolicy = headers.get(RUNNER_HEADER_PATH)?.get('content-security-policy')

assert(applicationPolicy, 'Missing application Content-Security-Policy')
assert(runnerPolicy, 'Missing code runner worker Content-Security-Policy')

const applicationScripts = directiveSources(applicationPolicy, 'script-src')
assert(applicationScripts.includes("'wasm-unsafe-eval'"), 'Application CSP must permit WebAssembly compilation')
assert(!applicationScripts.includes("'unsafe-eval'"), 'Application CSP must not permit JavaScript string evaluation')

const runnerScripts = directiveSources(runnerPolicy, 'script-src')
assert(runnerScripts.includes("'wasm-unsafe-eval'"), 'Runner CSP must permit WebAssembly compilation')
assert(runnerScripts.includes("'unsafe-eval'"), 'Runner CSP must permit the ruby.wasm JS bridge')
assert.deepEqual(directiveSources(runnerPolicy, 'connect-src'), ["'self'"])
assert(!runnerPolicy.includes('clerk'), 'Runner CSP must not inherit application third-party script origins')

const assetNames = await readdir(ASSETS_DIRECTORY)
const runnerAssets = assetNames.filter((name) => /^codeRunner\.worker-[^.]+\.js$/.test(name))
assert.equal(runnerAssets.length, 1, `Expected one code runner worker asset, found ${runnerAssets.length}`)

const runnerAssetPath = path.posix.join('/assets', runnerAssets[0])
assert(
  wildcardPathMatches(RUNNER_HEADER_PATH, runnerAssetPath),
  `${runnerAssetPath} is not covered by ${RUNNER_HEADER_PATH}`,
)

console.log(`Verified production CSP coverage for ${runnerAssetPath}`)
