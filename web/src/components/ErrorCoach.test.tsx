import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ErrorCoach } from './ErrorCoach'

it('shows actionable advice and opens the matching guide topic', async () => {
  const user = userEvent.setup()
  const onOpenGuideTopic = vi.fn()
  render(<ErrorCoach kind="java" onOpenGuideTopic={onOpenGuideTopic} advice={{
    title: 'Java cannot find that name',
    explanation: 'The compiler cannot see it.',
    location: 'Main.java · line 4',
    steps: ['Check spelling.', 'Declare the name.', 'Run again.'],
    guideTopicId: 'java-variables-types',
  }} />)

  expect(screen.getByRole('complementary', { name: 'Error coach' })).toBeTruthy()
  expect(screen.getByText('Main.java · line 4')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Review Variables and types' }))
  expect(onOpenGuideTopic).toHaveBeenCalledWith('java-variables-types')
})
