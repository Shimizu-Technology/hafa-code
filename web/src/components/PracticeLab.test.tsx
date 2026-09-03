import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { practiceChallengeById } from '../lib/practiceLab'
import { PracticeLab } from './PracticeLab'
import { PracticeSessionPanel } from './PracticeSessionPanel'

afterEach(cleanup)

describe('PracticeLab', () => {
  it('opens on the current language and can start a challenge from another language', async () => {
    const user = userEvent.setup()
    const onStartChallenge = vi.fn()
    render(
      <PracticeLab
        completedChallengeIds={['java-variables-greeting']}
        initialKind="java"
        open
        onClose={vi.fn()}
        onStartChallenge={onStartChallenge}
      />,
    )

    expect(screen.getByRole('button', { name: /Java 1\/3/i }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('1 of 3 complete')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Python' }))
    expect(screen.getByText('0 of 3 complete')).toBeTruthy()
    await user.click(screen.getAllByRole('button', { name: 'Start challenge' })[1])

    expect(onStartChallenge).toHaveBeenCalledWith(practiceChallengeById('python-loop-stops'))
  })

  it('searches concepts within the selected language', async () => {
    const user = userEvent.setup()
    render(<PracticeLab completedChallengeIds={[]} initialKind="web" open onClose={vi.fn()} onStartChallenge={vi.fn()} />)

    await user.type(screen.getByRole('searchbox'), 'responsive')
    expect(screen.getByRole('heading', { name: 'Make a responsive grid' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Build a profile card' })).toBeNull()
  })
})

describe('PracticeSessionPanel', () => {
  it('reveals hints progressively and exposes actionable check results', async () => {
    const user = userEvent.setup()
    const onCheck = vi.fn()
    const challenge = practiceChallengeById('ruby-loop-stops')!
    render(
      <PracticeSessionPanel
        challenge={challenge}
        checking={false}
        completed={false}
        result={{
          passed: false,
          checks: [
            { label: 'Use a loop', passed: true },
            { label: 'Output matches “Stop 1 / Stop 2 / Stop 3”', passed: false },
          ],
          expectedOutput: 'Stop 1\nStop 2\nStop 3',
          actualOutput: 'Stop 1',
        }}
        onCheck={onCheck}
        onOpenLab={vi.fn()}
      />,
    )

    expect(screen.queryByText(/inclusive Ruby range/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Show a hint' }))
    expect(screen.getByText(/inclusive Ruby range/i)).toBeTruthy()
    expect(screen.getByText(/Almost there/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Check my work' }))
    expect(onCheck).toHaveBeenCalledOnce()
  })
})
