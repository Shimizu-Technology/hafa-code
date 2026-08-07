import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { api, type CloudProjectComment } from '../lib/api'
import { ProjectFeedback } from './ProjectFeedback'

vi.mock('../lib/api', () => ({
  api: {
    getProjectComments: vi.fn(),
    markProjectCommentsRead: vi.fn(),
    createProjectComment: vi.fn(),
    resolveProjectComment: vi.fn(),
  },
}))

const comment: CloudProjectComment = {
  id: 1,
  body: 'Explain why this loop stops.',
  file_path: 'main.rb',
  line_number: 3,
  resolved_at: null,
  edited_at: null,
  created_at: '2026-07-25T01:00:00.000Z',
  updated_at: '2026-07-25T01:00:00.000Z',
  author: { id: 9, full_name: 'Teacher One', role: 'instructor' },
  resolved_by: null,
}

describe('ProjectFeedback', () => {
  beforeEach(() => {
    vi.mocked(api.getProjectComments).mockResolvedValue({
      data: { comments: [comment], unread_count: 1 },
      error: null,
    })
    vi.mocked(api.markProjectCommentsRead).mockResolvedValue({ data: null, error: null, status: 204 })
    vi.mocked(api.createProjectComment).mockResolvedValue({
      data: { ...comment, id: 2, body: 'I used a counter.', author: { id: 4, full_name: 'Student One', role: 'student' } },
      error: null,
    })
    vi.mocked(api.resolveProjectComment).mockResolvedValue({
      data: { ...comment, resolved_at: '2026-07-25T02:00:00.000Z' },
      error: null,
    })
  })

  test('loads private feedback, posts a line reply, and resolves a thread', async () => {
    const user = userEvent.setup()
    render(
      <ProjectFeedback
        projectId="42"
        currentUserId={4}
        files={[{ path: 'main.rb', language: 'ruby', content: '3.times { puts :hafa }' }]}
      />,
    )

    expect(await screen.findByText('Explain why this loop stops.')).toBeTruthy()
    await waitFor(() => expect(api.markProjectCommentsRead).toHaveBeenCalledWith('42'))

    await user.type(screen.getByLabelText(/Add feedback or reply/), 'I used a counter.')
    await user.selectOptions(screen.getByLabelText('File (optional)'), 'main.rb')
    await user.type(screen.getByLabelText('Line (optional)'), '3')
    await user.click(screen.getByRole('button', { name: 'Post' }))

    await waitFor(() => expect(api.createProjectComment).toHaveBeenCalledWith('42', {
      body: 'I used a counter.',
      file_path: 'main.rb',
      line_number: 3,
    }))
    expect(await screen.findByText('I used a counter.')).toBeTruthy()

    await user.click(screen.getAllByRole('button', { name: 'Resolve' })[0])
    await waitFor(() => expect(api.resolveProjectComment).toHaveBeenCalledWith('42', 1, true))
  })
})
