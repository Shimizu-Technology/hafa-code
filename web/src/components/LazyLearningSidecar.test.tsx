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
    LearningSidecar: ({ open, entered }: LearningSidecarProps) => (open ? <aside aria-label="Loaded sidecar" data-entered={String(Boolean(entered))} /> : null),
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

  it('downloads nothing while closed, shows a skeleton on first open, then the content without a second entrance', async () => {
    const { LazyLearningSidecar } = await import('./LazyLearningSidecar')
    const closed = props({ open: false })
    const { rerender } = render(<LazyLearningSidecar {...closed} />)
    expect(document.body.textContent).toBe('')

    const opened = props()
    rerender(<LazyLearningSidecar {...opened} />)
    expect(screen.getByRole('status').textContent).toContain('Loading the Python guide')
    expect(screen.getByRole('complementary', { name: 'Python learning' }).getAttribute('aria-busy')).toBe('true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(opened.onClose).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.learning-sidecar-backdrop')).toBeTruthy()

    await act(async () => chunk.release())
    expect(screen.getByLabelText('Loaded sidecar').dataset.entered).toBe('true')

    rerender(<LazyLearningSidecar {...props({ open: false })} />)
    rerender(<LazyLearningSidecar {...props()} />)
    expect(screen.getByLabelText('Loaded sidecar').dataset.entered).toBe('false')
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
    expect(screen.getByRole('status')).toBeTruthy()
    expect(document.querySelector('.learning-sidecar-backdrop')).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(docked.onClose).not.toHaveBeenCalled()
  })
})
