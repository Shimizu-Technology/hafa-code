import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LearningSidecar } from './LearningSidecar'

afterEach(cleanup)

const baseProps = {
  activeTab: 'guide' as const,
  coachContext: null,
  completedChallengeIds: [],
  guideKind: 'java' as const,
  guideNavigationRevision: 0,
  guideTopicId: null,
  kind: 'java' as const,
  open: true,
  onActiveTabChange: vi.fn(),
  onClose: vi.fn(),
  onOpenGuideTopic: vi.fn(),
  onStartChallenge: vi.fn(),
  onTryExample: vi.fn(),
}

describe('LearningSidecar', () => {
  it('keeps the current language guide docked with accessible learning tabs', async () => {
    const user = userEvent.setup()
    const onActiveTabChange = vi.fn()
    render(<LearningSidecar {...baseProps} onActiveTabChange={onActiveTabChange} />)

    expect(screen.getByRole('complementary', { name: 'Java learning' })).toBeTruthy()
    expect(screen.getByRole('tabpanel', { name: 'Java guide' })).toBeTruthy()
    const guideTab = screen.getByRole('tab', { name: 'Guide' })
    guideTab.focus()
    await user.keyboard('{ArrowRight}')
    expect(onActiveTabChange).toHaveBeenCalledWith('practice')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Practice' }))
  })

  it('shows contextual coach advice and routes its reference link inside the sidecar', async () => {
    const user = userEvent.setup()
    const onOpenGuideTopic = vi.fn()
    render(<LearningSidecar
      {...baseProps}
      activeTab="coach"
      coachContext={{
        kind: 'java',
        advice: {
          title: 'Java cannot find that name',
          explanation: 'The compiler cannot see it.',
          location: 'Main.java · line 4',
          steps: ['Check spelling.', 'Declare the name.', 'Run again.'],
          guideTopicId: 'java-variables-types',
        },
      }}
      onOpenGuideTopic={onOpenGuideTopic}
    />)

    expect(screen.getByRole('tabpanel', { name: 'Error coach' })).toBeTruthy()
    expect(screen.getByText('Main.java · line 4')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Review Variables and types' }))
    expect(onOpenGuideTopic).toHaveBeenCalledWith('java-variables-types', 'java')
  })

  it('opens retained Coach guidance in its originating language', async () => {
    const user = userEvent.setup()
    const onOpenGuideTopic = vi.fn()
    const coachContext = {
      kind: 'java' as const,
      advice: {
        title: 'Java cannot find that name',
        explanation: 'The compiler cannot see it.',
        location: 'Main.java · line 4',
        steps: ['Check spelling.', 'Declare the name.', 'Run again.'],
        guideTopicId: 'java-variables-types',
      },
    }
    const view = render(<LearningSidecar
      {...baseProps}
      activeTab="coach"
      coachContext={coachContext}
      guideKind="ruby"
      kind="ruby"
      onOpenGuideTopic={onOpenGuideTopic}
    />)

    expect(screen.getByRole('complementary', { name: 'Java learning' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Review Variables and types' }))
    expect(onOpenGuideTopic).toHaveBeenCalledWith('java-variables-types', 'java')

    view.rerender(<LearningSidecar
      {...baseProps}
      activeTab="guide"
      coachContext={coachContext}
      guideKind="java"
      guideNavigationRevision={1}
      guideTopicId="java-variables-types"
      kind="ruby"
      onOpenGuideTopic={onOpenGuideTopic}
    />)
    expect(screen.getByRole('heading', { name: 'Variables and types' })).toBeTruthy()
  })

  it('returns to a requested guide topic even after local guide navigation', async () => {
    const user = userEvent.setup()
    const view = render(<LearningSidecar
      {...baseProps}
      guideNavigationRevision={1}
      guideTopicId="java-output-comments"
    />)

    await user.click(screen.getByRole('button', { name: /Strings/ }))
    expect(screen.getByRole('heading', { name: 'Strings' })).toBeTruthy()

    view.rerender(<LearningSidecar
      {...baseProps}
      guideNavigationRevision={2}
      guideTopicId="java-output-comments"
    />)
    expect(screen.getByRole('heading', { name: 'Output and comments' })).toBeTruthy()
  })

  it('becomes a dismissible modal drawer at compact widths', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const mediaQuery = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mediaQuery), configurable: true })

    render(<LearningSidecar {...baseProps} onClose={onClose} />)

    expect(screen.getByRole('dialog', { name: 'Java learning' })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
