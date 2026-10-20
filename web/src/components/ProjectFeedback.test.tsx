import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
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

function usePhoneViewport() {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
}

const files = [{ path: 'main.rb', language: 'ruby' as const, content: '3.times { puts :hafa }' }]

describe('ProjectFeedback', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

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

  test('on a phone, an empty thread stays one row until the learner opens it', async () => {
    usePhoneViewport()
    vi.mocked(api.getProjectComments).mockResolvedValue({ data: { comments: [], unread_count: 0 }, error: null })
    const user = userEvent.setup()
    const { container } = render(<ProjectFeedback projectId="42" currentUserId={4} files={files} />)

    expect(await screen.findByText('No feedback yet. Start a focused project conversation here.')).toBeTruthy()
    const disclosure = container.querySelector('details.project-feedback')!
    expect(disclosure.hasAttribute('open')).toBe(false)
    expect(screen.getByText('0 open')).toBeTruthy()

    await user.click(screen.getByRole('heading', { name: 'Teacher feedback' }))
    await waitFor(() => expect(disclosure.hasAttribute('open')).toBe(true))
    expect(screen.getByLabelText(/Add feedback or reply/)).toBeTruthy()
  })

  test('on a phone, feedback from a teacher opens the thread by itself', async () => {
    usePhoneViewport()
    const { container } = render(<ProjectFeedback projectId="42" currentUserId={4} files={files} />)

    expect(await screen.findByText('Explain why this loop stops.')).toBeTruthy()
    await waitFor(() => expect(container.querySelector('details.project-feedback')!.hasAttribute('open')).toBe(true))
    expect(screen.getByText('1 open')).toBeTruthy()
  })
})
