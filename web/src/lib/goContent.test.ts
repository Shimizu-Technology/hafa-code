// Content verification for Go: every guide example and every Practice Lab
// reference solution must print exactly its expected output with the real Go
// toolchain, with Hafa Code's engine built natively, and with the browser
// WebAssembly module. Scaffolds must compile, and the checker must report the
// same compiler errors as `go build`. This catches Yaegi drift from real Go.
//
// Run with `npm run verify:go-content` (it builds the native engine first).
import { execFile } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../runtimes/go/dist/wasm_exec.js'
import { runGoModule, type GoProcessConstructor } from '../workers/goRunnerCore'
import { languageGuideFor } from './languageGuides'
import { GO_CHALLENGES } from './practiceChallenges/go'
import { GO_REFERENCE_SOLUTIONS } from './practiceChallenges/goSolutions'

const enabled = process.env.HAFA_VERIFY_GO_CONTENT === '1'
const run = promisify(execFile)
const runtimeDirectory = join(process.cwd(), 'runtimes/go')
const toolchain = /^toolchain\s+(go\S+)$/m.exec(readFileSync(join(runtimeDirectory, 'go.mod'), 'utf8'))?.[1] ?? 'local'
const goEnvironment = { ...process.env, GOTOOLCHAIN: toolchain, GOFLAGS: '', GOWORK: 'off', CGO_ENABLED: '0' }

let workspace = ''
let module: WebAssembly.Module

type Result = { stdout: string; stderr: string; exitCode: number }

function writeProject(name: string, source: string) {
  const directory = mkdtempSync(join(workspace, `${name}-`))
  writeFileSync(join(directory, 'go.mod'), 'module hafa\n\ngo 1.26\n')
  writeFileSync(join(directory, 'main.go'), source)
  return directory
}

async function capture(command: string, args: string[], cwd: string): Promise<Result> {
  try {
    const { stdout, stderr } = await run(command, args, { cwd, env: goEnvironment, timeout: 120_000 })
    return { stdout, stderr, exitCode: 0 }
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; code?: number }
    return { stdout: failure.stdout ?? '', stderr: failure.stderr ?? '', exitCode: typeof failure.code === 'number' ? failure.code : 1 }
  }
}

async function runInBrowserEngine(source: string): Promise<Result> {
  const output = { stdout: '', stderr: '' }
  const outcome = await runGoModule({
    module,
    Go: (globalThis as unknown as { Go: GoProcessConstructor }).Go,
    globals: globalThis as Parameters<typeof runGoModule>[0]['globals'],
    files: [{ path: 'main.go', content: source }],
    write: (stream, text) => { output[stream] += text },
    readLine: async () => null,
    onStarted: () => {},
  })
  if (outcome.kind === 'diagnostics') return { stdout: '', stderr: JSON.stringify(outcome.diagnostics), exitCode: 1 }
  return { ...output, exitCode: outcome.kind === 'exited' ? outcome.exitCode : 2 }
}

async function verifyProgram(name: string, source: string, expectedOutput: string) {
  const directory = writeProject(name, source)
  const [real, native, browser] = await Promise.all([
    capture('go', ['run', '.'], directory),
    capture(join(runtimeDirectory, 'dist/hafago-native'), [directory], directory),
    runInBrowserEngine(source),
  ])
  const expected = `${expectedOutput}\n`
  expect(real, `${name}: real go run`).toMatchObject({ stdout: expected, exitCode: 0 })
  expect(native, `${name}: Hafa engine (native)`).toMatchObject({ stdout: expected, exitCode: 0 })
  expect(browser, `${name}: Hafa engine (WebAssembly)`).toMatchObject({ stdout: expected, exitCode: 0 })
}

/** `go build` prints `# module` and `./file.go:line:col: message`; Hafa prints `file.go:line:col: message`. */
function compilerLines(stderr: string) {
  return stderr.split('\n').filter((line) => /\.go:\d+:\d+: /.test(line)).map((line) => line.replace(/^\.\//, ''))
}

const guidePrograms = languageGuideFor('go').topics.map((topic) => [topic.id, topic.code, topic.expectedOutput] as const)
const challengePrograms = GO_CHALLENGES.map((challenge) => [challenge.id, GO_REFERENCE_SOLUTIONS[challenge.id], challenge.expectedOutput ?? ''] as const)

const compileErrors = [
  ['unused variable', 'package main\n\nfunc main() {\n\tx := 5\n}\n'],
  ['unused import', 'package main\n\nimport (\n\t"fmt"\n\t"strings"\n)\n\nfunc main() {\n\tfmt.Println("hi")\n}\n'],
  ['missing return', 'package main\n\nfunc sign(n int) int {\n\tif n > 0 {\n\t\treturn 1\n\t}\n}\n\nfunc main() { sign(1) }\n'],
  ['type mismatch and undefined name', 'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar n int = "five"\n\tfmt.Println(n, missing)\n}\n'],
  ['unknown field', 'package main\n\nimport "fmt"\n\ntype Learner struct{ Name string }\n\nfunc main() {\n\tkai := Learner{Name: "Kai"}\n\tfmt.Println(kai.Nme)\n}\n'],
  ['else on its own line', 'package main\n\nimport "fmt"\n\nfunc main() {\n\tif true {\n\t\tfmt.Println("yes")\n\t}\n\telse {\n\t\tfmt.Println("no")\n\t}\n}\n'],
  ['missing brace', 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfor i := 0; i < 3; i++ {\n\t\tfmt.Println(i)\n}\n'],
  ['unclosed call', 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hi"\n}\n'],
  ['unbalanced condition', 'package main\n\nimport "fmt"\n\nfunc main() {\n\tscore := 3\n\tif (score > 2 {\n\t\tfmt.Println(score)\n\t}\n}\n'],
] as const

describe.skipIf(!enabled)('Go content verification', () => {
  beforeAll(async () => {
    workspace = mkdtempSync(join(tmpdir(), 'hafa-go-content-'))
    module = await WebAssembly.compile(readFileSync(join(runtimeDirectory, 'dist/hafago.wasm')))
  }, 120_000)

  afterAll(() => {
    if (workspace) rmSync(workspace, { recursive: true, force: true })
  })

  it.each(guidePrograms)('runs the %s guide example identically in Go and Hafa Code', async (name, source, expectedOutput) => {
    await verifyProgram(name, source, expectedOutput)
  }, 120_000)

  it.each(challengePrograms)('runs the %s reference solution identically in Go and Hafa Code', async (name, source, expectedOutput) => {
    await verifyProgram(name, source, expectedOutput)
  }, 120_000)

  it.each(GO_CHALLENGES.map((challenge) => [challenge.id, challenge.project.files[0].content] as const))('starts %s from a scaffold that compiles and runs', async (name, source) => {
    const directory = writeProject(`${name}-scaffold`, source)
    const [real, native] = await Promise.all([
      capture('go', ['run', '.'], directory),
      capture(join(runtimeDirectory, 'dist/hafago-native'), [directory], directory),
    ])
    expect(real.exitCode, `${name}: go run ${real.stderr}`).toBe(0)
    expect(native.exitCode, `${name}: Hafa engine ${native.stderr}`).toBe(0)
    expect(native.stdout).toBe(real.stdout)
  }, 120_000)

  it.each(compileErrors)('reports the same %s compiler errors as go build', async (name, source) => {
    const directory = writeProject(name.replaceAll(' ', '-'), source)
    const [real, native] = await Promise.all([
      capture('go', ['build', '-o', join(directory, 'program'), '.'], directory),
      capture(join(runtimeDirectory, 'dist/hafago-native'), [directory], directory),
    ])
    expect(real.exitCode).not.toBe(0)
    expect(native.exitCode).toBe(1)
    expect(compilerLines(native.stderr)).toEqual(compilerLines(real.stderr))
  }, 120_000)
})
