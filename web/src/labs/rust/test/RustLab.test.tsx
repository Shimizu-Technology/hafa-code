import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixtures from './rustcDiagnostics.fixture.json'
import type { LabReadiness } from '../capability'
import { MAX_PROJECTS, MAX_SOURCE_BYTES, RUST_LAB_STORAGE_KEY } from '../storage'

const harness = vi.hoisted(() => ({
  readiness: { status: 'ready', warnings: [] } as LabReadiness,
  cacheState: 'none' as 'none' | 'complete',
  loads: 0,
  compileResult: { wasm: new ArrayBuffer(8) as ArrayBuffer | null, diagnostics: '', durationMs: 420, crashed: false },
  programOutput: 'Hafa adai, Ana!\n',
  removed: 0,
}))

vi.mock('../capability', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../capability')>()),
  readEnvironment: () => ({}),
  assessEnvironment: () => harness.readiness,
}))

vi.mock('../toolchain', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../toolchain')>()),
  toolchainCacheState: async () => harness.cacheState,
  removeToolchainDownload: async () => { harness.removed += 1; harness.cacheState = 'none'; return true },
}))

vi.mock('../rustLabClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../rustLabClient')>()
  class FakeToolchain {
    loaded = false
    async load(onProgress: (progress: { phase: 'downloading'; loadedBytes: number; totalBytes: number }) => void) {
      harness.loads += 1
      onProgress({ phase: 'downloading', loadedBytes: 1_000_000, totalBytes: 38_700_000 })
      this.loaded = true
      return { fromCache: false, durationMs: 1234 }
    }
    async compile() { return { ...harness.compileResult } }
    dispose() { this.loaded = false }
  }
  return {
    ...actual,
    RustToolchain: FakeToolchain,
    runProgram: (_wasm: ArrayBuffer, _stdin: string, onOutput: (stream: 'stdout', text: string) => void) => {
      onOutput('stdout', harness.programOutput)
      return { done: Promise.resolve({ exitCode: 0, panicked: false, outputLimited: false, timedOut: false, stopped: false, durationMs: 3 }), stop: () => {} }
    },
  }
})

vi.mock('../RustEditor', () => ({
  RustEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Rust code" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))

const { RustLab } = await import('../RustLab')

afterEach(cleanup)

beforeEach(() => {
  harness.readiness = { status: 'ready', warnings: [] }
  harness.cacheState = 'none'
  harness.loads = 0
  harness.removed = 0
  harness.compileResult = { wasm: new ArrayBuffer(8), diagnostics: '', durationMs: 420, crashed: false }
  harness.programOutput = 'Hafa adai, Ana!\n'
})

describe('Rust Lab page', () => {
  it('explains an unsupported browser without offering a download', () => {
    harness.readiness = { status: 'unsupported', reasons: ['cross-origin isolation for this page'] }
    render(<RustLab />)
    expect(screen.getByRole('heading', { name: 'This browser cannot run the Rust Lab' })).toBeTruthy()
    expect(screen.getByText('cross-origin isolation for this page')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /open the lab anyway/i })).toBeNull()
  })

  it('gates phones and tablets but lets a learner continue on purpose', async () => {
    harness.readiness = { status: 'small-device', reasons: ['This looks like a phone or tablet.'] }
    render(<RustLab />)
    expect(screen.getByRole('heading', { name: 'The Rust Lab is for desktop browsers' })).toBeTruthy()
    expect(screen.getByText(/Nothing was downloaded/)).toBeTruthy()
    expect(harness.loads).toBe(0)
    await userEvent.click(screen.getByRole('button', { name: 'Open the lab anyway' }))
    expect(screen.getByRole('button', { name: /^Run$/ })).toBeTruthy()
    expect(harness.loads).toBe(0)
  })

  it('asks before downloading the measured compiler, then compiles and runs', async () => {
    render(<RustLab />)
    expect(screen.getByText(/one-time 38\.7 MB download/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /^Run$/ }))
    expect(harness.loads).toBe(0)
    const consent = screen.getByRole('button', { name: /Download and run/ })
    expect(screen.getByText(/One-time download of 38\.7 MB/)).toBeTruthy()
    await userEvent.click(consent)
    expect(await screen.findByText(/compiled in 0\.4 s/)).toBeTruthy()
    expect(harness.loads).toBe(1)
    expect(screen.getByText('Hafa adai, Ana!')).toBeTruthy()
    expect(screen.getByText(/rustc 1\.83\.0-dev ready/)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /^Run$/ }))
    expect(await screen.findByText(/compiled in 0\.4 s/)).toBeTruthy()
    expect(harness.loads).toBe(1)
  })

  it('starts a saved compiler without asking again and can remove it', async () => {
    harness.cacheState = 'complete'
    render(<RustLab />)
    await userEvent.click(await screen.findByRole('button', { name: /Remove download/ }))
    expect(harness.removed).toBe(1)
    expect(await screen.findByRole('button', { name: /Download compiler/ })).toBeTruthy()
  })

  it('shows rustc errors with their codes and coaching', async () => {
    harness.cacheState = 'complete'
    harness.compileResult = { wasm: null, diagnostics: fixtures.e0382.stderr, durationMs: 150, crashed: false }
    render(<RustLab />)
    await userEvent.click(screen.getByRole('button', { name: /^Run$/ }))
    await waitFor(() => expect(screen.getByText(/Did not compile/)).toBeTruthy())
    const coach = screen.getByRole('region', { name: /A value was used after it moved/ })
    expect(within(coach).getByText('E0382')).toBeTruthy()
    expect(within(coach).getByText('line 4:')).toBeTruthy()
    expect(screen.getByLabelText('rustc output').textContent).toContain('error[E0382]: borrow of moved value: `s`')
    await userEvent.click(within(coach).getByRole('button', { name: /Guide: Ownership and moves/ }))
    expect(screen.getByRole('button', { name: /Ownership and moves/, expanded: true })).toBeTruthy()
  })

  it('passes a challenge when the output matches and remembers it', async () => {
    harness.cacheState = 'complete'
    harness.programOutput = 'Hello, Ana!\nAna has 3 letters\n'
    render(<RustLab />)
    await userEvent.click(screen.getByRole('tab', { name: 'Practice' }))
    await userEvent.click(screen.getByRole('button', { name: /Keep the name/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Start challenge' }))
    expect((screen.getByRole('textbox', { name: 'Rust code' }) as HTMLTextAreaElement).value).toContain('fn greet(name: String)')
    await userEvent.click(screen.getByRole('button', { name: /^Run$/ }))
    await waitFor(() => expect(screen.getByText(/Challenge passed:/)).toBeTruthy())
    const saved = JSON.parse(localStorage.getItem(RUST_LAB_STORAGE_KEY)!)
    expect(saved.completedChallenges).toEqual(['rust-ownership'])
    expect(saved.projects[0]).toMatchObject({ title: 'Challenge: Keep the name', challengeId: 'rust-ownership' })
  })

  it('keeps edits in this browser across reloads', async () => {
    const first = render(<RustLab />)
    const editor = screen.getByRole('textbox', { name: 'Rust code' })
    await userEvent.clear(editor)
    await userEvent.type(editor, 'fn main() {{}')
    first.unmount()
    render(<RustLab />)
    expect((screen.getByRole('textbox', { name: 'Rust code' }) as HTMLTextAreaElement).value).toBe('fn main() {}')
  })

  it('keeps the last version that fits when an edit makes main.rs too large', async () => {
    render(<RustLab />)
    const editor = screen.getByRole('textbox', { name: 'Rust code' }) as HTMLTextAreaElement
    const before = editor.value
    fireEvent.change(editor, { target: { value: 'x'.repeat(MAX_SOURCE_BYTES + 1) } })
    expect(await screen.findByText(/main\.rs is limited to 200 KB/)).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'Rust code' }) as HTMLTextAreaElement).value).toBe(before)
    expect(JSON.parse(localStorage.getItem(RUST_LAB_STORAGE_KEY)!).projects[0].source).toBe(before)
  })

  it('stops adding projects at the limit and says why', async () => {
    localStorage.setItem(RUST_LAB_STORAGE_KEY, JSON.stringify({
      activeProjectId: 'p0',
      projects: Array.from({ length: MAX_PROJECTS }, (_, index) => ({ id: `p${index}`, title: `Project ${index}`, source: 'fn main() {}', stdin: '' })),
      completedChallenges: [],
    }))
    render(<RustLab />)
    await userEvent.click(screen.getByRole('button', { name: 'New' }))
    expect(screen.getByText(`The Rust Lab keeps up to ${MAX_PROJECTS} projects. Delete one to add another.`)).toBeTruthy()
    expect(JSON.parse(localStorage.getItem(RUST_LAB_STORAGE_KEY)!).projects).toHaveLength(MAX_PROJECTS)
  })

  it('imports a .rs file as a new project', async () => {
    render(<RustLab />)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await act(async () => {
      // jsdom's File cannot read its contents, so hand the page a file-shaped object.
      const file = { name: 'imported.rs', size: 36, text: async () => 'fn main() { println!("imported"); }' }
      fireEvent.change(input, { target: { files: [file] } })
    })
    expect(await screen.findByText(/Imported "imported\.rs"\./)).toBeTruthy()
    const select = screen.getByRole('combobox', { name: 'Project' }) as HTMLSelectElement
    expect(select.selectedOptions[0].textContent).toBe('imported')
  })
})
