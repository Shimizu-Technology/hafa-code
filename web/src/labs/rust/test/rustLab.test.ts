import { describe, expect, it } from 'vitest'
import fixtures from './rustcDiagnostics.fixture.json'
import { assessEnvironment, type LabEnvironment } from '../capability'
import { RUST_CHALLENGES, outputMatches } from '../challenges'
import { rustcArguments } from '../compileOptions'
import { parseDiagnostics } from '../diagnostics'
import { coachCompileError, coachPanic } from '../errorCoach'
import { RUST_GUIDE } from '../guide'
import {
  MAX_PROJECTS, MAX_SOURCE_BYTES, ProjectImportError, RUST_LAB_STORAGE_KEY, cleanTitle, createProject, exportProject, importProject, loadState, saveState,
} from '../storage'
import { TOOLCHAIN, TOOLCHAIN_DOWNLOAD_BYTES, chunkUrl, formatMegabytes } from '../toolchain'
import { readTar } from '../workers/tar'
import { CHUNK_BYTES, PINNED_FILES, TOOLCHAIN_ASSET_DIRECTORY, chunkFileName } from '../../../../scripts/rustToolchain.mjs'

const fixture = fixtures as Record<string, { source: string; stderr: string }>

describe('rustc diagnostics', () => {
  it.each([
    ['e0382', 'E0382', 4, 'A value was used after it moved', 'ownership'],
    ['e0502', 'E0502', 4, 'A borrow overlaps a change', 'borrowing'],
    ['e0499', 'E0499', 4, 'Two mutable borrows at the same time', 'borrowing'],
    ['e0308', 'E0308', 2, 'The types do not match', 'variables'],
    ['e0384', 'E0384', 3, 'An immutable variable was assigned twice', 'variables'],
  ] as const)('keeps %s visible and coaches it', (name, code, line, title, topic) => {
    const parsed = parseDiagnostics(fixture[name].stderr)
    expect(parsed.errorCount).toBe(1)
    expect(parsed.rendered).toContain(`error[${code}]`)
    expect(parsed.rendered).toContain('main.rs:')
    expect(parsed.rendered).not.toContain('/main.rs')
    expect(parsed.diagnostics.find((diagnostic) => diagnostic.level === 'error')).toMatchObject({ code })
    const coaching = coachCompileError(parsed.diagnostics)
    expect(coaching).toMatchObject({ code, title, topic, location: `line ${line}`, docsUrl: `https://doc.rust-lang.org/error_codes/${code}.html` })
    expect(coaching?.steps.length).toBeGreaterThanOrEqual(2)
  })

  it('names the mismatch rustc found', () => {
    const coaching = coachCompileError(parseDiagnostics(fixture.e0308.stderr).diagnostics)
    expect(coaching?.detail).toBe('expected `i32`, found `&str`')
  })

  it('drops rustc summary lines from the error list but keeps them in the transcript', () => {
    const parsed = parseDiagnostics(fixture.e0382.stderr)
    expect(parsed.diagnostics.map((diagnostic) => diagnostic.message)).toEqual(['borrow of moved value: `s`'])
    expect(parsed.rendered).toContain('aborting due to 1 previous error')
  })

  it('counts warnings without coaching them as errors', () => {
    const parsed = parseDiagnostics(fixture.warning.stderr)
    expect(parsed).toMatchObject({ errorCount: 0, warningCount: 1 })
    expect(coachCompileError(parsed.diagnostics)).toBeNull()
  })

  it('keeps output that is not JSON, such as a compiler crash', () => {
    const parsed = parseDiagnostics("thread 'main' panicked at compiler/rustc_driver/src/lib.rs:1:1\nunreachable")
    expect(parsed.diagnostics).toEqual([])
    expect(parsed.rendered).toContain('panicked')
  })

  it('does not point at line 0 for errors that are not at a place in the file', () => {
    const line = JSON.stringify({ $message_type: 'diagnostic', message: '`main` function not found in crate `main`', code: { code: 'E0601' }, level: 'error', spans: [{ file_name: '/main.rs', line_start: 0, line_end: 0, column_start: 1, column_end: 1, is_primary: true, label: null }], rendered: 'error[E0601]: `main` function not found in crate `main`\n' })
    const parsed = parseDiagnostics(line)
    expect(parsed.diagnostics[0].spans).toEqual([])
    expect(coachCompileError(parsed.diagnostics)).toMatchObject({ code: 'E0601', location: null })
  })

  it('gives general help for an error code without a coach entry', () => {
    const coaching = coachCompileError([{ level: 'error', message: 'cannot find value `x` in this scope', code: 'E0425', rendered: '', spans: [{ line: 3, column: 5, endLine: 3, endColumn: 6, label: 'not found in this scope', primary: true }] }])
    expect(coaching).toMatchObject({ code: 'E0425', title: 'Cannot find value `x` in this scope', location: 'line 3', topic: null })
  })

  it('explains a runtime panic', () => {
    const coaching = coachPanic("thread 'main' panicked at main.rs:4:20:\nindex out of bounds: the len is 0 but the index is 3\nnote: run with `RUST_BACKTRACE=1`")
    expect(coaching).toMatchObject({ title: 'An index was past the end of a list', location: 'line 4', detail: 'index out of bounds: the len is 0 but the index is 3', topic: 'results' })
    expect(coachPanic('just some stderr')).toBeNull()
  })
})

describe('Rust Lab content', () => {
  it('has five guide topics with complete programs', () => {
    expect(RUST_GUIDE.map((topic) => topic.id)).toEqual(['variables', 'ownership', 'borrowing', 'structs', 'results'])
    for (const topic of RUST_GUIDE) expect(topic.example).toContain('fn main()')
  })

  it('has five challenges whose starters do not already pass', () => {
    expect(RUST_CHALLENGES).toHaveLength(5)
    expect(new Set(RUST_CHALLENGES.map((challenge) => challenge.id)).size).toBe(5)
    for (const challenge of RUST_CHALLENGES) {
      expect(challenge.starter).toContain('fn main()')
      expect(challenge.expectedOutput.trim()).not.toBe('')
      expect(RUST_GUIDE.some((topic) => topic.id === challenge.topic)).toBe(true)
    }
  })

  it('compares output without caring about trailing whitespace', () => {
    expect(outputMatches('3\n2\n1\nLiftoff!\n', '3\n2\n1\nLiftoff!')).toBe(true)
    expect(outputMatches('3  \r\n2\n1\nLiftoff!\n\n', '3\n2\n1\nLiftoff!')).toBe(true)
    expect(outputMatches('3\n2\nLiftoff!', '3\n2\n1\nLiftoff!')).toBe(false)
    expect(outputMatches('  3\n2\n1\nLiftoff!', '3\n2\n1\nLiftoff!')).toBe(false)
  })
})

describe('Rust Lab projects', () => {
  const memory = () => {
    const values = new Map<string, string>()
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, values }
  }

  it('starts with the starter project and round-trips through storage', () => {
    const storage = memory()
    const state = loadState(storage)
    expect(state.projects).toHaveLength(1)
    expect(state.projects[0].source).toContain('fn main()')
    expect(saveState({ ...state, completedChallenges: ['rust-greeting'] }, storage)).toBe(true)
    expect(loadState(storage)).toMatchObject({ activeProjectId: state.activeProjectId, completedChallenges: ['rust-greeting'] })
  })

  it('drops invalid, duplicate, and oversized projects from storage', () => {
    const storage = memory()
    const keep = createProject({ title: 'Keep' })
    storage.setItem(RUST_LAB_STORAGE_KEY, JSON.stringify({
      activeProjectId: 'missing',
      projects: [keep, keep, { title: 'no source' }, { ...createProject(), source: 'x'.repeat(MAX_SOURCE_BYTES + 1) }, ...Array.from({ length: MAX_PROJECTS + 5 }, () => createProject())],
      completedChallenges: ['rust-greeting', 42, '<script>'],
    }))
    const state = loadState(storage)
    expect(state.projects[0].id).toBe(keep.id)
    expect(state.projects).toHaveLength(MAX_PROJECTS)
    expect(state.activeProjectId).toBe(keep.id)
    expect(state.completedChallenges).toEqual(['rust-greeting'])
  })

  it('falls back to a fresh project when storage is corrupt or unavailable', () => {
    expect(loadState({ getItem: () => '{not json' }).projects).toHaveLength(1)
    expect(loadState({ getItem: () => { throw new Error('blocked') } }).projects).toHaveLength(1)
    expect(saveState(loadState(memory()), { setItem: () => { throw new Error('full') } })).toBe(false)
  })

  it('exports and imports a project as a new copy', () => {
    const project = createProject({ title: 'Borrowing practice', source: 'fn main() {}\n', stdin: 'Ana\n' })
    const imported = importProject('borrowing-practice.hafa-rust.json', exportProject(project))
    expect(imported).toMatchObject({ title: 'Borrowing practice', source: 'fn main() {}\n', stdin: 'Ana\n' })
    expect(imported.id).not.toBe(project.id)
  })

  it('imports a plain .rs file', () => {
    expect(importProject('ownership.rs', 'fn main() { println!("hi"); }')).toMatchObject({ title: 'ownership', source: 'fn main() { println!("hi"); }' })
  })

  it('rejects files that are not Rust Lab projects', () => {
    expect(() => importProject('notes.json', '{"format":"something-else","version":1}')).toThrow(ProjectImportError)
    expect(() => importProject('notes.txt', 'hello')).toThrow(ProjectImportError)
    expect(() => importProject('big.rs', 'x'.repeat(MAX_SOURCE_BYTES + 1))).toThrow(ProjectImportError)
    expect(() => importProject('p.json', JSON.stringify({ format: 'hafa-code-rust-lab-project', version: 1, project: { title: 'x' } }))).toThrow(ProjectImportError)
  })

  it('cleans titles', () => {
    expect(cleanTitle('  My\u0000  program\n ')).toBe('My program')
    expect(cleanTitle('   ')).toBe('Untitled Rust program')
    expect(cleanTitle('x'.repeat(200))).toHaveLength(80)
  })
})

describe('Rust Lab device check', () => {
  const desktop: LabEnvironment = {
    crossOriginIsolated: true, sharedArrayBuffer: true, atomics: true, webAssembly: true, workers: true,
    coarsePointer: false, viewportWidth: 1280, deviceMemoryGb: 8,
  }

  it('allows an isolated desktop browser', () => {
    expect(assessEnvironment(desktop)).toEqual({ status: 'ready', warnings: [] })
  })

  it('refuses a page without cross-origin isolation before downloading anything', () => {
    expect(assessEnvironment({ ...desktop, crossOriginIsolated: false, sharedArrayBuffer: false })).toEqual({
      status: 'unsupported',
      reasons: ['SharedArrayBuffer and Atomics', 'cross-origin isolation for this page'],
    })
  })

  it.each([
    [{ coarsePointer: true, viewportWidth: 390 }, 2],
    [{ coarsePointer: true, viewportWidth: 1024 }, 1],
    [{ viewportWidth: 768 }, 1],
  ])('explains that phones, tablets, and narrow windows are not supported (%o)', (overrides, count) => {
    const result = assessEnvironment({ ...desktop, ...overrides })
    expect(result.status).toBe('small-device')
    expect(result.status === 'small-device' && result.reasons).toHaveLength(count)
  })

  it('warns about low memory', () => {
    const result = assessEnvironment({ ...desktop, deviceMemoryGb: 2 })
    expect(result.status === 'ready' && result.warnings[0]).toContain('2 GB')
  })
})

describe('Rust Lab toolchain pinning', () => {
  it('matches the build script that publishes the chunks', () => {
    const manifestFiles = TOOLCHAIN.assets.map((asset) => ({ name: asset.name, file: asset.file, sha256: asset.sha256 }))
    expect(manifestFiles).toEqual(PINNED_FILES)
    expect(TOOLCHAIN.chunkBytes).toBe(CHUNK_BYTES)
    for (const asset of TOOLCHAIN.assets) {
      expect(asset.chunks.reduce((total, chunk) => total + chunk.bytes, 0)).toBe(asset.bytes)
      for (const chunk of asset.chunks) {
        expect(chunk.bytes).toBeLessThanOrEqual(CHUNK_BYTES)
        expect(chunkUrl(chunk)).toBe(`/${TOOLCHAIN_ASSET_DIRECTORY}/${chunkFileName(chunk.sha256)}`)
      }
    }
  })

  it('reports the measured download size', () => {
    expect(formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)).toBe('38.7 MB')
  })

  it('compiles one edition-2021 file to wasm32-wasip1 with JSON diagnostics', () => {
    const args = rustcArguments()
    expect(args).toEqual(expect.arrayContaining(['/main.rs', '--edition', '2021', '--target', 'wasm32-wasip1', '--error-format', 'json']))
    expect(args.join(' ')).toContain('--sysroot /sysroot')
  })
})

describe('toolchain archive reader', () => {
  const header = (name: string, size: number, type = '0') => {
    const block = new Uint8Array(512)
    block.set(new TextEncoder().encode(name))
    block.set(new TextEncoder().encode(`${size.toString(8).padStart(11, '0')}\0`), 124)
    block[156] = type.charCodeAt(0)
    return block
  }
  const pad = (bytes: Uint8Array) => {
    const out = new Uint8Array(Math.ceil(bytes.length / 512) * 512)
    out.set(bytes)
    return out
  }
  const streamOf = (bytes: Uint8Array, split: number) => new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += split) controller.enqueue(bytes.subarray(offset, offset + split))
      controller.close()
    },
  })

  it('reads files, directories, and GNU long names across stream chunk boundaries', async () => {
    const longName = `self-contained/${'a'.repeat(120)}.o`
    const parts = [
      header('libstd.rlib', 5), pad(new TextEncoder().encode('hello')),
      header('self-contained/', 0, '5'),
      header('././@LongLink', longName.length + 1, 'L'), pad(new TextEncoder().encode(`${longName}\0`)),
      header('ignored-short-name', 3), pad(new TextEncoder().encode('abc')),
      new Uint8Array(1024),
    ]
    const archive = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
    let offset = 0
    for (const part of parts) {
      archive.set(part, offset)
      offset += part.length
    }
    const entries: Array<{ name: string; type: string; text: string }> = []
    await readTar(streamOf(archive, 97), ({ name, type, data }) => entries.push({ name, type, text: new TextDecoder().decode(data) }))
    expect(entries).toEqual([
      { name: 'libstd.rlib', type: '0', text: 'hello' },
      { name: 'self-contained/', type: '5', text: '' },
      { name: longName, type: '0', text: 'abc' },
    ])
  })

  it('rejects a truncated archive', async () => {
    const archive = new Uint8Array(1024)
    archive.set(header('libcore.rlib', 4096))
    await expect(readTar(streamOf(archive, 512), () => {})).rejects.toThrow('ended early')
  })
})
