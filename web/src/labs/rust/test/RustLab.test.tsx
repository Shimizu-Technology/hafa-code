import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixtures from './rustcDiagnostics.fixture.json'
import type { LabReadiness } from '../capability'
import { MAX_INPUT_BYTES, MAX_PROJECTS, MAX_SOURCE_BYTES, RUST_LAB_STORAGE_KEY } from '../storage'

const harness = vi.hoisted(() => ({
  readiness: { status: 'ready', warnings: [] } as LabReadiness,
  cacheState: 'none' as 'none' | 'complete',
  loads: 0,
  compileResult: { wasm: new ArrayBuffer(8) as ArrayBuffer | null, diagnostics: '', durationMs: 420, crashed: false },
  programOutput: 'Hafa adai, Ana!\n',
  removed: 0,
  /** When true, a load waits until dispose() stops it, like a slow download. */
  holdLoads: false,
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
    private stopLoad: ((error: Error) => void) | null = null
    async load(onProgress: (progress: { phase: 'downloading'; loadedBytes: number; totalBytes: number }) => void) {
      harness.loads += 1
      onProgress({ phase: 'downloading', loadedBytes: 1_000_000, totalBytes: 38_700_000 })
      if (harness.holdLoads) await new Promise((_resolve, reject) => { this.stopLoad = reject })
      this.loaded = true
      return { fromCache: false, durationMs: 1234 }
    }
    async compile() { return { ...harness.compileResult } }
    // Like RustToolchain.dispose(): a load in progress is settled as stopped.
    dispose() {
      this.loaded = false
      this.stopLoad?.(new actual.ToolchainError(actual.STOPPED_MESSAGE))
      this.stopLoad = null
    }
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

/** The Output panel's Run button (the phone Code tab has its own, hidden by CSS on larger screens). */
const runButton = () => within(screen.getByRole('region', { name: 'Output' })).getByRole('button', { name: /^Run$/ })

afterEach(cleanup)

beforeEach(() => {
  // jsdom has no matchMedia: a desktop window under 1600px (the learning sidecar opens as a drawer).
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  harness.readiness = { status: 'ready', warnings: [] }
  harness.cacheState = 'none'
  harness.loads = 0
  harness.removed = 0
  harness.compileResult = { wasm: new ArrayBuffer(8), diagnostics: '', durationMs: 420, crashed: false }
  harness.programOutput = 'Hafa adai, Ana!\n'
  harness.holdLoads = false
})

describe('Rust Lab page', () => {
  it('explains an unsupported browser without offering a download, and still opens the editor and guide', async () => {
    harness.readiness = { status: 'unsupported', reasons: ['cross-origin isolation for this page'] }
    render(<RustLab />)
    expect(screen.getByRole('heading', { name: 'This browser cannot run Rust yet' })).toBeTruthy()
    expect(screen.getByText('cross-origin isolation for this page')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Rust code' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Run$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Try running on this device/ })).toBeNull()
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Learning tools' })).getByRole('button', { name: 'Rust guide' }))
    expect(screen.getByRole('heading', { name: 'println! and variables' })).toBeTruthy()
  })

  it('shows phones and tablets the real lab with a desktop-only run state, and runs only when asked', async () => {
    harness.readiness = { status: 'small-device', reasons: ['This looks like a phone or tablet.'] }
    render(<RustLab />)
    expect(screen.getByRole('heading', { name: 'Running Rust needs a desktop browser' })).toBeTruthy()
    expect(screen.getByText(/Nothing was downloaded/)).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Rust code' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Run$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Download/ })).toBeNull()
    // Ctrl/Cmd+Enter does not start anything either.
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    await userEvent.click(screen.getByRole('button', { name: /Run on a computer/ }))
    expect(harness.loads).toBe(0)
    await userEvent.click(screen.getByRole('button', { name: 'Try running on this device' }))
    await userEvent.click(runButton())
    expect(screen.getByRole('button', { name: /Download and run/ })).toBeTruthy()
    expect(harness.loads).toBe(0)
  })

  it('asks before downloading the measured compiler, then compiles and runs', async () => {
    render(<RustLab />)
    expect(screen.getByText(/one-time 38\.7 MB download/)).toBeTruthy()
    await userEvent.click(runButton())
    expect(harness.loads).toBe(0)
    const consent = screen.getByRole('button', { name: /Download and run/ })
    expect(screen.getByText(/One-time download of 38\.7 MB/)).toBeTruthy()
    await userEvent.click(consent)
    expect(await screen.findByText(/compiled in 0\.4 s/)).toBeTruthy()
    expect(harness.loads).toBe(1)
    expect(screen.getByText('Hafa adai, Ana!')).toBeTruthy()
    expect(document.querySelector('.lab-status')?.textContent).toBe('Finished')

    await userEvent.click(runButton())
    expect(await screen.findByText(/compiled in 0\.4 s/)).toBeTruthy()
    expect(harness.loads).toBe(1)
  })

  it.each(['Stop', 'Cancel'])('lets a learner run again after %s ends the compiler download', async (button) => {
    harness.holdLoads = true
    render(<RustLab />)
    await userEvent.click(runButton())
    await userEvent.click(screen.getByRole('button', { name: /Download and run/ }))
    expect(await screen.findByText(/Downloading the compiler/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: button }))
    expect(await screen.findByRole('button', { name: /Download compiler/ })).toBeTruthy()

    harness.holdLoads = false
    await userEvent.click(runButton())
    await userEvent.click(await screen.findByRole('button', { name: /Download and run/ }))
    expect(await screen.findByText(/compiled in 0\.4 s/)).toBeTruthy()
    expect(harness.loads).toBe(2)
  })

  it('starts a saved compiler without asking again and can remove it', async () => {
    harness.cacheState = 'complete'
    render(<RustLab />)
    expect(await screen.findByText(/The compiler is saved in this browser/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Lab and display settings' }))
    await userEvent.click(await screen.findByRole('button', { name: /Remove download/ }))
    expect(harness.removed).toBe(1)
    expect(await screen.findByRole('button', { name: /Download compiler/ })).toBeTruthy()
  })

  it('shows rustc errors with their codes and coaching', async () => {
    harness.cacheState = 'complete'
    harness.compileResult = { wasm: null, diagnostics: fixtures.e0382.stderr, durationMs: 150, crashed: false }
    render(<RustLab />)
    await userEvent.click(runButton())
    await waitFor(() => expect(screen.getByText(/Did not compile/)).toBeTruthy())
    expect(screen.getByLabelText('rustc output').textContent).toContain('error[E0382]: borrow of moved value: `s`')
    expect(within(screen.getByRole('list', { name: 'Compile errors' })).getByRole('button', { name: /Line 4.*E0382/ })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Fix this error' }))
    const coach = screen.getByRole('region', { name: /A value was used after it moved/ })
    expect(within(coach).getByText('E0382')).toBeTruthy()
    expect(within(coach).getByText(/line 4/)).toBeTruthy()
    await userEvent.click(within(coach).getByRole('button', { name: /Guide: Ownership and moves/ }))
    expect(screen.getByRole('heading', { name: 'Ownership and moves' })).toBeTruthy()
  })

  it('passes a challenge when the output matches and remembers it', async () => {
    harness.cacheState = 'complete'
    harness.programOutput = 'Hello, Ana!\nAna has 3 letters\n'
    render(<RustLab />)
    await userEvent.click(screen.getByRole('button', { name: 'Practice' }))
    const card = screen.getByRole('article', { name: 'Keep the name' })
    await userEvent.click(within(card).getByRole('button', { name: /Start challenge/ }))
    expect((screen.getByRole('textbox', { name: 'Rust code' }) as HTMLTextAreaElement).value).toContain('fn greet(name: String)')
    await userEvent.click(runButton())
    await waitFor(() => expect(screen.getByText(/Challenge passed:/)).toBeTruthy())
    expect(screen.getByText(/Challenge passed:/).closest('.lab-challenge-strip')).toBeTruthy()
    const saved = JSON.parse(localStorage.getItem(RUST_LAB_STORAGE_KEY)!)
    expect(saved.completedChallenges).toEqual(['rust-ownership'])
    expect(saved.projects[0]).toMatchObject({ title: 'Challenge: Keep the name', challengeId: 'rust-ownership' })
  })

  it('uses the workspace Theme and Color-safe preferences and follows changes from another tab', () => {
    localStorage.setItem('hafa-code-theme-v1', 'dark')
    render(<RustLab />)
    const root = document.documentElement
    expect(root.dataset.theme).toBe('dark')
    expect(root.dataset.colorMode).toBe('default')

    localStorage.setItem('hafa-code-theme-v1', 'light')
    localStorage.setItem('hafa-code-color-mode-v1', 'colorblind')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'hafa-code-theme-v1', newValue: 'light' }))
      window.dispatchEvent(new StorageEvent('storage', { key: 'hafa-code-color-mode-v1', newValue: 'colorblind' }))
    })
    expect(root.dataset.theme).toBe('light')
    expect(root.dataset.colorMode).toBe('colorblind')

    localStorage.setItem('hafa-code-theme-v1', 'dark')
    localStorage.removeItem('hafa-code-color-mode-v1')
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: null })) })
    expect(root.dataset.theme).toBe('dark')
    expect(root.dataset.colorMode).toBe('default')
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

  it('warns as soon as a save fails after the page opened, and clears the warning when saving works again', async () => {
    render(<RustLab />)
    expect(screen.queryByText(/not saving Rust Lab projects/)).toBeNull()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })
    try {
      fireEvent.change(screen.getByRole('textbox', { name: 'Rust code' }), { target: { value: 'fn main() { println!("1"); }' } })
      expect(await screen.findByText(/not saving Rust Lab projects/)).toBeTruthy()
    } finally {
      setItem.mockRestore()
    }
    fireEvent.change(screen.getByRole('textbox', { name: 'Rust code' }), { target: { value: 'fn main() { println!("2"); }' } })
    await waitFor(() => expect(screen.queryByText(/not saving Rust Lab projects/)).toBeNull())
    expect(JSON.parse(localStorage.getItem(RUST_LAB_STORAGE_KEY)!).projects[0].source).toBe('fn main() { println!("2"); }')
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

  it('limits program input by bytes so non-ASCII input survives a reload', async () => {
    const first = render(<RustLab />)
    await userEvent.click(screen.getByText(/Program input \(stdin\)/))
    const input = screen.getByLabelText(/Text your program reads/) as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'Håfa adai é\n' } })
    fireEvent.change(input, { target: { value: 'é'.repeat(MAX_INPUT_BYTES / 2 + 1) } })
    expect(await screen.findByText(/Program input is limited to 20 KB/)).toBeTruthy()
    first.unmount()
    render(<RustLab />)
    expect(JSON.parse(localStorage.getItem(RUST_LAB_STORAGE_KEY)!).projects[0].stdin).toBe('Håfa adai é\n')
  })

  it('stops adding projects at the limit and says why', async () => {
    localStorage.setItem(RUST_LAB_STORAGE_KEY, JSON.stringify({
      activeProjectId: 'p0',
      projects: Array.from({ length: MAX_PROJECTS }, (_, index) => ({ id: `p${index}`, title: `Project ${index}`, source: 'fn main() {}', stdin: '' })),
      completedChallenges: [],
    }))
    render(<RustLab />)
    await userEvent.click(screen.getAllByRole('button', { name: 'New' })[0])
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
    expect((screen.getAllByLabelText('Project name')[0] as HTMLInputElement).value).toBe('imported')
    expect(screen.getAllByRole('button', { name: /^imported/ })[0].getAttribute('aria-current')).toBe('true')
  })
})
