import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassroomReviewPanel } from './ClassroomReviewPanel'
import { api, type CloudOrgMember, type CloudProjectSummary } from '../lib/api'
import { createProject } from '../lib/projectStorage'

const members: CloudOrgMember[] = [
  { id: 1, membership_id: 11, email: 'teacher@example.com', first_name: 'Tess', last_name: 'Teacher', full_name: 'Tess Teacher', role: 'user', organization_role: 'instructor', joined_at: '2026-09-01T00:00:00Z' },
  { id: 2, membership_id: 12, email: 'ana@example.com', first_name: 'Ana', last_name: 'Student', full_name: 'Ana Student', role: 'user', organization_role: 'student', joined_at: '2026-09-01T00:00:00Z' },
  { id: 3, membership_id: 13, email: 'ben@example.com', first_name: 'Ben', last_name: 'Student', full_name: 'Ben Student', role: 'user', organization_role: 'student', joined_at: '2026-09-01T00:00:00Z' },
]

function summary(overrides: Partial<CloudProjectSummary>): CloudProjectSummary {
  return {
    id: '42',
    title: 'Loop practice',
    kind: 'ruby',
    entryPath: 'main.rb',
    visibility: 'private',
    organizationId: '10',
    owner: { id: 2, fullName: 'Ana Student' },
    organization: { id: 10, name: 'Computer Science', slug: 'computer-science' },
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
    fileCount: 2,
    unresolvedFeedbackCount: 1,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ClassroomReviewPanel', () => {
  it('filters source-free student summaries and requests one student on demand', async () => {
    const user = userEvent.setup()
    const summaries = [
      summary({}),
      summary({ id: '43', title: 'Class website', kind: 'web', visibility: 'organization', owner: { id: 3, fullName: 'Ben Student' }, unresolvedFeedbackCount: 0 }),
      summary({ id: '44', title: 'Archived loops', archivedAt: '2026-09-05T00:00:00Z' }),
      summary({ id: '45', title: 'Teacher notes', owner: { id: 1, fullName: 'Tess Teacher' } }),
    ]
    const getProjects = vi.spyOn(api, 'getOrganizationProjects').mockResolvedValue({ data: summaries, error: null })

    render(<ClassroomReviewPanel organizationId="10" members={members} onOpenProject={vi.fn()} />)

    expect(await screen.findByText('Loop practice')).toBeTruthy()
    expect(screen.getByText('Class website')).toBeTruthy()
    expect(screen.queryByText('Archived loops')).toBeNull()
    expect(screen.queryByText('Teacher notes')).toBeNull()
    expect(screen.getByRole('status').textContent).toMatch(/2 of 3 projects shown/i)

    await user.selectOptions(screen.getByLabelText('Visibility'), 'organization')
    expect(screen.queryByText('Loop practice')).toBeNull()
    expect(screen.getByText('Class website')).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('Student'), '3')
    await waitFor(() => expect(getProjects).toHaveBeenLastCalledWith('10', { studentId: 3 }))
  })

  it('loads full source only when the teacher opens a review', async () => {
    const user = userEvent.setup()
    const projectSummary = summary({})
    const fullProject = {
      ...createProject('ruby'),
      id: projectSummary.id,
      title: projectSummary.title,
      organizationId: '10',
      owner: { id: 2, fullName: 'Ana Student' },
    }
    vi.spyOn(api, 'getOrganizationProjects').mockResolvedValue({ data: [projectSummary], error: null })
    const getProject = vi.spyOn(api, 'getProject').mockResolvedValue({ data: fullProject, error: null })
    const onOpenProject = vi.fn()

    render(<ClassroomReviewPanel organizationId="10" members={members} onOpenProject={onOpenProject} />)
    await screen.findByText('Loop practice')
    const list = screen.getByLabelText('Student projects')
    await user.click(within(list).getByRole('button', { name: 'Open review' }))

    await waitFor(() => expect(getProject).toHaveBeenCalledWith('42'))
    expect(onOpenProject).toHaveBeenCalledWith(fullProject)
  })
})
