import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LearningSidecarProps } from './LearningSidecar'

const chunk = vi.hoisted(() => ({
  fail: false,
  release: () => {},
  gate: Promise.resolve(),
}))

async function sidecarFactory() {
  await chunk.gate
  if (chunk.fail) throw new Error('chunk failed')
  return {
    LearningSidecar: ({ open, entered, returnFocusTo }: LearningSidecarProps) => (open ? <aside aria-label="Loaded sidecar" data-entered={String(Boolean(entered))} data-return-focus={returnFocusTo?.textContent ?? ''} /> : null),
  }
}
vi.mock('./LearningSidecar', sidecarFactory)

function props(overrides: Partial<LearningSidecarProps> = {}): LearningSidecarProps {
  return {
    activeTab: 'guide',
    coachContext: null,
    completedChallengeIds: [],
    guideKind: 'python',
    guideNavigationRevision: 0,
    guideTopicId: null,
    kind: 'python',
    open: true,
    onActiveTabChange: vi.fn(),
    onClose: vi.fn(),
    onOpenGuideTopic: vi.fn(),
    onStartChallenge: vi.fn(),
    onTryExample: vi.fn(),
    ...overrides,
  }
}

function setOverlay(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({ matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
}

describe('LazyLearningSidecar', () => {
  beforeEach(() => {
    setOverlay(true)
    vi.resetModules()
    chunk.fail = false
    chunk.gate = new Promise<void>((resolve) => { chunk.release = resolve })
  })

  afterEach(() => {
    cleanup()
    vi.doMock('./LearningSidecar', sidecarFactory)
  })

  it('downloads nothing while closed, shows a skeleton dialog on first open, then the content without a second entrance', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    const { LazyLearningSidecar } = await import('./LazyLearningSidecar')
    const opener = document.createElement('button')
    opener.textContent = 'Python guide'
    document.body.append(opener)
    opener.focus()
    const closed = props({ open: false })
    const { rerender } = render(<LazyLearningSidecar {...closed} />)
    expect(screen.queryByRole('dialog')).toBeNull()

    const opened = props()
    rerender(<LazyLearningSidecar {...opened} />)
    expect(screen.getByRole('status').textContent).toContain('Loading the Python guide')
    const dialog = screen.getByRole('dialog', { name: 'Python learning' })
    expect(dialog.getAttribute('aria-busy')).toBe('true')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close learning sidecar' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(opened.onClose).toHaveBeenCalledTimes(1)

    await act(async () => chunk.release())
    const loaded = screen.getByLabelText('Loaded sidecar')
    expect(loaded.dataset.entered).toBe('true')
    // The skeleton held focus, so the loaded panel is told which control opened it.
    expect(loaded.dataset.returnFocus).toBe('Python guide')

    rerender(<LazyLearningSidecar {...props({ open: false })} />)
    rerender(<LazyLearningSidecar {...props()} />)
    expect(screen.getByLabelText('Loaded sidecar').dataset.entered).toBe('false')
    opener.remove()
    vi.mocked(window.requestAnimationFrame).mockRestore()
  })

  it('offers Try again when the chunk cannot load', async () => {
    chunk.fail = true
    vi.doMock('./LearningSidecar', sidecarFactory)
    const { LazyLearningSidecar } = await import('./LazyLearningSidecar')
    render(<LazyLearningSidecar {...props({ activeTab: 'practice' })} />)
    expect(screen.getByRole('status').textContent).toContain('Loading the practice lab')
    await act(async () => chunk.release())
    expect(screen.getByRole('alert').textContent).toContain('could not load')

    chunk.fail = false
    vi.doMock('./LearningSidecar', sidecarFactory)
    await act(async () => screen.getByRole('button', { name: 'Try again' }).click())
    expect(await screen.findByLabelText('Loaded sidecar')).toBeTruthy()
  })

  it('leaves Escape to the editor when docked as a column, like the loaded sidecar', async () => {
    setOverlay(false)
    const { LazyLearningSidecar } = await import('./LazyLearningSidecar')
    const docked = props()
    render(<LazyLearningSidecar {...docked} />)
    expect(screen.getByRole('complementary', { name: 'Python learning' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(docked.onClose).not.toHaveBeenCalled()
  })
})
