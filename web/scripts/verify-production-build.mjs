import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const DIST_DIRECTORY = new URL('../dist/', import.meta.url)
const HEADERS_PATH = new URL('_headers', DIST_DIRECTORY)
const ASSETS_DIRECTORY = new URL('assets/', DIST_DIRECTORY)
const PREVIEW_FRAME_PATH = new URL('preview-frame.html', DIST_DIRECTORY)
const SERVICE_WORKER_PATH = new URL('sw.js', DIST_DIRECTORY)
const RUNNER_HEADERS = {
  ruby: '/assets/rubyRunner.worker-*.js',
  javascript: '/assets/javascriptRunner.worker-*.js',
  typescript: '/assets/typescriptRunner.worker-*.js',
  python: '/assets/pythonRunner.worker-*.js',
  java: '/assets/javaRunner.worker-*.js',
}
const JAVA_BOOTSTRAP_HEADER = '/javaRunner.bootstrap.js'
const PYODIDE_RUNTIME_FILES = ['pyodide-lock.json', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip']

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
const previewFrame = await readFile(PREVIEW_FRAME_PATH, 'utf8')
const serviceWorker = await readFile(SERVICE_WORKER_PATH, 'utf8')
const applicationPolicy = headers.get('/*')?.get('content-security-policy')
const rubyRunnerPolicy = headers.get(RUNNER_HEADERS.ruby)?.get('content-security-policy')
const javascriptRunnerPolicy = headers.get(RUNNER_HEADERS.javascript)?.get('content-security-policy')
const typescriptRunnerPolicy = headers.get(RUNNER_HEADERS.typescript)?.get('content-security-policy')
const pythonRunnerPolicy = headers.get(RUNNER_HEADERS.python)?.get('content-security-policy')
const javaRunnerPolicy = headers.get(RUNNER_HEADERS.java)?.get('content-security-policy')
const javaBootstrapPolicy = headers.get(JAVA_BOOTSTRAP_HEADER)?.get('content-security-policy')

assert(applicationPolicy, 'Missing application Content-Security-Policy')
assert(rubyRunnerPolicy, 'Missing Ruby runner worker Content-Security-Policy')
assert(javascriptRunnerPolicy, 'Missing JavaScript runner worker Content-Security-Policy')
assert(typescriptRunnerPolicy, 'Missing TypeScript runner worker Content-Security-Policy')
assert(pythonRunnerPolicy, 'Missing Python runner worker Content-Security-Policy')
assert(javaRunnerPolicy, 'Missing Java runner worker Content-Security-Policy')
assert(javaBootstrapPolicy, 'Missing Java bootstrap worker Content-Security-Policy')
assert.match(
  previewFrame,
  /<iframe\b[^>]*\bsandbox=["']allow-scripts["'][^>]*>/i,
  'Nested web preview must permit scripts and no other sandbox capabilities',
)
assert(!/allow-modals|allow-same-origin|allow-forms|allow-popups|allow-top-navigation/i.test(previewFrame), 'Nested web preview must not regain restricted browser capabilities')

const applicationScripts = directiveSources(applicationPolicy, 'script-src')
const applicationConnections = directiveSources(applicationPolicy, 'connect-src')
const applicationThirdPartyOrigins = new Set(
  [...applicationScripts, ...applicationConnections].filter((source) => source.startsWith('https://')),
)
assert(applicationScripts.includes("'wasm-unsafe-eval'"), 'Application CSP must permit WebAssembly compilation')
assert(!applicationScripts.includes("'unsafe-eval'"), 'Application CSP must not permit JavaScript string evaluation')

const rubyRunnerScripts = directiveSources(rubyRunnerPolicy, 'script-src')
assert(rubyRunnerScripts.includes("'wasm-unsafe-eval'"), 'Ruby runner CSP must permit WebAssembly compilation')
assert(rubyRunnerScripts.includes("'unsafe-eval'"), 'Ruby runner CSP must permit the ruby.wasm JS bridge')
assert.deepEqual(directiveSources(rubyRunnerPolicy, 'connect-src'), ["'self'"])
assert(!rubyRunnerPolicy.includes('clerk'), 'Ruby runner CSP must not inherit application third-party script origins')

const javascriptRunnerScripts = directiveSources(javascriptRunnerPolicy, 'script-src')
assert(javascriptRunnerScripts.includes("'wasm-unsafe-eval'"), 'JavaScript runner CSP must permit WebAssembly compilation')
assert(!javascriptRunnerScripts.includes("'unsafe-eval'"), 'JavaScript runner CSP must not permit JavaScript string evaluation')
assert.deepEqual(directiveSources(javascriptRunnerPolicy, 'connect-src'), ["'self'"])
assert(!javascriptRunnerPolicy.includes('clerk'), 'JavaScript runner CSP must not inherit application third-party script origins')

const typescriptRunnerScripts = directiveSources(typescriptRunnerPolicy, 'script-src')
assert(typescriptRunnerScripts.includes("'wasm-unsafe-eval'"), 'TypeScript runner CSP must permit WebAssembly compilation')
assert(!typescriptRunnerScripts.includes("'unsafe-eval'"), 'TypeScript runner CSP must not permit browser JavaScript string evaluation')
assert.deepEqual(directiveSources(typescriptRunnerPolicy, 'connect-src'), ["'self'"])
assert(!typescriptRunnerPolicy.includes('clerk'), 'TypeScript runner CSP must not inherit application third-party script origins')

const pythonRunnerScripts = directiveSources(pythonRunnerPolicy, 'script-src')
assert(pythonRunnerScripts.includes("'wasm-unsafe-eval'"), 'Python runner CSP must permit WebAssembly compilation')
assert(!pythonRunnerScripts.includes("'unsafe-eval'"), 'Python runner CSP must not permit JavaScript string evaluation')
assert.deepEqual(directiveSources(pythonRunnerPolicy, 'connect-src'), ["'self'"])
assert(!pythonRunnerPolicy.includes('clerk'), 'Python runner CSP must not inherit application third-party script origins')

const javaRunnerScripts = directiveSources(javaRunnerPolicy, 'script-src')
assert(javaRunnerScripts.includes("'wasm-unsafe-eval'"), 'Java runner CSP must permit WebAssembly compilation')
assert(javaRunnerScripts.includes("'unsafe-eval'"), 'Java runner CSP must permit the CheerpJ JavaScript bridge')
assert(javaRunnerScripts.includes('https://cjrtnc.leaningtech.com'), 'Java runner CSP must allow the pinned CheerpJ runtime host')
const javaRunnerConnections = directiveSources(javaRunnerPolicy, 'connect-src')
assert.deepEqual(
  javaRunnerConnections,
  ['https://cjrtnc.leaningtech.com', 'https://javafiddle.leaningtech.com'],
  'Java runner CSP connect-src must allow exactly the CheerpJ and JavaFiddle hosts',
)
for (const applicationOrigin of applicationThirdPartyOrigins) {
  assert(
    ![...javaRunnerScripts, ...javaRunnerConnections].includes(applicationOrigin),
    `Java runner CSP must not inherit application origin ${applicationOrigin}`,
  )
}

const javaBootstrapScripts = directiveSources(javaBootstrapPolicy, 'script-src')
assert(javaBootstrapScripts.includes("'wasm-unsafe-eval'"), 'Java bootstrap CSP must permit WebAssembly compilation')
assert(javaBootstrapScripts.includes("'unsafe-eval'"), 'Java bootstrap CSP must permit the CheerpJ JavaScript bridge')
assert(javaBootstrapScripts.includes('https://cjrtnc.leaningtech.com'), 'Java bootstrap CSP must allow the pinned CheerpJ runtime host')
assert.deepEqual(
  directiveSources(javaBootstrapPolicy, 'connect-src'),
  javaRunnerConnections,
  'Java bootstrap and bundled worker CSPs must allow the same runtime connections',
)

const assetNames = await readdir(ASSETS_DIRECTORY)
for (const [runnerName, headerPath] of Object.entries(RUNNER_HEADERS)) {
  const runnerAssets = assetNames.filter((name) => new RegExp(`^${runnerName}Runner\\.worker-[^.]+\\.js$`).test(name))
  assert.equal(runnerAssets.length, 1, `Expected one ${runnerName} runner worker asset, found ${runnerAssets.length}`)

  const runnerAssetPath = path.posix.join('/assets', runnerAssets[0])
  assert(wildcardPathMatches(headerPath, runnerAssetPath), `${runnerAssetPath} is not covered by ${headerPath}`)
  assert(!serviceWorker.includes(runnerAssetPath), `${runnerAssetPath} must remain lazy and outside the service-worker app shell`)
  console.log(`Verified production CSP coverage for ${runnerAssetPath}`)
}

const pyodideAssets = (await readdir(new URL('pyodide/', ASSETS_DIRECTORY))).sort()
assert.deepEqual(pyodideAssets, PYODIDE_RUNTIME_FILES, 'Expected only the pinned core Pyodide runtime assets')
console.log(`Verified self-hosted Pyodide runtime: ${pyodideAssets.join(', ')}`)

const productionScriptNames = assetNames.filter((name) => name.endsWith('.js'))
const productionScripts = await Promise.all(productionScriptNames.map((name) => readFile(new URL(name, ASSETS_DIRECTORY), 'utf8')))
const productionScriptSource = productionScripts.join('\n')
for (const testOnlyMarker of ['test_token_', 'e2e_user', 'VITE_E2E_AUTH', 'Classroom test session']) {
  assert(!productionScriptSource.includes(testOnlyMarker), `Production JavaScript must not include E2E auth marker: ${testOnlyMarker}`)
}
console.log('Verified classroom E2E authentication code is absent from production JavaScript')
