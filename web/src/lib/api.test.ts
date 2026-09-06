import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, setAuthTokenGetter } from './api'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function projectPayload(id: number) {
  return {
    id,
    title: `Project ${id}`,
    kind: 'ruby',
    entry_path: 'main.rb',
    visibility: 'private',
    organization_id: 20,
    archived_at: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    lock_version: 0,
    files: [{ path: 'main.rb', language: 'ruby', content: `puts ${id}`, position: 0 }],
  }
}

function summaryPayload(id: number) {
  return {
    id,
    title: `Student project ${id}`,
    kind: 'ruby',
    entry_path: 'main.rb',
    visibility: 'private',
    organization_id: 20,
    owner: { id: 8, full_name: 'Ana Student' },
    organization: { id: 20, name: 'Robotics', slug: 'robotics' },
    archived_at: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    file_count: 1,
    unresolved_feedback_count: 0,
  }
}

afterEach(() => {
  setAuthTokenGetter(async () => null)
  vi.unstubAllGlobals()
})

describe('API authentication failures', () => {
  it('returns the normal error result when the token provider rejects', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    setAuthTokenGetter(async () => {
      throw new Error('Session token unavailable')
    })

    await expect(api.getInvitation('test-invite')).resolves.toEqual({
      data: null,
      error: 'Session token unavailable',
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('paginated project APIs', () => {
  it('requests owned projects and accumulates every page', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ projects: [projectPayload(1)], pagination: { page: 1, total_pages: 2 } }))
      .mockResolvedValueOnce(jsonResponse({ projects: [projectPayload(2)], pagination: { page: 2, total_pages: 2 } }))
    vi.stubGlobal('fetch', fetchSpy)

    const result = await api.getProjects('20', { ownedOnly: true })

    expect(result.data?.map((project) => project.id)).toEqual(['1', '2'])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/v1/projects?page=1&per_page=100&organization_id=20&owned_only=true')
    expect(String(fetchSpy.mock.calls[1][0])).toContain('/api/v1/projects?page=2&per_page=100&organization_id=20&owned_only=true')
  })

  it('requests one student and accumulates classroom summary pages', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ projects: [summaryPayload(41)], pagination: { page: 1, total_pages: 2 } }))
      .mockResolvedValueOnce(jsonResponse({ projects: [summaryPayload(42)], pagination: { page: 2, total_pages: 2 } }))
    vi.stubGlobal('fetch', fetchSpy)

    const result = await api.getOrganizationProjects('20', { studentId: 8 })

    expect(result.data?.map((project) => project.id)).toEqual(['41', '42'])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/v1/organizations/20/projects?page=1&per_page=100&student_id=8')
    expect(String(fetchSpy.mock.calls[1][0])).toContain('/api/v1/organizations/20/projects?page=2&per_page=100&student_id=8')
  })

  it('propagates an error from a later classroom summary page', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ projects: [summaryPayload(41)], pagination: { page: 1, total_pages: 2 } }))
      .mockResolvedValueOnce(jsonResponse({ error: 'Page two unavailable' }, 503))
    vi.stubGlobal('fetch', fetchSpy)

    await expect(api.getOrganizationProjects('20', { studentId: 8 })).resolves.toEqual({
      data: null,
      error: 'Page two unavailable',
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
