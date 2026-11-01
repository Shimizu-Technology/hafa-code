#!/usr/bin/env node
// Builds the browser Go runner (runtimes/go) into runtimes/go/dist:
//   hafago.wasm   the type checker + Yaegi interpreter, GOOS=js GOARCH=wasm
//   wasm_exec.js  the JavaScript support file from the same Go toolchain
// With --native it also builds dist/hafago-native, the same engine for this
// machine, which scripts/verify-go-content.mjs compares with the real `go run`.
//
// The toolchain is pinned by the `toolchain` line in runtimes/go/go.mod and
// enforced with GOTOOLCHAIN, so any installed Go 1.21+ downloads and uses
// exactly that release (verified by the Go checksum database). Unchanged
// inputs skip the build.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..')
const MODULE_DIRECTORY = join(WEB_DIRECTORY, 'runtimes', 'go')
const DIST_DIRECTORY = join(MODULE_DIRECTORY, 'dist')
const BUILD_DIRECTORY = join(MODULE_DIRECTORY, '.build')
const STAMP_PATH = join(DIST_DIRECTORY, 'build-stamp.json')
const GENERATED = [/^symbols\/zz_.*\.go$/, /^stdexport\/data\//, /^gcsyntax\//, /^\.build\//, /^dist\//]

const native = process.argv.includes('--native')
const toolchain = /^toolchain\s+(go\S+)$/m.exec(readFileSync(join(MODULE_DIRECTORY, 'go.mod'), 'utf8'))?.[1]
if (!toolchain) fail('runtimes/go/go.mod must pin a `toolchain goX.Y.Z` line.')

function fail(message) {
  console.error(`\nHafa Code's Go runtime could not be built.\n${message}\n`)
  process.exit(1)
}

const environment = {
  ...process.env,
  GOTOOLCHAIN: toolchain,
  GOFLAGS: '-mod=readonly',
  CGO_ENABLED: '0',
  GOWORK: 'off',
}

function go(args, extraEnvironment = {}) {
  return execFileSync('go', args, {
    cwd: MODULE_DIRECTORY,
    env: { ...environment, ...extraEnvironment },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim()
}

let installedVersion
try {
  installedVersion = execFileSync('go', ['env', 'GOVERSION'], { encoding: 'utf8', env: { ...process.env, GOTOOLCHAIN: 'local' } }).trim()
} catch {
  fail('Install Go 1.21 or newer (https://go.dev/dl/) and make sure `go` is on PATH. The build then downloads the pinned toolchain itself.')
}
const [, major, minor] = /^go(\d+)\.(\d+)/.exec(installedVersion) ?? []
if (!major || Number(major) < 1 || (Number(major) === 1 && Number(minor) < 21)) {
  fail(`Found ${installedVersion}. Go 1.21 or newer is required to download the pinned ${toolchain} toolchain.`)
}

function sourceFiles(directory = MODULE_DIRECTORY) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    const name = relative(MODULE_DIRECTORY, path).split('\\').join('/')
    if (GENERATED.some((pattern) => pattern.test(entry.isDirectory() ? `${name}/` : name))) return []
    return entry.isDirectory() ? sourceFiles(path) : [name]
  }).sort()
}

const inputHash = (() => {
  const hash = createHash('sha256').update(toolchain).update('\0').update(readFileSync(fileURLToPath(import.meta.url)))
  for (const name of sourceFiles()) hash.update('\0').update(name).update('\0').update(readFileSync(join(MODULE_DIRECTORY, name)))
  return hash.digest('hex')
})()

const outputs = ['hafago.wasm', 'wasm_exec.js', ...(native ? ['hafago-native'] : [])]
const stamp = existsSync(STAMP_PATH) ? JSON.parse(readFileSync(STAMP_PATH, 'utf8')) : null
if (stamp?.inputHash === inputHash && outputs.every((name) => existsSync(join(DIST_DIRECTORY, name)) && (stamp.outputs ?? []).includes(name))) {
  console.log(`Go runtime is up to date (${toolchain}).`)
  process.exit(0)
}

const startedAt = Date.now()
console.log(`Building the Go runtime with ${toolchain}…`)
mkdirSync(BUILD_DIRECTORY, { recursive: true })
mkdirSync(DIST_DIRECTORY, { recursive: true })

try {
  const hafagen = join(BUILD_DIRECTORY, process.platform === 'win32' ? 'hafagen.exe' : 'hafagen')
  go(['build', '-o', hafagen, './cmd/hafagen'])
  execFileSync(hafagen, [], { cwd: MODULE_DIRECTORY, env: { ...environment, GOOS: 'js', GOARCH: 'wasm' }, stdio: 'inherit' })

  const reproducible = ['-modfile', join('.build', 'go.mod'), '-trimpath', '-buildvcs=false', '-ldflags=-s -w']
  go(['build', ...reproducible, '-o', join(DIST_DIRECTORY, 'hafago.wasm'), './cmd/hafago'], { GOOS: 'js', GOARCH: 'wasm' })
  copyFileSync(join(go(['env', 'GOROOT']), 'lib', 'wasm', 'wasm_exec.js'), join(DIST_DIRECTORY, 'wasm_exec.js'))
  if (native) go(['build', ...reproducible, '-o', join(DIST_DIRECTORY, 'hafago-native'), './cmd/hafago-native'])
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

writeFileSync(STAMP_PATH, `${JSON.stringify({ toolchain, inputHash, outputs }, null, 2)}\n`)
const wasmBytes = readFileSync(join(DIST_DIRECTORY, 'hafago.wasm')).byteLength
console.log(`Built the Go runtime in ${((Date.now() - startedAt) / 1000).toFixed(1)}s (${(wasmBytes / 1024 / 1024).toFixed(1)} MiB WebAssembly).`)
